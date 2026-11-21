import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot, CheckCircle2, Clock3, Cpu, FolderOpen, Gamepad2, HardDrive, Hourglass, Loader2, Music, Scissors, Sparkles, Star, XCircle,
} from 'lucide-react';
import { apiJson } from '../lib/api';
import { fmtDate, STATUS_LABEL } from './util';
import { BarList, Notice } from './ui';

// Painel (redesigned 21-nov-2026): views and likes are gone with automatic
// posting, so every number here is counted from the files on disk - what
// the production line made, how good it was, what is waiting for you and
// how the machine is doing.
const DAY = 86400;
const nf = new Intl.NumberFormat('pt-BR');
const gb = (b) => `${(b / 1073741824).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const dur = (c) => Math.max(0, (Number(c.end) || 0) - (Number(c.start) || 0));
const nota = (c) => Number(c.predicted_score ?? c.relevance_score ?? 0) || 0;
const dia = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
const curto = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function Card({ title, icon, children, extra, className = '' }) {
  return (
    <section className={`card p-5 ${className}`} aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          {icon && React.createElement(icon, { size: 16, className: 'text-brass', 'aria-hidden': true })} {title}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Tile({ icon, label, value, sub, tone, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`card flex flex-col items-start p-4 text-left ${onClick ? 'transition hover:border-brass/60' : ''}`}>
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted">
        {React.createElement(icon, { size: 14, 'aria-hidden': true, className: tone || 'text-brass' })} {label}
      </span>
      <span className="mt-2 text-[30px] font-extrabold leading-none tabular-nums text-ink">{value}</span>
      {sub && <span className="mt-1.5 text-xs text-muted">{sub}</span>}
    </Tag>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-xl border border-rule bg-paper2 px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-mono text-sm font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}

// Clips per day, last 14 days (missing days count as zero). One series: the
// title names it, each column has its own hover tooltip.
function Colunas({ serie }) {
  const [hover, setHover] = useState(null);
  const top = Math.max(1, ...serie.map((d) => d.value));
  const total = serie.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div className="relative">
        <div className="flex h-40 items-end gap-[2px] border-b border-rule" role="img"
          aria-label={`Cortes por dia nos últimos ${serie.length} dias: ${total} no total, pico de ${top}`}>
          {serie.map((d, i) => (
            <div key={d.label} className="relative flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className={`w-full max-w-[26px] rounded-t-[4px] ${d.value ? 'bg-brass' : 'bg-paper3'} ${hover === i ? 'brightness-125' : ''}`}
                style={{ height: d.value ? `${Math.max(4, (d.value / top) * 100)}%` : '2px' }} />
            </div>
          ))}
        </div>
        {hover !== null && (
          <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-rule2 bg-paper2 px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: `${((hover + 0.5) / serie.length) * 100}%` }}>
            <span className="text-muted">{curto(serie[hover].label)}</span> · <b className="tabular-nums text-ink">{serie[hover].value}</b> <span className="text-ink2">corte(s)</span>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
        <span>{curto(serie[0].label)}</span><span>{total} corte(s) · pico {top}/dia</span><span>{curto(serie[serie.length - 1].label)}</span>
      </div>
    </div>
  );
}

// Review state of every clip: one row per state, icon + label + count.
function Revisao({ t, go }) {
  const total = t.pending + t.approved + t.rejected || 1;
  const linhas = [
    { label: 'Esperando revisão', v: t.pending, icon: Hourglass, cls: 'text-warn' },
    { label: 'Aprovados', v: t.approved, icon: CheckCircle2, cls: 'text-ok' },
    { label: 'Rejeitados', v: t.rejected, icon: XCircle, cls: 'text-danger' },
  ];
  return (
    <div>
      <ul className="space-y-3">
        {linhas.map((l) => (
          <li key={l.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="flex items-center gap-2 truncate text-ink2">{React.createElement(l.icon, { size: 14, className: l.cls, 'aria-hidden': true })} {l.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-paper3" aria-hidden="true">
              <span className="block h-full rounded-full bg-brass" style={{ width: `${l.v ? Math.max(3, (l.v / total) * 100) : 0}%` }} />
            </span>
            <span className="w-20 text-right font-mono text-xs tabular-nums text-ink">{l.v} · {pct(l.v, total)}%</span>
          </li>
        ))}
      </ul>
      {t.pending > 0 && (
        <button type="button" className="btn-primary mt-4 w-full sm:w-auto" onClick={() => go('clips')}>Revisar {t.pending} corte(s)</button>
      )}
    </div>
  );
}

// Score of the clips (0-100): distribution in four bands + averages.
function Qualidade({ clips }) {
  const notas = clips.map(nota).filter((n) => n > 0);
  const faixas = [['Excelente (80+)', 80, 101], ['Bom (60-79)', 60, 80], ['Médio (40-59)', 40, 60], ['Fraco (até 39)', 0, 40]]
    .map(([label, a, b]) => ({ label, value: notas.filter((n) => n >= a && n < b).length }));
  const media = notas.length ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length) : 0;
  const durs = clips.map(dur).filter((d) => d > 0);
  const mediaDur = durs.length ? Math.round(durs.reduce((s, d) => s + d, 0) / durs.length) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Nota média" value={notas.length ? `${media}/100` : '—'} />
        <Mini label="Duração" value={mediaDur ? `${mediaDur} s` : '—'} />
        <Mini label="Melhor" value={notas.length ? `${Math.max(...notas)}/100` : '—'} />
      </div>
      <BarList data={faixas} max={4} empty="Sem notas ainda." />
    </div>
  );
}

function Maquina({ sys }) {
  if (!sys) return <p className="text-sm text-muted">Carregando…</p>;
  const usado = sys.output_bytes || 0;
  const livre = sys.disk_free_bytes || 0;
  const p = pct(usado, usado + livre);
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs"><span className="text-ink2">Vídeos e cortes</span><span className="font-mono tabular-nums text-ink">{gb(usado)} · {gb(livre)} livres</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-paper3" role="meter" aria-label="Espaço usado pelos vídeos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
          <div className={`h-full rounded-full ${p > 85 ? 'bg-danger' : 'bg-brass'}`} style={{ width: `${Math.max(2, p)}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Mini label="IA dos cortes" value={sys.gemini_configured ? 'Gemini' : 'Motor local'} />
        <Mini label="Transcrição" value={`Whisper ${sys.whisper_model}`} />
        <Mini label="Codificador" value={`${sys.encoder} · H.264`} />
        <Mini label="Fila agora" value={`${sys.jobs_active || 0} rodando · ${sys.jobs_queued || 0} esperando`} />
      </div>
    </div>
  );
}

