import React from 'react';
import { Bot, CalendarClock, FileVideo, Gamepad2, Instagram, Link2, Music2, Play, Send, Settings, TrendingUp, Youtube } from 'lucide-react';
import { fmtDate, PLATFORMS, STATUS_LABEL } from './util';

const WEEK = 7 * 86400;
const NET_ICON = { youtube: Youtube, instagram: Instagram, tiktok: Music2 };
const NET_COLOR = { youtube: '#ef4444', instagram: '#e1306c', tiktok: '#22d3ee' };
const ROWS = [1 / 6, 3 / 6, 5 / 6];

function Kpi({ icon, label, value, sub }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ok/30 bg-ok/10 text-ok">{React.createElement(icon, { size: 18, 'aria-hidden': true })}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="text-3xl font-extrabold tabular-nums leading-tight text-ink">{value}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
    </div>
  );
}

function Node({ icon, color, title, sub, on, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-rule2 bg-paper2 p-3 text-left hover:border-brass/60">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${color}22`, color }}>{React.createElement(icon, { size: 20, 'aria-hidden': true })}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-ink">{title}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${on ? 'bg-ok' : 'bg-muted/50'}`} title={on ? 'ativo' : 'não conectado'} />
    </button>
  );
}

// Results at a glance: what went in, what the agents produced, where it was
// published. Every number is counted from the clips and the publication queue
// on disk; nothing here is estimated.
export default function ResultsBoard({ dash, clips, pubs, working, agentCount, connected, go }) {
  const now = Date.now() / 1000;
  const list = pubs || [];
  const weekClips = (clips || []).filter((c) => c.video_url && now - c.created_at <= WEEK).length;
  const sent = list.filter((p) => p.status === 'enviado');
  const failed = list.filter((p) => p.status === 'falhou').length;
  const weekSent = sent.filter((p) => now - p.created_at <= WEEK).length;
  const rate = sent.length + failed ? `${Math.round((sent.length / (sent.length + failed)) * 100)}%` : '—';
  const queue = list.filter((p) => ['aguardando_aprovacao', 'agendado'].includes(p.status));
  const perNet = (id) => ({
    sent: sent.filter((p) => p.platforms.includes(id)).length,
    queued: queue.filter((p) => p.platforms.includes(id)).length,
  });
  const titleOf = (p) => p.title || (clips || []).find((c) => c.job_id === p.job_id && c.clip_index === p.clip_index)?.video_title_for_youtube_short || 'Corte sem título';

  return (
    <div className="mb-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Bot} label="Agentes ativos" value={`${working}/${agentCount}`} sub={working ? 'Processando agora' : 'Todos prontos'} />
        <Kpi icon={Play} label="Vídeos gerados" value={weekClips} sub={`Últimos 7 dias · ${dash.totals.clips} no total`} />
        <Kpi icon={Send} label="Vídeos publicados" value={weekSent} sub={`Últimos 7 dias · ${sent.length} no total`} />
        <Kpi icon={TrendingUp} label="Taxa de sucesso" value={rate} sub={sent.length + failed ? `${failed} envio(s) com falha` : 'Nenhum envio ainda'} />
      </div>

      <section aria-label="Fluxo de produção" className="card relative overflow-hidden p-4 md:p-6">
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {ROWS.map((r) => (
            <g key={r} fill="none" stroke="var(--color-ok)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke">
              <path d={`M 31 ${r * 100} C 37 ${r * 100}, 37 50, 42 50`} vectorEffect="non-scaling-stroke" className="sede-flow" />
              <path d={`M 58 50 C 63 50, 63 ${r * 100}, 69 ${r * 100}`} vectorEffect="non-scaling-stroke" className="sede-flow" />
            </g>
          ))}
        </svg>
        <div className="relative grid items-center gap-4 lg:grid-cols-[31%_1fr_31%] lg:gap-[11%]">
          <div className="grid gap-3 lg:gap-6">
            <Node icon={FileVideo} color="#22d3ee" title="Arquivo de vídeo" sub="MP4, MKV, MOV, WebM do computador" on onClick={() => go('import')} />
            <Node icon={Link2} color="#a855f7" title="Endereço da internet" sub="YouTube ou gravação da Twitch" on onClick={() => go('import')} />
            <Node icon={Gamepad2} color="#f59e0b" title="Biblioteca de jogos" sub={`${dash.totals.games} jogos cadastrados`} on onClick={() => go('games')} />
          </div>
          <div className="mx-auto grid w-full max-w-[220px] place-items-center rounded-3xl border-2 border-ok/70 bg-paper2 px-4 py-7 text-center" style={{ boxShadow: '0 0 34px oklch(var(--tw-ok) / 0.28)' }}>
            <span className={`mb-2 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider ${working ? 'border-ok bg-ok/15 text-ok' : 'border-rule2 text-muted'}`}>{working ? 'ATIVO' : 'PRONTO'}</span>
            <Settings size={34} className={`text-ok ${working ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} aria-hidden="true" />
            <p className="mt-2 text-xl font-extrabold text-ink">J.A.R.V.I.S.</p>
            <p className="text-sm text-ink2">Orquestrador</p>
            <p className="mt-2 text-xs text-ok">Cortar • Editar • Publicar</p>
          </div>
          <div className="grid gap-3 lg:gap-6">
            {['youtube', 'instagram', 'tiktok'].map((id) => {
              const n = perNet(id);
              return (
                <Node key={id} icon={NET_ICON[id]} color={NET_COLOR[id]} title={PLATFORMS.find((p) => p.id === id).label} on={connected}
                  sub={connected ? `${n.sent} publicado(s) · ${n.queued} na fila` : 'Não conectado'} onClick={() => go('social')} />
              );
            })}
          </div>
        </div>
        {!connected && (
          <p className="relative mt-4 text-xs text-muted">
            As redes aparecem como não conectadas porque a chave do Upload-Post não foi informada.{' '}
            <button type="button" className="underline" onClick={() => go('config')}>Abrir Configurações</button>
          </p>
        )}
      </section>

      <section aria-label="Fila de publicação" className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-ink">
          Fila de publicação <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs text-ok">{queue.length}</span>
        </h2>
        {queue.length === 0 ? (
          <p className="text-sm text-muted">Nada na fila. Aprove um corte e envie para as redes em <button type="button" className="underline" onClick={() => go('social')}>Redes Sociais</button>.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {queue.slice(0, 6).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink">{titleOf(p)}</span>
                <span className="text-xs text-ink2">{p.platforms.map((x) => PLATFORMS.find((k) => k.id === x)?.label || x).join(' · ')}</span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-muted"><CalendarClock size={13} aria-hidden="true" />{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : `criado em ${fmtDate(p.created_at)}`}</span>
                <span className="text-xs text-brass">{STATUS_LABEL[p.status] || p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
