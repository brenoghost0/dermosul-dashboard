import os
import sys
import threading
from typing import List

from PySide6.QtCore import QObject, Signal, Slot, Qt
from PySide6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
    QLabel, QTextEdit, QFileDialog, QProgressBar, QFrame
)

from bot import Bot


class Bridge(QObject):
    log = Signal(str)
    progress = Signal(int)
    finished = Signal()
    infos_count = Signal(int)


class MainWindow(QWidget):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Robô de Automação - Dermosul Bot")
        self.setMinimumSize(640, 520)

        # Estado
        self.infos: List[str] = []
        self.bridge = Bridge()
        self.bridge.log.connect(self.on_log)
        self.bridge.progress.connect(self.on_progress)
        self.bridge.finished.connect(self.on_finished)
        self.bridge.infos_count.connect(self.on_infos_count)

        # Layout raiz
        root = QVBoxLayout(self)
        root.setSpacing(14)
        root.setContentsMargins(20, 20, 20, 20)

        # Header
        title = QLabel("ROBÔ DE AUTOMAÇÃO")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("font-size: 22px; font-weight: 800; color: #ffffff;")

        header = QFrame()
        header.setStyleSheet("background: #6d28d9; border-radius: 16px; padding: 16px;")
        hbox = QVBoxLayout(header)
        hbox.addWidget(title)

        # Linha de botões
        btns = QHBoxLayout()
        self.btn_load = QPushButton("Carregar Infos…")
        self.btn_load.clicked.connect(self.handle_load_infos)
        self.btn_load.setStyleSheet("background:#a78bfa; color:#1f1147; font-weight:700; padding:10px 16px; border-radius:10px;")

        self.lbl_count = QLabel("0 infos carregadas")
        self.lbl_count.setStyleSheet("color:#f5f3ff; font-weight:600; margin-left: 12px;")

        self.btn_start = QPushButton("Iniciar")
        self.btn_start.clicked.connect(self.handle_start)
        self.btn_start.setStyleSheet("background:#1f1147; color:#fff; font-weight:800; padding:10px 16px; border-radius:10px;")

        btns.addWidget(self.btn_load)
        btns.addWidget(self.lbl_count)
        btns.addStretch(1)
        btns.addWidget(self.btn_start)
        hbox.addLayout(btns)

        root.addWidget(header)

        # Logs
        logs_box = QFrame()
        logs_box.setStyleSheet("background: #f8fafc; border:1px solid #e2e8f0; border-radius: 12px;")
        logs_layout = QVBoxLayout(logs_box)

        logs_title = QLabel("STATUS / LOGS")
        logs_title.setStyleSheet("font-size: 14px; font-weight: 800; color:#111827;")

        self.txt_logs = QTextEdit()
        self.txt_logs.setReadOnly(True)
        self.txt_logs.setStyleSheet("background:white; border:1px solid #e5e7eb; border-radius:8px; padding:10px;")

        self.progress = QProgressBar()
        self.progress.setRange(0, 100)
        self.progress.setValue(0)

        logs_layout.addWidget(logs_title)
        logs_layout.addWidget(self.txt_logs)
        logs_layout.addWidget(self.progress)

        root.addWidget(logs_box)

        # Estilo do app (fundo)
        self.setStyleSheet("background: #ede9fe;")

    # ----------------- Slots -----------------
    @Slot()
    def handle_load_infos(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "Selecione o arquivo .txt", os.path.join(os.getcwd(), "dermosul-bot", "infos"), "Text Files (*.txt)")
        if not path:
            return
        try:
            self.infos = Bot.carregar_infos(path)
            self.lbl_count.setText(f"{len(self.infos)} infos carregadas")
            self.on_log(f"✔ {len(self.infos)} infos carregadas do arquivo: {os.path.basename(path)}")
        except Exception as e:
            self.on_log(f"! Erro ao carregar infos: {e}")

    @Slot()
    def handle_start(self) -> None:
        if not self.infos:
            self.on_log("! Nenhuma info carregada. Use 'Carregar Infos…'")
            return
        self.btn_start.setEnabled(False)
        self.btn_load.setEnabled(False)
        self.progress.setValue(0)

        def _run():
            bot = Bot(
                logger=lambda m: self.bridge.log.emit(m),
                on_progress=lambda p: self.bridge.progress.emit(p),
                on_infos_count=lambda c: self.bridge.infos_count.emit(c),
            )
            try:
                bot.run_workflow(self.infos)
            finally:
                self.bridge.finished.emit()

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        self.on_log("▶ Iniciando fluxo…")

    @Slot(str)
    def on_log(self, msg: str) -> None:
        # Colore o log por prefixos comuns
        color = None
        text = msg
        if isinstance(msg, str):
            if msg.startswith('✔'):
                color = '#059669'  # verde
            elif msg.startswith('!'):
                color = '#dc2626'  # vermelho
            elif msg.startswith('→'):
                color = '#2563eb'  # azul
            elif msg.startswith('↻') or msg.startswith('ℹ'):
                color = '#d97706'  # laranja
        if color:
            self.txt_logs.append(f"<span style='color:{color}'>{text}</span>")
        else:
            self.txt_logs.append(text)

    @Slot(int)
    def on_progress(self, value: int) -> None:
        self.progress.setValue(value)

    @Slot()
    def on_finished(self) -> None:
        self.on_log("✔ Finalizado")
        self.btn_start.setEnabled(True)
        self.btn_load.setEnabled(True)

    @Slot(int)
    def on_infos_count(self, count: int) -> None:
        try:
            if count >= 0:
                self.lbl_count.setText(f"{count} infos restantes")
        except Exception:
            pass


def main() -> None:
    app = QApplication(sys.argv)
    w = MainWindow()
    w.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
