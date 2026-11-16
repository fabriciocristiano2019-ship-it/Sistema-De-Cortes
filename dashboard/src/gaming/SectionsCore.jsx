import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Trash2, Upload, ImagePlus, Save, X, Square, Play, RefreshCw } from 'lucide-react';
import { apiJson } from '../lib/api';
import { errText, fmtClock, fmtDate, jsonReq, mediaUrl, PLATFORMS, STATUS_LABEL } from './util';
import { Badge, BarList, DayColumns, Empty, Field, Header, Notice, StatTile } from './ui';

/* 01 · Dashboard ---------------------------------------------------------- */
const REFRESH_MS = 60000;
const nf = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const platLabel = (id) => PLATFORMS.find((p) => p.id === id)?.label || id;

// Views and likes of the published posts. Refreshed on a timer; the numbers
// are the ones each network reports through Upload-Post, so they trail the
// apps by a few minutes.
function SocialMetrics({ uploadPostKey, uploadUserId, go }) {
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

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
  }, [uploadPostKey, uploadUserId, days]);

  return (
    <section className="card p-5 mb-4" aria-label="Desempenho nas redes">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm text-ink">Desempenho nas redes</h2>
        <div className="flex items-center gap-3 text-xs text-muted">
          {m?.fetched_at && <span className="font-mono">atualizado às {new Date(m.fetched_at * 1000).toLocaleTimeString('pt-BR')} · a cada 60 s</span>}
          {loading && <RefreshCw size={12} className="animate-spin" aria-label="atualizando" />}
          <select className="input-field py-1.5 text-xs" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Período">
            <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
          </select>
        </div>
      </div>
      {!m ? <p className="text-sm text-muted">Carregando…</p>
        : !m.configured ? (
          <Notice tone="info">{m.reason} <button className="underline" onClick={() => go('config')}>Abrir Configurações</button></Notice>
        ) : m.error ? <Notice tone="error">{m.error}</Notice> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <StatTile label="Visualizações" value={nf.format(m.totals.views)} sub={`${m.totals.posts} post(s) em ${m.days} dias`} />
              <StatTile label="Curtidas" value={nf.format(m.totals.likes)} sub={m.totals.views ? `${((m.totals.likes / m.totals.views) * 100).toFixed(1)}% das visualizações` : ''} />
              <StatTile label="Comentários" value={nf.format(m.totals.comments)} />
              <StatTile label="Compartilhamentos" value={nf.format(m.totals.shares)} />
            </div>
            {m.totals.posts === 0 ? <p className="text-sm text-muted">Nenhum post publicado neste período.</p> : (
              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs text-muted mb-3">Visualizações por rede</h3>
                  <BarList data={m.per_platform.map((p) => ({ label: platLabel(p.platform), value: p.views }))} />
                  <h3 className="text-xs text-muted mt-5 mb-3">Curtidas por rede</h3>
                  <BarList data={m.per_platform.map((p) => ({ label: platLabel(p.platform), value: p.likes }))} />
                </div>
                <div>
                  <h3 className="text-xs text-muted mb-3">Posts com mais visualizações</h3>
                  <ul className="divide-y divide-rule">
                    {m.top_posts.slice(0, 5).map((p, i) => (
                      <li key={i} className="py-2 flex items-center gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate text-ink2" title={p.title}>
                          {p.url ? <a className="hover:text-ink underline-offset-2 hover:underline" href={p.url} target="_blank" rel="noreferrer">{p.title}</a> : p.title}
                        </span>
                        <span className="text-xs text-muted shrink-0">{platLabel(p.platform)}</span>
                        <span className="font-mono text-xs text-ink tabular-nums shrink-0">{nf.format(p.views)} views · {nf.format(p.likes)} ♥</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
    </section>
  );
}

export function DashboardSection({ dash, job, go, uploadPostKey, uploadUserId }) {
  if (!dash) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brass" /></div>;
  const t = dash.totals;
  const minutes = Math.round(t.seconds / 60);
  return (
    <div>
      <Header ord="01 · DASHBOARD" title="Visão geral" hint="Números calculados a partir dos arquivos produzidos em disco.">
        <button className="btn-primary" onClick={() => go('import')}><Upload size={16} className="inline mr-1.5" />Importar gameplay</button>
      </Header>
      {job?.id && ['queued', 'processing'].includes(job.status) && (
        <div className="mb-4">
          <Notice tone="info">
            Processamento em andamento ({STATUS_LABEL[job.status]}).{' '}
            <button className="underline" onClick={() => go('analysis')}>Acompanhar</button>
          </Notice>
        </div>
      )}
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <StatTile label="Gameplays Processadas" value={t.videos} sub={`${t.games} jogos na biblioteca`} />
        <StatTile label="Cortes 9:16 Gerados" value={t.clips} sub={`${minutes} min de vídeo`} tone="accent" />
        {t.external_api_jobs > 0 ? (
          <StatTile label="Custo de APIs Externas" value={`${t.external_api_jobs} análise(s) Gemini`} tone="warn"
            sub="Cobrança feita pelo Google; consulte o painel deles." />
        ) : (
          <StatTile label="Custo de APIs Externas" value="R$ 0,00" tone="ok" sub="Todas as análises usaram o motor local." />
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile label="Aguardando aprovação" value={t.pending} />
        <StatTile label="Aprovados" value={t.approved} sub={`${t.rejected} rejeitados`} />
        <StatTile label="Na fila de publicação" value={t.scheduled} />
        <StatTile label="Publicações enviadas" value={t.published} />
      </div>
      <SocialMetrics uploadPostKey={uploadPostKey} uploadUserId={uploadUserId} go={go} />
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-5">
          <h2 className="text-sm text-ink mb-4">Cortes por jogo</h2>
          <BarList data={dash.by_game} />
        </div>
        <div className="card p-5">
          <h2 className="text-sm text-ink mb-4">Cortes por tipo de momento</h2>
          <BarList data={dash.by_moment} />
        </div>
        <div className="card p-5">
          <h2 className="text-sm text-ink mb-4">Cortes por dia (últimos 30 dias com produção)</h2>
          <DayColumns data={dash.by_day} />
        </div>
        <div className="card p-5">
          <h2 className="text-sm text-ink mb-4">Cortes por categoria de jogo</h2>
          <BarList data={dash.by_category} />
        </div>
      </div>
      <div className="card p-5">
        <h2 className="text-sm text-ink mb-3">Últimas gameplays</h2>
        {dash.recent.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma gameplay processada. Comece em “Importação”.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {dash.recent.map((r) => (
              <li key={r.job_id} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-ink">{r.game}</span>
                <span className="text-muted truncate max-w-[18rem]" title={r.source}>{r.source}</span>
                <span className="ml-auto font-mono text-xs text-ink2">{r.clips} corte(s) · motor {r.engine}</span>
                <span className="font-mono text-xs text-muted">{fmtDate(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* 02 · Biblioteca de jogos ------------------------------------------------ */
function GameForm({ meta, initial, onSaved, onCancel }) {
  const [f, setF] = useState(() => ({
    name: initial?.name || '',
    category: initial?.category || 'other',
    aliases: (initial?.aliases || []).join(', '),
    preferences: { ...(meta?.defaults || {}), ...(initial?.preferences || {}) },
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const setPref = (k, v) => setF((p) => ({ ...p, preferences: { ...p.preferences, [k]: v } }));

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const body = {
        name: f.name, category: f.category,
        aliases: f.aliases.split(',').map((a) => a.trim()).filter(Boolean),
        preferences: f.preferences,
      };
      let g = initial
        ? await jsonReq(`/api/games/${initial.id}`, 'PUT', body)
        : await jsonReq('/api/games', 'POST', body);
      const file = fileRef.current?.files?.[0];
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        g = await apiJson(`/api/games/${g.id}/cover`, { method: 'POST', body: fd });
      }
      onSaved(g);
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  return (
    <div className="card p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm text-ink">{initial ? `Editar ${initial.name}` : 'Novo jogo'}</h2>
        <button className="btn-quiet" onClick={onCancel} aria-label="Fechar"><X size={16} /></button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nome do jogo">
          <input className="input-field w-full" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Valorant" />
        </Field>
        <Field label="Categoria (define o perfil de análise)">
          <select className="input-field w-full" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Apelidos para identificação automática" hint="Separados por vírgula. Usados no nome do arquivo e na fala.">
          <input className="input-field w-full" value={f.aliases} onChange={(e) => setF({ ...f, aliases: e.target.value })} placeholder="valorant, vava" />
        </Field>
        <Field label="Capa (imagem JPG/PNG/WebP, até 8 MB)">
          <input ref={fileRef} type="file" accept="image/*" className="block w-full text-sm text-muted file:mr-3 file:btn-ghost" />
        </Field>
        <Field label="Duração padrão do corte (segundos)">
          <input type="number" min="5" max="180" className="input-field w-full" value={f.preferences.clip_seconds}
            onChange={(e) => setPref('clip_seconds', Number(e.target.value))} />
        </Field>
        <Field label="Layout padrão">
          <select className="input-field w-full" value={f.preferences.layout} onChange={(e) => setPref('layout', e.target.value)}>
            {meta.layouts.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink2">
          <input type="checkbox" checked={!!f.preferences.captions} onChange={(e) => setPref('captions', e.target.checked)} /> Legendas automáticas
        </label>
        <label className="flex items-center gap-2 text-sm text-ink2">
          <input type="checkbox" checked={!!f.preferences.zoom} onChange={(e) => setPref('zoom', e.target.checked)} /> Zoom nos momentos importantes
        </label>
      </div>
      {err && <div className="mt-4"><Notice tone="error">{err}</Notice></div>}
      <div className="mt-5 flex gap-2">
        <button className="btn-primary" disabled={busy || !f.name.trim()} onClick={save}>
          {busy ? <Loader2 size={16} className="inline animate-spin mr-1.5" /> : <Save size={16} className="inline mr-1.5" />}Salvar
        </button>
        <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

export function GamesSection({ meta, games, reload }) {
  const [editing, setEditing] = useState(null); // null | 'new' | game
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => (games || []).filter((g) => !filter || g.category === filter), [games, filter]);

  const remove = async (g) => {
    if (!window.confirm(`Remover “${g.name}” da biblioteca?\n\nOs cortes já produzidos continuam salvos.`)) return;
    try { await apiJson(`/api/games/${g.id}`, { method: 'DELETE' }); reload(); } catch (e) { setErr(errText(e)); }
  };

  if (!meta || !games) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brass" /></div>;
  return (
    <div>
      <Header ord="02 · BIBLIOTECA DE JOGOS" title="Jogos" hint="Qualquer jogo funciona: escolha uma categoria e o sistema usa o perfil de análise dela. Os jogos iniciais são só exemplos e podem ser editados ou removidos.">
        <select className="input-field" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} className="inline mr-1" />Adicionar jogo</button>
      </Header>
      {err && <div className="mb-4"><Notice tone="error">{err}</Notice></div>}
      {editing && (
        <GameForm key={editing === 'new' ? 'new' : editing.id} meta={meta} initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
      {shown.length === 0 ? <Empty title="Nenhum jogo nesta categoria">Adicione um jogo para começar.</Empty> : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {shown.map((g) => (
            <article key={g.id} className="card overflow-hidden flex flex-col">
              <div className="aspect-[4/5] bg-paper3 relative">
                {g.cover_url
                  ? <img src={mediaUrl(g.cover_url)} alt={`Capa de ${g.name}`} className="absolute inset-0 w-full h-full object-cover" />
                  : <div className="absolute inset-0 flex flex-col items-center justify-center text-muted gap-2 p-3 text-center">
                      <ImagePlus size={22} /><span className="font-display text-lg text-ink2 leading-tight">{g.name}</span>
                    </div>}
              </div>
              <div className="p-3 flex-1 flex flex-col gap-1.5">
                <h3 className="text-sm text-ink truncate" title={g.name}>{g.name}</h3>
                <p className="text-xs text-muted">{g.category_label}</p>
                <p className="font-mono text-xs text-ink2">{g.videos} vídeo(s) · {g.clips} corte(s)</p>
                <div className="mt-auto pt-2 flex gap-1.5">
                  <button className="btn-ghost btn-sm flex-1" onClick={() => setEditing(g)}>Editar</button>
                  <button className="btn-quiet btn-sm" onClick={() => setOpen(open === g.id ? null : g.id)}>Histórico</button>
                  <button className="btn-quiet btn-sm" onClick={() => remove(g)} aria-label={`Remover ${g.name}`}><Trash2 size={14} /></button>
                </div>
                {open === g.id && (
                  <ul className="mt-2 border-t border-rule pt-2 space-y-1">
                    {g.history.length === 0 && <li className="text-xs text-muted">Nenhum vídeo processado ainda.</li>}
                    {g.history.map((h) => (
                      <li key={h.job_id} className="text-xs text-muted flex justify-between gap-2">
                        <span className="truncate" title={h.source}>{h.source}</span>
                        <span className="font-mono shrink-0">{h.clips} · {fmtDate(h.created_at).slice(0, 10)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* 03 · Importação --------------------------------------------------------- */
export function ImportSection({ meta, games, form, setForm, onStart, starting, startError, job }) {
  const [ident, setIdent] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const busy = job?.id && ['queued', 'processing'].includes(job.status);

  const pick = async (file) => {
    if (!file) return;
    set('file', file);
    setIdent(null);
    try {
      const r = await jsonReq('/api/gaming/identify', 'POST', { filename: file.name });
      setIdent(r);
      if (r.best && r.confidence !== 'baixa') applyGame(r.best.game_id);
    } catch { /* identification is a convenience; manual selection still works */ }
  };

  const applyGame = (id) => {
    const g = (games || []).find((x) => x.id === id);
    setForm((p) => ({
      ...p, game_id: id,
      ...(g ? { clip_seconds: g.preferences.clip_seconds, layout: g.preferences.layout,
                captions: g.preferences.captions, zoom: g.preferences.zoom,
                max_clips: g.preferences.max_clips, min_score: g.preferences.min_score } : {}),
    }));
  };

  if (!meta || !games) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brass" /></div>;
  const custom = !meta.durations.includes(Number(form.clip_seconds));
  const ready = (form.file || form.url.trim()) && form.acknowledged && !busy && !starting;

  return (
    <div>
      <Header ord="03 · IMPORTAÇÃO" title="Importar gameplay" hint="O vídeo original é preservado; os cortes são arquivos novos." />
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5">
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
          <Field label="Ou cole um link (YouTube / Twitch VOD)" hint="O download usa yt-dlp, já incluído. Arquivo local tem prioridade.">
            <input className="input-field w-full" value={form.url} disabled={!!form.file}
              onChange={(e) => set('url', e.target.value)} placeholder="https://..." />
          </Field>
          {ident && (
            <Notice tone={ident.best ? 'ok' : 'warn'}>
              {ident.best
                ? <>Jogo sugerido: <strong>{ident.best.name}</strong> (confiança {ident.confidence}: {ident.best.evidence.join('; ')}).</>
                : 'Não reconheci o jogo pelo nome do arquivo. Selecione ao lado, ou deixe em “Identificar automaticamente” para tentar pela fala após a transcrição.'}
            </Notice>
          )}
        </div>

        <div className="card p-5 space-y-4">
          <Field label="Jogo">
            <select className="input-field w-full" value={form.game_id} onChange={(e) => applyGame(e.target.value)}>
              <option value="auto">Identificar automaticamente</option>
              {games.map((g) => <option key={g.id} value={g.id}>{g.name} — {g.category_label}</option>)}
            </select>
          </Field>
          {form.game_id === 'auto' && (
            <Field label="Categoria, caso o jogo não seja identificado">
              <select className="input-field w-full" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
          )}
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
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.captions} onChange={(e) => set('captions', e.target.checked)} /> Legendas animadas (D)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.zoom} onChange={(e) => set('zoom', e.target.checked)} /> Zoom nos picos</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.auto_hook} onChange={(e) => set('auto_hook', e.target.checked)} /> Texto de gancho</label>
          </div>
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
      <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-5">
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
