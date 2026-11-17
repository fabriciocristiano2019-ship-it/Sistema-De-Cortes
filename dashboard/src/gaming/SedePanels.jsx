import React, { useEffect, useRef, useState } from 'react';
import {
  Check, CheckCircle2, Download, Loader2, Plus, Scissors, Sparkles, Terminal, Upload, X, XCircle, Zap,
} from 'lucide-react';
import { apiJson } from '../lib/api';
import { errText, fmtClock, jsonReq, LAYOUT_SHORT, mediaUrl, STATUS_LABEL } from './util';
import { LOOK } from './agents';

const CLIP_COUNTS = [1, 3, 5, 8, 10, 15, 20, 30];

const ACTIVE = ['queued', 'processing'];

const LAYOUT_HINT = {
  auto: 'O sistema escolhe o melhor enquadramento para cada cena.',
  full: 'Mostra a tela inteira do jogo, com vida, mapa e placar (HUD).',
  webcam: 'Jogo em cima e a sua câmera embaixo, maior.',
  vertical: 'Recorta o centro da tela para ocupar o celular todo.',
};

/* Orquestrador ------------------------------------------------------------ */

export function OrchestratorPanel({
  meta, games, form, setForm, job, starting, startError, cancelling, onStartFile, onStartUrl, onCancel, onAddGame, onImportLink,
  proAI = false, onProAI, uploadPct = null,
}) {
  const fileRef = useRef(null);
  const active = job && ACTIVE.includes(job.status);
  const snap = job?.snap;
  const pct = snap?.progress ?? 0;
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const durations = meta?.durations || [15, 30, 45, 60];
  const customDur = !durations.includes(Number(form.clip_seconds));
  const link = (form.url || '').trim();
  const linkOk = /^https?:\/\/\S+\.\S+/i.test(link);
  const ytOnCloud = linkOk && /(^|\.)(youtube\.com|youtu\.be)\//i.test(link.replace(/^https?:\/\//i, '').replace(/^www\./i, ''))
    && /\.app\.github\.dev$/i.test(window.location.hostname);

  const pickGame = (id) => {
    const g = (games || []).find((x) => x.id === id);
    setForm((p) => ({
      ...p,
      game_id: id,
      ...(g ? { category: g.category, clip_seconds: g.preferences.clip_seconds, layout: g.preferences.layout } : {}),
    }));
  };

  let badge = { label: 'PRONTO', cls: 'text-ok border-ok/40 bg-ok/10' };
  if (active) badge = { label: job.status === 'queued' ? 'NA FILA' : 'PROCESSANDO', cls: 'text-warn border-warn/40 bg-warn/10' };
  else if (job?.status === 'failed') badge = { label: 'FALHOU', cls: 'text-danger border-danger/40 bg-danger/10' };

  return (
    <section aria-label="Orquestrador Core AI" className="rounded-[20px] border border-rule2 bg-paper2 p-4" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="flex items-center gap-2 text-[13px] font-extrabold tracking-wide text-brass">
          <Zap size={16} aria-hidden="true" /> NOVO CORTE
        </h2>
        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider ${badge.cls}`}>{badge.label}</span>
      </div>
      {!active && (
        <p className="-mt-2 mb-3 text-[11.5px] leading-snug text-muted">
          Escolha as opções e envie o vídeo. O J.A.R.V.I.S. e os 8 agentes fazem o resto.
        </p>
      )}
      {!active && (proAI && form.engine !== 'local' ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-ok/35 bg-ok/10 px-3 py-2 text-[11px] font-bold text-ok">
          <Sparkles size={14} aria-hidden="true" /> IA profissional ligada (Gemini)
        </p>
      ) : (
        <button type="button" onClick={onProAI}
          className="mb-4 flex w-full items-center gap-2 rounded-xl border border-dashed border-brass/50 px-3 py-2 text-left text-[11px] text-ink2 hover:border-brass">
          <Sparkles size={14} className="shrink-0 text-brass" aria-hidden="true" />
          <span><b className="text-ink">Ativar IA profissional (Gemini)</b>: cortes, títulos e legendas melhores. Coloque a chave em Configurações.</span>
        </button>
      ))}

      <label className="flex items-center gap-2 text-xs font-bold text-ink mb-1.5" htmlFor="sede-game"><span className="sede-step">1</span>Qual jogo?</label>
      <div className="flex gap-2 mb-3">
        <select id="sede-game" className="sede-select flex-1 min-w-0" value={form.game_id}
          title="Detecção automática: reconhece o jogo pelo nome do arquivo e pelo que é dito no vídeo" disabled={active} onChange={(e) => pickGame(e.target.value)}>
          <option value="auto">Descobrir sozinho</option>
          {(games || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button type="button" onClick={onAddGame} title="Cadastrar um jogo na biblioteca" aria-label="Cadastrar um jogo na biblioteca"
          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] border border-rule2 text-brass hover:border-brass">
          <Plus size={17} />
        </button>
      </div>

      {!active && <p className="-mt-2 mb-3 text-[10.5px] text-muted">Reconhece pelo nome do arquivo e pelo que é falado.</p>}

      <div className="grid grid-cols-2 gap-2 mb-1">
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-ink mb-1.5" htmlFor="sede-dur"><span className="sede-step">2</span>Tamanho do corte</label>
          <select id="sede-dur" className="sede-select w-full" disabled={active} value={customDur ? 'custom' : String(form.clip_seconds)}
            onChange={(e) => (e.target.value === 'other' ? onImportLink() : set('clip_seconds', Number(e.target.value)))}>
            {durations.map((d) => <option key={d} value={d}>{d} segundos</option>)}
            {customDur && <option value="custom">{form.clip_seconds} segundos</option>}
            <option value="other">Personalizada…</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-ink mb-1.5" htmlFor="sede-layout"><span className="sede-step">3</span>Enquadramento</label>
          <select id="sede-layout" className="sede-select w-full" disabled={active} value={form.layout} onChange={(e) => set('layout', e.target.value)}>
            <option value="auto">Automático</option>
            <option value="full">Tela inteira</option>
            <option value="webcam">Jogo + webcam</option>
            <option value="vertical">Vertical recortado</option>
          </select>
        </div>
      </div>

      {!active && <p className="mb-3 text-[10.5px] leading-snug text-muted">{LAYOUT_HINT[form.layout] || LAYOUT_HINT.auto}</p>}

      <div className="mb-3">
        <label className="flex items-center gap-2 text-xs font-bold text-ink mb-1.5" htmlFor="sede-qtd"><span className="sede-step">4</span>Quantidade de cortes</label>
        <select id="sede-qtd" className="sede-select w-full" disabled={active} value={String(form.max_clips)}
          onChange={(e) => set('max_clips', Number(e.target.value))}>
          {CLIP_COUNTS.map((n) => <option key={n} value={n}>{n === 1 ? '1 corte' : `${n} cortes de uma vez`}</option>)}
        </select>
        <label className="mt-2 flex items-start gap-1.5 pl-[26px] text-xs text-ink2">
          <input type="checkbox" className="mt-px" checked={form.fill !== false} disabled={active} onChange={(e) => set('fill', e.target.checked)} />
          <span>Entregar sempre essa quantidade (se faltarem momentos fortes, usa os melhores trechos que sobrarem)</span>
        </label>
        {!active && <p className="mt-1 pl-[26px] text-[10.5px] leading-snug text-muted">
          Os cortes não se repetem: {Number(form.max_clips)} cortes de {Number(form.clip_seconds) || 30} s precisam de um vídeo com pelo menos {Math.ceil(Number(form.max_clips) * (Number(form.clip_seconds) || 30) / 60)} min. Um vídeo de 1 hora dá conta.
        </p>}
      </div>

      <p className="flex items-center gap-2 text-xs font-bold text-ink mb-1.5"><span className="sede-step">5</span>Extras</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 pl-[26px] text-xs text-ink2">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-[var(--color-accent)]" checked={!!form.captions} disabled={active} onChange={(e) => set('captions', e.target.checked)} />
          Legendas animadas
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-[var(--color-accent)]" checked={!!form.zoom} disabled={active} onChange={(e) => set('zoom', e.target.checked)} />
          Zoom nos melhores momentos
        </label>
      </div>

      <input ref={fileRef} type="file" accept="video/*,.mkv,.mov,.mp4,.webm,.avi,.m4v" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onStartFile(f); }} />

      {active ? (
        <>
          <button type="button" onClick={onCancel} disabled={cancelling}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-danger px-2 py-2.5 text-[12.5px] font-extrabold text-white whitespace-nowrap transition hover:brightness-110 disabled:opacity-60">
            {cancelling ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
            {cancelling ? 'Cancelando…' : `Cancelar Processamento (${pct}%)`}
          </button>
          <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-ink2">
            <span className="truncate">{job.status === 'queued' ? 'Aguardando vaga na fila…' : 'Delegando tarefas aos agentes…'}</span>
            <span className="shrink-0 tabular-nums">Etapa {snap?.step ?? 1}/{snap?.steps ?? 8}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
            aria-label="Progresso do processamento">
            <div className="h-full rounded-full bg-brass transition-[width] duration-700" style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
          {snap?.step_label && <p className="mt-1.5 text-[11px] text-muted truncate">Agora: {snap.step_label}</p>}
        </>
      ) : (
        <>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={starting}
            className="sede-cta flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-[12px] font-extrabold whitespace-nowrap transition hover:brightness-110 disabled:opacity-60">
            {starting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {starting ? (uploadPct != null ? `Enviando o vídeo… ${uploadPct}%` : 'Enviando…') : 'Escolher vídeo e começar'}
          </button>
          <div className="my-3 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-rule2" /> ou cole um link <span className="h-px flex-1 bg-rule2" />
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (linkOk) onStartUrl(); }}>
            <label htmlFor="sede-url" className="sr-only">Link do vídeo</label>
            <input id="sede-url" type="url" inputMode="url" placeholder="https://youtube.com/watch?v=…" value={form.url || ''}
              onChange={(e) => set('url', e.target.value)} disabled={starting}
              className="sede-select !bg-none min-w-0 flex-1 !pr-3 font-normal" />
            <button type="submit" disabled={!linkOk || starting} title="Baixar o vídeo do link e começar"
              className="sede-btn-accent shrink-0 disabled:opacity-50">Começar</button>
          </form>
          {ytOnCloud && (
            <p className="mt-2 text-[10.5px] leading-snug text-warn">
              No Codespaces o YouTube costuma bloquear downloads (pede login). Se falhar, envie o arquivo do vídeo
              ou configure os cookies do YouTube (guia LEIA-ME).
            </p>
          )}
          <button type="button" onClick={onImportLink} className="mt-2 w-full text-center text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline">
            Mais opções de importação
          </button>
        </>
      )}
      {starting && uploadPct != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper3" role="progressbar" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={uploadPct} aria-label="Envio do vídeo">
          <div className="h-full rounded-full bg-brass transition-[width] duration-300" style={{ width: `${Math.max(2, uploadPct)}%` }} />
        </div>
      )}
      {startError && <p role="alert" className="mt-2 text-xs text-danger">{startError}</p>}
      {!active && job?.status === 'failed' && job.snap?.error && (
        <p role="alert" className="mt-2 text-xs text-danger">Último processamento falhou: {job.snap.error}</p>
      )}
    </section>
  );
}

/* Console ----------------------------------------------------------------- */

const LEVEL = {
  ok: { label: 'feito', color: '#34d399' },
  info: { label: 'info', color: '#60a5fa' },
  progress: { label: 'info', color: '#60a5fa' },
  warn: { label: 'aviso', color: '#fbbf24' },
  error: { label: 'erro', color: '#fb7185' },
};

// Live diary of the agents: one line per step, the agent's codename in its own
// colour (the same as its room on the map), then what it did.
export function ConsolePanel({ lines, roles }) {
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <section aria-label="Diário dos agentes" className="sede-console rounded-[20px] border border-rule2 p-4 text-slate-200">
      <div className="border-b border-white/10 pb-2.5 mb-2.5">
        <h2 className="flex items-center gap-2 text-[12px] font-extrabold tracking-wide text-emerald-400">
          <Terminal size={14} className="shrink-0" aria-hidden="true" /> DIÁRIO DOS AGENTES
        </h2>
        <p className="mt-0.5 text-[10.5px] text-slate-400">O que cada agente está fazendo, em tempo real.</p>
      </div>
      <div ref={box} role="log" aria-live="polite" tabIndex={0} className="h-72 overflow-y-auto pr-1 text-[11.5px] leading-snug space-y-2 custom-scrollbar">
        {lines.map((l, i) => {
          const isAgent = l.agent && l.agent !== 'core';
          const who = l.agent === 'core' || !l.agent ? 'J.A.R.V.I.S.' : (roles[l.agent] || l.agent).split(' · ')[0];
          const color = isAgent ? (LOOK[l.agent]?.color || '#a5b4fc') : '#22d3ee';
          const lv = LEVEL[l.level] || LEVEL.info;
          return (
            <p key={i} className="break-words">
              <span className="font-mono text-[11px] text-slate-400 mr-1.5">{l.t ? fmtClock(l.t) : '--:--:--'}</span>
              <span className="font-extrabold mr-1.5" style={{ color }}>{who}</span>
              {(l.level === 'warn' || l.level === 'error') && (
                <span className="mr-1.5 rounded px-1 text-[9.5px] font-extrabold uppercase" style={{ color: lv.color, boxShadow: `inset 0 0 0 1px ${lv.color}` }}>{lv.label}</span>
              )}
              <span className={l.level === 'ok' ? 'text-slate-100' : 'text-slate-300'}>{isAgent ? l.text : String(l.text).replace(/^J\.A\.R\.V\.I\.S\.:?\s*/, '')}</span>
            </p>
          );
        })}
      </div>
    </section>
  );
}

/* Cortes + prévia --------------------------------------------------------- */

export function ClipsStrip({ clips, selectedKey, onSelect, onReload, onOpenEditor, rendering }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const approve = async (c) => {
    const key = `${c.job_id}:${c.clip_index}`;
    setBusy(key); setErr('');
    try {
      await jsonReq(`/api/gaming/clips/${c.job_id}/${c.clip_index}`, 'PATCH', { approved: true });
      await onReload();
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  };
  return (
    <section aria-label="Cortes identificados" className="rounded-[20px] border border-rule2 bg-paper2 p-4 min-w-0" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
            <Scissors size={17} className="text-brass" aria-hidden="true" /> Cortes Automáticos Identificados ({clips.length})
          </h2>
          <p className="text-xs text-muted mt-0.5">Só entram momentos com evidência • Aprovação manual obrigatória</p>
        </div>
        <button type="button" onClick={onOpenEditor} className="text-xs font-bold text-brass hover:underline">Abrir Editor Completo →</button>
      </div>
      {err && <p role="alert" className="mb-3 text-xs text-danger">{err}</p>}
      {clips.length === 0 ? (
        <p className="rounded-xl border border-dashed border-rule2 px-4 py-10 text-center text-sm text-muted">
          {rendering ? 'Os agentes ainda estão trabalhando. Os cortes aparecem aqui assim que ficarem prontos.' : 'Nenhum corte ainda. Importe uma gameplay para os agentes começarem.'}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {clips.map((c) => {
            const key = `${c.job_id}:${c.clip_index}`;
            const on = key === selectedKey;
            const secs = Math.round((c.end || 0) - (c.start || 0));
            const ready = !!c.video_url;
            return (
              <li key={key}>
                {/* The whole card is clickable for the mouse; keyboard and screen
                    readers use the title button (a card with role=button cannot
                    hold the Approve/Download controls: nested-interactive). */}
                <div onClick={() => onSelect(c)}
                  className={`flex h-full cursor-pointer flex-col rounded-2xl border p-3 transition focus-within:border-brass ${on ? 'border-brass bg-brass/5' : 'border-rule2 hover:border-brass/50'}`}>
                  <div className="flex items-start gap-2.5 mb-2.5">
                    <span title={`Pontuação de relevância ${c.relevance_score}/100, calculada das evidências de áudio, imagem e fala`}
                      className="rounded-md border border-ok/40 bg-ok/10 px-2 py-1 text-center text-[10px] font-extrabold leading-tight text-ok">
                      VIRAL<br />{Math.round(c.relevance_score ?? c.predicted_score ?? 0)}%
                    </span>
                    <span className="font-mono text-[10.5px] leading-snug text-ink2">
                      {c.start_timecode} -<br />{c.end_timecode} ({secs}s)
                    </span>
                  </div>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-wide text-brass">{c.moment_label}{c.game_name ? ` · ${c.game_name}` : ''}</p>
                  <h3 className="mt-1 text-[13px] font-extrabold uppercase leading-snug text-ink">
                    <button type="button" aria-pressed={on} onClick={(e) => { e.stopPropagation(); onSelect(c); }}
                      className="text-left uppercase rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
                      {c.video_title_for_youtube_short}
                    </button>
                  </h3>
                  <p className="mt-1.5 text-xs text-ink2 line-clamp-2">{c.description}</p>
                  {Array.isArray(c.evidence) && c.evidence.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-muted line-clamp-2" title={c.evidence.join(' · ')}>Evidências: {c.evidence.join(' · ')}</p>
                  )}
                  <div className="flex-1 min-h-3" />
                  <div className="flex items-center gap-2 border-t border-rule pt-3">
                    {c.status === 'aprovado' ? (
                      <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ok/40 py-1.5 text-xs font-bold text-ok"><Check size={14} /> Aprovado</span>
                    ) : (
                      <button type="button" disabled={!ready || busy === key} onClick={(e) => { e.stopPropagation(); approve(c); }}
                        className="sede-btn-accent flex flex-1 items-center justify-center gap-1.5 !py-1.5 disabled:opacity-50">
                        {busy === key ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {ready ? 'Aprovar' : 'Renderizando…'}
                      </button>
                    )}
                    {ready && (
                      <a href={mediaUrl(c.video_url)} download onClick={(e) => e.stopPropagation()} title="Baixar o MP4" aria-label="Baixar o MP4 deste corte"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-rule2 text-ink2 hover:border-brass hover:text-brass">
                        <Download size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function PreviewPanel({ clip }) {
  const layout = clip ? (LAYOUT_SHORT[clip.layout] || 'Formato automático') : null;
  return (
    <section aria-label="Prévia do corte" className="rounded-[20px] border border-rule2 bg-paper2 p-4" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-[13px] font-extrabold text-ink">Prévia 9:16 (1080x1920)</h2>
        {layout && <span className="rounded border border-brass/40 bg-brass/10 px-1.5 py-0.5 font-mono text-[10px] text-brass">{layout} • MP4</span>}
      </div>
      <div className="mx-auto w-full max-w-[230px] overflow-hidden rounded-[26px] border-2 border-rule2 bg-black" style={{ aspectRatio: '9 / 16' }}>
        {clip?.video_url ? (
          <video key={clip.video_url} src={mediaUrl(clip.video_url)} controls playsInline loop preload="metadata" className="h-full w-full object-contain bg-black"
            aria-label={`Prévia: ${clip.video_title_for_youtube_short}`} />
        ) : (
          <div className="grid h-full place-items-center px-5 text-center text-xs text-slate-400">
            {clip ? 'Este corte ainda está sendo renderizado.' : 'Selecione um corte para assistir aqui.'}
          </div>
        )}
      </div>
      {clip && (
        <p className="mt-3 text-center text-[11px] text-muted">
          {clip.game_name || 'Gameplay'} · {Math.round((clip.end || 0) - (clip.start || 0))}s · {STATUS_LABEL[clip.status] || clip.status}
        </p>
      )}
    </section>
  );
}

/* Aviso de conclusão ------------------------------------------------------ */

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, 9000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  const ok = toast.tone !== 'error';
  return (
    <div role="status" className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-2xl ${ok ? 'bg-emerald-600' : 'bg-rose-600'}`}>
      {ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      <span>{toast.text}</span>
      <button type="button" onClick={onClose} aria-label="Fechar aviso" className="ml-1 opacity-80 hover:opacity-100"><X size={15} /></button>
    </div>
  );
}

