import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { API_BASE_URL, http } from '../../lib/api';
import type { ScrapeRealtimeEvent } from '../../lib/scraping/types';

type ScrapeJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

interface ScrapeJobLogEntry {
  id: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  timestamp: string;
  context?: Record<string, unknown>;
}

interface ScrapeJobDto {
  id: string;
  sourceUrl: string;
  mode: string;
  turbo?: boolean;
  status: ScrapeJobStatus;
  processed: number;
  totalFound: number | null;
  logs?: unknown;
  createdAt: string;
  finishedAt?: string | null;
}

interface ScrapeStatusResponse {
  job: ScrapeJobDto;
  processedResults: number;
}

interface ScrapeResultDto {
  id: string;
  title: string;
  brand: string | null;
  price: number | null;
  sku: string | null;
  shortDescription: string | null;
  longDescriptionHtml: string | null;
  images?: string[] | null;
  attributes?: Record<string, unknown> | null;
  createdAt: string;
}

interface JobsResponse {
  data: ScrapeJobDto[];
}

interface ResultsResponse {
  data: ScrapeResultDto[];
}

const statusLabels: Record<ScrapeJobStatus, string> = {
  queued: 'Na fila',
  running: 'Em andamento',
  done: 'Concluído',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCurrency(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);
}

function normalizeLogs(raw: unknown): ScrapeJobLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: ScrapeJobLogEntry[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    const id = candidate.id;
    const message = candidate.message;
    const level = candidate.level;
    const timestamp = candidate.timestamp;
    if (!id || !message || !timestamp) continue;

    entries.push({
      id: String(id),
      message: String(message),
      level: level === 'warn' || level === 'error' ? level : 'info',
      timestamp: String(timestamp),
      context: typeof candidate.context === 'object' && candidate.context ? (candidate.context as Record<string, unknown>) : undefined,
    });
  }

  return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

const MAX_VISIBLE_LOGS = 200;

