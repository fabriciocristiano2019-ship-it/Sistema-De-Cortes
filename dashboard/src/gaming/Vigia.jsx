import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ExternalLink, Loader2, PowerOff, RefreshCw, X } from 'lucide-react';
import { apiJson } from '../lib/api';
import { getApiUrl } from '../config';
import { guardarCodespace, lerCodespace } from './codespace';

// GitHub stops an idle codespace and does not tell the code inside first, so
// the panel cannot warn ahead of time. What it can do: notice within ~30 s
// that the server stopped answering and say what happened and how to wake it
// (reloading the page would only show GitHub's "page not found").
const PASSO = 15000;
const FALHAS = 2;

async function bate() {
  const res = await fetch(getApiUrl('/api/gaming/vivo'), { cache: 'no-store', credentials: 'same-origin' });
  if (res.status === 401) return { ok: true };          // logged out: the password screen handles it
  if (!res.ok) throw new Error(String(res.status));
  const d = await res.json();                           // GitHub's 404 page is HTML: throws here
  if (!d || d.ok !== true) throw new Error('resposta estranha');
  return d;
}

export function SistemaVigia({ onVoltou }) {
  const [caiu, setCaiu] = useState(false);
  const [testando, setTestando] = useState(false);
  const falhas = useRef(0);
  const caiuRef = useRef(false);

  const checar = useCallback(async () => {
    try {
      const d = await bate();
      if (d.codespace !== undefined) guardarCodespace(d.codespace);
      falhas.current = 0;
      if (caiuRef.current) { caiuRef.current = false; setCaiu(false); onVoltou?.(); }
    } catch {
      falhas.current += 1;
      if (falhas.current >= FALHAS && !caiuRef.current) { caiuRef.current = true; setCaiu(true); }
    }
  }, [onVoltou]);

  useEffect(() => {
    checar();
    const t = setInterval(checar, PASSO);
    // A phone wakes the tab after minutes asleep: check at once, not in 15 s.
    const acordou = () => { if (document.visibilityState === 'visible') checar(); };
    document.addEventListener('visibilitychange', acordou);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', acordou); };
  }, [checar]);

  if (!caiu) return null;
  const cs = lerCodespace();
  const tentar = async () => { setTestando(true); await checar(); setTestando(false); };
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4" role="alertdialog" aria-modal="true" aria-labelledby="vigia-titulo">
      <div className="w-full max-w-md rounded-[20px] border border-warn/50 bg-paper2 p-5 text-ink2 shadow-2xl">
        <h2 id="vigia-titulo" className="mb-2 flex items-center gap-2 text-lg font-extrabold text-ink">
          <PowerOff size={18} className="text-warn" aria-hidden="true" /> O sistema desligou
        </h2>
        <p className="mb-2 text-sm">
          O servidor parou de responder. O mais comum é o GitHub ter desligado o Codespace por ficar um tempo sem uso
          (ou ele está reiniciando depois de uma atualização: aí volta sozinho em 1 ou 2 minutos).
        </p>
        <p className="mb-4 text-sm">
          Não crie um Codespace novo: ele viria vazio. Religue este, e o painel volta sozinho nesta tela.
        </p>
        <div className="flex flex-wrap gap-2">
          {cs?.religar_url && (
            <a className="sede-btn-accent inline-flex items-center gap-1.5 px-4" href={cs.religar_url} target="_blank" rel="noreferrer">
              <ExternalLink size={15} aria-hidden="true" /> Religar o Codespace
            </a>
          )}
          <button type="button" onClick={tentar} disabled={testando}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rule2 px-4 py-2 text-sm font-bold text-ink2 hover:border-brass disabled:opacity-60">
            {testando ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />} Tentar de novo
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          {cs?.religar_url ? 'O link abre o Codespace no navegador; deixe aquela aba aberta enquanto usa o painel.'
            : <>Abra <a className="underline" href="https://github.com/codespaces" target="_blank" rel="noreferrer">github.com/codespaces</a> e clique no seu Codespace (não em &quot;Create&quot;).</>}
          {' '}Se havia vídeo processando, confira na Sede quando voltar.
        </p>
      </div>
    </div>
  );
}

// "These clips are in no backup yet": on the Sede, at most once a day.
const ADIA = 'os_backup_adiado';
const DIA = 24 * 3600 * 1000;

export function LembreteBackup({ atualizar = 0 }) {
  const [r, setR] = useState(null);
  const [adiado, setAdiado] = useState(() => {
    try { return Date.now() - Number(localStorage.getItem(ADIA) || 0) < DIA; } catch { return false; }
  });
  useEffect(() => { apiJson('/api/gaming/backup/resumo').then(setR).catch(() => {}); }, [atualizar]);
  if (adiado || !r || !r.cortes_sem_backup) return null;
  const velho = !r.ultimo_backup || Date.now() / 1000 - r.ultimo_backup > 3 * 24 * 3600;
  if (!velho && r.cortes_sem_backup < 10) return null;
  const n = r.cortes_sem_backup;
  const depois = () => { try { localStorage.setItem(ADIA, String(Date.now())); } catch { /* private */ } setAdiado(true); };
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-[16px] border border-warn/40 bg-paper2 px-4 py-3 text-sm text-ink2">
      <Archive size={16} className="shrink-0 text-warn" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <b className="text-ink">{n} corte{n > 1 ? 's' : ''} sem backup.</b>{' '}
        {r.ultimo_backup ? 'Desde o último backup você fez cortes novos.' : 'Você ainda não baixou nenhum backup.'}
        {' '}Se o Codespace for apagado, eles vão junto.
      </span>
      <a className="sede-btn-accent px-3 py-1.5 text-[13px]" href={getApiUrl('/api/gaming/backup')} download onClick={depois}>Baixar backup</a>
      <button type="button" className="btn-quiet btn-sm" onClick={depois} aria-label="Lembrar amanhã"><X size={15} /></button>
    </div>
  );
}
