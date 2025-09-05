import os
import time
from datetime import datetime
from pathlib import Path
import urllib.parse
from typing import Callable, List, Optional
import random
import re
import unicodedata
try:
    import requests  # opcional; usado apenas se APIs forem habilitadas
except Exception:
    requests = None  # segue sem dependência quando não disponível

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    ElementNotInteractableException,
    NoSuchElementException,
    TimeoutException,
)


def default_logger(msg: str) -> None:
    print(msg)


class Bot:
    """Robô simples para abrir páginas e coletar informações.

    - Usa Selenium (Chrome) com Selenium Manager (não precisa baixar driver manualmente em versões recentes).
    - Exponde callbacks de log e progresso para integração com a UI.
    """

    def __init__(self,
                 logger: Callable[[str], None] | None = None,
                 on_progress: Callable[[int], None] | None = None,
                 on_infos_count: Callable[[int], None] | None = None):
        self.logger = logger or default_logger
        self.on_progress = on_progress or (lambda _p: None)
        self.on_infos_count = on_infos_count or (lambda _c: None)
        self.driver_pedidos: Optional[webdriver.Chrome] = None
        self.driver_beleza: Optional[webdriver.Chrome] = None
        # Armazena dados do cliente do pedido atual
        self.current_customer: dict = {}
        self.current_shipping: dict = {}
        self.card_info: dict | None = None
        self.card_line: str | None = None
        self.card_fail_count: int = 0
        self.used_email_suffixes: set[str] = set()
        self.current_product: str | None = None
        self.current_qty: int = 1
        self.abort_current_order: bool = False

        # Cronômetro por pedido/etapa
        self._order_timer_start: float | None = None
        self._stage_start_time: float | None = None
        self._stage_current_name: str | None = None
        self._stage_times: list[tuple[str, float]] = []

        # Tuning de desempenho (ajustáveis por ENV)
        # Perfis padrão: rápido (pode ajustar via ENV se precisar desacelerar)
        self.delay_scale = float(os.environ.get("BOT_DELAY_SCALE", "0.7"))
        self.typing_delay = float(os.environ.get("BOT_TYPING_DELAY", "0.02"))
        self.wait_register_pre = float(os.environ.get("BOT_REGISTER_PRE_CLICK_WAIT", "2"))
        self.wait_register_post = float(os.environ.get("BOT_REGISTER_POST_CLICK_WAIT", "3"))
        self.wait_payment_retry = float(os.environ.get("BOT_PAYMENT_RETRY_WAIT", "4"))
        self.fast_search = os.environ.get("BOT_FAST_SEARCH", "1") == "1"
        self.cep_delay = float(os.environ.get("BOT_CEP_DELAY", "0.06"))
        self.debug_enabled = os.environ.get("BOT_DEBUG", "1") == "1"

        # Arquivos de log
        self._log_fp = None
        self.log_dir = Path(__file__).resolve().parent / 'logs'
        self.log_file_path: Path | None = None

        # URLs padrão podem ser configuradas por variáveis de ambiente
        self.dashboard_url = os.environ.get("DASHBOARD_URL", "http://localhost:5174/dashboard/pedidos")
        self.beleza_url = os.environ.get("BELEZA_URL", "https://www.belezanaweb.com.br/")
        # Mantém navegador aberto ao término? (padrão: sim)
        self.keep_open = os.environ.get("BOT_KEEP_OPEN", "1") == "1"
        # API para salvar/ler anotações (Dashboard) - não usada quando salvamos via UI
        self.api_base = os.environ.get("BOT_API_URL", "http://localhost:3007")
        self.api_user = os.environ.get("BOT_API_USER", "admin")
        self.api_pass = os.environ.get("BOT_API_PASS", "123")
        self._api_token: Optional[str] = None

    # ------------------- Utilidades -------------------
    def _mk_driver(self) -> webdriver.Chrome:
        opts = Options()
        if os.environ.get("BOT_HEADLESS", "0") == "1":
            opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--window-size=1366,900")
        # Minimiza sinais de automação
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_experimental_option("excludeSwitches", ["enable-automation"])  # remove infobar
        opts.add_experimental_option("useAutomationExtension", False)
        # Carregamento de página mais rápido (DOM pronto)
        try:
            opts.set_capability("pageLoadStrategy", "eager")
        except Exception:
            pass
        # Bloqueio de imagens (desativado por padrão)
        if os.environ.get("BOT_BLOCK_IMAGES", "0") == "1":
            try:
                prefs = {
                    "profile.managed_default_content_settings.images": 2,
                    "profile.default_content_setting_values.notifications": 2,
                }
                opts.add_experimental_option("prefs", prefs)
            except Exception:
                pass
        # User-Agent randômico (varia o patch)
        patch = str(100 + int(time.time()) % 50)
        ua = os.environ.get(
            "BOT_UA",
            f"Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.{patch} Safari/537.36"
        )
        opts.add_argument(f"--user-agent={ua}")

        driver = webdriver.Chrome(options=opts)
        try:
            driver.set_page_load_timeout(int(os.environ.get("BOT_PAGELOAD_TIMEOUT", "20")))
        except Exception:
            pass

        # Spoofs adicionais via CDP
        try:
            driver.execute_cdp_cmd("Network.enable", {})
            driver.execute_cdp_cmd("Network.setUserAgentOverride", {"userAgent": ua})
        except Exception:
            pass
        try:
            stealth_js = """
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = window.chrome || { runtime: {} };
            Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR','pt','en-US','en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter){
              if (parameter === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
              if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
              return getParameter.apply(this, arguments);
            };
            const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
            if (originalQuery) {
              window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : originalQuery(parameters)
              );
            }
            """
            driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": stealth_js})
        except Exception:
            pass

        return driver

    def _ensure_log_open(self):
        try:
            self.log_dir.mkdir(parents=True, exist_ok=True)
            if not self._log_fp:
                ts = datetime.now().strftime('%Y%m%d_%H%M%S')
                self.log_file_path = self.log_dir / f'run_{ts}.log'
                self._log_fp = open(self.log_file_path, 'a', encoding='utf-8')
                header = f"=== Dermosul Bot Run {ts} ===\n" \
                         f"DASHBOARD_URL={self.dashboard_url}\n" \
                         f"BELEZA_URL={self.beleza_url}\n" \
                         f"FAST_SEARCH={self.fast_search} DELAY_SCALE={self.delay_scale} TYPING_DELAY={self.typing_delay}\n"
                self._log_fp.write(header)
                self._log_fp.flush()
        except Exception:
            pass

    def _write_file_log(self, msg: str) -> None:
        try:
            self._ensure_log_open()
            if self._log_fp:
                ts = datetime.now().strftime('%H:%M:%S')
                self._log_fp.write(f"[{ts}] {msg}\n")
                self._log_fp.flush()
        except Exception:
            pass

    def _emit_infos_count(self) -> None:
        try:
            path = Path(__file__).resolve().parent / 'infos' / 'infos.txt'
            if path.exists():
                count = sum(1 for ln in path.read_text(encoding='utf-8').splitlines() if ln.strip())
                self.on_infos_count(count)
        except Exception:
            pass

    def _finalize_log(self) -> None:
        try:
            if self._log_fp:
                self._log_fp.flush()
                self._log_fp.close()
                self._log_fp = None
            # copia para last_run.log
            if self.log_file_path and self.log_file_path.exists():
                last = self.log_dir / 'last_run.log'
                try:
                    last.write_text(self.log_file_path.read_text(encoding='utf-8'), encoding='utf-8')
                except Exception:
                    pass
        except Exception:
            pass

    def _log(self, msg: str) -> None:
        # Escreve no arquivo e reenvia ao logger da UI
        self._write_file_log(msg)
        self.logger(msg)

    # ------------------- Notas via UI -------------------
    def _find_notes_section(self):
        if not self.driver_pedidos:
            return None
        d = self.driver_pedidos
        # Tenta aguardar o container com título "Anotações" por alguns segundos
        try:
            WebDriverWait(d, 5).until(
                lambda drv: len(drv.find_elements(By.XPATH, "//h2[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'anotações')]") ) > 0
            )
        except Exception:
            pass
        # Primeiro por heading
        try:
            sec = d.find_element(By.XPATH, "//h2[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'anotações')]/ancestor::div[contains(@class,'border')][1]")
            return sec
        except Exception:
            pass
        # Scroll para o final e tentar novamente
        try:
            d.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(0.3)
            sec = d.find_element(By.XPATH, "//h2[contains(., 'Anota')]/ancestor::div[1]")
            return sec
        except Exception:
            pass
        # Fallback: retorna o body para permitir busca solta
        return d

    def _get_note_text_from_ui(self) -> Optional[str]:
        sec = self._find_notes_section()
        if not sec:
            return None
        try:
            # espera textarea visível dentro da seção
            ta = None
            try:
                ta = WebDriverWait(self.driver_pedidos, 4).until(
                    lambda drv: (sec.find_element(By.XPATH, ".//textarea"))
                )
            except Exception:
                pass
            if not ta:
                # fallback: qualquer textarea na página
                tas = self.driver_pedidos.find_elements(By.TAG_NAME, 'textarea')
                ta = tas[0] if tas else None
            if ta:
                return (ta.get_attribute('value') or ta.text or '').strip()
        except Exception:
            return None

    def _save_note_via_ui(self, text: str) -> bool:
        if not self.driver_pedidos:
            return False
        sec = self._find_notes_section()
        if not sec:
            # tenta rolar para baixo e tentar novamente
            try:
                self.driver_pedidos.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                sec = self._find_notes_section()
            except Exception:
                pass
        if not sec:
            self._log("! Seção 'Anotações' não encontrada para salvar nota.")
            return False
        try:
            # aguarda textarea
            try:
                ta = WebDriverWait(self.driver_pedidos, 5).until(
                    lambda drv: (sec.find_element(By.XPATH, ".//textarea"))
                )
            except Exception:
                ta = sec.find_element(By.XPATH, ".//textarea")
            self.driver_pedidos.execute_script("arguments[0].scrollIntoView({block:'center'});", ta)
            try:
                ta.clear()
            except Exception:
                pass
            ta.send_keys(text)
            # botão salvar
            btn = None
            try:
                btn = sec.find_element(By.XPATH, ".//button[contains(., 'Salvar Anotações')]")
            except Exception:
                pass
            if btn:
                try:
                    btn.click()
                except Exception:
                    self.driver_pedidos.execute_script("arguments[0].click();", btn)
                time.sleep(1.0)
                self._log("✔ Anotação salva no pedido")
                return True
        except Exception as e:
            self._log(f"! Falha ao salvar anotação via UI: {e}")
        return False

    def _should_skip_order_due_to_note(self, order_id: Optional[str]) -> bool:
        # Checa via UI primeiro
        try:
            notes = self._get_note_text_from_ui() or ''
            norm = self._normalize(notes)
            # Log auxiliar para depuração (primeiros 120 chars)
            try:
                snippet = notes[:120].replace('\n', ' ')
                self._log(f"ℹ Anotação lida: {snippet}")
            except Exception:
                pass
            matched = (
                'nao foi possivel validar os dados do seu cartao' in norm or
                'nao foi possivel validar os dados do seu cartao, tente novamente mais tarde' in norm or
                'nao foi possivel validar os dados do seu cartao tente novamente mais tarde' in norm or
                'nao foi possivel validar' in norm and 'cartao' in norm
            )
            if matched:
                # Se houver timestamp, respeita 24h; sem timestamp, pula por segurança
                m = re.search(r"(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})", notes)
                if m:
                    ts = f"{m.group(1)} {m.group(2)}"
                    try:
                        t = datetime.strptime(ts, '%Y-%m-%d %H:%M:%S')
                        hours = (datetime.now() - t).total_seconds() / 3600.0
                        if hours < 24.0:
                            self._log(f"ℹ Anotação de validação encontrada (há {hours:.1f}h). Ignorando pedido.")
                            return True
                        else:
                            self._log(f"ℹ Anotação encontrada, mas com mais de 24h ({hours:.1f}h). Prosseguindo.")
                    except Exception:
                        self._log("ℹ Timestamp da anotação não pôde ser lido. Ignorando por segurança.")
                        return True
                else:
                    self._log("ℹ Anotação presente sem timestamp. Ignorando por segurança.")
                    return True
        except Exception:
            pass
        # Fallback: sem UI, não pula
        return False

    def _focus_notes_and_wait(self, timeout: float = 3.0) -> bool:
        """Tenta rolar a página até o card de Anotações e aguarda o textarea ficar disponível."""
        if not self.driver_pedidos:
            return False
        d = self.driver_pedidos
        try:
            sec = self._find_notes_section()
            if sec:
                try:
                    d.execute_script("arguments[0].scrollIntoView({block:'center'});", sec)
                except Exception:
                    pass
                try:
                    WebDriverWait(d, int(timeout)).until(
                        lambda drv: len(sec.find_elements(By.XPATH, ".//textarea")) > 0
                    )
                except Exception:
                    pass
                return True
        except Exception:
            pass
        return False

    # ------------------- API helpers (Notas) -------------------
    def _api_login(self) -> bool:
        if getattr(self, '_api_token', None):
            return True
        try:
            url = f"{self.api_base}/api/login"
            r = requests.post(url, json={"username": self.api_user, "password": self.api_pass}, timeout=5)
            if r.ok:
                data = r.json()
                tok = data.get('token') or data.get('accessToken')
                if tok:
                    self._api_token = tok
                    return True
        except Exception:
            pass
        return False

    def _api_headers(self) -> dict:
        hdrs = {"Content-Type": "application/json"}
        if getattr(self, '_api_token', None):
            hdrs["Authorization"] = f"Bearer {self._api_token}"
        return hdrs

    def _api_get_notes(self, order_id: Optional[str]) -> Optional[str]:
        if not order_id:
            return None
        if not self._api_login():
            return None
        try:
            url = f"{self.api_base}/api/orders/{urllib.parse.quote(str(order_id))}/notes"
            r = requests.get(url, headers=self._api_headers(), timeout=5)
            if r.ok:
                return (r.json() or {}).get('notes') or ''
        except Exception:
            return None
        return None

    def _api_save_note(self, order_id: Optional[str], text: str) -> bool:
        if not order_id:
            return False
        if not self._api_login():
            return False
        try:
            url = f"{self.api_base}/api/orders/{urllib.parse.quote(str(order_id))}/notes"
            r = requests.patch(url, headers=self._api_headers(), data=json.dumps({"notes": text}), timeout=5)
            return bool(r.ok)
        except Exception:
            return False

    def _now_str(self) -> str:
        try:
            return datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            return str(datetime.now())

    def _should_skip_order_due_to_note(self, order_id: Optional[str]) -> bool:
        try:
            notes = self._api_get_notes(order_id) or ''
            norm = self._normalize(notes)
            if 'nao foi possivel validar os dados do seu cartao' in norm or 'não foi possível validar os dados do seu cartão' in notes.lower():
                m = re.search(r"(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})", notes)
                if m:
                    ts = f"{m.group(1)} {m.group(2)}"
                    try:
                        t = datetime.strptime(ts, '%Y-%m-%d %H:%M:%S')
                        delta = datetime.now() - t
                        if delta.total_seconds() < 24*3600:
                            return True
                    except Exception:
                        return True
                else:
                    return True
        except Exception:
            return False
        return False

    def _progress(self, value: int) -> None:
        value = max(0, min(100, int(value)))
        self.on_progress(value)

    def _sleep(self, seconds: float) -> None:
        try:
            time.sleep(max(0.0, seconds) * max(0.1, self.delay_scale))
        except Exception:
            pass

    # ------------------- Cronômetro -------------------
    def _timer_start_order(self) -> None:
        self._order_timer_start = time.time()
        self._stage_times = []
        self._stage_start_time = None
        self._stage_current_name = None
        try:
            self._log("⏱ Início do pedido (cronômetro iniciado)")
        except Exception:
            pass

    def _timer_end_order(self, success: bool) -> None:
        if self._order_timer_start is None:
            return
        total = time.time() - self._order_timer_start
        # Finaliza etapa em aberto
        if self._stage_current_name and self._stage_start_time:
            self._stage_times.append((self._stage_current_name, time.time() - self._stage_start_time))
        status = "concluído" if success else "finalizado (sem sucesso)"
        try:
            self._log(f"⏱ Pedido {status} em {total:.1f}s")
            for name, secs in self._stage_times:
                self._log(f"  ⏱ Etapa '{name}': {secs:.1f}s")
        except Exception:
            pass
        # Reset
        self._order_timer_start = None
        self._stage_times = []
        self._stage_start_time = None
        self._stage_current_name = None

    def _stage_begin(self, name: str) -> None:
        # Fecha etapa anterior, se houver
        if self._stage_current_name and self._stage_start_time:
            try:
                elapsed = time.time() - self._stage_start_time
                self._stage_times.append((self._stage_current_name, elapsed))
                self._log(f"⏱ Etapa '{self._stage_current_name}' concluída em {elapsed:.1f}s")
            except Exception:
                pass
        self._stage_current_name = name
        self._stage_start_time = time.time()

    def _stage_end(self, name: str | None = None) -> None:
        try:
            if name and name != self._stage_current_name:
                # se nome diferente, fecha etapa corrente e grava separadamente
                if self._stage_current_name and self._stage_start_time:
                    elapsed = time.time() - self._stage_start_time
                    self._stage_times.append((self._stage_current_name, elapsed))
                self._stage_current_name = name
                self._stage_start_time = time.time()
            if self._stage_current_name and self._stage_start_time:
                elapsed = time.time() - self._stage_start_time
                self._stage_times.append((self._stage_current_name, elapsed))
                self._log(f"⏱ Etapa '{self._stage_current_name}' concluída em {elapsed:.1f}s")
        except Exception:
            pass
        finally:
            self._stage_current_name = None
            self._stage_start_time = None

    # ------------------- Esperas robustas -------------------
    def _wait_page_ready(self, driver, timeout: int = 25) -> None:
        """Espera document.readyState === 'complete'."""
        end = time.time() + timeout
        while time.time() < end:
            try:
                if driver.execute_script("return document.readyState") == 'complete':
                    return
            except Exception:
                pass
            time.sleep(0.3)

    def _wait_first(self, driver, by, selectors: list[str], timeout: int = 25):
        """Retorna o primeiro elemento que casar com qualquer seletor dentro do timeout."""
        end = time.time() + timeout
        while time.time() < end:
            for sel in selectors:
                try:
                    el = driver.find_element(by, sel)
                    if el:
                        return el
                except Exception:
                    continue
            time.sleep(0.3)
        return None

    def _dismiss_overlays(self, driver) -> None:
        """Tenta fechar overlays/banners comuns (cookies, newsletter, CEP etc.)."""
        candidates = [
            "#onetrust-accept-btn-handler",
            "button[aria-label*='fechar' i]",
            "button[title*='Fechar' i]",
            "button[aria-label*='close' i]",
            "button[class*='close' i]",
            "[class*='close' i]",
            "[data-testid*='close' i]",
            "button:enabled",
        ]
        # Tente clicar até 3 elementos que pareçam closers
        tries = 0
        for sel in candidates:
            if tries >= 3:
                break
            try:
                el = driver.find_element(By.CSS_SELECTOR, sel)
                if el and el.is_displayed():
                    try:
                        el.click()
                        tries += 1
                        time.sleep(0.2)
                    except Exception:
                        try:
                            driver.execute_script("arguments[0].click();", el)
                            tries += 1
                            time.sleep(0.2)
                        except Exception:
                            pass
            except Exception:
                continue

    def _is_access_denied(self, driver) -> bool:
        try:
            body_text = (driver.find_element(By.TAG_NAME, 'body').text or '').lower()
            url = (driver.current_url or '').lower()
            return 'access denied' in body_text or 'errors.edgesuite.net' in url
        except Exception:
            return False

    def _detect_validation_unavailable(self) -> bool:
        """Detecta a mensagem 'não foi possível validar os dados do seu cartão' na página."""
        if not self.driver_beleza:
            return False
        try:
            try:
                txt = self.driver_beleza.execute_script(
                    "return document.body && (document.body.innerText || document.body.textContent) || '';"
                )
            except Exception:
                txt = (self.driver_beleza.find_element(By.TAG_NAME, 'body').text or '')
            norm = self._normalize(txt)
            keys = [
                'nao foi possivel validar os dados do seu cartao',
                'validar os dados do seu cartao',
            ]
            return any(k in norm for k in keys)
        except Exception:
            return False

    def _log_opened_order_info(self) -> None:
        """Tenta identificar e logar o identificador do pedido aberto."""
        if not self.driver_pedidos:
            return
        try:
            # 1) Header "Pedido #XXXX"
            header = self.driver_pedidos.find_elements(By.XPATH, "//h1[contains(., 'Pedido #')]")
            if header:
                txt = header[0].text.strip()
                if txt:
                    self._log(f"✔ Detalhe aberto: {txt}")
                    return
        except Exception:
            pass
        try:
            # 2) Pela URL (último segmento)
            url = self.driver_pedidos.current_url
            order_id = url.rstrip('/').split('/')[-1]
            if order_id and order_id not in ("pedidos", "dashboard"):
                self._log(f"✔ Detalhe aberto. ID: {order_id}")
                return
        except Exception:
            pass
        # 3) Fallback
        self._log("✔ Detalhe do pedido aberto (ID não detectado)")

    def _get_order_id_from_header(self) -> Optional[str]:
        """Extrai o ID do pedido do header "Pedido #..." ou da URL atual."""
        if not self.driver_pedidos:
            return None
        try:
            header = self.driver_pedidos.find_elements(By.XPATH, "//h1[contains(., 'Pedido #')]")
            if header:
                txt = (header[0].text or '').strip()
                if '#' in txt:
                    return txt.split('#', 1)[1].strip()
        except Exception:
            pass
        try:
            url = self.driver_pedidos.current_url
            return url.rstrip('/').split('/')[-1]
        except Exception:
            return None

    def _extract_customer_info_from_detail(self) -> dict:
        """Coleta dados do cliente na tela de detalhes (IDs exatos do formulário)."""
        info = {
            'first_name': None,
            'last_name': None,
            'cpf': None,
            'birthdate': None,  # YYYY-MM-DD
            'phone': None,
            'gender': None,
            'email': None,
            'order_id': None,
        }
        d = self.driver_pedidos
        if not d:
            return info
        mapping = {
            'first_name': 'customer-firstName',
            'last_name': 'customer-lastName',
            'cpf': 'customer-cpf',
            'phone': 'customer-phone',
            'email': 'customer-email',
            'gender': 'customer-gender',
        }
        for key, el_id in mapping.items():
            try:
                el = d.find_element(By.ID, el_id)
                val = (el.get_attribute('value') or '').strip()
                if val:
                    info[key] = val
            except Exception:
                pass
        # Data de nascimento: campos separados DD/MM/YYYY
        try:
            day = (d.find_element(By.ID, 'customer-birthdate-day').get_attribute('value') or '').zfill(2)
            month = (d.find_element(By.ID, 'customer-birthdate-month').get_attribute('value') or '').zfill(2)
            year = (d.find_element(By.ID, 'customer-birthdate-year').get_attribute('value') or '')
            if day and month and year:
                info['birthdate'] = f"{year}-{month}-{day}"
        except Exception:
            pass
        # Order ID para usar como senha
        info['order_id'] = self._get_order_id_from_header()
        # Fallback para e-mail
        if not info['email']:
            info['email'] = self._extract_customer_email_from_detail()
        return info

    def _extract_shipping_info_from_detail(self) -> dict:
        """Coleta endereço de entrega da tela de detalhes do pedido."""
        info = {
            'postalCode': None,
            'address1': None,
            'number': None,
            'complement': None,
            'district': None,
            'city': None,
            'state': None,
        }
        d = self.driver_pedidos
        if not d:
            return info
        ids = {
            'postalCode': 'shipping-postalCode',
            'address1': 'shipping-address1',
            'number': 'shipping-address2',
            'complement': 'shipping-address2_complement',
            'district': 'shipping-district',
            'city': 'shipping-city',
            'state': 'shipping-state',
        }
        for key, el_id in ids.items():
            try:
                el = d.find_element(By.ID, el_id)
                val = (el.get_attribute('value') or '').strip()
                if val:
                    info[key] = val
            except Exception:
                pass
        return info

    def _extract_product_title_from_detail(self) -> Optional[str]:
        """Extrai o título do produto do detalhe do pedido.
        Procura a tabela com cabeçalho 'Produto' e pega a primeira célula.
        """
        if not self.driver_pedidos:
            return None
        # Tentativas de caminho diferentes
        xpaths = [
            "//th[contains(normalize-space(.), 'Produto')]/ancestor::table//tbody/tr[1]/td[1]",
            "//table[.//th[contains(normalize-space(.), 'Produto')]]//tbody/tr[1]/td[1]",
        ]
        for xp in xpaths:
            try:
                cell = self.driver_pedidos.find_element(By.XPATH, xp)
                txt = cell.text.strip()
                if txt:
                    # Remove SKU entre parênteses se existir
                    if ' (' in txt:
                        txt = txt.split(' (', 1)[0].strip()
                    return txt
            except Exception:
                continue
        # Fallback: primeira célula de um tbody (pode ser arriscado)
        try:
            cell = self.driver_pedidos.find_element(By.CSS_SELECTOR, 'table tbody tr td')
            txt = cell.text.strip()
            if txt:
                if ' (' in txt:
                    txt = txt.split(' (', 1)[0].strip()
                return txt
        except Exception:
            pass
        return None

    def _extract_product_qty_from_detail(self) -> int:
        """Extrai a quantidade do primeiro item na tabela de itens.
        Procura a coluna 'Qtd.' e lê a célula correspondente. Retorna ao menos 1.
        """
        if not self.driver_pedidos:
            return 1
        try:
            # Encontrar índice da coluna 'Qtd.'
            ths = self.driver_pedidos.find_elements(By.XPATH, "//table//th")
            col_idx = None
            for i, th in enumerate(ths, start=1):
                txt = (th.text or '').strip().lower()
                if txt.startswith('qtd') or 'qtd' in txt or 'quant' in txt:
                    col_idx = i
                    break
            if col_idx is not None:
                td = self.driver_pedidos.find_element(By.XPATH, f"//table//tbody/tr[1]/td[{col_idx}]")
                val = (td.text or '').strip()
                n = int(re.sub(r"\D", "", val) or '1')
                return max(1, n)
        except Exception:
            pass
        # Fallback: tenta encontrar número único pequeno na linha do item
        try:
            row = self.driver_pedidos.find_element(By.XPATH, "//table//tbody/tr[1]")
            nums = re.findall(r"\b\d+\b", row.text or '')
            for num in nums:
                n = int(num)
                if 1 <= n <= 20:
                    return n
        except Exception:
            pass
        return 1

    def _extract_customer_email_from_detail(self) -> Optional[str]:
        if not self.driver_pedidos:
            return None
        # 1) mailto link
        try:
            a = self.driver_pedidos.find_elements(By.CSS_SELECTOR, "a[href^='mailto:']")
            if a:
                href = a[0].get_attribute('href') or ''
                m = re.search(r"mailto:([^?]+)", href)
                if m:
                    return m.group(1).strip()
        except Exception:
            pass
        # 2) inputs com email
        try:
            candidates = self.driver_pedidos.find_elements(By.CSS_SELECTOR, "input[type='email'], input[id*='email' i], input[name*='email' i]")
            for el in candidates:
                v = (el.get_attribute('value') or '').strip()
                if v and '@' in v:
                    return v
        except Exception:
            pass
        # 3) qualquer texto com @
        try:
            nodes = self.driver_pedidos.find_elements(By.XPATH, "//*[contains(text(), '@')]")
            for n in nodes:
                txt = (n.text or '').strip()
                if re.search(r"\b[\w.\-+]+@[\w\-]+\.[A-Za-z]{2,}\b", txt):
                    return re.search(r"\b[\w.\-+]+@[\w\-]+\.[A-Za-z]{2,}\b", txt).group(0)
        except Exception:
            pass
        return None

    def _get_cart_quantity(self) -> int:
        if not self.driver_beleza:
            return 1
        try:
            # Preferir input number
            for sel in [
                "input[type='number']",
                "input[name*='qty' i]",
                "input[id*='qty' i]",
            ]:
                try:
                    inp = self.driver_beleza.find_element(By.CSS_SELECTOR, sel)
                    if inp:
                        v = (inp.get_attribute('value') or '').strip()
                        n = int(re.sub(r"\D", "", v) or '1')
                        return max(1, n)
                except Exception:
                    continue
        except Exception:
            pass
        # fallback lendo texto próximo
        try:
            wrap = self.driver_beleza.find_element(By.XPATH, "//button[contains(normalize-space(.), '+')]/parent::*")
            txt = (wrap.text or '').strip()
            nums = re.findall(r"\b\d+\b", txt)
            if nums:
                return max(1, int(nums[0]))
        except Exception:
            pass
        return 1

    def _normalize(self, s: str) -> str:
        try:
            s = unicodedata.normalize('NFKD', s)
            s = ''.join(c for c in s if not unicodedata.combining(c))
        except Exception:
            pass
        return re.sub(r"\s+", " ", s or '').strip().lower()

    def _find_cart_line_for_product(self, expected_title: Optional[str]):
        if not self.driver_beleza or not expected_title:
            return None
        try:
            low = self._normalize(expected_title)
            links = self.driver_beleza.find_elements(By.CSS_SELECTOR, "a[href*='/p/'], a[href*='/produto/']")
            for a in links:
                try:
                    txt = self._normalize(a.text or '')
                    if not txt:
                        continue
                    if low in txt or any(w in txt for w in low.split()[:3]):
                        # tenta subir para a linha do item
                        for xp in ["ancestor::tr[1]", "ancestor::div[contains(@class,'item')][1]", "ancestor::li[1]", "ancestor::*[@data-testid][1]"]:
                            try:
                                line = a.find_element(By.XPATH, xp)
                                if line:
                                    return line
                            except Exception:
                                continue
                except Exception:
                    continue
        except Exception:
            pass
        return None

    def _get_line_quantity(self, line) -> int:
        try:
            # 1) Preferir contador visível: <p data-testid="product-quantity">01</p>
            try:
                p = line.find_element(By.CSS_SELECTOR, "p[data-testid='product-quantity']")
                txt = (p.text or '').strip()
                n = int(re.sub(r"\D", "", txt) or '1')
                return max(1, n)
            except Exception:
                pass
            try:
                inp = line.find_element(By.CSS_SELECTOR, "input[type='number'], input[name*='qty' i], input[id*='qty' i]")
                v = (inp.get_attribute('value') or '').strip()
                return max(1, int(re.sub(r"\\D", "", v) or '1'))
            except Exception:
                txt = (line.text or '').strip()
                nums = re.findall(r"\b\d+\b", txt)
                if nums:
                    return max(1, int(nums[0]))
        except Exception:
            pass
        return 1

    def _click_plus_in_line(self, line) -> bool:
        # tenta pelo SVG de soma
        try:
            plus = None
            # 0) Botão com título "Aumentar quantidade..."
            if not plus:
                try:
                    plus = line.find_element(By.CSS_SELECTOR, "button[title*='Aumentar quantidade' i]")
                except Exception:
                    plus = None
            try:
                plus = line.find_element(By.XPATH, ".//svg[.//path[@d='M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z']]/ancestor::button[1]")
            except Exception:
                try:
                    plus = line.find_element(By.XPATH, ".//svg[.//path[@d='M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z']]/ancestor::*[self::span or self::div][@role='button' or contains(@class,'button')][1]")
                except Exception:
                    plus = None
            if plus:
                try:
                    plus.click()
                except Exception:
                    self.driver_beleza.execute_script("arguments[0].click();", plus)
                return True
        except Exception:
            pass
        return False

    def _click_minus_in_line(self, line) -> bool:
        try:
            minus = None
            # Botão com título "Diminuir quantidade" se existir
            if not minus:
                try:
                    minus = line.find_element(By.CSS_SELECTOR, "button[title*='Diminuir quantidade' i]")
                except Exception:
                    minus = None
            try:
                minus = line.find_element(By.XPATH, ".//svg[.//path[@d='M19 13H5V11H19V13Z']]/ancestor::button[1]")
            except Exception:
                try:
                    minus = line.find_element(By.XPATH, ".//svg[.//path[@d='M19 13H5V11H19V13Z']]/ancestor::*[self::span or self::div][@role='button' or contains(@class,'button')][1]")
                except Exception:
                    minus = None
            if minus:
                try:
                    minus.click()
                except Exception:
                    self.driver_beleza.execute_script("arguments[0].click();", minus)
                return True
        except Exception:
            pass
        return False

    def _find_global_buttons_by_title(self, expected_title: Optional[str]):
        if not self.driver_beleza or not expected_title:
            return None, None, None
        try:
            low = self._normalize(expected_title)
            # Encontra botões cujo title contenha o nome do produto
            plus_candidates = self.driver_beleza.find_elements(By.CSS_SELECTOR, "button[title*='Aumentar quantidade' i]")
            minus_candidates = self.driver_beleza.find_elements(By.CSS_SELECTOR, "button[title*='Diminuir quantidade' i]")
            def pick(cands):
                for b in cands:
                    try:
                        t = self._normalize(b.get_attribute('title') or '')
                        if not t:
                            continue
                        # Usa as primeiras palavras do título esperado para casar
                        words = low.split()
                        if words and words[0] in t and (len(words) < 2 or words[1] in t):
                            return b
                    except Exception:
                        continue
                return None
            plus = pick(plus_candidates)
            minus = pick(minus_candidates)
            # Container para ler quantidade próximo do botão
            qty_el = None
            if plus:
                try:
                    container = plus.find_element(By.XPATH, "ancestor::*[self::li or self::div][1]")
                    qty_el = container.find_element(By.CSS_SELECTOR, "p[data-testid='product-quantity']")
                except Exception:
                    qty_el = None
            return plus, minus, qty_el
        except Exception:
            return None, None, None

    def _ensure_cart_quantity(self, desired: int, expected_title: Optional[str] = None) -> bool:
        if not self.driver_beleza:
            return
        desired = max(1, int(desired))
        # Garante estar na sacola
        try:
            if '/sacola' not in (self.driver_beleza.current_url or ''):
                self.driver_beleza.get('https://www.belezanaweb.com.br/sacola')
                self._wait_page_ready(self.driver_beleza, 15)
        except Exception:
            pass
        # De preferência, atua na linha do produto do pedido
        line = self._find_cart_line_for_product(expected_title)
        current = self._get_line_quantity(line) if line else self._get_cart_quantity()
        initial_current = current
        if current == desired:
            return True
        # Tenta via input number
        try:
            inp = None
            for sel in [
                "input[type='number']",
                "input[name*='qty' i]",
                "input[id*='qty' i]",
            ]:
                try:
                    inp = (line.find_element(By.CSS_SELECTOR, sel) if line else self.driver_beleza.find_element(By.CSS_SELECTOR, sel))
                    if inp:
                        break
                except Exception:
                    continue
            if inp:
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", inp)
                try:
                    inp.clear()
                except Exception:
                    pass
                for ch in str(desired):
                    inp.send_keys(ch)
                    time.sleep(0.03)
                try:
                    self.driver_beleza.execute_script(
                        "arguments[0].dispatchEvent(new Event('input', {bubbles:true})); arguments[0].dispatchEvent(new Event('change', {bubbles:true}));",
                        inp
                    )
                except Exception:
                    pass
                time.sleep(0.4)
                # após alterar direto no input, valida
                end = time.time() + 10
                while time.time() < end:
                    cur = self._get_line_quantity(line) if line else self._get_cart_quantity()
                    if cur == desired and (initial_current == desired or cur != initial_current):
                        return True
                    time.sleep(0.2)
                return False
        except Exception:
            pass
        # Clicar '+' ou '-' conforme necessário
        try:
            # Pega botões no contexto da linha (se conhecida) ou global
            if line:
                plus_clicked = self._click_plus_in_line(line)
                minus_clicked = self._click_minus_in_line(line)
                # Se nenhum encontrado, cai no global abaixo
            # Global fallback
            plus = None
            minus = None
            if not line:
                plus, minus, qty_el = self._find_global_buttons_by_title(expected_title)
                # Se conseguimos um contador específico, lê por ele
                if qty_el is not None:
                    try:
                        current = max(1, int(re.sub(r"\\D", "", (qty_el.text or '').strip()) or '1'))
                    except Exception:
                        pass
            cur = self._get_line_quantity(line) if line else (max(1, int(re.sub(r"\\D", "", (qty_el.text or '') or '1'))) if 'qty_el' in locals() and qty_el is not None else self._get_cart_quantity())
            # Limita 15 interações por segurança
            steps = 0
            while cur > desired and minus and steps < 15:
                try:
                    (minus.click() if minus else self._click_minus_in_line(line))
                except Exception:
                    if minus:
                        self.driver_beleza.execute_script("arguments[0].click();", minus)
                # aguarda contador refletir mudança
                try:
                    WebDriverWait(self.driver_beleza, 3).until(
                        lambda d: (
                            (self._get_line_quantity(line) if line else (max(1, int(re.sub(r"\\D", "", (qty_el.text or '') or '1'))) if 'qty_el' in locals() and qty_el is not None else self._get_cart_quantity()))
                        ) != cur
                    )
                except Exception:
                    time.sleep(0.2)
                cur = self._get_line_quantity(line) if line else (max(1, int(re.sub(r"\\D", "", (qty_el.text or '') or '1'))) if 'qty_el' in locals() and qty_el is not None else self._get_cart_quantity())
                steps += 1
            while cur < desired and plus and steps < 15:
                try:
                    (plus.click() if plus else self._click_plus_in_line(line))
                except Exception:
                    if plus:
                        self.driver_beleza.execute_script("arguments[0].click();", plus)
                try:
                    WebDriverWait(self.driver_beleza, 3).until(
                        lambda d: (
                            (self._get_line_quantity(line) if line else (max(1, int(re.sub(r"\\D", "", (qty_el.text or '') or '1'))) if 'qty_el' in locals() and qty_el is not None else self._get_cart_quantity()))
                        ) != cur
                    )
                except Exception:
                    time.sleep(0.2)
                cur = self._get_line_quantity(line) if line else (max(1, int(re.sub(r"\\D", "", (qty_el.text or '') or '1'))) if 'qty_el' in locals() and qty_el is not None else self._get_cart_quantity())
                steps += 1
            # Valida mudança e alvo final
            end = time.time() + 10
            while time.time() < end:
                cur = self._get_line_quantity(line) if line else (max(1, int(re.sub(r"\\D", "", (qty_el.text or '') or '1'))) if 'qty_el' in locals() and qty_el is not None else self._get_cart_quantity())
                if cur == desired and (initial_current == desired or cur != initial_current):
                    return True
                time.sleep(0.2)
        except Exception:
            pass
        return False

    def _mutate_email(self, email: str) -> str:
        try:
            name, domain = email.split('@', 1)
        except ValueError:
            return email
        suffix = random.choice(list('abcdefghijklmnopqrstuvwxyz0123456789'))
        return f"{name}{suffix}@{domain}"

    def _generate_site_password(self, base: Optional[str] = None, min_len: int = 6, max_len: int = 12) -> str:
        """Gera senha conforme regras: 6–12 chars, com minúscula, maiúscula, número e especial.
        Não loga valor em claro.
        """
        # Sanea limites
        try:
            min_len = max(6, int(min_len))
        except Exception:
            min_len = 6
        try:
            max_len = min(24, int(max_len))
        except Exception:
            max_len = 12
        if max_len < min_len:
            max_len = min_len
        length = random.randint(min_len, max_len)
        lowers = 'abcdefghijklmnopqrstuvwxyz'
        uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        digits = '0123456789'
        specials = '!@#$%^&*()_+-=.'
        allchars = lowers + uppers + digits + specials
        # Garante pelo menos 1 de cada categoria
        pwd = [
            random.choice(lowers),
            random.choice(uppers),
            random.choice(digits),
            random.choice(specials),
        ]
        # Usa parte do base (ex: order_id) apenas como ruído, se existir
        seed = (base or '')
        while len(pwd) < length:
            src = random.choice([allchars, seed or allchars])
            ch = random.choice(src)
            # Evita espaços/caracteres inválidos
            if ch.isalnum() or ch in specials:
                pwd.append(ch)
        random.shuffle(pwd)
        return ''.join(pwd[:length])

    def pesquisar_no_beleza_once(self, termo: str, email: Optional[str]) -> bool:
        """Abre o site Beleza na Web e pesquisa pelo termo fornecido."""
        self._log(f"→ Abrindo Beleza na Web para pesquisar: {termo}")
        self.driver_beleza = self._mk_driver()
        self.driver_beleza.get(self.beleza_url)
        try:
            wait = WebDriverWait(self.driver_beleza, 25)
            self._wait_page_ready(self.driver_beleza, 25)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
        except Exception:
            pass
        # Inicia cronômetro do pedido após abrir o site
        self._timer_start_order()
        # Fecha possíveis banners de consentimento
        try:
            for sel in [
                "#onetrust-accept-btn-handler",
                "button[aria-label*='aceitar' i]",
                "button[aria-label*='accept' i]",
            ]:
                try:
                    btn = self.driver_beleza.find_element(By.CSS_SELECTOR, sel)
                    if btn:
                        btn.click()
                        break
                except Exception:
                    continue
        except Exception:
            pass
        # Pesquisa: via URL rápida (quando habilitado) ou via input
        self._stage_begin("Pesquisa")
        if self.fast_search:
            try:
                q = urllib.parse.quote_plus(termo)
                self.driver_beleza.get(urllib.parse.urljoin(self.beleza_url, f"busca?q={q}"))
                self._log("✔ Pesquisa enviada (rápida)")
            except Exception as e:
                self._log(f"! Falha na pesquisa rápida: {e}")
                return False
            finally:
                self._stage_end("Pesquisa")
        else:
            # Várias heurísticas para encontrar a caixa de busca (com timeout menor)
            selectors = [
                "input[type='search']",
                "input[name='q']",
                "input[placeholder*='Buscar' i]",
                "input[placeholder*='busca' i]",
                "input#search, input[id*='search' i]",
                "form input",
            ]
            search_el = self._wait_first(self.driver_beleza, By.CSS_SELECTOR, selectors, timeout=20)
            if not search_el:
                self._log("! Campo de busca não encontrado no site Beleza na Web")
                return False
            try:
                search_el.clear()
                search_el.send_keys(termo)
                search_el.send_keys(Keys.ENTER)
                self._log("✔ Pesquisa enviada")
            except Exception as e:
                self._log(f"! Falha ao pesquisar: {e}")
                return False
            finally:
                self._stage_end("Pesquisa")

        # Aguarda a página de resultados carregar
        try:
            self._wait_page_ready(self.driver_beleza, 15)
        except Exception:
            pass

        # Tenta clicar "Adicionar à sacola" (página do produto preferencialmente)
        self._stage_begin("Adicionar à sacola")
        added = self._add_to_cart_belezanaweb(termo)
        self._stage_end("Adicionar à sacola")
        if not added:
            return False

        # Ir para a sacola (botão no modal ou navegação direta) e validar conteúdo
        self._stage_begin("Validar sacola / Checkout")
        if not self._go_to_cart_and_validate(termo):
            self._stage_end("Validar sacola / Checkout")
            return False

        # Ajusta quantidade no carrinho conforme pedido atual
        try:
            desired = int(getattr(self, 'current_qty', 1) or 1)
            expected = getattr(self, 'current_product', None) or termo
            ok_qty = self._ensure_cart_quantity(desired, expected)
            if not ok_qty:
                self._log("! Não foi possível ajustar a quantidade no carrinho. Abortando avanço.")
                self._stage_end("Validar sacola / Checkout")
                return False
        except Exception as e:
            self._log(f"! Erro ao ajustar quantidade no carrinho: {e}")
            self._stage_end("Validar sacola / Checkout")
            return False

        # Com produto correto na sacola, prossegue
        self._proceed_checkout()
        self._stage_end("Validar sacola / Checkout")

        # Aguarda redirecionamento para autenticação e preenche e-mail + cadastro
        return self._fill_auth_email_if_needed(email)

    def _go_to_cart_and_proceed(self) -> None:
        if not self.driver_beleza:
            return
        wait = WebDriverWait(self.driver_beleza, 20)
        # 1) Tenta clicar no botão "Ir para a Sacola" do modal
        try:
            btn = None
            # localizar por texto
            try:
                btn = self.driver_beleza.find_element(By.XPATH, "//a[contains(., 'Ir para a Sacola')]")
            except Exception:
                pass
            if not btn:
                # localizar por href
                candidates = self.driver_beleza.find_elements(By.CSS_SELECTOR, "a[href*='/sacola']")
                if candidates:
                    btn = candidates[0]
            if btn:
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn)
                try:
                    ActionChains(self.driver_beleza).move_to_element(btn).pause(0.1).click(btn).perform()
                except Exception:
                    self.driver_beleza.execute_script("arguments[0].click();", btn)
        except Exception:
            pass

    # ------------------- Cart validation and checkout helpers -------------------
    def _normalize(self, s: str) -> str:
        try:
            s = unicodedata.normalize('NFKD', s)
            s = ''.join(c for c in s if not unicodedata.combining(c))
        except Exception:
            pass
        s = re.sub(r"\s+", " ", s).strip().lower()
        return s

    def _go_to_cart_and_validate(self, expected_title: str) -> bool:
        if not self.driver_beleza:
            return False
        # Se não estivermos na sacola, navega para ela
        if '/sacola' not in (self.driver_beleza.current_url or ''):
            try:
                self.driver_beleza.get('https://www.belezanaweb.com.br/sacola')
                self._wait_page_ready(self.driver_beleza, 20)
            except Exception:
                pass
        # Coleta nomes de produtos no carrinho
        try:
            expected_norm = self._normalize(expected_title)
            links = self.driver_beleza.find_elements(By.CSS_SELECTOR, "a[href*='/p/'], a[href*='/produto/']")
            names = [ (el.text or '').strip() for el in links if (el.text or '').strip() ]
            if not names:
                try:
                    body = self.driver_beleza.find_element(By.TAG_NAME, 'body').text
                    names = [body]
                except Exception:
                    names = []
            for n in names:
                if expected_norm in self._normalize(n):
                    return True
            # Não encontrou: limpa carrinho e retorna False
            self._log("! Produto divergente na sacola. Limpando e tentando novamente…")
            self._clear_cart()
            return False
        except Exception as e:
            self._log(f"! Falha ao validar sacola: {e}")
            return False

    def _proceed_checkout(self) -> None:
        if not self.driver_beleza:
            return
        try:
            proceed = None
            # CSS por data-cy (tanto <a> quanto <button>)
            for sel in [
                "button[data-cy='ProceedCheckout']",
                "a[data-cy='ProceedCheckout']",
            ]:
                try:
                    proceed = self.driver_beleza.find_element(By.CSS_SELECTOR, sel)
                    if proceed:
                        break
                except Exception:
                    proceed = None
            # XPath por texto (ancora ou botão)
            if not proceed:
                try:
                    proceed = self.driver_beleza.find_element(By.XPATH, "//button[contains(normalize-space(.), 'Finalizar Compra')] | //a[contains(normalize-space(.), 'Finalizar Compra')]")
                except Exception:
                    proceed = None
            if proceed:
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", proceed)
                try:
                    ActionChains(self.driver_beleza).move_to_element(proceed).pause(0.1).click(proceed).perform()
                except Exception:
                    self.driver_beleza.execute_script("arguments[0].click();", proceed)
            # Tenta preencher endereço assim que estiver na etapa de endereço
            try:
                WebDriverWait(self.driver_beleza, 20).until(
                    lambda d: '/sacola/transacional/endereco' in (d.current_url or '') or '/sacola/transacional' in (d.current_url or '')
                )
                self._fill_address_if_present()
            except Exception:
                pass
        except Exception:
            pass

    def _fill_address_if_present(self) -> bool:
        if not self.driver_beleza:
            return False
        ship = getattr(self, 'current_shipping', {}) or {}
        postal = (ship.get('postalCode') or '').replace('\n', '').replace('\r', '').strip()
        address1 = ship.get('address1') or ''
        number = ship.get('number') or ''
        complement = ship.get('complement') or ''
        district = ship.get('district') or ''
        city = ship.get('city') or ''
        state = ship.get('state') or ''

        def type_slowly_by_id(id_, raw_value, delay=None):
            if delay is None:
                delay = max(0.01, self.typing_delay)
            try:
                el = self.driver_beleza.find_element(By.ID, id_)
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", el)
                try:
                    el.click()
                except Exception:
                    pass
                try:
                    el.clear()
                except Exception:
                    pass
                for ch in raw_value:
                    el.send_keys(ch)
                    time.sleep(delay)
                # dispara eventos da máscara
                try:
                    self.driver_beleza.execute_script(
                        "arguments[0].dispatchEvent(new Event('input', {bubbles:true})); arguments[0].dispatchEvent(new Event('change', {bubbles:true})); arguments[0].blur();",
                        el
                    )
                except Exception:
                    pass
                return True
            except Exception:
                return False

        def set_value_by_id(id_, value):
            try:
                el = self.driver_beleza.find_element(By.ID, id_)
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", el)
                try:
                    el.click()
                except Exception:
                    pass
                try:
                    el.clear()
                except Exception:
                    pass
                # set via JS (máscaras)
                try:
                    self.driver_beleza.execute_script(
                        "arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input', {bubbles:true})); arguments[0].dispatchEvent(new Event('change', {bubbles:true}));",
                        el, value
                    )
                except Exception:
                    el.send_keys(value)
                return True
            except Exception:
                return False

        # Título e tipo de local (digitar lentamente no título)
        type_slowly_by_id('label', 'Casa')
        try:
            sel = Select(self.driver_beleza.find_element(By.ID, 'addressType'))
            sel.select_by_value('HOME')
        except Exception:
            pass

        # CEP (deve ser digitado pausadamente para acionar autofill)
        if postal:
            digits = re.sub(r"\D", "", postal)[:8]
            try:
                self._log(f"→ CEP do pedido: {digits}")
            except Exception:
                pass
            try:
                el_cep = self.driver_beleza.find_element(By.ID, 'postalCode')
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", el_cep)
                try:
                    el_cep.click()
                except Exception:
                    pass
                try:
                    el_cep.clear()
                except Exception:
                    pass
                # Digita devagar (sem forçar via JS) para disparar máscaras e autofill
                for ch in digits:
                    el_cep.send_keys(ch)
                    time.sleep(max(0.02, self.cep_delay))
                try:
                    self.driver_beleza.execute_script(
                        "arguments[0].dispatchEvent(new Event('input', {bubbles:true})); arguments[0].dispatchEvent(new Event('change', {bubbles:true}));",
                        el_cep
                    )
                except Exception:
                    pass
                # Se por algum motivo não tiver 8 dígitos, repete a digitação lenta
                try:
                    curr = (el_cep.get_attribute('value') or '').replace('\D','')
                    if len(curr) < 8:
                        try:
                            el_cep.clear()
                        except Exception:
                            pass
                        for ch in digits:
                            el_cep.send_keys(ch)
                            time.sleep(max(0.02, self.cep_delay))
                except Exception:
                    pass
            except Exception:
                pass
            # Aguarda auto-preenchimento do endereço após CEP
            try:
                WebDriverWait(self.driver_beleza, 8).until(
                    lambda d: (d.find_element(By.ID, 'streetAddress').get_attribute('value') or '') != ''
                )
            except Exception:
                pass

        # Se não carregou, tenta digitar manual (removendo readonly)
        try:
            street_val = self.driver_beleza.find_element(By.ID, 'streetAddress').get_attribute('value') or ''
            if not street_val and address1:
                self.driver_beleza.execute_script("let e=document.getElementById('streetAddress'); e && e.removeAttribute('readonly');")
                type_slowly_by_id('streetAddress', address1)
        except Exception:
            pass
        try:
            dist_val = self.driver_beleza.find_element(By.ID, 'district').get_attribute('value') or ''
            if not dist_val and district:
                self.driver_beleza.execute_script("let e=document.getElementById('district'); e && e.removeAttribute('readonly');")
                type_slowly_by_id('district', district)
        except Exception:
            pass
        # Cidade/Estado normalmente consolidado em cityUF; não vamos forçar a edição se readonly

        # Número e complemento
        if number:
            type_slowly_by_id('number', str(number))
        if complement:
            type_slowly_by_id('complement', complement)

        # Checkbox titular = mesmo recebedor
        try:
            # 1) Preferir o input com id="isOwnerReceive"
            try:
                chk_input = self.driver_beleza.find_element(By.ID, 'isOwnerReceive')
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", chk_input)
                if not chk_input.is_selected():
                    try:
                        chk_input.click()
                    except Exception:
                        self.driver_beleza.execute_script("arguments[0].click();", chk_input)
            except Exception:
                # 2) Fallback: encontrar pelo texto e clicar no container .check
                chk = None
                try:
                    span = self.driver_beleza.find_element(By.XPATH, "//span[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), 'titular da conta')]" )
                    try:
                        chk = span.find_element(By.XPATH, "preceding::div[contains(@class,'check')][1]")
                    except Exception:
                        chk = None
                except Exception:
                    chk = None
                if not chk:
                    chk = self.driver_beleza.find_element(By.CSS_SELECTOR, "div.check, [class*='check']")
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'}); arguments[0].click();", chk)
        except Exception:
            pass

        # Botão salvar e continuar
        try:
            btn = None
            # tenta por texto
            try:
                btn = self.driver_beleza.find_element(By.XPATH, "//button[contains(., 'Salvar e continuar')] | //button[contains(., 'Salvar e continuar a compra')]")
            except Exception:
                pass
            if btn:
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn)
                try:
                    btn.click()
                except Exception:
                    self.driver_beleza.execute_script("arguments[0].click();", btn)
                self._log("✔ Endereço salvo e continuado")
                # Se aparecer a tela de seleção de endereço (botão "Usar este endereço"), clicar com espera robusta
                end_time = time.time() + 30
                clicked = False
                while time.time() < end_time and not clicked:
                    use_btn = None
                    try:
                        # por texto
                        use_btn = self.driver_beleza.find_element(By.XPATH, "//button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'usar este endereço')]")
                    except Exception:
                        # por classe
                        try:
                            for b in self.driver_beleza.find_elements(By.CSS_SELECTOR, "button.btn-cta.btn-style, button.sc-dKREkF"):
                                txt = (b.text or '').strip().lower()
                                if 'usar este endereço' in txt:
                                    use_btn = b
                                    break
                        except Exception:
                            use_btn = None
                    if use_btn:
                        self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", use_btn)
                        try:
                            use_btn.click()
                        except Exception:
                            self.driver_beleza.execute_script("arguments[0].click();", use_btn)
                        self._log("✔ 'Usar este endereço' clicado")
                        clicked = True
                        break
                    time.sleep(0.5)
                # opcional: aguarda ir para pagamento
                if clicked:
                    try:
                        WebDriverWait(self.driver_beleza, 20).until(
                            lambda d: '/pagamento' in (d.current_url or '')
                        )
                    except Exception:
                        pass
                    # Ao entrar em pagamento, tentar preencher cartão e finalizar
                    try:
                        self._fill_payment_if_present()
                    except Exception:
                        pass
                return True
        except Exception:
            pass
        return False

    def _clear_cart(self) -> None:
        if not self.driver_beleza:
            return
        # remove até 5 itens
        for _ in range(5):
            removed = False
            try:
                # Por texto
                try:
                    btn = self.driver_beleza.find_element(By.XPATH, "//button[contains(., 'Remover')] | //a[contains(., 'Remover')]")
                except Exception:
                    btn = None
                if not btn:
                    for sel in [
                        "button[aria-label*='Remover' i]",
                        "a[aria-label*='Remover' i]",
                        "button[class*='remove' i]",
                    ]:
                        try:
                            btn = self.driver_beleza.find_element(By.CSS_SELECTOR, sel)
                            break
                        except Exception:
                            continue
                if btn:
                    self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn)
                    try:
                        btn.click()
                    except Exception:
                        try:
                            self.driver_beleza.execute_script("arguments[0].click();", btn)
                        except Exception:
                            pass
                    time.sleep(0.8)
                    removed = True
            except Exception:
                pass
            if not removed:
                break
        # 2) Garante que está na sacola
        try:
            self._wait_page_ready(self.driver_beleza, 20)
        except Exception:
            pass
        if '/sacola' not in (self.driver_beleza.current_url or ''):
            self.driver_beleza.get('https://www.belezanaweb.com.br/sacola')
            try:
                self._wait_page_ready(self.driver_beleza, 20)
            except Exception:
                pass
        # 3) Clica em "Finalizar Compra"
        try:
            proceed = None
            # seletor por data-cy
            try:
                proceed = self.driver_beleza.find_element(By.CSS_SELECTOR, "a[data-cy='ProceedCheckout']")
            except Exception:
                pass
            if not proceed:
                # por texto
                try:
                    proceed = self.driver_beleza.find_element(By.XPATH, "//a[contains(., 'Finalizar Compra')]")
                except Exception:
                    pass
            if proceed:
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", proceed)
                try:
                    ActionChains(self.driver_beleza).move_to_element(proceed).pause(0.1).click(proceed).perform()
                except Exception:
                    self.driver_beleza.execute_script("arguments[0].click();", proceed)
        except Exception:
            pass

    def _fill_auth_email_if_needed(self, email: Optional[str]) -> bool:
        if not self.driver_beleza:
            return False
        # Aguarda alguma URL de autenticação
        try:
            WebDriverWait(self.driver_beleza, 15).until(
                lambda d: '/autenticacao/' in (d.current_url or '') or '/autenticacao' in (d.current_url or '')
            )
        except Exception:
            # Não redirecionou para autenticação (talvez já logado). Tentar avançar o checkout.
            try:
                cur = self.driver_beleza.current_url or ''
            except Exception:
                cur = ''
            # Força seguir para checkout/etapas
            try:
                self._proceed_checkout()
            except Exception:
                pass
            # Aguarda endereço ou pagamento
            try:
                WebDriverWait(self.driver_beleza, 20).until(
                    lambda d: '/sacola/transacional/endereco' in (d.current_url or '') or '/sacola/transacional' in (d.current_url or '') or '/pagamento' in (d.current_url or '')
                )
            except Exception:
                pass
            # Se caiu em endereço/pagamento, tenta completar fluxo normalmente
            addr_ok = False
            pay_ok = False
            try:
                if '/pagamento' not in (self.driver_beleza.current_url or ''):
                    self._stage_begin("Endereço")
                    addr_ok = self._fill_address_if_present()
                    try:
                        used_ok = self._ensure_use_this_address()
                    except Exception:
                        used_ok = False
                    self._stage_end("Endereço")
                self._stage_begin("Pagamento")
                pay_ok = self._fill_payment_if_present()
            except Exception:
                pay_ok = False
            finally:
                self._stage_end("Pagamento")
            ok = bool(pay_ok)
            self._timer_end_order(ok)
            return ok
        if not email:
            return False
        email_to_use = self._mutate_email(email)
        self._log(f"→ Preenchendo e-mail na autenticação: {email_to_use}")
        try:
            self._stage_begin("Autenticação")
            field = None
            for sel in [
                "input[type='email']",
                "input[name*='email' i]",
                "input[id*='email' i]",
            ]:
                try:
                    el = self.driver_beleza.find_element(By.CSS_SELECTOR, sel)
                    if el.is_enabled():
                        field = el
                        break
                except Exception:
                    continue
            if field:
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", field)
                try:
                    field.clear()
                except Exception:
                    pass
                field.send_keys(email_to_use)
                field.send_keys(Keys.ENTER)
                self._log("✔ E-mail enviado na autenticação")
                # Aguarda tela de registro e tenta preencher com várias tentativas
                try:
                    WebDriverWait(self.driver_beleza, 30).until(
                        lambda d: ('/autenticacao/register' in (d.current_url or '')) or bool(d.find_elements(By.CSS_SELECTOR, "#givenName, #familyName, #cpf, #birthDate, #telephone, #password"))
                    )
                except Exception:
                    pass
                self._stage_end("Autenticação")
                # Preenche cadastro uma única vez, aguarda e valida
                self._stage_begin("Cadastro")
                self._fill_registration_if_present()
                try:
                    self._log(f"↻ Aguardando {self.wait_register_post:.0f}s após avançar cadastro…")
                except Exception:
                    pass
                self._sleep(self.wait_register_post)
                # Se ainda estiver na tela de cadastro (URL de register ou campos do formulário presentes), tenta novamente
                try:
                    still_on_register = False
                    try:
                        if '/autenticacao/register' in (self.driver_beleza.current_url or ''):
                            still_on_register = True
                    except Exception:
                        pass
                    if not still_on_register:
                        try:
                            has_register_fields = bool(self.driver_beleza.find_elements(By.CSS_SELECTOR, "#givenName, #familyName, #cpf, #birthDate, #telephone, #password"))
                        except Exception:
                            has_register_fields = False
                        still_on_register = has_register_fields
                    if still_on_register:
                        self._log("! Ainda na tela de cadastro. Tentando preencher novamente…")
                        self._fill_registration_if_present()
                        self._sleep(self.wait_register_post)
                except Exception:
                    pass
                self._stage_end("Cadastro")
                # Após cadastro, aguarda etapa de endereço e preenche
                try:
                    WebDriverWait(self.driver_beleza, 25).until(
                        lambda d: '/sacola/transacional/endereco' in (d.current_url or '') or '/sacola/transacional' in (d.current_url or '')
                    )
                except Exception:
                    pass
                self._stage_begin("Endereço")
                addr_ok = False
                # Tenta preencher e confirmar endereço até 2x, só encerra etapa quando confirmar
                for _ in range(2):
                    try:
                        attempt_ok = self._fill_address_if_present()
                    except Exception:
                        attempt_ok = False
                    # Confirmação: URL mudou para pagamento ou botão "Usar este endereço" processado
                    cur_url = ''
                    try:
                        cur_url = self.driver_beleza.current_url or ''
                    except Exception:
                        cur_url = ''
                    if attempt_ok or '/pagamento' in cur_url:
                        addr_ok = True
                        break
                    # aguarda breve e tenta novamente
                    self._sleep(2)
                if not addr_ok:
                    self._log("ℹ Endereço ainda não confirmado; permanecendo na etapa de endereço.")
                self._stage_end("Endereço")
                pay_ok = False
                try:
                    self._stage_begin("Pagamento")
                    pay_ok = self._fill_payment_if_present()
                except Exception:
                    pay_ok = False
                finally:
                    self._stage_end("Pagamento")
                # Considera sucesso apenas se pagamento concluir
                ok = bool(pay_ok)
                # Fecha cronômetro do pedido
                self._timer_end_order(ok)
                return ok
        except Exception as e:
            self._log(f"! Falha ao preencher e enviar e-mail: {e}")
            return False
        return False

    def _clean_digits(self, s: Optional[str]) -> str:
        if not s:
            return ''
        return re.sub(r"\D", "", s)

    def _fill_registration_if_present(self) -> bool:
        if not self.driver_beleza:
            return False
        info = getattr(self, 'current_customer', {}) or {}
        first = (info.get('first_name') or '').strip()
        last = (info.get('last_name') or '').strip()
        cpf = self._clean_digits(info.get('cpf'))
        phone = self._clean_digits(info.get('phone'))
        birth_iso = (info.get('birthdate') or '').strip()  # YYYY-MM-DD esperado
        order_id = (info.get('order_id') or '').strip()
        password_val = self._generate_site_password(order_id)
        gender = (info.get('gender') or '').strip().lower()

        # Aguarda campos de formulário indicativos de cadastro
        try:
            WebDriverWait(self.driver_beleza, 10).until(
                lambda d: len(d.find_elements(By.CSS_SELECTOR, "form input")) > 10
            )
        except Exception:
            pass

        # Converte YYYY-MM-DD -> DD/MM/YYYY se necessário
        birth = birth_iso
        if birth_iso and '-' in birth_iso and len(birth_iso.split('-')) == 3:
            y, m, d = birth_iso.split('-')
            birth = f"{d.zfill(2)}/{m.zfill(2)}/{y}"

        def fill_by_id(id_: str, value: str):
            if not value:
                return False
            try:
                el = self.driver_beleza.find_element(By.ID, id_)
                if el.is_enabled():
                    self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", el)
                    try:
                        el.click()
                    except Exception:
                        pass
                    try:
                        el.clear()
                    except Exception:
                        pass
                    # Campos com máscara podem exigir digitação lenta
                    if id_ == 'cpf':
                        digits = re.sub(r"\D", "", value)
                        for ch in digits:
                            el.send_keys(ch)
                            time.sleep(max(0.01, self.typing_delay))
                        # dispara eventos adicionais
                        try:
                            self.driver_beleza.execute_script(
                                "arguments[0].dispatchEvent(new Event('input', {bubbles:true})); arguments[0].dispatchEvent(new Event('change', {bubbles:true})); arguments[0].blur();",
                                el
                            )
                        except Exception:
                            pass
                    else:
                        # Tenta via JS para campos com máscara
                        try:
                            self.driver_beleza.execute_script(
                                "arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input', {bubbles:true})); arguments[0].dispatchEvent(new Event('change', {bubbles:true})); arguments[0].blur();",
                                el, value
                            )
                        except Exception:
                            el.send_keys(value)
                    return True
            except Exception:
                return False

        def fill_first_matching(selectors: list[str], value: str):
            if not value:
                return False
            for sel in selectors:
                try:
                    el = self.driver_beleza.find_element(By.CSS_SELECTOR, sel)
                    if el.is_enabled():
                        self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", el)
                        try:
                            el.click()
                        except Exception:
                            pass
                        try:
                            el.clear()
                        except Exception:
                            pass
                        el.send_keys(value)
                        return True
                except Exception:
                    continue
            return False

        # Preenchimento usando IDs fornecidos
        fill_by_id('givenName', first) or fill_first_matching(["input[name='givenName']", "input[placeholder*='Nome' i]"], first)
        fill_by_id('familyName', last) or fill_first_matching(["input[name='familyName']", "input[placeholder*='Sobrenome' i]"], last)
        fill_by_id('cpf', cpf) or fill_first_matching(["input[name='cpf']", "input[placeholder*='CPF' i]"], cpf)
        if birth:
            fill_by_id('birthDate', birth) or fill_first_matching(["input[name='birthDate']", "input[placeholder*='Nascimento' i]"], birth)
        fill_by_id('telephone', phone) or fill_first_matching(["input[name='telephone']", "input[placeholder*='Celular' i]"], phone)
        # Senha (gera conforme regras do site)
        fill_by_id('password', password_val) or fill_first_matching(["input[name='password']", "input[type='password']"], password_val)
        # Confirmar senha, se existir
        try:
            fill_by_id('confirmPassword', password_val) or fill_first_matching(["input[name='confirmPassword']", "input[name*='confirm' i]"], password_val)
        except Exception:
            pass
        try:
            # Guarda para possível reutilização (não logamos valor em claro)
            if isinstance(self.current_customer, dict):
                self.current_customer['generated_password'] = '***'
        except Exception:
            pass

        # Gênero (labels com for=gender-F / gender-M)
        try:
            if gender.startswith('m'):
                try:
                    lab = self.driver_beleza.find_element(By.CSS_SELECTOR, "label[for='gender-M']")
                    self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'}); arguments[0].click();", lab)
                except Exception:
                    try:
                        el = self.driver_beleza.find_element(By.XPATH, "//*[contains(., 'Masculino')]/preceding::input[@type='radio'][1]")
                        self.driver_beleza.execute_script("arguments[0].click();", el)
                    except Exception:
                        pass
            elif gender.startswith('f'):
                try:
                    lab = self.driver_beleza.find_element(By.CSS_SELECTOR, "label[for='gender-F']")
                    self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'}); arguments[0].click();", lab)
                except Exception:
                    try:
                        el = self.driver_beleza.find_element(By.XPATH, "//*[contains(., 'Feminino')]/preceding::input[@type='radio'][1]")
                        self.driver_beleza.execute_script("arguments[0].click();", el)
                    except Exception:
                        pass
        except Exception:
            pass

        # Criar Conta
        try:
            btn = None
            try:
                btn = self.driver_beleza.find_element(By.CSS_SELECTOR, "button[data-flora='button'][data-flora-text='Criar Conta']")
            except Exception:
                pass
            if not btn:
                try:
                    btn = self.driver_beleza.find_element(By.XPATH, "//button[.//span[contains(., 'Criar Conta')]] | //button[contains(., 'Criar Conta')] | //a[contains(., 'Criar Conta')]")
                except Exception:
                    pass
            if btn:
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn)
                # Aguarda alguns segundos para garantir que as validações/máscaras do formulário terminem
                try:
                    self._log(f"↻ Aguardando {self.wait_register_pre:.0f}s antes de clicar em 'Criar Conta'…")
                except Exception:
                    pass
                self._sleep(self.wait_register_pre)
                try:
                    btn.click()
                except Exception:
                    self.driver_beleza.execute_script("arguments[0].click();", btn)
                return True
        except Exception:
            pass
        return False

    def _add_to_cart_belezanaweb(self, termo: str) -> bool:
        if not self.driver_beleza:
            return False
        wait = WebDriverWait(self.driver_beleza, 25)
        # Aguarda resultados carregarem parcialmente
        try:
            self._wait_page_ready(self.driver_beleza, 25)
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'body')))
        except Exception:
            pass
        # 1) Preferir abrir a página do produto para estabilidade
        # Encontra um link do produto compatível e entra
        try:
            low = termo.lower()
            links = self.driver_beleza.find_elements(By.CSS_SELECTOR, "a[href]")
            cand = None
            for a in links:
                try:
                    href = (a.get_attribute('href') or '').lower()
                    txt = (a.text or '').strip().lower()
                    if ('/p/' in href or '/produto/' in href) and any(w in href for w in low.split()[:3]):
                        cand = a
                        break
                    if txt and any(w in txt for w in low.split()[:3]) and ('/p/' in href or '/produto/' in href):
                        cand = a
                        break
                except Exception:
                    continue
            if cand:
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", cand)
                # tenta clicar; se algum overlay interceptar, fecha e tenta novamente
                for _ in range(3):
                    try:
                        ActionChains(self.driver_beleza).move_to_element(cand).pause(0.1).click(cand).perform()
                        break
                    except (ElementClickInterceptedException, ElementNotInteractableException):
                        self._dismiss_overlays(self.driver_beleza)
                        time.sleep(0.3)
                try:
                    self._wait_page_ready(self.driver_beleza, 25)
                    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'body')))
                except Exception:
                    pass
                # aguarda URL conter /p/ (página do produto)
                try:
                    WebDriverWait(self.driver_beleza, 15).until(EC.url_contains('/p/'))
                except Exception:
                    # tenta um clique direto via JS no link
                    try:
                        self.driver_beleza.execute_script("arguments[0].click();", cand)
                        WebDriverWait(self.driver_beleza, 10).until(EC.url_contains('/p/'))
                    except Exception:
                        pass
                # Se bloqueou por Access Denied, sinaliza para retry
                if self._is_access_denied(self.driver_beleza):
                    raise RuntimeError('Access Denied detectado ao abrir página do produto')
        except Exception as e:
            self._log(f"! Falha ao entrar na página do produto: {e}")

        # 2) Na página do produto, tente diferentes seletores e formas de clique
        selectors = [
            "a.js-add-to-cart",
            "a.btn.btn-conversion.btn-buy-only-icon.js-add-to-cart",
            "a[title*='Adicionar à sacola' i]",
            "a[aria-label*='Adicionar à sacola' i]",
            "button.js-add-to-cart",
            "button[aria-label*='Adicionar' i]",
        ]
        try:
            end = time.time() + 20
            btn = None
            while time.time() < end and not btn:
                for sel in selectors:
                    try:
                        el = self.driver_beleza.find_element(By.CSS_SELECTOR, sel)
                        if el.is_displayed():
                            btn = el
                            break
                    except Exception:
                        continue
                if not btn:
                    time.sleep(0.4)
            if not btn:
                # fallback por XPath no title
                try:
                    btn = self.driver_beleza.find_element(By.XPATH, "//a[contains(@title, 'Adicionar à sacola') or contains(@aria-label, 'Adicionar à sacola')]")
                except Exception:
                    btn = None
            if btn:
                self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn)
                try:
                    for _ in range(3):
                        try:
                            ActionChains(self.driver_beleza).move_to_element(btn).pause(0.1).click(btn).perform()
                            break
                        except (ElementClickInterceptedException, ElementNotInteractableException):
                            self._dismiss_overlays(self.driver_beleza)
                            time.sleep(0.3)
                except (ElementClickInterceptedException, ElementNotInteractableException):
                    # Tenta via JS
                    self.driver_beleza.execute_script("arguments[0].click();", btn)
                self._log("✔ Adicionado à sacola (página do produto)")
                if self._is_access_denied(self.driver_beleza):
                    raise RuntimeError('Access Denied após tentar adicionar à sacola')
                return True
        except Exception as e:
            self._log(f"! Erro ao clicar no botão de compra: {e}")
        return False

    def buscar_e_adicionar_com_retry(self, termo: str, email: Optional[str], retries: int = 2) -> bool:
        attempt = 0
        while attempt <= retries:
            success = False
            try:
                ok = self.pesquisar_no_beleza_once(termo, email)
                if ok:
                    success = True
                    self._log("✔ Fluxo na Beleza na Web concluído")
                    return True
            except Exception as e:
                self._log(f"! Erro na busca/compra (tentativa {attempt+1}): {e}")
            finally:
                # Fecha o navegador somente se falhou; em sucesso mantém aberto
                if not success:
                    try:
                        if self.driver_beleza:
                            self.driver_beleza.quit()
                    except Exception:
                        pass
                    self.driver_beleza = None
            # Se marcamos para abortar este pedido (ex.: validação indisponível), não retentar
            if getattr(self, 'abort_current_order', False):
                self._log("ℹ Abortado para este pedido. Pulando tentativas restantes.")
                return False
            attempt += 1
            self._log("↻ Repetindo fluxo na Beleza na Web…")
        return False

    # ------------------- Fluxo de Infos -------------------
    @staticmethod
    def carregar_infos(filepath: str) -> List[str]:
        """Carrega um arquivo .txt com uma informação por linha."""
        infos: List[str] = []
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    infos.append(line)
        return infos

    # ------------------- Ações com Navegador -------------------
    def abrir_pedidos(self) -> None:
        self._log("Iniciando navegador 1 (Dashboard Pedidos)...")
        self.driver_pedidos = self._mk_driver()
        self.driver_pedidos.get(self.dashboard_url)
        self._log(f"→ Acessou {self.dashboard_url}")
        # Tenta autenticar se for redirecionado ao login
        self._login_if_needed()

    def _login_if_needed(self) -> None:
        if not self.driver_pedidos:
            return
        try:
            wait = WebDriverWait(self.driver_pedidos, 5)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
            inputs = self.driver_pedidos.find_elements(By.CSS_SELECTOR, 'input')
            pwd_el = None
            user_el = None
            for el in inputs:
                t = (el.get_attribute('type') or '').lower()
                if t == 'password':
                    pwd_el = el
                else:
                    # pega o primeiro input de texto disponível
                    if not user_el:
                        user_el = el
            if pwd_el:
                # Detectamos tela de login
                if user_el:
                    user_el.clear()
                    user_el.send_keys('admin')
                pwd_el.clear()
                pwd_el.send_keys('123')
                pwd_el.send_keys(Keys.ENTER)
                self._log('→ Fez login (admin/123)')
                # Aguarda redirecionar para o dashboard
                try:
                    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table')))
                except Exception:
                    pass
        except Exception as e:
            self._log(f"! Falha ao verificar/autenticar: {e}")

    def coletar_pedidos(self) -> int:
        if not self.driver_pedidos:
            self._log("Driver de pedidos não inicializado.")
            return 0
        time.sleep(1.0)  # aguarda carregamento básico
        qtd = 0
        try:
            # Exemplo: pegar linhas de uma tabela. Ajuste para seu seletor real.
            rows = self.driver_pedidos.find_elements(By.CSS_SELECTOR, "table tbody tr")
            qtd = len(rows)
            self._log(f"✔ Encontrados {qtd} pedidos na tabela")
        except Exception as e:
            self._log(f"! Falha ao coletar pedidos: {e}")
        return qtd

    def abrir_primeiro_pedido_pago(self) -> bool:
        """Abre o primeiro pedido com status 'pago'.
        Se der erro na tela de detalhes, recarrega a lista em
        http://localhost:5174/dashboard/pedidos e tenta o próximo PAGO.
        Retorna True se conseguiu abrir um detalhe válido; False caso contrário.
        """
        if not self.driver_pedidos:
            self._log("Driver de pedidos não inicializado.")
            return False

        wait = WebDriverWait(self.driver_pedidos, 10)

        def get_pago_rows():
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table tbody')))
            except Exception:
                return []
            rows_local = self.driver_pedidos.find_elements(By.CSS_SELECTOR, 'table tbody tr')
            def is_pago(row) -> bool:
                try:
                    return 'pago' in (row.text or '').lower()
                except Exception:
                    return False
            return [r for r in rows_local if is_pago(r)]

        # Garante que estamos na lista
        self.driver_pedidos.get(self.dashboard_url)
        self._login_if_needed()

        page_index = 1
        while True:
            pago_rows = get_pago_rows()
            self._log(f"→ Página {page_index}: encontrados {len(pago_rows)} pedidos com status PAGO")
            idx = 0
            while idx < len(pago_rows):
                row = pago_rows[idx]
                try:
                    tds = row.find_elements(By.TAG_NAME, 'td')
                    target = tds[0] if tds else row
                    self._log(f"→ Abrindo pedido PAGO #{idx + 1} na página {page_index}")
                    self.driver_pedidos.execute_script("arguments[0].scrollIntoView({block: 'center'});", target)
                    target.click()

                    # Aguarda detalhe/erro
                    try:
                        any_of = getattr(EC, 'any_of', None)
                        if any_of:
                            wait.until(any_of(
                                EC.presence_of_element_located((By.XPATH, "//h1[contains(., 'Pedido #')]")),
                                EC.presence_of_element_located((By.XPATH, "//button[contains(., 'Imprimir')]")),
                                EC.presence_of_element_located((By.XPATH, "//*[contains(., 'Falha ao carregar pedido')]")),
                                EC.presence_of_element_located((By.XPATH, "//*[contains(., 'Erro desconhecido da API')]")),
                                EC.presence_of_element_located((By.XPATH, "//*[contains(., 'Pedido não encontrado')]")
                            )))
                        else:
                            time.sleep(1.0)
                    except Exception:
                        pass

                    ok = False
                    has_error = False
                    try:
                        ok = len(self.driver_pedidos.find_elements(By.XPATH, "//h1[contains(., 'Pedido #')] | //button[contains(., 'Imprimir')]")) > 0
                    except Exception:
                        ok = False
                    try:
                        has_error = len(self.driver_pedidos.find_elements(By.XPATH, "//*[contains(., 'Falha ao carregar pedido') or contains(., 'Erro desconhecido da API') or contains(., 'Pedido não encontrado')]")) > 0
                    except Exception:
                        has_error = False

                    if ok and not has_error:
                        self._log("✔ Detalhe do pedido aberto com sucesso")
                        self._log_opened_order_info()
                        # Pequena pausa e foco nas anotações para garantir leitura confiável
                        try:
                            time.sleep(0.5)
                            self._focus_notes_and_wait(3.0)
                            if self._should_skip_order_due_to_note(self._get_order_id_from_header()):
                                self._log("ℹ Pedido com anotação recente. Ignorando e voltando à lista.")
                                try:
                                    self.driver_pedidos.back()
                                    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table tbody')))
                                except Exception:
                                    self.driver_pedidos.get(self.dashboard_url)
                                    self._login_if_needed()
                                pago_rows = get_pago_rows()
                                idx += 1
                                continue
                        except Exception:
                            pass
                        # reset flag de aborto para este pedido
                        self.abort_current_order = False
                        # Checa se deve pular por nota recente
                        try:
                            order_id = self._get_order_id_from_header()
                            if self._should_skip_order_due_to_note(order_id):
                                self._log("ℹ Pedido possui anotação de validação de cartão nas últimas 24h. Ignorando.")
                                self.driver_pedidos.back()
                                try:
                                    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table tbody')))
                                except Exception:
                                    pass
                                pago_rows = get_pago_rows()
                                idx += 1
                                continue
                        except Exception:
                            pass
                        prod = self._extract_product_title_from_detail()
                        self.current_qty = self._extract_product_qty_from_detail()
                        self.current_customer = self._extract_customer_info_from_detail()
                        self.current_shipping = self._extract_shipping_info_from_detail()
                        email = self.current_customer.get('email') if self.current_customer else self._extract_customer_email_from_detail()
                        if prod:
                            self.current_product = prod
                            self._log(f"→ Produto identificado: {prod}")
                            self._log(f"→ Quantidade do pedido: {self.current_qty}")
                            # Checagem redundante da anotação imediatamente antes de comprar
                            try:
                                if self._should_skip_order_due_to_note(self._get_order_id_from_header()):
                                    self._log("ℹ Pedido ainda anotado para aguardar 24h. Ignorando.")
                                    try:
                                        self.driver_pedidos.back()
                                        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table tbody')))
                                    except Exception:
                                        self.driver_pedidos.get(self.dashboard_url)
                                        self._login_if_needed()
                                    pago_rows = get_pago_rows()
                                    idx += 1
                                    continue
                            except Exception:
                                pass
                            if email:
                                self._log(f"→ E-mail do cliente: {email}")
                            ok_flow = self.buscar_e_adicionar_com_retry(prod, email)
                            if ok_flow:
                                return True
                            # Se abortamos este pedido, pular para o próximo
                            if getattr(self, 'abort_current_order', False):
                                self._log("ℹ Pedido anotado para retry futuro. Pulando para o próximo.")
                                try:
                                    self.driver_pedidos.back()
                                    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table tbody')))
                                except Exception:
                                    self.driver_pedidos.get(self.dashboard_url)
                                    self._login_if_needed()
                                pago_rows = get_pago_rows()
                                idx += 1
                                continue
                            # Caso falhe sem anotação, tratar como erro e tentar próximo
                            self._log("! Compra não concluída. Pulando para próximo pedido PAGO…")
                            try:
                                self.driver_pedidos.back()
                                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table tbody')))
                            except Exception:
                                self.driver_pedidos.get(self.dashboard_url)
                                self._login_if_needed()
                            pago_rows = get_pago_rows()
                            idx += 1
                            continue
                        else:
                            self._log("! Não foi possível identificar o título do produto no detalhe")
                            return False
                    else:
                        # Volta para a lista para tentar o próximo
                        self._log("! Erro ao abrir o pedido. Voltando à lista para tentar o próximo PAGO…")
                        try:
                            self.driver_pedidos.back()
                            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table tbody')))
                        except Exception:
                            self.driver_pedidos.get(self.dashboard_url)
                            self._login_if_needed()
                        pago_rows = get_pago_rows()
                        idx += 1
                        continue
                except Exception as e:
                    self._log(f"! Falha ao abrir linha: {e}")
                    try:
                        self.driver_pedidos.get(self.dashboard_url)
                        self._login_if_needed()
                    except Exception:
                        pass
                    pago_rows = get_pago_rows()
                    idx += 1
                    continue

            # Fim da página: tenta avançar
            try:
                next_btn = None
                try:
                    next_btn = self.driver_pedidos.find_element(By.XPATH, "//button[contains(normalize-space(.), 'Próxima')]")
                except Exception:
                    next_btn = None
                if next_btn and not (next_btn.get_attribute('disabled') or '').strip():
                    self.driver_pedidos.execute_script("arguments[0].scrollIntoView({block: 'center'});", next_btn)
                    try:
                        next_btn.click()
                    except Exception:
                        self.driver_pedidos.execute_script("arguments[0].click();", next_btn)
                    try:
                        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table tbody')))
                    except Exception:
                        time.sleep(0.8)
                    page_index += 1
                    continue
            except Exception:
                pass
            break
        return False

    def abrir_beleza(self) -> None:
        self._log("Iniciando navegador 2 (Beleza na Web)...")
        self.driver_beleza = self._mk_driver()
        self.driver_beleza.get(self.beleza_url)
        self._log(f"→ Acessou {self.beleza_url}")

    def fechar(self) -> None:
        for drv in (self.driver_pedidos, self.driver_beleza):
            try:
                if drv:
                    drv.quit()
            except Exception:
                pass
        self.driver_pedidos = None
        self.driver_beleza = None

    # ------------------- Cartões: helpers -------------------
    def _load_next_card(self) -> bool:
        """Carrega a próxima linha de cartão do arquivo infos/infos.txt.
        Formato: numero:mm:aa:cvv
        Retorna True se carregou, False se não há cartões.
        """
        try:
            from pathlib import Path
            path = Path(__file__).resolve().parent / 'infos' / 'infos.txt'
            if not path.exists():
                self._log("! Arquivo infos.txt não encontrado.")
                return False
            for line in path.read_text(encoding='utf-8').splitlines():
                line = (line or '').strip()
                if not line:
                    continue
                parts = line.split(':')
                if len(parts) >= 4:
                    num, mm, aa, cvv = [p.strip() for p in parts[:4]]
                    self.card_info = {'number': num, 'mm': mm, 'yy': aa, 'cvv': cvv}
                    self.card_line = f"{num}:{mm}:{aa}:{cvv}"
                    self._log(f"→ Próximo cartão carregado: **** **** **** {num[-4:]}")
                    return True
            self._log("! Nenhum cartão disponível em infos.txt")
            return False
        except Exception as e:
            self._log(f"! Falha ao ler infos.txt: {e}")
            return False

    def _remove_current_card_line(self) -> None:
        """Remove a linha do cartão atual de infos/infos.txt (se existir)."""
        try:
            from pathlib import Path
            if not self.card_line:
                return
            path = Path(__file__).resolve().parent / 'infos' / 'infos.txt'
            if not path.exists():
                return
            lines = path.read_text(encoding='utf-8').splitlines()
            new_lines = [ln for ln in lines if ln.strip() != self.card_line.strip()]
            path.write_text('\n'.join(new_lines) + ('\n' if new_lines else ''), encoding='utf-8')
            self._log(f"→ Cartão removido do infos.txt: {self.card_line}")
            self._emit_infos_count()
        except Exception as e:
            self._log(f"! Falha ao atualizar infos.txt: {e}")

    def _fill_payment_if_present(self) -> bool:
        if not self.driver_beleza:
            return False
        # Aguarda entrar na etapa de pagamento
        try:
            WebDriverWait(self.driver_beleza, 15).until(
                lambda d: '/pagamento' in (d.current_url or '')
            )
        except Exception:
            # Se não entrou na URL de pagamento, não tente preencher
            try:
                cur = self.driver_beleza.current_url or ''
                if '/pagamento' not in cur:
                    self._log("ℹ Ainda na etapa de endereço. Não iniciar pagamento.")
                    return False
            except Exception:
                return False

        def type_slowly_selectors(selectors: list[str], text: str, delay=None) -> bool:
            if delay is None:
                delay = max(0.01, self.typing_delay)
            for sel in selectors:
                try:
                    el = self.driver_beleza.find_element(By.CSS_SELECTOR, sel)
                    if el and el.is_enabled():
                        self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", el)
                        try:
                            el.click()
                        except Exception:
                            pass
                        try:
                            el.clear()
                        except Exception:
                            pass
                        for ch in text:
                            el.send_keys(ch)
                            time.sleep(delay)
                        try:
                            self.driver_beleza.execute_script(
                                "arguments[0].dispatchEvent(new Event('input', {bubbles:true})); arguments[0].dispatchEvent(new Event('change', {bubbles:true})); arguments[0].blur();",
                                el
                            )
                        except Exception:
                            pass
                        return True
                except Exception:
                    continue
            return False

        def on_payment_screen() -> bool:
            try:
                cur = self.driver_beleza.current_url or ''
                if '/pagamento' not in cur:
                    return False
                # Verifica se há alguma indicação da seção de pagamento/cartão na página
                if self.driver_beleza.find_elements(By.XPATH, "//*[contains(., 'Cartão de Crédito') or contains(., 'Pagar com Cartão')]"):
                    return True
            except Exception:
                pass
            return True  # Se URL confirma, segue adiante

        def fill_card_fields():
            # Segurança extra: só tenta preencher se estamos realmente na tela de pagamento
            if not on_payment_screen():
                self._log("ℹ Elementos de pagamento não detectados. Abortando preenchimento de cartão.")
                return
            card = self.card_info or {}
            number = (card.get('number') or '').strip()
            mm = (card.get('mm') or '').zfill(2)
            yy = (card.get('yy') or '').zfill(2)
            cvv = (card.get('cvv') or '').strip()
            cust = getattr(self, 'current_customer', {}) or {}
            holder = (f"{cust.get('first_name','').strip()} {cust.get('last_name','').strip()}").strip()

            # Número do cartão
            type_slowly_selectors([
                "input[name*='card'][name*='number' i]",
                "input[id*='card'][id*='number' i]",
                "input[name='cardNumber']",
                "input[id='cardNumber']",
            ], number)
            # Nome do titular
            type_slowly_selectors([
                "input[name*='holder' i]",
                "input[name*='cardholder' i]",
                "input[placeholder*='nome' i]",
            ], holder)
            # Validade
            type_slowly_selectors([
                "input[name*='valid' i]",
                "input[name*='expiry' i]",
                "input[placeholder*='mm' i]",
            ], f"{mm}/{yy}")
            # CVV
            type_slowly_selectors([
                "input[name*='cvv' i]",
                "input[name*='security' i]",
            ], cvv)

        def click_finalize():
            try:
                btn = None
                try:
                    btn = self.driver_beleza.find_element(By.CSS_SELECTOR, "button[data-cy='ProceedSuccess']")
                except Exception:
                    pass
                if not btn:
                    try:
                        btn = self.driver_beleza.find_element(By.XPATH, "//button[contains(., 'Finalizar Pedido')]")
                    except Exception:
                        pass
                if btn:
                    self.driver_beleza.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn)
                    try:
                        btn.click()
                    except Exception:
                        self.driver_beleza.execute_script("arguments[0].click();", btn)
                    self._log("✔ Finalizar Pedido clicado")
                    # Aguarda um período fixo antes de qualquer nova ação
                    try:
                        post_wait = float(os.environ.get('BOT_POST_FINALIZE_WAIT', '10'))
                    except Exception:
                        post_wait = 10.0
                    time.sleep(max(1.0, post_wait))
                    # Checagem imediata da mensagem de validação indisponível
                    try:
                        if self._detect_validation_unavailable():
                            msg = 'No momento, não foi possível validar os dados do seu cartão, tente novamente mais tarde.'
                            self._log(f"! {msg}")
                            # Fecha o navegador da loja e salva anotação via UI
                            try:
                                if self.driver_beleza:
                                    self.driver_beleza.quit()
                            except Exception:
                                pass
                            self.driver_beleza = None
                            note = f"{msg} — {self._now_str()}"
                            self._save_note_via_ui(note)
                            # Marca para não retentar neste pedido
                            self.abort_current_order = True
                            return False
                    except Exception:
                        pass
                    return True
            except Exception:
                pass
            return False

        def is_card_error_present() -> bool:
            try:
                # alerta clássico
                if self.driver_beleza.find_elements(By.XPATH, "//*[contains(., 'Verifique o seu Cartão de Crédito')]"):
                    return True
                # mensagens genéricas de erro que também significam reprovação
                body = (self.driver_beleza.find_element(By.TAG_NAME, 'body').text or '')
                norm = self._normalize(body)
                generic_errors = [
                    'nao conseguimos completar sua transacao',
                    'nao conseguimos completar a sua transacao',
                    'transacao nao autorizada',
                    'transação não autorizada',
                    'falha no pagamento',
                    'pagamento nao processado',
                    'nao foi possivel processar o pagamento',
                    'ocorreu um erro no pagamento',
                    'dados do cartao invalidos',
                    'cartao recusado',
                    'cartao reprovado'
                ]
                return any(err in norm for err in generic_errors)
            except Exception:
                return False

        # Até 3 tentativas de cartão (1ª + 2 novas)
        for attempt in range(1, 4):
            # Checagem imediata de limite diário antes de qualquer ação
            try:
                body_txt = (self.driver_beleza.find_element(By.TAG_NAME, 'body').text or '')
                norm = self._normalize(body_txt)
                if 'atingiu o limite diario' in norm or 'limite diario de tentativas' in norm or 'em 24 horas' in norm:
                    self._log("! Limite diário detectado no início da etapa de pagamento. Reiniciando fluxo…")
                    return False
            except Exception:
                pass
            # Garantir que temos um cartão carregado (sempre o primeiro do arquivo)
            if not self.card_info:
                if not self._load_next_card():
                    self._log("! Sem cartões disponíveis para tentar.")
                    return False

            fill_card_fields()
            click_finalize()
            # Aguarda resposta
            try:
                WebDriverWait(self.driver_beleza, 12).until(
                    lambda d: is_card_error_present() or '/recibo' in (d.current_url or '') or '/sucesso' in (d.current_url or '')
                )
            except Exception:
                pass

            # Sucesso se mudou para recibo/sucesso
            try:
                if '/recibo' in (self.driver_beleza.current_url or '') or '/sucesso' in (self.driver_beleza.current_url or ''):
                    return True
            except Exception:
                pass

            # Limite diário de tentativas de compra -> reinicia fluxo completo
            try:
                body_txt = (self.driver_beleza.find_element(By.TAG_NAME, 'body').text or '')
                norm = self._normalize(body_txt)
                if 'atingiu o limite diario' in norm or 'limite diario de tentativas' in norm or 'em 24 horas' in norm:
                    self._log("! Limite diário de tentativas atingido. Reiniciando fluxo…")
                    return False
                if 'nao foi possivel validar os dados do seu cartao' in norm:
                    msg = 'No momento, não foi possível validar os dados do seu cartão, tente novamente mais tarde.'
                    self._log(f"! {msg}")
                    try:
                        # Fecha o navegador da loja e salva anotação via UI na tela do pedido
                        if self.driver_beleza:
                            try:
                                self.driver_beleza.quit()
                            except Exception:
                                pass
                            self.driver_beleza = None
                        order_id = self._get_order_id_from_header()
                        note = f"{msg} — {self._now_str()}"
                        self._save_note_via_ui(note)
                    except Exception:
                        pass
                    return False
                if 'nao foi possivel validar os dados do seu cartao' in norm:
                    msg = 'No momento, não foi possível validar os dados do seu cartão, tente novamente mais tarde.'
                    self._log(f"! {msg}")
                    try:
                        order_id = self._get_order_id_from_header()
                        note = f"{msg} — {self._now_str()}"
                        self._api_save_note(order_id, note)
                    except Exception:
                        pass
                    try:
                        if self.driver_beleza:
                            self.driver_beleza.quit()
                    except Exception:
                        pass
                    self.driver_beleza = None
                    return False
            except Exception:
                pass

            # Se erro de cartão, remove, atualiza e tenta próximo
            if is_card_error_present():
                self._log(f"! Cartão reprovado (tentativa {attempt}/3). Removendo e tentando próximo…")
                self._remove_current_card_line()
                # Limpa estado do cartão atual
                self.card_info = None
                self.card_line = None
                try:
                    self.driver_beleza.refresh()
                    self._wait_page_ready(self.driver_beleza, 20)
                except Exception:
                    pass
                self._log(f"↻ Aguardando {self.wait_payment_retry:.0f}s antes de nova tentativa…")
                self._sleep(self.wait_payment_retry)
                continue

            # Caso nenhum estado claro, considera falha desta tentativa
            self._log(f"! Falha ao concluir pagamento na tentativa {attempt}/3.")

        # Após 3 tentativas, retorna False para reiniciar o fluxo completo
        self._log("! Três tentativas de pagamento sem sucesso. Reiniciando fluxo completo…")
        return False

    # ------------------- Orquestração -------------------
    def run_workflow(self, infos: List[str]) -> None:
        try:
            self._ensure_log_open()
            self._log(f"✔ {len(infos)} infos carregadas")
            self._progress(5)
            # Carrega primeiro cartão disponível do infos.txt
            self._load_next_card()

            # Passo 1: Pedidos
            self.abrir_pedidos()
            self._progress(25)
            lidos = self.coletar_pedidos()
            self._log(f"Leitura concluída: {lidos} pedidos")
            self._progress(90)

            # Abrir primeiro pedido com status PAGO (ou o próximo válido)
            ok = self.abrir_primeiro_pedido_pago()
            if ok:
                self._log("✔ Fluxo concluído ✅")
            else:
                self._log("! Fluxo não concluído — verifique a janela do navegador para preencher/corrigir.")
            self._progress(100)
        finally:
            # Finaliza e copia para logs/last_run.log
            self._finalize_log()
            if self.keep_open:
                self._log("Mantendo o navegador aberto para inspeção.")
            else:
                self.fechar()


if __name__ == "__main__":
    # Execução simples em modo console
    bot = Bot()
    txt = os.path.join(os.path.dirname(__file__), "infos", "exemplo.txt")
    if os.path.exists(txt):
        infos = Bot.carregar_infos(txt)
    else:
        infos = ["linha 1", "linha 2", "linha 3"]
    bot.run_workflow(infos)