/* Pipeline & Logs --------------------------------------------------------- */

const STATE_PT = {
  idle: 'Pronto', waiting: 'Aguardando', working: 'Trabalhando', done: 'Concluído', skipped: 'Dispensado', failed: 'Falhou', stopped: 'Parado',
};

export function PipelineView({ agents, jobId, jobStatus, system }) {
  const [test, setTest] = useState(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState('');
  const [raw, setRaw] = useState(null);

  useEffect(() => {
    if (!jobId) return undefined;
    let dead = false;
    apiJson(`/api/status/${jobId}`).then((d) => { if (!dead) setRaw(d.logs || []); }).catch(() => { if (!dead) setRaw([]); });
    return () => { dead = true; };
  }, [jobId, jobStatus]);

  const run = async () => {
    setRunning(true); setErr('');
    try { setTest(await apiJson('/api/gaming/selftest', { method: 'POST' })); }
    catch (e) { setErr(errText(e)); } finally { setRunning(false); }
  };

  const gb = (b) => `${(b / 1024 ** 3).toFixed(1)} GB`;
  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-rule2 bg-paper2 p-5" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-ink">Arquitetura &amp; Execução Real (mo3y/openshorts)</h2>
            <p className="text-sm text-muted mt-0.5">Fluxo local via Docker Compose, Faster-Whisper e FFmpeg sem dependências pagas.</p>
          </div>
          <button type="button" onClick={run} disabled={running} className="sede-btn-accent flex items-center gap-2 disabled:opacity-60">
            {running && <Loader2 size={15} className="animate-spin" />}
            {running ? 'Executando…' : 'Executar Teste Completo'}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-rule2 bg-paper p-4">
            <h3 className="text-[13px] font-extrabold text-brass mb-2">Arquivos do Windows &amp; Docker</h3>
            <ul className="space-y-1 font-mono text-[11.5px] text-ink2">
              <li>• instalar.bat (verifica o Docker Desktop e cria o .env)</li>
              <li>• iniciar.bat (sobe os containers e abre o painel)</li>
              <li>• parar.bat (encerra os containers preservando os vídeos)</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-rule2 bg-paper p-4">
            <h3 className="text-[13px] font-extrabold text-ok mb-2">Separação Áudio + Visão</h3>
            <ul className="space-y-1 text-[12.5px] text-ink2">
              <li>• Áudio: picos de volume (dB), estouros súbitos e transcrição Whisper.</li>
              <li>• Visão: movimento, cortes de cena, clarões e vermelho na tela.</li>
              <li>• Exportação: MP4 H.264 + AAC 1080x1920 pronto para as redes.</li>
            </ul>
          </div>
        </div>
        {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
        {test && (
          <div className="mt-4 rounded-2xl border border-rule2 bg-paper p-4" role="status">
            <p className={`text-sm font-extrabold mb-3 ${test.ok ? 'text-ok' : 'text-danger'}`}>
              {test.ok ? 'Teste concluído' : 'Teste com falhas'}: {test.passed} de {test.total} verificações passaram.
            </p>
            <ul className="space-y-2">
              {test.results.map((r) => (
                <li key={r.name} className="flex items-start gap-2.5 text-[12.5px]">
                  {r.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-danger" />}
                  <span className="min-w-0">
                    <span className="font-bold text-ink">{r.name}</span> <span className="font-mono text-[10.5px] text-muted">{r.ms} ms</span>
                    <span className="block text-ink2 break-words">{r.detail}</span>
                  </span>
                </li>
              ))}
              {(test.optional || []).map((o) => (
                <li key={o.name} className="flex items-start gap-2.5 text-[12.5px]">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted/60 ml-1 mr-1" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="font-bold text-ink">{o.name}</span>: <span className="text-ink2">{o.configured ? 'configurado' : 'não configurado (o sistema funciona sem)'}</span>
                    <span className="block text-muted">{o.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-[20px] border border-rule2 bg-paper2 p-5" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
        <h2 className="text-[15px] font-extrabold text-ink mb-3">Etapas do fluxo e agente responsável</h2>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela das etapas do fluxo (role para o lado no celular)">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="text-muted">
                <th className="py-1.5 pr-3 font-semibold">#</th><th className="py-1.5 pr-3 font-semibold">Sala</th>
                <th className="py-1.5 pr-3 font-semibold">Agente</th><th className="py-1.5 pr-3 font-semibold">O que faz</th>
                <th className="py-1.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a, i) => (
                <tr key={a.id} className="border-t border-rule align-top">
                  <td className="py-2 pr-3 font-mono text-muted">{i + 1}</td>
                  <td className="py-2 pr-3 font-bold text-ink whitespace-nowrap">{a.name}</td>
                  <td className="py-2 pr-3 text-ink2 whitespace-nowrap">{a.role}</td>
                  <td className="py-2 pr-3 text-ink2">{a.does}</td>
                  <td className="py-2 text-ink2 whitespace-nowrap">{STATE_PT[a.state] || a.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {system && (
        <section className="rounded-[20px] border border-rule2 bg-paper2 p-5" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
          <h2 className="text-[15px] font-extrabold text-ink mb-3">Ambiente em execução</h2>
          <dl className="grid gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
            {[
              ['FFmpeg', system.ffmpeg ? system.ffmpeg.replace(/ Copyright.*/, '') : 'não encontrado'],
              ['Codificador de vídeo', system.encoder],
              ['Transcrição', `faster-whisper · modelo ${system.whisper_model} · ${system.whisper_device}`],
              ['Processamentos simultâneos', system.max_concurrent_jobs],
              ['Espaço livre em disco', gb(system.disk_free_bytes)],
              ['Vídeos produzidos em disco', gb(system.output_bytes)],
              ['Gemini (opcional)', system.gemini_configured ? 'configurado' : 'não configurado'],
              ['Upload-Post (opcional)', system.upload_post_configured ? 'configurado' : 'não configurado'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-rule py-1">
                <dt className="text-muted">{k}</dt><dd className="text-ink text-right break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="sede-console rounded-[20px] border border-rule2 p-5 text-slate-200">
        <h2 className="text-[13px] font-extrabold text-emerald-400 mb-3">Registro completo do último processamento (saída técnica das ferramentas)</h2>
        {!jobId ? (
          <p className="text-sm text-slate-400">Nenhum processamento nesta sessão ainda.</p>
        ) : raw === null ? (
          <Loader2 className="animate-spin text-slate-400" />
        ) : (
          <pre tabIndex={0} className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed custom-scrollbar">{raw.join('\n') || 'Sem linhas registradas.'}</pre>
        )}
      </section>
    </div>
  );
}
