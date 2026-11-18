import React, { useEffect, useState } from 'react';
import { ChevronDown, Eye, Heart, Loader2, RefreshCw, Scissors, Send } from 'lucide-react';
import { apiJson } from '../lib/api';
import { errText, fmtDate, PLATFORMS, safeHttpUrl, STATUS_LABEL } from './util';
import { BarList, DayColumns, Notice } from './ui';

// Painel: the general numbers, next to the Sede. Views and likes come from the
// networks through Upload-Post (refreshed every minute, they trail the apps by
// a few minutes); everything else is counted from the files on disk.
const REFRESH_MS = 60000;
const WEEK = 7 * 86400;
const nf = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const platLabel = (id) => PLATFORMS.find((p) => p.id === id)?.label || id;

function useMetricas(days, uploadPostKey, uploadUserId) {
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams({ days: String(days) });
        if (uploadUserId) q.set('user', uploadUserId);
        const d = await apiJson(`/api/gaming/metrics?${q}`, { headers: uploadPostKey ? { 'X-Upload-Post-Key': uploadPostKey } : {} });
        if (alive) setM(d);
      } catch (e) { if (alive) setM({ configured: true, error: errText(e) }); }
      finally { if (alive) setLoading(false); }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(t); };
  }, [days, uploadPostKey, uploadUserId]);
  return [m, loading];
}

function Kpi({ icon, label, value, sub, destaque }) {
  return (
    <div className={`card p-4 ${destaque ? 'border-brass/50' : ''}`}>
      <p className="flex items-center gap-2 text-xs font-bold text-muted">
        {React.createElement(icon, { size: 15, 'aria-hidden': true, className: destaque ? 'text-brass' : '' })} {label}
      </p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums leading-none text-ink">{value}</p>
      {sub && <div className="mt-2 text-xs text-muted">{sub}</div>}
    </div>
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

export default function Painel({ dash, clips, pubs, job, go, uploadPostKey, uploadUserId }) {
  const [days, setDays] = useState(30);
  const [m, loading] = useMetricas(days, uploadPostKey, uploadUserId);

  if (!dash) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brass" aria-label="Carregando" /></div>;

  const t = dash.totals;
  const now = Date.now() / 1000;
  const semana = (clips || []).filter((c) => c.video_url && now - c.created_at <= WEEK).length;
  const enviadosSemana = (pubs || []).filter((p) => p.status === 'enviado' && now - p.created_at <= WEEK).length;
  const redesOk = m && m.configured && !m.error;
  const conectar = <button type="button" className="font-bold text-brass underline" onClick={() => go('config')}>Conectar as redes</button>;

  return (
    <section aria-labelledby="painel-titulo" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Painel</p>
          <h2 id="painel-titulo" className="text-2xl font-extrabold tracking-tight text-ink">Seus números</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          {loading && <RefreshCw size={12} className="animate-spin" aria-label="atualizando" />}
          {m?.fetched_at && <span className="hidden font-mono sm:inline">atualizado às {new Date(m.fetched_at * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
          <select className="input-field py-1.5 text-xs" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Período das visualizações">
            <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
          </select>
        </div>
      </div>

      {job?.id && ['queued', 'processing'].includes(job.status) && (
        <Notice tone="info">
          Processamento em andamento ({STATUS_LABEL[job.status]}).{' '}
          <button type="button" className="underline" onClick={() => go('analysis')}>Acompanhar</button>
        </Notice>
      )}

      {t.pending > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-warn/40 p-4">
          <p className="text-sm text-ink"><b className="tabular-nums">{t.pending}</b> corte(s) esperando sua aprovação.</p>
          <button type="button" className="btn-primary" onClick={() => go('clips')}>Revisar agora</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Eye} label="Visualizações" destaque
          value={redesOk ? nf.format(m.totals.views) : '—'}
          sub={!m ? 'Carregando…' : redesOk ? `${m.totals.posts} post(s) · ${m.days} dias` : m.configured ? 'Não deu para ler agora' : conectar} />
        <Kpi icon={Heart} label="Curtidas"
          value={redesOk ? nf.format(m.totals.likes) : '—'}
          sub={redesOk && m.totals.views ? `${((m.totals.likes / m.totals.views) * 100).toFixed(1)}% de quem viu` : `nos últimos ${days} dias`} />
        <Kpi icon={Scissors} label="Cortes gerados" value={t.clips} sub={`+${semana} nos últimos 7 dias`} />
        <Kpi icon={Send} label="Publicados" value={t.published} sub={`+${enviadosSemana} nos últimos 7 dias`} />
      </div>

      {m?.error && <Notice tone="error">{m.error}</Notice>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-bold text-ink">Cortes por dia</h3>
          <DayColumns data={dash.by_day} />
        </div>
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold text-ink">Vídeos mais vistos</h3>
          {!redesOk ? <p className="text-sm text-muted">Aparece aqui quando as redes estiverem conectadas.</p>
            : m.top_posts.length === 0 ? <p className="text-sm text-muted">Nenhuma publicação nos últimos {m.days} dias.</p> : (
              <ol className="divide-y divide-rule">
                {m.top_posts.slice(0, 5).map((p, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-4 shrink-0 font-mono text-xs text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-ink2" title={p.title}>
                      {safeHttpUrl(p.url) ? <a className="hover:text-ink hover:underline" href={safeHttpUrl(p.url)} target="_blank" rel="noopener noreferrer">{p.title}</a> : p.title}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-ink">{nf.format(p.views)} <Eye size={11} className="inline" aria-label="visualizações" /></span>
                  </li>
                ))}
              </ol>
            )}
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-ink">Últimas gameplays</h3>
          <button type="button" className="text-xs font-bold text-brass hover:underline" onClick={() => go('import')}>Importar nova</button>
        </div>
        {dash.recent.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma gameplay processada ainda.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {dash.recent.slice(0, 5).map((r) => (
              <li key={r.job_id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink" title={r.source}>{r.game}</span>
                <span className="shrink-0 font-mono text-xs text-ink2">{r.clips} corte(s)</span>
                <span className="hidden shrink-0 font-mono text-xs text-muted sm:inline">{fmtDate(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="card group p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-ink">
          Mais detalhes
          <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="Gameplays processadas" value={t.videos} />
            <Mini label="Minutos de corte" value={Math.round(t.seconds / 60)} />
            <Mini label="Aprovados / rejeitados" value={`${t.approved} / ${t.rejected}`} />
            <Mini label="Custo de IA paga" value={t.external_api_jobs > 0 ? `${t.external_api_jobs} análise(s) Gemini` : 'R$ 0,00'} />
            {redesOk && <Mini label="Comentários" value={nf.format(m.totals.comments)} />}
            {redesOk && <Mini label="Compartilhamentos" value={nf.format(m.totals.shares)} />}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {redesOk && m.per_platform.length > 0 && (
              <div>
                <h4 className="mb-3 text-xs text-muted">Visualizações por rede</h4>
                <BarList data={m.per_platform.map((p) => ({ label: platLabel(p.platform), value: p.views }))} />
              </div>
            )}
            <div>
              <h4 className="mb-3 text-xs text-muted">Cortes por jogo</h4>
              <BarList data={dash.by_game} max={5} />
            </div>
            <div>
              <h4 className="mb-3 text-xs text-muted">Cortes por tipo de momento</h4>
              <BarList data={dash.by_moment} max={5} />
            </div>
            <div>
              <h4 className="mb-3 text-xs text-muted">Cortes por categoria</h4>
              <BarList data={dash.by_category} max={5} />
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
