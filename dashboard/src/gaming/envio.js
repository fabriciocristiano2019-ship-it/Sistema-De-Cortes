import { apiFetch } from '../lib/api';

// Sends a video in small parts. GitHub Codespaces (and other proxies) refuse
// a whole gameplay in one request with "413 Request Entity Too Large"; parts
// of 8 MB always pass. Each part is retried a few times; the server ignores a
// part it already has, so a retry never duplicates data.
const PARTE = 8 * 1024 * 1024;

export function mensagemHttp(status, text) {
  let d = {};
  try { d = JSON.parse(text); } catch { /* not JSON */ }
  if (typeof d.detail === 'string') return d.detail;
  if (status === 413) return 'O vídeo é grande demais para o servidor aceitar de uma vez.';
  if (status === 502 || status === 503 || status === 504) return 'O servidor não respondeu (ele pode estar reiniciando). Tente de novo em alguns segundos.';
  if (/^\s*</.test(text || '')) return `O servidor respondeu com erro ${status}.`;
  return text || `Erro ${status}`;
}

export async function pedir(path, opts) {
  const res = await apiFetch(path, opts);
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(mensagemHttp(res.status, text));
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

// An unfinished upload is remembered in this browser: after a reload, picking
// the same file again continues from the bytes the server already has.
const PENDENTE = 'os_envio_pendente';
const mesmoArquivo = (a, f) => a && a.nome === f.name && a.tamanho === f.size && a.modificado === f.lastModified;

export function envioPendente() {
  try { return JSON.parse(localStorage.getItem(PENDENTE) || 'null'); } catch { return null; }
}

function guardarPendente(v) {
  try { if (v) localStorage.setItem(PENDENTE, JSON.stringify(v)); else localStorage.removeItem(PENDENTE); } catch { /* private mode */ }
}

export function esquecerEnvioPendente() { guardarPendente(null); }

async function retomar(file) {
  const p = envioPendente();
  if (!mesmoArquivo(p, file)) return null;
  try {
    const d = await pedir(`/api/uploads/${p.id}`, { method: 'GET' });
    if (d.complete || d.bytes > file.size) return null;
    return { id: p.id, offset: d.bytes };
  } catch { return null; }   // expired or server restarted: start over
}

export async function enviarVideo(file, onProgresso = () => {}) {
  let id;
  let offset = 0;
  const volta = await retomar(file);
  if (volta) {
    ({ id, offset } = volta);
  } else {
    const slot = await pedir('/api/uploads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name }),
    });
    id = slot.upload_id;
  }
  guardarPendente({ id, nome: file.name, tamanho: file.size, modificado: file.lastModified, em: Date.now() });
  onProgresso(Math.round((offset / file.size) * 100));
  while (offset < file.size) {
    const fim = Math.min(file.size, offset + PARTE);
    let tentativa = 0;
    for (;;) {
      try {
        await pedir(`/api/uploads/${id}/parte?offset=${offset}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: file.slice(offset, fim),
        });
        break;
      } catch (e) {
        tentativa += 1;
        if (tentativa >= 4 || (e.status && e.status < 500 && e.status !== 409)) throw e;
        await new Promise((r) => setTimeout(r, 1500 * tentativa));
      }
    }
    offset = fim;
    onProgresso(Math.round((offset / file.size) * 100));
  }
  await pedir(`/api/uploads/${id}/concluir`, { method: 'POST' });
  guardarPendente(null);
  return id;
}
