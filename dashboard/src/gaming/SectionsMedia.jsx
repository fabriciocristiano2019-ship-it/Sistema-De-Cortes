import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Loader2, Pencil, Save, Scissors, Send, Type, X, Image as ImageIcon } from 'lucide-react';
import PublicarDialog from './PublicarDialog';
import { errText, fmtDate, fmtTime, jsonReq, mediaUrl } from './util';
import { somAprovado } from './sons';
import { Badge, Empty, Field, Header, Notice, ScoreBar } from './ui';

function ClipVideo({ clip, className = '' }) {
  if (!clip.video_url) {
    return <div className={`bg-paper3 flex items-center justify-center text-xs text-muted ${className}`}>Renderizando…</div>;
  }
  return <video src={mediaUrl(clip.video_url)} controls preload="metadata" playsInline className={`bg-black ${className}`} />;
}

function ClipPicker({ clips, selected, onSelect }) {
  if (!clips.length) return null;
  const value = selected ? `${selected.job_id}:${selected.clip_index}` : '';
  return (
    <Field label="Corte">
      <select className="input-field w-full" value={value}
        onChange={(e) => { const [j, i] = e.target.value.split(':'); onSelect({ job_id: j, clip_index: Number(i) }); }}>
        <option value="" disabled>Selecione um corte</option>
        {clips.map((c) => (
          <option key={`${c.job_id}:${c.clip_index}`} value={`${c.job_id}:${c.clip_index}`}>
            {c.game_name} · {c.moment_label} · {c.start_timecode} – {c.end_timecode} · {c.relevance_score}/100
          </option>
        ))}
      </select>
    </Field>
  );
}

const findClip = (clips, sel) => clips.find((c) => sel && c.job_id === sel.job_id && c.clip_index === sel.clip_index);

