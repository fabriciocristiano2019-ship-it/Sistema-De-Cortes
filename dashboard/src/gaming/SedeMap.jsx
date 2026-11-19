import React, { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import JarvisOrb from './JarvisOrb';
import { anel, LOOK } from './agents';

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

// One agent: its sphere floating free (no box), its Marvel name and what it
// does underneath. The sphere speeds up and glows while the agent works.
function AgentNode({ agent, onOpen, detail, theme, size, compact, style }) {
  const look = LOOK[agent.id] || { color: '#64748b' };
  const badge = BADGE[agent.state] || BADGE.idle;
  const working = agent.state === 'working';
  const nome = (agent.role || '').split(' · ')[0] || agent.name;
  const tarefa = agent.state === 'failed' ? 'falhou' : agent.name;
  return (
    <button type="button" onClick={() => onOpen(agent)}
      title={`${nome}: ${agent.does}${detail ? `\n${detail}` : ''}\nClique para abrir o módulo.`}
      aria-label={`${nome}, ${agent.name}: ${badge.label.toLowerCase()}. Abrir módulo.`}
      className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center transition-transform duration-300 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass rounded-2xl ${working ? 'scale-110' : ''}`}
      style={{ ...style, width: compact ? 64 : 128 }}>
      <span className="relative grid place-items-center rounded-full"
        style={working ? { filter: `drop-shadow(0 0 14px ${look.color})` } : undefined}>
        <JarvisOrb size={size} busy={working} theme={theme} color={look.color} />
      </span>
      {/* A soft plate under the words so the line to J.A.R.V.I.S. never runs through them. */}
      <span className="rounded-md px-1 py-px" style={{ background: 'color-mix(in oklab, var(--sede-map) 84%, transparent)' }}>
        <span className={`block font-extrabold tracking-[0.08em] text-ink leading-tight ${compact ? 'text-[9px]' : 'text-[12px]'}`}
          style={working ? { color: look.color } : undefined}>{nome}</span>
        <span className={`block leading-tight line-clamp-2 ${compact ? 'text-[8px]' : 'text-[10.5px]'} ${agent.state === 'failed' ? 'text-danger font-bold' : working ? 'font-bold' : 'text-muted'}`}
          style={working ? { color: look.color } : undefined}>{tarefa}</span>
      </span>
    </button>
  );
}

// Lines from J.A.R.V.I.S. to each room; a dot travels along the busy ones.
function Linhas({ agents, reduceMotion, posicoes }) {
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

// The virtual room: eight agents around the orchestrator. Every state shown
// here is the real state of that pipeline stage for the tracked job.
export default function SedeMap({ agents, core, theme, onOpen, details = {} }) {
  const coreBadge = CORE_BADGE[core] || CORE_BADGE.idle;
  const busy = core === 'working';
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const deitado = useDeitado();
  const ids = agents.map((a) => a.id);
  // Spheres on a ring around J.A.R.V.I.S. (13 of them: wide ellipse).
  const posFull = anel(ids, 41, 39);
  const posMini = deitado ? anel(ids, 45, 41) : anel(ids, 41, 42);
  return (
    <section aria-label="Sede virtual: agentes do fluxo" className="rounded-[20px] border border-rule2 overflow-hidden">
      {/* Phones (standing or lying down): the same room, smaller — J.A.R.V.I.S. in the
          middle, the agents around it. Which map shows is decided in sede.css. */}
      <div className="sede-mini relative sede-map select-none">
        <Linhas agents={agents} reduceMotion={reduceMotion} posicoes={posMini} />
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className={`relative h-[132px] w-[132px] rounded-full transition-transform duration-700 ${busy ? 'scale-105' : ''}`}
            style={{ background: 'radial-gradient(circle, var(--sede-map) 55%, transparent 72%)' }}>
            {[1, 2, 3].map((n) => <span key={n} className={`sede-ripple r${n} ${busy && !reduceMotion ? 'sede-ripple-on' : ''}`} aria-hidden="true" />)}
            <JarvisOrb size={132} busy={busy} theme={theme} className="absolute inset-0" />
            <span className="absolute inset-x-0 -bottom-4 flex flex-col items-center">
              <span className="text-[9.5px] font-extrabold tracking-[0.16em] text-ink" style={{ textShadow: '0 0 12px var(--sede-glow)' }}>J.A.R.V.I.S.</span>
              <span className={`mt-0.5 rounded-full px-1.5 py-px text-[8px] font-extrabold tracking-wider ${coreBadge.cls}`}>{coreBadge.label}</span>
            </span>
          </div>
        </div>
        {agents.map((a) => {
          const p = posMini[a.id];
          return p && <AgentNode key={a.id} agent={a} onOpen={onOpen} theme={theme} size={36} compact
            detail={details[a.id]} style={{ left: `${p.x}%`, top: `${p.y}%` }} />;
        })}
      </div>

      <div className="sede-full relative sede-map h-[680px] select-none">
        <p className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-rule2 bg-paper2/90 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-ink">
          <Radio size={13} className="text-ok" aria-hidden="true" />
          SEDE VIRTUAL — {theme === 'nova' ? 'EDIÇÃO NOVA CORPORATIVA' : 'EDIÇÃO CLÁSSICA NEON'}
        </p>
        <p className="absolute right-4 top-4 z-30 rounded-full border border-rule2 bg-paper2/90 px-3 py-1.5 text-[11px] text-ink2">
          Clique em qualquer IA para abrir o módulo
        </p>

        <Linhas agents={agents} reduceMotion={reduceMotion} posicoes={posFull} />

        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className={`relative h-[290px] w-[290px] rounded-full transition-transform duration-700 ${busy ? 'scale-105' : ''}`}
            style={{ background: 'radial-gradient(circle, var(--sede-map) 55%, transparent 72%)' }}>
            {[1, 2, 3].map((n) => <span key={n} className={`sede-ripple r${n} ${busy && !reduceMotion ? 'sede-ripple-on' : ''}`} aria-hidden="true" />)}
            <JarvisOrb size={290} busy={busy} theme={theme} className="absolute inset-0" />
            <span className="absolute inset-x-0 -bottom-3 flex flex-col items-center">
              <span className="text-[15px] font-extrabold tracking-[0.2em] text-ink" style={{ textShadow: '0 0 16px var(--sede-glow)' }}>J.A.R.V.I.S.</span>
              <span className={`mt-1 rounded-full px-2 py-px text-[8.5px] font-extrabold tracking-wider ${coreBadge.cls}`}>{coreBadge.label}</span>
            </span>
          </div>
        </div>

        {agents.map((a) => {
          const p = posFull[a.id];
          return p && <AgentNode key={a.id} agent={a} onOpen={onOpen} theme={theme} size={58}
            detail={details[a.id]} style={{ left: `${p.x}%`, top: `${p.y}%` }} />;
        })}
      </div>
    </section>
  );
}
