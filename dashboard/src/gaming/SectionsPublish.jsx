import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, Send, Trash2 } from 'lucide-react';
import { apiJson } from '../lib/api';
import { errText, fmtDate, jsonReq, PLATFORMS, STATUS_LABEL } from './util';
import { Badge, Empty, Field, Header, Notice } from './ui';

const clipLabel = (clips, p) => {
  const c = (clips || []).find((x) => x.job_id === p.job_id && x.clip_index === p.clip_index);
  return c ? `${c.game_name} · ${c.moment_label}` : `Corte ${p.clip_index + 1}`;
};

function PubRow({ p, clips, onApprove, onCancel, busy }) {
  const last = p.log?.[p.log.length - 1];
  return (
    <li className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="text-ink truncate">{p.title || clipLabel(clips, p)}</p>
        <p className="text-xs text-muted">
          {clipLabel(clips, p)} · {p.platforms.map((x) => PLATFORMS.find((k) => k.id === x)?.label || x).join(', ')}
          {p.scheduled_at ? ` · agendado para ${new Date(p.scheduled_at).toLocaleString('pt-BR')}` : ' · envio imediato após aprovação'}
        </p>
        {p.status === 'falhou' && last?.detail && <p className="text-xs text-danger mt-0.5">{String(last.detail)}</p>}
      </div>
      <Badge status={p.status} />
      {['aguardando_aprovacao', 'falhou'].includes(p.status) && (
        <button className="btn-primary" disabled={busy === p.id} onClick={() => onApprove(p)}>
          {busy === p.id ? <Loader2 size={14} className="inline animate-spin mr-1" /> : <Send size={14} className="inline mr-1" />}
          {p.status === 'falhou' ? 'Tentar de novo' : 'Aprovar e enviar'}
        </button>
      )}
      {['aguardando_aprovacao', 'agendado', 'falhou'].includes(p.status) && (
        <button className="btn-quiet" onClick={() => onCancel(p)} aria-label="Cancelar publicação"><Trash2 size={14} /></button>
      )}
    </li>
  );
}

function usePubActions({ reload, uploadPostKey, setErr }) {
  const [busy, setBusy] = useState('');
  const headers = uploadPostKey ? { 'X-Upload-Post-Key': uploadPostKey } : {};
  const approve = async (p) => {
    if (!window.confirm(`Publicar “${p.title || 'corte'}” em ${p.platforms.join(', ')}?\n\nEssa ação envia o vídeo para as redes sociais.`)) return;
    setBusy(p.id); setErr('');
    try { await jsonReq(`/api/gaming/publications/${p.id}/approve`, 'POST', {}, headers); }
    catch (e) { setErr(errText(e)); }
    finally { setBusy(''); reload(); }
  };
  const cancel = async (p) => {
    const note = p.status === 'agendado'
      ? '\n\nAtenção: o agendamento já foi enviado ao Upload-Post. Cancele também no painel deles.' : '';
    if (!window.confirm(`Cancelar esta publicação?${note}`)) return;
    try { await apiJson(`/api/gaming/publications/${p.id}`, { method: 'DELETE' }); reload(); } catch (e) { setErr(errText(e)); }
  };
  return { busy, approve, cancel };
}