export default function Painel({ dash, clips, job, go }) {
  const [pasta, setPasta] = useState(null);
  const [sys, setSys] = useState(null);
  useEffect(() => { apiJson('/api/gaming/prontos').then(setPasta).catch(() => {}); }, [clips?.length]);
  useEffect(() => { apiJson('/api/gaming/system').then(setSys).catch(() => {}); }, [clips?.length]);

  const lista = useMemo(() => (clips || []).filter((c) => c.video_url), [clips]);
  const serie = useMemo(() => {
    const conta = {};
    for (const c of lista) conta[dia(c.created_at)] = (conta[dia(c.created_at)] || 0) + 1;
    const hoje = Date.now() / 1000;
    return Array.from({ length: 14 }, (_, i) => { const d = dia(hoje - (13 - i) * DAY); return { label: d, value: conta[d] || 0 }; });
  }, [lista]);
  const musica = useMemo(() => {
    const m = { alto: 0, medio: 0, baixo: 0 };
    for (const c of lista) if (c.musica?.risco in m) m[c.musica.risco] += 1;
    return m;
  }, [lista]);

  if (!dash) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brass" aria-label="Carregando" /></div>;
  const t = dash.totals;
  const agora = Date.now() / 1000;
  const semana = lista.filter((c) => agora - c.created_at <= 7 * DAY).length;
  const hoje = lista.filter((c) => dia(c.created_at) === dia(agora)).length;
  const revisados = t.approved + t.rejected;
  const conferidas = musica.alto + musica.medio + musica.baixo;

  return (
    <section aria-labelledby="painel-titulo" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Painel</p>
          <h2 id="painel-titulo" className="text-2xl font-extrabold tracking-tight text-ink">Sua produção</h2>
          <p className="text-xs text-muted">Tudo contado a partir dos vídeos do sistema.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${sys?.gemini_configured ? 'border-ok/40 text-ok' : 'border-rule2 text-ink2'}`}>
          <Sparkles size={13} aria-hidden="true" /> {sys?.gemini_configured ? 'IA profissional (Gemini) ligada' : 'Motor local (sem custo)'}
        </span>
      </div>

      {job?.id && ['queued', 'processing'].includes(job.status) && (
        <Notice tone="info">
          Processamento em andamento ({STATUS_LABEL[job.status]}).{' '}
          <button type="button" className="underline" onClick={() => go('analysis')}>Acompanhar</button>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile icon={Scissors} label="Cortes feitos" value={nf.format(t.clips)} sub={`+${semana} em 7 dias · +${hoje} hoje`} />
        <Tile icon={FolderOpen} label="Vídeos novos" value={pasta ? pasta.novos : '—'} sub={pasta ? `${pasta.total} na pasta · abrir` : 'Carregando…'} onClick={() => go('pasta')} />
        <Tile icon={Hourglass} label="Para revisar" value={t.pending} sub={t.pending ? 'toque para revisar' : 'tudo revisado'} tone="text-warn" onClick={t.pending ? () => go('clips') : undefined} />
        <Tile icon={CheckCircle2} label="Aprovação" value={revisados ? `${pct(t.approved, revisados)}%` : '—'} sub={`${t.approved} de ${revisados} revisado(s)`} tone="text-ok" />
        <Tile icon={Clock3} label="Minutos" value={nf.format(Math.round(t.seconds / 60))} sub={`${nf.format(Math.round(t.seconds))} s no total`} />
        <Tile icon={Gamepad2} label="Gameplays" value={t.videos} sub={`${dash.by_game.length} jogo(s) diferentes`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Cortes por dia · últimos 14 dias" icon={Scissors}
          extra={<button type="button" className="text-xs font-bold text-brass hover:underline" onClick={() => go('videos')}>Ver biblioteca</button>}>
          <Colunas serie={serie} />
        </Card>
        <Card title="Revisão dos cortes" icon={CheckCircle2}>
          <Revisao t={t} go={go} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Por jogo" icon={Gamepad2}><BarList data={dash.by_game} max={6} /></Card>
        <Card title="Por tipo de momento" icon={Star}><BarList data={dash.by_moment} max={6} /></Card>
        <Card title="Qualidade dos cortes" icon={Sparkles}><Qualidade clips={lista} /></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Últimas gameplays" icon={Bot}
          extra={<button type="button" className="text-xs font-bold text-brass hover:underline" onClick={() => go('import')}>Importar nova</button>}>
          {dash.recent.length === 0 ? <p className="text-sm text-muted">Nenhuma gameplay processada ainda.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Últimas gameplays processadas</caption>
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted">
                    <th className="pb-2 pr-3 font-bold">Jogo</th><th className="pb-2 pr-3 font-bold">Arquivo</th>
                    <th className="pb-2 pr-3 text-right font-bold">Cortes</th><th className="pb-2 pr-3 font-bold">Motor</th><th className="pb-2 font-bold">Quando</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {dash.recent.slice(0, 8).map((r) => (
                    <tr key={r.job_id}>
                      <td className="whitespace-nowrap py-2 pr-3 font-bold text-ink">{r.game}</td>
                      <td className="max-w-[14rem] truncate py-2 pr-3 text-ink2" title={r.source}>{r.source}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-ink">{r.clips}</td>
                      <td className="py-2 pr-3 text-xs text-ink2">{r.engine === 'gemini' ? 'Gemini' : 'Local'}</td>
                      <td className="whitespace-nowrap py-2 font-mono text-xs text-muted">{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Máquina" icon={HardDrive}><Maquina sys={sys} /></Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Card title="Música nos cortes" icon={Music}>
              {conferidas === 0 ? (
                <p className="text-sm text-muted">Nenhum corte conferido ainda.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  <li className="flex justify-between gap-2"><span className="text-ink2">Risco alto</span><b className="font-mono tabular-nums text-ink">{musica.alto}</b></li>
                  <li className="flex justify-between gap-2"><span className="text-ink2">Risco médio</span><b className="font-mono tabular-nums text-ink">{musica.medio}</b></li>
                  <li className="flex justify-between gap-2"><span className="text-ink2">Sem música</span><b className="font-mono tabular-nums text-ink">{musica.baixo}</b></li>
                </ul>
              )}
            </Card>
            <Card title="Custo" icon={Cpu}>
              <p className="text-2xl font-extrabold tabular-nums text-ink">{t.external_api_jobs > 0 ? `${t.external_api_jobs} análise(s)` : 'R$ 0,00'}</p>
              <p className="mt-1 text-xs text-muted">{t.external_api_jobs > 0 ? 'Feitas com o Gemini (cobrança do Google, conforme o uso).' : 'Tudo no motor local, sem serviço pago.'}</p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
