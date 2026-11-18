import React, { useContext } from 'react';
import { ModuleCtx } from './ctx';
import { STATUS_LABEL, STATUS_TONE } from './util';

export function Header({ ord, title, hint, children }) {
  const mod = useContext(ModuleCtx);
  if (mod) {
    // Inside the Sede shell the module bar already says where you are: a plain
    // title, one line of help when the module has it, and its own buttons.
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-ink">{mod.label}</h2>
          {hint && <p className="text-sm text-muted mt-0.5 max-w-3xl">{hint}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <p className="eyebrow mb-1.5">{ord}</p>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        {hint && <p className="text-sm text-muted mt-1 max-w-2xl">{hint}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Badge({ status, children }) {
  const tone = STATUS_TONE[status] || 'text-muted border-rule2';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-micro uppercase ${tone}`}>
      {children || STATUS_LABEL[status] || status}
    </span>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs text-ink2 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-ink mb-1">{title}</p>
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}

export function Notice({ tone = 'info', children }) {
  const cls = {
    info: 'border-rule2 text-ink2',
    warn: 'border-warn/40 text-warn',
    error: 'border-danger/40 text-danger',
    ok: 'border-ok/40 text-ok',
  }[tone];
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-input border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function StatTile({ label, value, sub, tone = 'ink' }) {
  const color = { ink: 'text-ink', accent: 'text-brass', ok: 'text-ok', warn: 'text-warn' }[tone];
  return (
    <div className="card p-4">
      <p className="text-xs text-muted mb-2">{label}</p>
      <p className={`text-2xl font-extrabold tabular-nums leading-none ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-2">{sub}</p>}
    </div>
  );
}

export function BarList({ data, unit = '', max = 8, empty = 'Sem dados ainda.' }) {
  const rows = (data || []).slice(0, max);
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  const top = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-ink2" title={r.label}>{r.label}</span>
          <span className="h-2 rounded-full bg-paper3 overflow-hidden" aria-hidden="true">
            <span className="block h-full rounded-full bg-brass" style={{ width: `${Math.max(3, (r.value / top) * 100)}%` }} />
          </span>
          <span className="font-mono text-xs text-ink tabular-nums">{r.value}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

// Column chart for the daily series. Bars carry a title for exact values and
// the first/last dates anchor the axis.
export function DayColumns({ data }) {
  const rows = data || [];
  if (!rows.length) return <p className="text-sm text-muted">Sem cortes produzidos ainda.</p>;
  const top = Math.max(...rows.map((r) => r.value), 1);
  const short = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
  return (
    <div>
      <div className="flex items-end gap-1 h-28" role="img" aria-label="Cortes produzidos por dia">
        {rows.map((r) => (
          <div key={r.label} className="flex-1 min-w-[6px] max-w-[28px] flex flex-col justify-end h-full" title={`${short(r.label)}: ${r.value} corte(s)`}>
            <div className="rounded-t bg-brass" style={{ height: `${Math.max(4, (r.value / top) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-micro text-muted mt-1.5 font-mono">
        <span>{short(rows[0].label)}</span>
        <span>pico: {top}</span>
        <span>{short(rows[rows.length - 1].label)}</span>
      </div>
    </div>
  );
}

export function ScoreBar({ score }) {
  const v = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="flex items-center gap-2" title="Pontuação de relevância (0 a 100)">
      <span className="h-1.5 w-20 rounded-full bg-paper3 overflow-hidden" aria-hidden="true">
        <span className="block h-full bg-brass" style={{ width: `${v}%` }} />
      </span>
      <span className="font-mono text-xs text-ink tabular-nums">{v}/100</span>
    </div>
  );
}
