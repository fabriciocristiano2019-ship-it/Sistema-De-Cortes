// Shared helpers for the Gaming Edition panel.
import { apiJson } from '../lib/api';
import { getApiUrl } from '../config';

export const fmtTime = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
};

export const fmtDate = (epochSeconds) =>
  epochSeconds
    ? new Date(epochSeconds * 1000).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';

// Wall-clock time of a console line (epoch seconds from the server).
export const fmtClock = (epochSeconds) =>
  new Date(epochSeconds * 1000).toLocaleTimeString('pt-BR', { hour12: false });

export const LAYOUT_SHORT = {
  auto: 'Formato automático', full: 'Formato A', webcam: 'Formato B', vertical: 'Formato C',
};

export const mediaUrl = (path) => (path ? getApiUrl(path) : '');

export const errText = (e) => e?.detail || e?.message || 'Erro inesperado';

export const jsonReq = (path, method, body, headers = {}) =>
  apiJson(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const STATUS_LABEL = {
  pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado',
  aguardando_aprovacao: 'Aguardando aprovação', agendado: 'Agendado', enviado: 'Enviado',
  falhou: 'Falhou', cancelado: 'Cancelado',
  queued: 'Na fila', processing: 'Processando', completed: 'Concluído', failed: 'Falhou',
  cancelled: 'Cancelado',
};

export const STATUS_TONE = {
  aprovado: 'text-ok border-ok/40', enviado: 'text-ok border-ok/40', completed: 'text-ok border-ok/40',
  rejeitado: 'text-danger border-danger/40', falhou: 'text-danger border-danger/40',
  failed: 'text-danger border-danger/40',
  agendado: 'text-brass border-brass/40', processing: 'text-brass border-brass/40',
  queued: 'text-brass border-brass/40',
};

export const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram Reels' },
  { id: 'youtube', label: 'YouTube Shorts' },
];

export const JOB_KEY = 'os_gaming_job';

// Links that come from outside (social network APIs) only open when they are
// plain http(s): a "javascript:" or "data:" address would run in the panel.
export const safeHttpUrl = (url) => {
  try {
    const u = new URL(String(url || ''), window.location.origin);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch (_) { return null; }
};
