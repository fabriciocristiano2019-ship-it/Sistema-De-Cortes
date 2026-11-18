import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, Square, Play } from 'lucide-react';
import { fmtClock, STATUS_LABEL } from './util';
import { Badge, Empty, Field, Header, Notice } from './ui';

/* 03 · Importação --------------------------------------------------------- */
export function ImportSection({ meta, form, setForm, onStart, starting, startError, job }) {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const busy = job?.id && ['queued', 'processing'].includes(job.status);

  const pick = (file) => { if (file) set('file', file); };

  if (!meta) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brass" /></div>;
  const custom = !meta.durations.includes(Number(form.clip_seconds));
  const ready = (form.file || form.url.trim()) && form.acknowledged && !busy && !starting;

  return (
    <div>
      <Header ord="03 · IMPORTAÇÃO" title="Importar gameplay" hint="O vídeo original é preservado; os cortes são arquivos novos." />
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5">
        <div className="space-y-4">
          <div
            className={`card p-6 text-center border-dashed ${drag ? 'border-brass' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          >
            <Upload className="mx-auto mb-3 text-brass" />
            <p className="text-ink mb-1">{form.file ? form.file.name : 'Arraste o vídeo aqui'}</p>
            <p className="text-xs text-muted mb-4">
              {form.file ? `${(form.file.size / 1048576).toFixed(1)} MB` : 'MP4, MKV, MOV ou WebM'}
            </p>
            <input ref={fileRef} type="file" accept="video/*,.mkv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Escolher arquivo</button>
          </div>
          <Field label="Ou cole um endereço (YouTube / gravação da Twitch)" hint="O download usa yt-dlp, já incluído. Arquivo local tem prioridade.">
            <input className="input-field w-full" value={form.url} disabled={!!form.file}
              onChange={(e) => set('url', e.target.value)} placeholder="https://..." />
          </Field>
        </div>

        <div className="card p-5 space-y-4">
          <Field label="Tipo de jogo" hint="O jogo é reconhecido sozinho pelo nome do arquivo e pela fala; isto só vale quando ele não é reconhecido.">
            <select className="input-field w-full" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Duração de cada corte">
            <div className="flex flex-wrap gap-2">
              {meta.durations.map((d) => (
                <button key={d} type="button" onClick={() => set('clip_seconds', d)}
                  className={Number(form.clip_seconds) === d ? 'btn-primary' : 'btn-ghost'}>{d}s</button>
              ))}
              <input type="number" min="5" max="180" aria-label="Duração personalizada em segundos"
                className={`input-field w-24 ${custom ? 'border-brass' : ''}`} placeholder="outro"
                value={custom ? form.clip_seconds : ''} onChange={(e) => set('clip_seconds', Number(e.target.value) || 30)} />
            </div>
          </Field>
          <Field label="Formato do vídeo (1080×1920, 9:16)">
            <select className="input-field w-full" value={form.layout} onChange={(e) => set('layout', e.target.value)}>
              {meta.layouts.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Máximo de cortes">
              <input type="number" min="1" max="30" className="input-field w-full" value={form.max_clips} onChange={(e) => set('max_clips', Number(e.target.value))} />
            </Field>
            <Field label="Pontuação mínima (0–100)">
              <input type="number" min="0" max="100" className="input-field w-full" value={form.min_score} onChange={(e) => set('min_score', Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Motor de análise" hint={form.engine !== 'local' && !meta.gemini_configured ? 'Sem chave Gemini no servidor: informe a sua em Configurações, ou o motor local será usado.' : 'O motor local é gratuito e roda no seu computador.'}>
            <select className="input-field w-full" value={form.engine} onChange={(e) => set('engine', e.target.value)}>
              {meta.engines.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </Field>
          <p className="text-sm text-ink2">Automático em todo corte: legendas animadas, zoom nos melhores momentos e texto de gancho.</p>
          <label className="flex items-start gap-2 text-sm text-ink2">
            <input type="checkbox" className="mt-0.5" checked={form.acknowledged} onChange={(e) => set('acknowledged', e.target.checked)} />
            Confirmo que tenho direito de usar este vídeo.
          </label>
          {startError && <Notice tone="error">{startError}</Notice>}
          {busy && <Notice tone="warn">Já existe um processamento em andamento. Aguarde ou cancele em “Análise inteligente”.</Notice>}
          <button className="btn-primary w-full" disabled={!ready} onClick={onStart}>
            {starting ? <Loader2 size={16} className="inline animate-spin mr-1.5" /> : <Play size={16} className="inline mr-1.5" />}
            Iniciar análise inteligente
          </button>
        </div>
      </div>
    </div>
  );
}

/* 04 · Análise inteligente ------------------------------------------------ */
const STEP_STATE = {
  idle: ['Pronto', 'text-muted'], waiting: ['Aguardando', 'text-muted'], working: ['Trabalhando', 'text-brass border-brass/50'],
  done: ['Concluído', 'text-ok'], skipped: ['Dispensado', 'text-muted'], failed: ['Falhou', 'text-danger border-danger/50'],
  stopped: ['Parado', 'text-muted'],
};

export function AnalysisSection({ job, onCancel, cancelling, go }) {
  const logRef = useRef(null);
  const snap = job?.snap;
  const lines = useMemo(() => snap?.console || [], [snap]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [lines.length]);

  if (!job?.id) {
    return (
      <div>
        <Header ord="04 · ANÁLISE INTELIGENTE" title="Análise" />
        <Empty title="Nenhuma análise em andamento">Importe uma gameplay para começar. <button className="underline" onClick={() => go('import')}>Ir para Importação</button></Empty>
      </div>
    );
  }
  const active = ['queued', 'processing'].includes(job.status);
  const agents = snap?.agents || [];
  const roles = Object.fromEntries(agents.map((a) => [a.id, a.role]));
  const pct = snap?.progress ?? 0;
  return (
    <div>
      <Header ord="04 · ANÁLISE INTELIGENTE" title="Análise" hint="Áudio e imagem são analisados separadamente; a fala entra como terceiro sinal.">
        <Badge status={job.status} />
        {active && (
          <button className="btn-danger" disabled={cancelling} onClick={onCancel}>
            <Square size={14} className="inline mr-1.5" />{cancelling ? 'Cancelando…' : 'Cancelar processamento'}
          </button>
        )}
        {job.status === 'completed' && <button className="btn-primary" onClick={() => go('clips')}>Ver cortes encontrados</button>}
      </Header>
      {snap && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-ink2 mb-1.5">
            <span>{active ? `Etapa ${snap.step} de ${snap.steps}${snap.step_label ? `: ${snap.step_label}` : ''}` : STATUS_LABEL[job.status]}</span>
            <span className="font-mono tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-paper3 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progresso da análise">
            <div className="h-full rounded-full bg-brass transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-5">
        {agents.map((a, i) => {
          const [label, tone] = STEP_STATE[a.state] || STEP_STATE.idle;
          return (
            <li key={a.id} className={`card px-3 py-2.5 text-xs ${tone}`} title={a.does}>
              <span className="font-mono mr-1.5">{String(i + 1).padStart(2, '0')}</span>
              <span className="font-semibold">{a.name}</span>
              {a.state === 'working' && <Loader2 size={12} className="inline animate-spin ml-1.5" />}
              <span className="block mt-0.5 opacity-80">{a.role} · {label}</span>
            </li>
          );
        })}
      </ol>
      {job.status === 'failed' && (
        <div className="mb-4"><Notice tone="error">{snap?.error || 'O processamento falhou. Veja o registro abaixo.'}</Notice></div>
      )}
      {job.status === 'cancelled' && <div className="mb-4"><Notice tone="warn">Processamento cancelado. O vídeo original foi preservado.</Notice></div>}
      <div className="card p-0 overflow-hidden">
        <p className="eyebrow px-4 pt-3">REGISTRO DE OPERAÇÕES</p>
        <pre ref={logRef} tabIndex={0} className="p-4 text-xs font-mono text-ink2 whitespace-pre-wrap max-h-[26rem] overflow-y-auto">
          {lines.length
            ? lines.map((l) => `${l.t ? `[${fmtClock(l.t)}] ` : ''}${l.agent && l.agent !== 'core' ? `[${roles[l.agent] || l.agent}] ` : ''}${l.text}`).join('\n')
            : 'Aguardando…'}
        </pre>
      </div>
    </div>
  );
}