/* 09 · Redes sociais ------------------------------------------------------ */
export function SocialSection({ clips, pubs, meta, reload, uploadPostKey, uploadUserId, go }) {
  const approved = useMemo(() => (clips || []).filter((c) => c.status === 'aprovado' && c.video_url), [clips]);
  const [sel, setSel] = useState('');
  const [f, setF] = useState({ platforms: ['tiktok', 'instagram', 'youtube'], title: '', description: '', scheduled_at: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const { busy, approve, cancel } = usePubActions({ reload, uploadPostKey, setErr });
  const configured = !!uploadPostKey || meta?.upload_post_configured;

  useEffect(() => {
    const c = approved.find((x) => `${x.job_id}:${x.clip_index}` === sel);
    if (c) {
      setF((p) => ({ ...p, title: c.video_title_for_youtube_short || '', description: c.video_description_for_instagram || c.description || '' }));
    }
    // Prefill only when the chosen clip changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const toggle = (id) => setF((p) => ({ ...p, platforms: p.platforms.includes(id) ? p.platforms.filter((x) => x !== id) : [...p.platforms, id] }));
  const queue = async () => {
    const [job_id, idx] = sel.split(':');
    setSaving(true); setErr('');
    try {
      await jsonReq('/api/gaming/publications', 'POST', {
        job_id, clip_index: Number(idx), platforms: f.platforms, title: f.title, description: f.description,
        scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        user_id: uploadUserId || null,
      });
      setSel(''); reload();
    } catch (e) { setErr(errText(e)); } finally { setSaving(false); }
  };
  const waiting = (pubs || []).filter((p) => ['aguardando_aprovacao', 'falhou'].includes(p.status));

  return (
    <div>
      <Header ord="09 · REDES SOCIAIS" title="Central de publicação" hint="Instagram Reels, TikTok e YouTube Shorts. Nada é publicado sem a sua aprovação manual." />
      {!configured && (
        <div className="mb-4">
          <Notice tone="warn">
            Publicação automática desativada: falta a chave do Upload-Post (serviço externo; confira os limites do plano gratuito e os preços no site deles antes de usar).
            Sem a chave você ainda pode baixar o MP4 e copiar título, descrição e hashtags para postar manualmente.{' '}
            <button className="underline" onClick={() => go('config')}>Abrir Configurações</button>
          </Notice>
        </div>
      )}
      {err && <div className="mb-4"><Notice tone="error">{err}</Notice></div>}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5 space-y-4">
          <h2 className="text-sm text-ink">Preparar publicação</h2>
          {approved.length === 0 ? (
            <p className="text-sm text-muted">Nenhum corte aprovado. Aprove cortes em <button className="underline" onClick={() => go('clips')}>Cortes encontrados</button>.</p>
          ) : (
            <>
              <Field label="Corte aprovado">
                <select className="input-field w-full" value={sel} onChange={(e) => setSel(e.target.value)}>
                  <option value="" disabled>Selecione</option>
                  {approved.map((c) => <option key={`${c.job_id}:${c.clip_index}`} value={`${c.job_id}:${c.clip_index}`}>{c.game_name} · {c.moment_label} · {c.video_title_for_youtube_short}</option>)}
                </select>
              </Field>
              <fieldset>
                <legend className="text-xs text-ink2 mb-1.5">Redes</legend>
                <div className="flex flex-wrap gap-4 text-sm text-ink2">
                  {PLATFORMS.map((p) => (
                    <label key={p.id} className="flex items-center gap-2"><input type="checkbox" checked={f.platforms.includes(p.id)} onChange={() => toggle(p.id)} /> {p.label}</label>
                  ))}
                </div>
              </fieldset>
              <Field label="Título"><input className="input-field w-full" maxLength={100} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="Descrição e hashtags"><textarea className="input-field w-full" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
              <Field label="Agendar para (opcional)" hint="Em branco: envia assim que você aprovar.">
                <input type="datetime-local" className="input-field w-full" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} />
              </Field>
              <button className="btn-primary" disabled={!sel || !f.platforms.length || saving} onClick={queue}>
                {saving ? <Loader2 size={16} className="inline animate-spin mr-1.5" /> : <CalendarClock size={16} className="inline mr-1.5" />}Colocar na fila de aprovação
              </button>
            </>
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm text-ink mb-2">Aguardando aprovação ({waiting.length})</h2>
          {waiting.length === 0 ? <p className="text-sm text-muted">Fila vazia.</p> : (
            <ul className="divide-y divide-rule">
              {waiting.map((p) => <PubRow key={p.id} p={p} clips={clips} busy={busy} onApprove={approve} onCancel={cancel} />)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* 10 · Agendamentos ------------------------------------------------------- */
export function ScheduleSection({ clips, pubs, reload, uploadPostKey }) {
  const [err, setErr] = useState('');
  const { busy, approve, cancel } = usePubActions({ reload, uploadPostKey, setErr });
  const list = useMemo(() => (pubs || [])
    .filter((p) => p.scheduled_at && ['aguardando_aprovacao', 'agendado', 'falhou'].includes(p.status))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)), [pubs]);
  return (
    <div>
      <Header ord="10 · AGENDAMENTOS" title="Agendamentos" hint="Publicações com data marcada. Depois de aprovado, o disparo na data é feito pelo Upload-Post." />
      {err && <div className="mb-4"><Notice tone="error">{err}</Notice></div>}
      {list.length === 0 ? <Empty title="Nada agendado">Defina uma data em “Redes sociais” ao preparar a publicação.</Empty> : (
        <div className="card p-5"><ul className="divide-y divide-rule">
          {list.map((p) => <PubRow key={p.id} p={p} clips={clips} busy={busy} onApprove={approve} onCancel={cancel} />)}
        </ul></div>
      )}
    </div>
  );
}

/* 11 · Histórico ---------------------------------------------------------- */
export function HistorySection({ dash, pubs, clips }) {
  const events = useMemo(() => {
    const ev = [];
    for (const r of dash?.recent || []) ev.push({ at: r.created_at, kind: 'Análise', text: `${r.game}: ${r.clips} corte(s) de “${r.source}”`, status: 'completed' });
    for (const p of pubs || []) {
      ev.push({ at: p.created_at, kind: 'Publicação', text: `${clipLabel(clips, p)} → ${p.platforms.join(', ')}`, status: p.status });
    }
    return ev.sort((a, b) => b.at - a.at);
  }, [dash, pubs, clips]);
  return (
    <div>
      <Header ord="11 · HISTÓRICO" title="Histórico" hint="Análises realizadas e publicações, da mais recente para a mais antiga." />
      {events.length === 0 ? <Empty title="Sem registros">O histórico aparece depois da primeira análise.</Empty> : (
        <div className="card p-5"><ul className="divide-y divide-rule">
          {events.map((e, i) => (
            <li key={i} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-mono text-xs text-muted w-36 shrink-0">{fmtDate(e.at)}</span>
              <span className="text-xs text-ink2 w-24 shrink-0">{e.kind}</span>
              <span className="text-ink min-w-0 flex-1 truncate" title={e.text}>{e.text}</span>
              <Badge status={e.status}>{STATUS_LABEL[e.status] || e.status}</Badge>
            </li>
          ))}
        </ul></div>
      )}
    </div>
  );
}

/* 12 · Configurações ------------------------------------------------------ */
const gb = (b) => `${(b / 1073741824).toFixed(1)} GB`;

export function ConfigSection({ meta, apiKey, uploadPostKey, uploadUserId, keys }) {
  const [sys, setSys] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { apiJson('/api/gaming/system').then(setSys).catch((e) => setErr(errText(e))); }, []);
  const Row = ({ k, children }) => (
    <div className="py-2.5 flex flex-wrap justify-between gap-3 text-sm"><dt className="text-muted">{k}</dt><dd className="text-ink text-right">{children}</dd></div>
  );
  const yes = (b, okText, noText) => <span className={b ? 'text-ok' : 'text-muted'}>{b ? okText : noText}</span>;
  return (
    <div>
      <Header ord="12 · CONFIGURAÇÕES" title="Configurações" hint="As chaves ficam no arquivo .env do servidor ou só neste navegador; nunca são gravadas nos vídeos nem nos registros.">
      </Header>
      {err && <div className="mb-4"><Notice tone="error">{err}</Notice></div>}
      {keys && (
        <section className="card p-5 mb-5" aria-label="Chaves opcionais">
          <h2 className="text-sm text-ink mb-1">Chaves opcionais</h2>
          <p className="text-xs text-muted mb-4 max-w-3xl">
            O sistema funciona sem nenhuma chave. Elas ficam guardadas só neste navegador e são enviadas apenas ao servidor local quando necessário.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Chave do Upload-Post (publicar e ver resultados)" hint="Serviço de terceiros; pode ter custo.">
              <input id="cfg-upload-key" type="password" autoComplete="off" className="input-field w-full" value={uploadPostKey || ''} onChange={(e) => keys.setUploadPostKey(e.target.value.trim())} />
            </Field>
            <Field label="Nome do perfil no Upload-Post" hint="O perfil onde suas redes estão conectadas.">
              <input id="cfg-upload-user" type="text" autoComplete="off" className="input-field w-full" value={uploadUserId || ''} onChange={(e) => keys.setUploadUserId(e.target.value.trim())} />
            </Field>
            <Field label="Chave do Gemini (motor alternativo)" hint="Opcional. Cobrado pelo Google conforme o uso.">
              <input id="cfg-gemini-key" type="password" autoComplete="off" className="input-field w-full" value={apiKey || ''} onChange={(e) => keys.setApiKey(e.target.value.trim())} />
            </Field>
          </div>
        </section>
      )}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h2 className="text-sm text-ink mb-1">Processamento local (gratuito)</h2>
          <dl className="divide-y divide-rule">
            <Row k="FFmpeg">{sys ? (sys.ffmpeg ? sys.ffmpeg.replace(/ Copyright.*/, '') : <span className="text-danger">não encontrado</span>) : '…'}</Row>
            <Row k="Transcrição">Faster-Whisper · modelo {sys?.whisper_model || '…'} · {sys?.whisper_device || '…'}</Row>
            <Row k="Codificador de vídeo">{sys?.encoder || '…'} (H.264) + AAC</Row>
            <Row k="Motor de momentos">Local: áudio + imagem + fala</Row>
            <Row k="Trabalhos simultâneos">{sys?.max_concurrent_jobs ?? '…'}</Row>
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="text-sm text-ink mb-1">Serviços opcionais (externos)</h2>
          <dl className="divide-y divide-rule">
            <Row k="Gemini (análise por IA)">{yes(!!apiKey || meta?.gemini_configured, 'chave configurada', 'sem chave: usando motor local')}</Row>
            <Row k="Upload-Post (publicação)">{yes(!!uploadPostKey || meta?.upload_post_configured, 'chave configurada', 'sem chave: publicação manual')}</Row>
          </dl>
          <p className="text-xs text-muted mt-3">
            Gemini e Upload-Post são serviços de terceiros e podem cobrar conforme o uso. O sistema nunca os ativa sozinho: só funcionam com uma chave que você informar.
          </p>
        </div>
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm text-ink mb-1">Armazenamento</h2>
          <dl className="divide-y divide-rule">
            <Row k="Retenção de vídeos e cortes">{sys ? (sys.retention_seconds > 0 ? `apagados após ${Math.round(sys.retention_seconds / 3600)} h` : 'mantidos sem prazo') : '…'}</Row>
            <Row k="Espaço usado pelos trabalhos">{sys ? gb(sys.output_bytes) : '…'}{sys?.output_max_gb > 0 ? ` (limite ${sys.output_max_gb} GB: os mais antigos são removidos ao passar disso)` : ' (sem limite)'}</Row>
            <Row k="Espaço livre em disco">{sys ? gb(sys.disk_free_bytes) : '…'}</Row>
          </dl>
          <p className="text-xs text-muted mt-3">Retenção e limite são definidos no arquivo .env (JOB_RETENTION_SECONDS e OUTPUT_MAX_GB). A biblioteca de jogos nunca é removida pela limpeza.</p>
        </div>
      </div>
    </div>
  );
}
