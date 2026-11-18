import React, { useEffect, useState } from 'react';
import { Maximize2, Radio } from 'lucide-react';
import Wave from './Wave';
import JarvisOrb from './JarvisOrb';
import { LOOK } from './agents';

// Phone lying down: two rows around J.A.R.V.I.S., clockwise in pipeline order,
// so the centre column stays free for the orb and its label.
const DEITADO = {
  ingest: { x: 13, y: 23 }, library: { x: 31, y: 23 }, whisper: { x: 69, y: 23 }, vision: { x: 87, y: 23 },
  slicer: { x: 87, y: 77 }, editor916: { x: 69, y: 77 }, captions: { x: 31, y: 77 }, social: { x: 13, y: 77 },
};
const QUERY_DEITADO = '(max-height: 520px) and (min-width: 568px)';

function useDeitado() {
  const mq = () => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY_DEITADO).matches;
  const [on, setOn] = useState(mq);
  useEffect(() => {
    const m = window.matchMedia?.(QUERY_DEITADO);
    if (!m) return undefined;
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return on;
}

// Black or white text, whichever contrasts more with the badge colour (WCAG
// relative luminance): white on the light cyan/blue badges read at 2.4:1.
function inkOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const lin = (i) => { const c = parseInt(m[1].slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#0b1020' : '#fff';
}



const BADGE = {
  idle: { label: 'PRONTO', cls: 'text-brass border-brass/30 bg-brass/10' },
  waiting: { label: 'AGUARDANDO', cls: 'text-warn border-warn/35 bg-warn/10' },
  working: { label: 'TRABALHANDO', cls: '' },
  done: { label: 'CONCLUÍDO', cls: 'text-brass border-brass/35 bg-brass/15' },
  skipped: { label: 'DISPENSADO', cls: 'text-muted border-rule2 bg-paper3/60' },
  failed: { label: 'FALHOU', cls: 'text-danger border-danger/40 bg-danger/10' },
  stopped: { label: 'PARADO', cls: 'text-muted border-rule2 bg-paper3/60' },
};

const CORE_BADGE = {
  idle: { label: 'CÉREBRO ATIVO', cls: 'text-brass border border-brass/40 bg-brass/10' },
  queued: { label: 'NA FILA', cls: 'text-warn border border-warn/40 bg-warn/10' },
  working: { label: 'ORQUESTRANDO', cls: 'bg-ok text-paper' },
  failed: { label: 'FALHA', cls: 'bg-danger text-white' },
};

function lineStyle(state) {
  if (state === 'working') return { stroke: 'var(--color-accent)', width: 3, dash: '7 6', flow: true };
  if (state === 'done') return { stroke: 'var(--color-ok)', width: 2 };
  if (state === 'failed') return { stroke: 'var(--color-danger)', width: 2 };
  return { stroke: 'var(--sede-line)', width: 1.5 };
}

function AgentRoom({ agent, onOpen, detail, className = '', style }) {
  const look = LOOK[agent.id] || { color: '#64748b' };
  const badge = BADGE[agent.state] || BADGE.idle;
  const working = agent.state === 'working';
  return (
    <button
      type="button"
      onClick={() => onOpen(agent)}
      title={`${agent.does}${detail ? `\n${detail}` : ''}\nClique para abrir o módulo.`}
      aria-label={`${agent.name}, ${agent.role}: ${badge.label.toLowerCase()}. Abrir módulo.`}
      className={`text-left rounded-2xl border bg-paper2 p-2.5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${working ? 'scale-[1.03]' : 'border-rule2 hover:border-brass/60'} ${className}`}
      style={{
        ...style,
        ...(working ? { borderColor: look.color, boxShadow: `0 0 0 1px ${look.color}, 0 0 26px ${look.color}55` } : { boxShadow: 'var(--sede-card-shadow)' }),
      }}
    >
      <span className="flex items-center justify-between gap-2 mb-2">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${working ? 'animate-pulse' : ''}`} style={{ background: look.color }} />
        <span
          className={`rounded border px-1.5 py-px text-[9px] font-extrabold tracking-wider ${badge.cls}`}
          style={working ? { color: look.color, borderColor: `${look.color}88`, background: `${look.color}22` } : undefined}
        >
          {badge.label}
        </span>
      </span>
      <span
        className="flex items-center gap-2 rounded-xl border border-rule px-2 py-2 mb-2"
        style={{ background: `linear-gradient(100deg, color-mix(in oklab, ${look.color} 17%, var(--color-paper)) 0%, var(--color-paper) 88%)` }}
      >
        <span className="grid place-items-center h-6 w-7 rounded-md text-[10px] font-extrabold shrink-0" style={{ background: look.color, color: inkOn(look.color) }}>IA</span>
        <span className="flex-1 min-w-0 flex items-center">
          <Wave mode={working ? 'on' : agent.state === 'done' ? 'done' : 'rest'} bars={14} height={18}
            color={working || agent.state === 'done' ? look.color : 'var(--color-muted)'} />
        </span>
        <Maximize2 size={12} className="text-muted shrink-0" aria-hidden="true" />
      </span>
      <span className="block text-[12px] font-extrabold tracking-tight text-ink leading-tight line-clamp-2">{agent.name}</span>
      <span className="block text-[11px] text-muted truncate">{agent.role}</span>
    </button>
  );
}

// Lines from J.A.R.V.I.S. to each room; a dot travels along the busy ones.
function Linhas({ agents, reduceMotion, posicoes = LOOK }) {
  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
      {agents.map((a) => {
        const look = posicoes[a.id];
        if (!look) return null;
        const ls = lineStyle(a.state);
        return (
          <g key={a.id}>
            <line x1="50%" y1="50%" x2={`${look.x}%`} y2={`${look.y}%`} stroke={ls.stroke} strokeWidth={ls.width}
              strokeDasharray={ls.dash} strokeLinecap="round" className={ls.flow ? 'sede-flow' : undefined} />
            {ls.flow && !reduceMotion && (
              <circle r="4.5" fill="var(--color-accent)">
                <animate attributeName="cx" values={`50%;${look.x}%`} dur="1.15s" repeatCount="indefinite" />
                <animate attributeName="cy" values={`50%;${look.y}%`} dur="1.15s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Compact room for phones: icon, live wave and name.
function AgentMini({ agent, onOpen, style }) {
  const look = LOOK[agent.id] || { color: '#64748b' };
  const badge = BADGE[agent.state] || BADGE.idle;
  const working = agent.state === 'working';
  return (
    <button type="button" onClick={() => onOpen(agent)}
      aria-label={`${agent.name}, ${agent.role}: ${badge.label.toLowerCase()}. Abrir módulo.`}
      className={`absolute z-10 flex w-[84px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border bg-paper2/95 px-1 pb-1.5 pt-1.5 text-center transition-transform duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${working ? 'scale-105' : 'border-rule2'}`}
      style={{ ...style, ...(working ? { borderColor: look.color, boxShadow: `0 0 0 1px ${look.color}, 0 0 18px ${look.color}66` } : { boxShadow: 'var(--sede-card-shadow)' }) }}>
      <span className="flex w-full items-center justify-center gap-1">
        <span className={`grid h-6 w-6 place-items-center rounded-md text-[9px] font-extrabold ${working ? 'animate-pulse' : ''}`}
          style={{ background: look.color, color: inkOn(look.color) }}>IA</span>
        <Wave mode={working ? 'on' : agent.state === 'done' ? 'done' : 'rest'} bars={7} height={14}
          color={working || agent.state === 'done' ? look.color : 'var(--color-muted)'} />
      </span>
      <span className="line-clamp-2 text-[9.5px] font-extrabold leading-tight text-ink">{agent.name}</span>
      <span className={`rounded border px-1 text-[8px] font-extrabold tracking-wider ${badge.cls}`}
        style={working ? { color: look.color, borderColor: `${look.color}88` } : undefined}>{badge.label}</span>
    </button>
  );
}

// The virtual room: eight agents around the orchestrator. Every state shown
// here is the real state of that pipeline stage for the tracked job.
export default function SedeMap({ agents, core, theme, onOpen, details = {} }) {
  const coreBadge = CORE_BADGE[core] || CORE_BADGE.idle;
  const busy = core === 'working';
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const posMini = useDeitado() ? DEITADO : LOOK;
  return (
    <section aria-label="Sede virtual: agentes do fluxo" className="rounded-[20px] border border-rule2 overflow-hidden">
      {/* Phones (standing or lying down): the same room, smaller — J.A.R.V.I.S. in the
          middle, the agents around it. Which map shows is decided in sede.css. */}
      <div className="sede-mini relative sede-map select-none">
        <Linhas agents={agents} reduceMotion={reduceMotion} posicoes={posMini} />
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className={`relative h-[104px] w-[104px] rounded-full transition-transform duration-700 ${busy ? 'scale-105' : ''}`}
            style={{ background: 'radial-gradient(circle, var(--sede-map) 55%, transparent 72%)' }}>
            {[1, 2, 3].map((n) => <span key={n} className={`sede-ripple r${n} ${busy && !reduceMotion ? 'sede-ripple-on' : ''}`} aria-hidden="true" />)}
            <JarvisOrb size={104} busy={busy} theme={theme} className="absolute inset-0" />
            <span className="absolute inset-x-0 -bottom-4 flex flex-col items-center">
              <span className="text-[9.5px] font-extrabold tracking-[0.16em] text-ink" style={{ textShadow: '0 0 12px var(--sede-glow)' }}>J.A.R.V.I.S.</span>
              <span className={`mt-0.5 rounded-full px-1.5 py-px text-[8px] font-extrabold tracking-wider ${coreBadge.cls}`}>{coreBadge.label}</span>
            </span>
          </div>
        </div>
        {agents.map((a) => {
          const look = posMini[a.id];
          if (!look) return null;
          return <AgentMini key={a.id} agent={a} onOpen={onOpen}
            style={{ left: `${look.x}%`, top: `${look.y}%` }} />;
        })}
      </div>

      <div className="sede-full relative sede-map h-[600px] select-none">
        <p className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-rule2 bg-paper2/90 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-ink">
          <Radio size={13} className="text-ok" aria-hidden="true" />
          SEDE VIRTUAL — {theme === 'nova' ? 'EDIÇÃO NOVA CORPORATIVA' : 'EDIÇÃO CLÁSSICA NEON'}
        </p>
        <p className="absolute right-4 top-4 z-30 rounded-full border border-rule2 bg-paper2/90 px-3 py-1.5 text-[11px] text-ink2">
          Clique em qualquer sala para abrir o módulo
        </p>

        <Linhas agents={agents} reduceMotion={reduceMotion} />

        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className={`relative h-44 w-44 rounded-full transition-transform duration-700 ${busy ? 'scale-105' : ''}`}
            style={{ background: 'radial-gradient(circle, var(--sede-map) 55%, transparent 72%)' }}>
            {[1, 2, 3].map((n) => <span key={n} className={`sede-ripple r${n} ${busy && !reduceMotion ? 'sede-ripple-on' : ''}`} aria-hidden="true" />)}
            <JarvisOrb size={176} busy={busy} theme={theme} className="absolute inset-0" />
            <span className="absolute inset-x-0 -bottom-3 flex flex-col items-center">
              <span className="text-[11px] font-extrabold tracking-[0.18em] text-ink" style={{ textShadow: '0 0 12px var(--sede-glow)' }}>J.A.R.V.I.S.</span>
              <span className={`mt-1 rounded-full px-2 py-px text-[8.5px] font-extrabold tracking-wider ${coreBadge.cls}`}>{coreBadge.label}</span>
            </span>
          </div>
        </div>

        {agents.map((a) => {
          const look = LOOK[a.id];
          if (!look) return null;
          return (
            <AgentRoom key={a.id} agent={a} onOpen={onOpen} detail={details[a.id]}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 hover:!-translate-y-[calc(50%+2px)]"
              style={{ left: `${look.x}%`, top: `${look.y}%`, width: 'clamp(138px, 19%, 176px)' }} />
          );
        })}
      </div>
    </section>
  );
}
