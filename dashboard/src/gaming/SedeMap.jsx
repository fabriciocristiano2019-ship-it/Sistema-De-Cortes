import React from 'react';
import { Eye, Maximize2, Radio } from 'lucide-react';

// Where each room sits on the map (% of the map box) and its signature colour.
// The pipeline order and the agents themselves come from the backend
// (gaming/pipeline.py): this file only draws them.
const LOOK = {
  library: { x: 18, y: 19, color: '#3b82f6' },
  ingest: { x: 50, y: 12.5, color: '#06b6d4' },
  whisper: { x: 82, y: 19, color: '#a855f7' },
  vision: { x: 13, y: 50, color: '#f43f5e' },
  slicer: { x: 87, y: 50, color: '#f59e0b' },
  editor916: { x: 18, y: 81, color: '#10b981' },
  captions: { x: 50, y: 87.5, color: '#ec4899' },
  social: { x: 82, y: 81, color: '#6366f1' },
};

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
        <span className="grid place-items-center h-6 w-7 rounded-md text-[10px] font-extrabold text-white shrink-0" style={{ background: look.color }}>IA</span>
        <span className="flex-1 space-y-1">
          <span className={`block h-1.5 w-9 rounded-full ${working ? 'animate-pulse' : 'bg-muted/45'}`} style={working ? { background: look.color } : undefined} />
          <span className={`block h-1 w-5 rounded-full ${working ? 'animate-pulse' : ''} bg-muted/30`} />
        </span>
        <Maximize2 size={12} className="text-muted shrink-0" aria-hidden="true" />
      </span>
      <span className="block text-[12px] font-extrabold tracking-tight text-ink leading-tight truncate">{agent.name}</span>
      <span className="block text-[11px] text-muted truncate">{agent.role}</span>
    </button>
  );
}

// The virtual room: eight agents around the orchestrator. Every state shown
// here is the real state of that pipeline stage for the tracked job.
export default function SedeMap({ agents, core, theme, onOpen, details = {} }) {
  const coreBadge = CORE_BADGE[core] || CORE_BADGE.idle;
  const busy = core === 'working';
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return (
    <section aria-label="Sede virtual: agentes do pipeline" className="rounded-[20px] border border-rule2 overflow-hidden">
      {/* Phones: same rooms, as a simple grid */}
      <div className="md:hidden sede-map p-3">
        <p className="text-[11px] font-bold text-muted mb-2">J.A.R.V.I.S. · {coreBadge.label}</p>
        <div className="grid grid-cols-2 gap-2">
          {agents.map((a) => <AgentRoom key={a.id} agent={a} onOpen={onOpen} detail={details[a.id]} />)}
        </div>
      </div>

      <div className="hidden md:block relative sede-map h-[600px] select-none">
        <p className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-rule2 bg-paper2/90 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-ink">
          <Radio size={13} className="text-ok" aria-hidden="true" />
          SEDE VIRTUAL — {theme === 'nova' ? 'EDIÇÃO NOVA CORPORATIVA' : 'EDIÇÃO CLÁSSICA NEON'}
        </p>
        <p className="absolute right-4 top-4 z-30 rounded-full border border-rule2 bg-paper2/90 px-3 py-1.5 text-[11px] text-ink2">
          Clique em qualquer sala para abrir o módulo
        </p>

        <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
          {agents.map((a) => {
            const look = LOOK[a.id];
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

        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className={`relative grid h-32 w-32 place-items-center rounded-full bg-paper2 sede-core-ring transition-transform duration-500 ${busy ? 'scale-105' : ''}`}>
            <span className={`absolute inset-2 rounded-full border border-dashed border-brass/45 ${busy ? 'sede-orbit' : ''}`} aria-hidden="true" />
            <span className="relative flex flex-col items-center">
              <span className="sede-core-chip grid h-11 w-11 place-items-center rounded-full">
                <Eye size={21} className={busy ? 'animate-pulse' : ''} aria-hidden="true" />
              </span>
              <span className="mt-1 text-[11px] font-extrabold tracking-wider text-ink">J.A.R.V.I.S.</span>
              <span className={`mt-0.5 rounded-full px-2 py-px text-[8.5px] font-extrabold tracking-wider ${coreBadge.cls}`}>{coreBadge.label}</span>
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