/* 05 · Cortes encontrados ------------------------------------------------- */
function ClipCard({ clip, meta, onPatched, onEdit, onSubs, publicacao }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const patch = async (body, tag) => {
    if (body.approved === true && publicacao && !publicacao.confirmar(clip)) return;
    setBusy(tag); setErr('');
    try {
      await jsonReq(`/api/gaming/clips/${clip.job_id}/${clip.clip_index}`, 'PATCH', body);
      if (body.approved === true) somAprovado();
      await onPatched();
      if (body.approved === true) publicacao?.publicar(clip);
      setEdit(false);
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  };
  const [thumbOpen, setThumbOpen] = useState(false);
  const [thumbText, setThumbText] = useState('');
  const makeThumb = async () => {
    setBusy('thumb'); setErr('');
    try {
      await jsonReq(`/api/gaming/clips/${clip.job_id}/${clip.clip_index}/thumbnail`, 'POST', { text: thumbText });
      await onPatched();
      setThumbOpen(false);
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  };
  const startEdit = () => {
    setF({
      video_title_for_youtube_short: clip.video_title_for_youtube_short || '',
      description: clip.description || '',
      hashtags: (clip.hashtags || []).join(' '),
      moment_category: clip.moment_category,
    });
    setEdit(true);
  };
  const save = () => {
    const hashtags = f.hashtags.split(/\s+/).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`));
    const tags = hashtags.join(' ');
    patch({
      video_title_for_youtube_short: f.video_title_for_youtube_short,
      description: f.description,
      hashtags,
      video_description_for_tiktok: `${f.description} ${tags}`.trim(),
      video_description_for_instagram: `${f.description}\n\n${tags}`.trim(),
      ...(meta.moments.some((m) => m.id === f.moment_category) ? { moment_category: f.moment_category } : {}),
    }, 'save');
  };

  return (
    <article className="card p-4 grid sm:grid-cols-[11rem_1fr] gap-4">
      <ClipVideo clip={clip} className="w-full aspect-[9/16] rounded-input" />
      <div className="min-w-0 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink">{clip.game_name || 'Gameplay'}</span>
          <Badge>{clip.moment_label}</Badge>
          <Badge status={clip.status} />
          <span className="ml-auto"><ScoreBar score={clip.relevance_score} /></span>
        </div>
        <p className="font-mono text-xs text-ink2">
          Original: {clip.start_timecode} → {clip.end_timecode} · {Math.round(clip.end - clip.start)}s · motor {clip.analysis_engine}
        </p>
        {!edit ? (
          <>
            <h3 className="text-base text-ink leading-snug break-words">{clip.video_title_for_youtube_short}</h3>
            <p className="text-sm text-muted break-words">{clip.description}</p>
            <p className="text-xs text-ink2 break-words">{(clip.hashtags || []).join(' ')}</p>
          </>
        ) : (
          <div className="space-y-2">
            <Field label="Título"><input className="input-field w-full" maxLength={100} value={f.video_title_for_youtube_short} onChange={(e) => setF({ ...f, video_title_for_youtube_short: e.target.value })} /></Field>
            <Field label="Descrição"><textarea className="input-field w-full" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <Field label="Hashtags"><input className="input-field w-full" value={f.hashtags} onChange={(e) => setF({ ...f, hashtags: e.target.value })} /></Field>
            <Field label="Categoria do momento">
              <select className="input-field w-full" value={f.moment_category} onChange={(e) => setF({ ...f, moment_category: e.target.value })}>
                {!meta.moments.some((m) => m.id === f.moment_category) && <option value={f.moment_category}>{clip.moment_label}</option>}
                {meta.moments.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
          </div>
        )}
        {(clip.evidence || []).length > 0 && (
          <div>
            <p className="text-micro uppercase text-muted mb-1">Evidências</p>
            <ul className="flex flex-wrap gap-1.5">
              {clip.evidence.map((e) => <li key={e} className="text-xs text-ink2 border border-rule2 rounded-full px-2 py-0.5">{e}</li>)}
            </ul>
          </div>
        )}
        {clip.thumbnail_url && (
          <div className="flex items-start gap-3">
            <img src={mediaUrl(clip.thumbnail_url)} alt={`Thumbnail: ${clip.thumbnail_text || ''}`} className="w-20 rounded-input border border-rule2" />
            <div className="text-xs text-muted">
              <p className="text-ink2">Thumbnail gerada no seu computador (sem custo).</p>
              <a className="underline" href={mediaUrl(clip.thumbnail_url)} download>Baixar JPG</a>
            </div>
          </div>
        )}
        {thumbOpen && (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Texto da thumbnail">
              <input className="input-field w-64 max-w-full" maxLength={90} value={thumbText} onChange={(e) => setThumbText(e.target.value)} />
            </Field>
            <button className="btn-primary btn-sm" disabled={!!busy} onClick={makeThumb}>
              {busy === 'thumb' ? <Loader2 size={14} className="inline animate-spin mr-1" /> : <ImageIcon size={14} />}Gerar
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setThumbOpen(false)}>Fechar</button>
          </div>
        )}
        {err && <Notice tone="error">{err}</Notice>}
        <div className="mt-auto pt-1 flex flex-wrap gap-2">
          {edit ? (
            <>
              <button className="btn-primary btn-sm" disabled={!!busy} onClick={save}><Save size={14} />Salvar</button>
              <button className="btn-ghost btn-sm" onClick={() => setEdit(false)}>Cancelar</button>
            </>
          ) : (
            <>
              <button className={`btn-sm ${clip.approved === true ? 'btn-primary' : 'btn-ghost'}`} disabled={!!busy} onClick={() => patch({ approved: true }, 'ok')}>
                {busy === 'ok' ? <Loader2 size={14} className="inline animate-spin mr-1" /> : <Check size={14} />}Aprovar
              </button>
              <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => patch({ approved: false }, 'no')}><X size={14} />Rejeitar</button>
              <button className="btn-quiet btn-sm" onClick={startEdit}><Pencil size={14} />Editar texto</button>
              <button className="btn-quiet btn-sm" onClick={() => onEdit(clip)}><Scissors size={14} />Editor</button>
              <button className="btn-quiet btn-sm" onClick={() => onSubs(clip)}><Type size={14} />Legendas</button>
              {clip.video_url && (
                <button className="btn-quiet btn-sm" onClick={() => { setThumbText(clip.thumbnail_text || clip.viral_hook_text || clip.video_title_for_youtube_short || ''); setThumbOpen(true); }}>
                  <ImageIcon size={14} />Thumbnail
                </button>
              )}
              {clip.video_url && <a className="btn-quiet btn-sm" href={mediaUrl(clip.video_url)} download><Download size={14} />MP4</a>}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function ClipsSection({ clips, job, meta, reload, openEditor, openSubs, go, publicacao }) {
  const [scope, setScope] = useState(job?.id ? 'job' : 'all');
  const list = useMemo(() => {
    const src = clips || [];
    return scope === 'job' && job?.id ? src.filter((c) => c.job_id === job.id) : src.filter((c) => c.status === 'pendente');
  }, [clips, scope, job?.id]);
  if (!clips || !meta) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brass" /></div>;
  return (
    <div>
      <Header ord="05 · CORTES ENCONTRADOS" title="Cortes" hint="Cada corte mostra por que foi escolhido. Revise, ajuste o texto e aprove antes de publicar.">
        <select className="input-field" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Quais cortes mostrar">
          <option value="job" disabled={!job?.id}>Da última análise</option>
          <option value="all">Todos os pendentes</option>
        </select>
      </Header>
      {job?.id && ['queued', 'processing'].includes(job.status) && scope === 'job' && (
        <div className="mb-4"><Notice>Análise em andamento: os cortes aparecem aqui conforme ficam prontos.</Notice></div>
      )}
      {list.length === 0 ? (
        <Empty title="Nenhum corte para revisar">
          {scope === 'job' ? 'A última análise ainda não gerou cortes.' : 'Não há cortes pendentes.'}{' '}
          <button className="underline" onClick={() => go('import')}>Importar gameplay</button>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {list.map((c) => <ClipCard key={`${c.job_id}:${c.clip_index}`} clip={c} meta={meta} onPatched={reload} onEdit={openEditor} onSubs={openSubs} publicacao={publicacao} />)}
        </div>
      )}
    </div>
  );
}

/* 06 · Editor de vídeos --------------------------------------------------- */
export function EditorSection({ clips, selected, onSelect, reload }) {
  const clip = findClip(clips || [], selected);
  const srcRef = useRef(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [framing, setFraming] = useState('auto');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const clipKey = clip ? `${clip.job_id}:${clip.clip_index}` : '';
  useEffect(() => {
    if (clip) { setStart(Number(clip.start.toFixed(2))); setEnd(Number(clip.end.toFixed(2))); setMsg(null); }
    // Reset only when another clip is chosen, not when its fields refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipKey]);

  const apply = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await jsonReq('/api/clip/rerender', 'POST', {
        job_id: clip.job_id, clip_index: clip.clip_index,
        segments: [{ start: Number(start), end: Number(end) }],
        snap_to_words: false, reapply_captions: true, framing,
      });
      await reload();
      setMsg({ tone: 'ok', text: `Corte renderizado de novo (${fmtTime(r.start)} → ${fmtTime(r.end)}, ${Math.round(r.duration)}s).` });
    } catch (e) { setMsg({ tone: 'error', text: errText(e) }); } finally { setBusy(false); }
  };
  const dur = Number(end) - Number(start);
  const valid = dur >= 3 && dur <= 180 && Number(start) >= 0;

  return (
    <div>
      <Header ord="06 · EDITOR DE VÍDEOS" title="Editor" hint="Ajuste início, fim e enquadramento. O vídeo original não é alterado; o corte é renderizado de novo." />
      <div className="mb-5 max-w-2xl"><ClipPicker clips={clips || []} selected={selected} onSelect={onSelect} /></div>
      {!clip ? <Empty title="Selecione um corte">Escolha acima o corte que quer ajustar.</Empty> : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_15rem] gap-5">
          <div className="card p-4 space-y-4">
            <div>
              <p className="text-xs text-muted mb-2">Vídeo original (use para achar o ponto exato)</p>
              <video ref={srcRef} src={mediaUrl(`/api/source/${clip.job_id}`)} controls preload="metadata" className="w-full rounded-input bg-black max-h-[22rem]"
                onLoadedMetadata={(e) => { e.currentTarget.currentTime = Number(start) || 0; }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={`Início (s) · ${fmtTime(start)}`}>
                <div className="flex gap-2">
                  <input type="number" step="0.1" min="0" className="input-field w-full" value={start} onChange={(e) => setStart(e.target.value)} />
                  <button className="btn-ghost shrink-0" onClick={() => setStart(Number((srcRef.current?.currentTime || 0).toFixed(2)))}>Usar posição</button>
                </div>
              </Field>
              <Field label={`Fim (s) · ${fmtTime(end)}`}>
                <div className="flex gap-2">
                  <input type="number" step="0.1" min="0" className="input-field w-full" value={end} onChange={(e) => setEnd(e.target.value)} />
                  <button className="btn-ghost shrink-0" onClick={() => setEnd(Number((srcRef.current?.currentTime || 0).toFixed(2)))}>Usar posição</button>
                </div>
              </Field>
            </div>
            <Field label="Enquadramento" hint="“Tela inteira” mantém toda a largura do jogo (HUD, mapa e placar preservados).">
              <select className="input-field w-full" value={framing} onChange={(e) => setFraming(e.target.value)}>
                <option value="auto">Manter automático</option>
                <option value="full">Tela inteira (preserva a interface do jogo)</option>
                <option value="track">Vertical com recorte central</option>
              </select>
            </Field>
            {!valid && <Notice tone="warn">A duração precisa ficar entre 3 e 180 segundos (atual: {dur.toFixed(1)}s).</Notice>}
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <button className="btn-primary" disabled={busy || !valid} onClick={apply}>
              {busy ? <Loader2 size={16} className="inline animate-spin mr-1.5" /> : <Scissors size={16} className="inline mr-1.5" />}
              {busy ? 'Renderizando…' : 'Aplicar e renderizar'}
            </button>
          </div>
          <div>
            <p className="text-xs text-muted mb-2">Corte atual</p>
            <ClipVideo clip={clip} className="w-full aspect-[9/16] rounded-input" />
          </div>
        </div>
      )}
    </div>
  );
}

/* 07 · Legendas ----------------------------------------------------------- */
export function SubtitlesSection({ clips, selected, onSelect, reload }) {
  const clip = findClip(clips || [], selected);
  const [o, setO] = useState({ style: 'karaoke', position: 'bottom', font_size: 16, highlight_color: '#FFE500', font_color: '#FFFFFF', effect: 'pop', uppercase: true });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setO((p) => ({ ...p, [k]: v }));

  const run = async (path, body, tag, okText) => {
    setBusy(tag); setMsg(null);
    try {
      await jsonReq(path, 'POST', body);
      await reload();
      setMsg({ tone: 'ok', text: okText });
    } catch (e) { setMsg({ tone: 'error', text: errText(e) }); } finally { setBusy(''); }
  };
  const base = clip ? { job_id: clip.job_id, clip_index: clip.clip_index } : null;

  return (
    <div>
      <Header ord="07 · LEGENDAS" title="Legendas" hint="Geradas da transcrição local (Faster-Whisper), sincronizadas palavra por palavra." />
      <div className="mb-5 max-w-2xl"><ClipPicker clips={clips || []} selected={selected} onSelect={onSelect} /></div>
      {!clip ? <Empty title="Selecione um corte">Escolha acima o corte para aplicar ou refazer as legendas.</Empty> : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_15rem] gap-5">
          <div className="card p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Estilo">
                <select className="input-field w-full" value={o.style} onChange={(e) => set('style', e.target.value)}>
                  <option value="karaoke">Animada: destaca a palavra falada</option>
                  <option value="classic">Clássica: cor única</option>
                </select>
              </Field>
              <Field label="Posição">
                <select className="input-field w-full" value={o.position} onChange={(e) => set('position', e.target.value)}>
                  <option value="bottom">Embaixo</option><option value="middle">Meio</option><option value="top">Em cima</option>
                </select>
              </Field>
              <Field label="Tamanho da fonte">
                <input type="number" min="10" max="40" className="input-field w-full" value={o.font_size} onChange={(e) => set('font_size', Number(e.target.value))} />
              </Field>
              <Field label="Efeito (estilo animado)">
                <select className="input-field w-full" value={o.effect} disabled={o.style !== 'karaoke'} onChange={(e) => set('effect', e.target.value)}>
                  <option value="none">Nenhum</option><option value="pop">Pop</option><option value="glow">Brilho</option><option value="box">Caixa</option>
                </select>
              </Field>
              <Field label="Cor do texto"><input type="color" className="h-10 w-full rounded-input bg-transparent" value={o.font_color} onChange={(e) => set('font_color', e.target.value)} /></Field>
              <Field label="Cor do destaque"><input type="color" className="h-10 w-full rounded-input bg-transparent" value={o.highlight_color} disabled={o.style !== 'karaoke'} onChange={(e) => set('highlight_color', e.target.value)} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink2"><input type="checkbox" checked={o.uppercase} onChange={(e) => set('uppercase', e.target.checked)} /> Texto em maiúsculas</label>
            {clip.transcript_excerpt && <p className="text-sm text-muted">Fala no corte: “{clip.transcript_excerpt}”</p>}
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!!busy} onClick={() => run('/api/subtitle', { ...base, ...o }, 'burn', 'Legendas aplicadas.')}>
                {busy === 'burn' ? <Loader2 size={16} className="inline animate-spin mr-1.5" /> : <Type size={16} className="inline mr-1.5" />}Aplicar legendas
              </button>
              <button className="btn-ghost" disabled={!!busy} onClick={() => run('/api/subtitle/remove', base, 'rm', 'Legendas removidas.')}>
                {busy === 'rm' && <Loader2 size={16} className="inline animate-spin mr-1.5" />}Remover legendas
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted mb-2">Resultado</p>
            <ClipVideo key={clip.video_url} clip={clip} className="w-full aspect-[9/16] rounded-input" />
          </div>
        </div>
      )}
    </div>
  );
}

/* 08 · Biblioteca de vídeos ----------------------------------------------- */
export function VideoLibrarySection({ clips, openEditor, pubs = [], servicoPub = false, onPublicar, onAbrirChaves }) {
  const [publicando, setPublicando] = useState(null);
  // Networks each clip already went to (sent publications), for "Republicar".
  const enviados = useMemo(() => {
    const m = {};
    for (const p of pubs || []) {
      if (p.status !== 'enviado') continue;
      const k = `${p.job_id}:${p.clip_index}`;
      m[k] = [...new Set([...(m[k] || []), ...(p.platforms || [])])];
    }
    return m;
  }, [pubs]);
  const [status, setStatus] = useState('');
  const list = useMemo(() => (clips || []).filter((c) => !status || c.status === status), [clips, status]);
  if (!clips) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brass" /></div>;
  return (
    <div>
      <Header ord="08 · BIBLIOTECA DE VÍDEOS" title="Vídeos produzidos" hint={`${list.length} de ${clips.length} corte(s). Arquivos MP4 (H.264 + AAC), 1080×1920.`}>
        <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por situação">
          <option value="">Todas as situações</option>
          <option value="pendente">Pendentes</option><option value="aprovado">Aprovados</option><option value="rejeitado">Rejeitados</option>
        </select>
      </Header>
      {list.length === 0 ? <Empty title="Nenhum vídeo aqui">Ajuste os filtros ou processe uma gameplay.</Empty> : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {list.map((c) => (
            <article key={`${c.job_id}:${c.clip_index}`} className="card overflow-hidden flex flex-col">
              <ClipVideo clip={c} className="w-full aspect-[9/16]" />
              <div className="p-3 flex flex-col gap-1.5 flex-1">
                <h3 className="text-sm text-ink line-clamp-2 break-words" title={c.video_title_for_youtube_short}>{c.video_title_for_youtube_short}</h3>
                <p className="text-xs text-muted">{c.game_name} · {c.moment_label}</p>
                <p className="font-mono text-xs text-muted">{fmtDate(c.created_at)}</p>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mt-auto pt-1.5">
                  <Badge status={c.status} />
                  <span className="flex gap-0.5">
                    {onPublicar && c.video_url && (
                      <button className="btn-quiet btn-sm" onClick={() => setPublicando(c)}
                        aria-label={enviados[`${c.job_id}:${c.clip_index}`] ? 'Publicar de novo' : 'Publicar'}
                        title={enviados[`${c.job_id}:${c.clip_index}`] ? `Já publicado: ${enviados[`${c.job_id}:${c.clip_index}`].join(', ')}. Publicar de novo` : 'Publicar no YouTube ou outras redes'}>
                        <Send size={14} className={enviados[`${c.job_id}:${c.clip_index}`] ? 'text-ok' : ''} />
                      </button>
                    )}
                    <button className="btn-quiet btn-sm" onClick={() => openEditor(c)} aria-label="Abrir no editor"><Scissors size={14} /></button>
                    {c.video_url && <a className="btn-quiet btn-sm" href={mediaUrl(c.video_url)} download aria-label="Baixar MP4"><Download size={14} /></a>}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {publicando && (
        <PublicarDialog clip={publicando} jaFoi={enviados[`${publicando.job_id}:${publicando.clip_index}`] || []} servico={servicoPub}
          onPublicar={onPublicar} onFechar={() => setPublicando(null)} onAbrirChaves={onAbrirChaves} />
      )}
    </div>
  );
}
