import { API_BASE_URL } from './api';

export function resolveImageUrl(url: string | undefined | null): string {
  const raw = (url || '').trim();
  if (!raw) return '';
  // Absolute HTTP(S)
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        // Reaponta para backend local em dev quando for /uploads
        if (u.pathname.startsWith('/uploads')) {
          return `http://localhost:3007${u.pathname}`;
        }
        // Caso contrário, usa a origem/API configurada
        return `${API_BASE_URL}${u.pathname}`;
      }
    } catch {}
    return raw;
  }
  // Paths tipo 'uploads/arquivo'
  if (!raw.startsWith('/')) {
    const clean = `/${raw.replace(/^\.?\/*/, '')}`;
    return resolveImageUrl(clean);
  }
  if (raw.startsWith('/')) {
    // Em dev (Vite em 5174), '/uploads' não é servido pelo Vite.
    // Redireciona para o backend local (3007) quando pertinente.
    try {
      const isDev = (import.meta as any)?.env?.DEV;
      const isUploads = raw.startsWith('/uploads');
      if (isDev && isUploads && typeof window !== 'undefined') {
        const port = window.location.port;
        if (port && port !== '3007') {
          return `http://localhost:3007${raw}`;
        }
      }
    } catch {}
    return `${API_BASE_URL}${raw}`;
  }
  return `${API_BASE_URL}${raw}`;
}