export default function WebScrapingPage() {
  const [urlInput, setUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentJob, setCurrentJob] = useState<ScrapeJobDto | null>(null);
  const [jobLogs, setJobLogs] = useState<ScrapeJobLogEntry[]>([]);
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [results, setResults] = useState<ScrapeResultDto[]>([]);
  const [history, setHistory] = useState<ScrapeJobDto[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const percentage = useMemo(() => {
    if (progress.total <= 0) return 0;
    return Math.min(100, Math.round((progress.processed / progress.total) * 100));
  }, [progress]);

  const modeLabel = useMemo(() => {
    if (!currentJob) return '-';
    const base = currentJob.mode === 'test' ? 'Teste' : 'Completo';
    return currentJob.turbo ? `${base} (Turbo)` : base;
  }, [currentJob]);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await http<JobsResponse>('/scrape/jobs');
      if (Array.isArray(response?.data)) {
        setHistory(response.data);
      }
    } catch (error) {
      console.error('[web-scraping] falha ao carregar histórico', error);
    }
  }, []);

  const loadResults = useCallback(async (jobId: string) => {
    try {
      const response = await http<ResultsResponse>(`/scrape/result/${jobId}`);
      if (Array.isArray(response?.data)) {
        setResults(response.data);
      }
    } catch (error) {
      console.error('[web-scraping] falha ao buscar resultados', error);
    }
  }, []);

  const loadJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await http<ScrapeStatusResponse>(`/scrape/status/${jobId}`);
      if (response?.job) {
        setCurrentJob(response.job);
        setProgress({ processed: response.job.processed ?? 0, total: response.job.totalFound ?? 0 });
        const logs = normalizeLogs(response.job.logs);
        setJobLogs(logs);
        setTurboMode(response.job.turbo ?? false);
        if (response.job.status === 'done') {
          await loadResults(jobId);
        }
      }
    } catch (error) {
      console.error('[web-scraping] falha ao carregar status', error);
    }
  }, [loadResults]);

  const handleSocketEvent = useCallback((event: ScrapeRealtimeEvent) => {
    const activeJobId = activeJobIdRef.current;
    if (!activeJobId || event.jobId !== activeJobId) return;

    if (event.type === 'log') {
      setJobLogs((prev) => {
        const exists = prev.some((log) => log.id === event.logId);
        if (exists) return prev;
        const next = [
          ...prev,
          {
            id: event.logId || `${Date.now()}`,
            message: event.message,
            level: event.level || 'info',
            timestamp: event.timestamp || new Date().toISOString(),
            context: event.meta,
          },
        ].slice(-MAX_VISIBLE_LOGS);
        return next;
      });
      if (typeof event.processed === 'number' || typeof event.total === 'number') {
        setProgress((prev) => ({
          processed: typeof event.processed === 'number' ? event.processed : prev.processed,
          total: typeof event.total === 'number' ? event.total : prev.total,
        }));
      }
    } else if (event.type === 'progress') {
      setProgress({ processed: event.processed, total: event.total });
      setCurrentJob((prev) => prev ? { ...prev, processed: event.processed, totalFound: event.total } : prev);
    } else if (event.type === 'status') {
      setCurrentJob((prev) => prev ? { ...prev, status: event.status, processed: event.processed ?? prev.processed, totalFound: event.total ?? prev.totalFound } : prev);
      if (event.status === 'done') {
        setSuccessMessage('Extração concluída com sucesso!');
        loadResults(event.jobId);
        refreshHistory();
      }
      if (event.status === 'failed') {
        setErrorMessage(event.errorMessage || 'Falha ao executar o scraping. Consulte os logs.');
      }
      if (event.status === 'cancelled') {
        setErrorMessage('Processo cancelado.');
      }
    }
  }, [loadResults, refreshHistory]);

  const resolveSocketOrigin = useCallback(() => {
    const envBase = (API_BASE_URL || '').replace(/\/+$/, '');
    if (envBase) {
      return envBase.toLowerCase().endsWith('/api') ? envBase.slice(0, -4) : envBase;
    }
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }, []);

  useEffect(() => {
    const socketBase = resolveSocketOrigin();
    const socket = socketBase
      ? io(socketBase, { path: '/socket.io', transports: ['websocket', 'polling'], withCredentials: true })
      : io({ path: '/socket.io', transports: ['websocket', 'polling'], withCredentials: true });
    socketRef.current = socket;
    const listener = (event: ScrapeRealtimeEvent) => handleSocketEvent(event);
    socket.on('scrape:event', listener);
    return () => {
      socket.off('scrape:event', listener);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [handleSocketEvent, resolveSocketOrigin]);

  useEffect(() => {
    if (!socketRef.current) return;
    const jobId = currentJob?.id;
    activeJobIdRef.current = jobId ?? null;
    if (jobId) {
      socketRef.current.emit('scrape:subscribe', jobId);
      return () => {
        socketRef.current?.emit('scrape:unsubscribe', jobId);
      };
    }
    return undefined;
  }, [currentJob?.id]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobLogs]);

  const startJob = useCallback(async (mode: 'full' | 'test') => {
    if (!urlInput.trim()) {
      setErrorMessage('Informe uma URL de categoria para iniciar a extração.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await http<{ jobId: string; status: ScrapeJobStatus; mode: string; turbo?: boolean }>('/scrape/start', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput.trim(), mode, turbo: turboMode }),
      });
      const jobId = response?.jobId;
      if (jobId) {
        await loadJobStatus(jobId);
        setResults([]);
        refreshHistory();
      }
    } catch (error) {
      console.error('[web-scraping] falha ao iniciar job', error);
      setErrorMessage((error as Error).message || 'Falha ao iniciar o scraping.');
    } finally {
      setIsSubmitting(false);
    }
  }, [urlInput, turboMode, loadJobStatus, refreshHistory]);

  const cancelJob = useCallback(async () => {
    if (!currentJob?.id) return;
    try {
      await http(`/scrape/cancel/${currentJob.id}`, { method: 'POST' });
      setErrorMessage('Cancelamento solicitado. Aguarde a confirmação nos logs.');
    } catch (error) {
      setErrorMessage((error as Error).message || 'Não foi possível cancelar o job.');
    }
  }, [currentJob?.id]);

  const selectJobFromHistory = useCallback(async (job: ScrapeJobDto) => {
    setCurrentJob(job);
    setProgress({ processed: job.processed ?? 0, total: job.totalFound ?? 0 });
    setJobLogs(normalizeLogs(job.logs));
    setTurboMode(job.turbo ?? false);
    if (job.status === 'done') {
      await loadResults(job.id);
    } else {
      setResults([]);
    }
    await loadJobStatus(job.id);
  }, [loadResults, loadJobStatus]);

  const clearHistory = useCallback(async () => {
    if (isClearingHistory) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Deseja remover o histórico de jobs concluídos?');
      if (!confirmed) return;
    }
    setIsClearingHistory(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await http<{ deleted: number }>('/scrape/jobs', { method: 'DELETE' });
      await refreshHistory();
      if (currentJob && (currentJob.status === 'done' || currentJob.status === 'failed' || currentJob.status === 'cancelled')) {
        setCurrentJob(null);
        setProgress({ processed: 0, total: 0 });
        setJobLogs([]);
        setResults([]);
        setTurboMode(false);
      }
      setSuccessMessage('Histórico limpo.');
    } catch (error) {
      console.error('[web-scraping] falha ao limpar histórico', error);
      setErrorMessage((error as Error).message || 'Não foi possível limpar o histórico.');
    } finally {
      setIsClearingHistory(false);
    }
  }, [currentJob, isClearingHistory, refreshHistory]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-white/5 p-6 shadow-2xl shadow-sky-900/20">
        <div>
          <h1 className="text-2xl font-semibold text-white">Web Scraping de Catálogos</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Informe a URL de uma categoria autorizada para capturar automaticamente os produtos, com acompanhamento em tempo real de progresso e logs.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 text-sm text-slate-200">
            URL do catálogo
            <input
              className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-sm text-white focus:border-sky-400 focus:outline-none"
              placeholder="https://exemplo.com/dermocosmeticos"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              disabled={isSubmitting}
            />
          </label>
          <div className="flex flex-col gap-2 md:items-end">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-slate-600 bg-transparent text-sky-400 focus:ring-sky-500"
                checked={turboMode}
                onChange={(event) => setTurboMode(event.target.checked)}
                disabled={isSubmitting}
              />
              <span>Modo turbo (mais rápido, sem fallback dinâmico)</span>
            </label>
            <div className="flex gap-2">
              <button
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                onClick={() => startJob('test')}
                disabled={isSubmitting}
              >
                Testar (1 produto)
              </button>
              <button
                className="rounded-xl border border-sky-500 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
                onClick={() => startJob('full')}
                disabled={isSubmitting}
              >
                Começar extração
              </button>
            </div>
          </div>
        </div>
        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}
      </header>

      {currentJob && (
        <section className="grid gap-6 rounded-3xl border border-slate-800 bg-[#0c1424] p-6 shadow-inner shadow-sky-900/30 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Job atual</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{currentJob.sourceUrl}</h2>
                <p className="text-xs text-slate-400">{statusLabels[currentJob.status]} • criado em {formatDate(currentJob.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Modo:</span>
                <span className="rounded-full border border-slate-600 px-3 py-1 font-semibold text-slate-200">{modeLabel}</span>
              </div>
            </header>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{progress.processed} de {progress.total || '?'} produtos</span>
                <span>{percentage}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full border border-slate-700 bg-slate-900">
                <div
                  className="h-full bg-gradient-to-r from-sky-400/80 via-sky-500 to-sky-300 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>Logs em tempo real</span>
                {currentJob.status === 'running' && (
                  <button
                    className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                    onClick={cancelJob}
                  >
                    Cancelar
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto px-4 py-3 text-xs text-slate-200">
                {jobLogs.length === 0 && <p className="text-slate-500">Aguardando eventos...</p>}
                {jobLogs.map((log) => (
                  <div key={log.id} className="py-1">
                    <span className="mr-2 text-[10px] font-mono uppercase text-slate-500">{formatDate(log.timestamp)}</span>
                    <span className={log.level === 'error' ? 'text-red-300' : log.level === 'warn' ? 'text-amber-300' : 'text-slate-100'}>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Resumo</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li><span className="text-slate-400">Status:</span> <span className="text-slate-100">{statusLabels[currentJob.status]}</span></li>
                <li><span className="text-slate-400">Modo:</span> <span className="text-slate-100">{modeLabel}</span></li>
                <li><span className="text-slate-400">Processados:</span> <span className="text-slate-100">{progress.processed}</span></li>
                <li><span className="text-slate-400">Total previsto:</span> <span className="text-slate-100">{progress.total || 'em análise'}</span></li>
                <li><span className="text-slate-400">Iniciado:</span> <span className="text-slate-100">{formatDate(currentJob.createdAt)}</span></li>
                <li><span className="text-slate-400">Finalizado:</span> <span className="text-slate-100">{formatDate(currentJob.finishedAt)}</span></li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
              <p className="font-semibold text-slate-200">Boas práticas</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Use domínios presentes na whitelist.</li>
                <li>Evite executar múltiplos scrapers simultâneos.</li>
                <li>Após finalizar, revise os produtos importados.</li>
              </ul>
            </div>
          </aside>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-slate-800 bg-[#0c1424] p-6">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Produtos importados</h3>
              <p className="text-xs text-slate-400">Atualizado em tempo real durante a execução.</p>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{results.length} itens</span>
          </header>
          <div className="mt-4 divide-y divide-slate-800">
            {results.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">Nenhum produto disponível ainda.</p>
            )}
            {results.map((product) => (
              <article key={product.id} className="py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{product.title}</h4>
                    {product.brand && <p className="text-xs text-slate-400">{product.brand}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-300">
                    <span>{formatCurrency(product.price ?? null)}</span>
                    {product.sku && <span className="rounded-full border border-slate-700 px-2 py-1">SKU {product.sku}</span>}
                  </div>
                </div>
                {product.shortDescription && (
                  <p className="mt-2 text-xs text-slate-400">{product.shortDescription}</p>
                )}
                {product.longDescriptionHtml && (
                  <details className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                    <summary className="cursor-pointer text-slate-300">Ver descrição completa</summary>
                    <div className="prose prose-invert mt-2 max-w-none text-xs" dangerouslySetInnerHTML={{ __html: product.longDescriptionHtml }} />
                  </details>
                )}
              </article>
            ))}
          </div>
        </div>
        <aside className="rounded-3xl border border-slate-800 bg-[#0c1424] p-6">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Histórico</h3>
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-sky-300 hover:text-sky-200 disabled:opacity-50"
                onClick={refreshHistory}
                disabled={isClearingHistory}
              >
                Atualizar
              </button>
              <button
                className="text-xs text-rose-300 hover:text-rose-200 disabled:opacity-50"
                onClick={clearHistory}
                disabled={isClearingHistory || history.length === 0}
              >
                Limpar
              </button>
            </div>
          </header>
          <div className="mt-4 space-y-3">
            {history.length === 0 && <p className="text-xs text-slate-500">Nenhum job registrado ainda.</p>}
            {history.map((job) => (
              <button
                key={job.id}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-xs transition ${currentJob?.id === job.id ? 'border-sky-500 bg-sky-500/10 text-sky-200' : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700 hover:bg-slate-900'}`}
                onClick={() => selectJobFromHistory(job)}
              >
                <p className="font-semibold text-white">{statusLabels[job.status]}</p>
                <p className="mt-1 truncate text-[11px] text-slate-400">{job.sourceUrl}</p>
                <p className="mt-1 text-[11px] text-slate-500">{job.mode === 'test' ? 'Teste' : 'Completo'}{job.turbo ? ' · Turbo' : ''}</p>
                <p className="mt-1 text-[11px] text-slate-500">{job.processed} / {job.totalFound ?? '??'} itens</p>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
