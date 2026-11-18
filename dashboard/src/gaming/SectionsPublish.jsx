import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, Send, Trash2 } from 'lucide-react';
import { apiJson } from '../lib/api';
import { errText, fmtDate, jsonReq, PLATFORMS, STATUS_LABEL } from './util';
import { Badge, Empty, Field, Header, Notice } from './ui';
import { postizHeaders, postizKey, postizUrl, setPostizKey, setPostizUrl } from './postizConf';
import { somAprovado } from './sons';

const clipLabel = (clips, p) => {
  const c = (clips || []).find((x) => x.job_id === p.job_id && x.clip_index === p.clip_index);
  return c ? `${c.game_name} · ${c.moment_label}` : `Corte ${p.clip_index + 1}`;
};

function PubRow({ p, clips, onApprove, onCancel, busy }) {
  const last = p.log?.[p.log.length - 1];
  return (
    <li className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <div className="min-w-[13rem] flex-1">
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
  const headers = { ...(uploadPostKey ? { 'X-Upload-Post-Key': uploadPostKey } : {}), ...postizHeaders() };
  const approve = async (p) => {
    if (!window.confirm(`Publicar “${p.title || 'corte'}” em ${p.platforms.join(', ')}?\n\nEssa ação envia o vídeo para as redes sociais.`)) return;
    setBusy(p.id); setErr('');
    try { await jsonReq(`/api/gaming/publications/${p.id}/approve`, 'POST', {}, headers); somAprovado(); }
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
  const viaPostiz = !!postizKey() || !!meta?.postiz_configured;
  const configured = viaPostiz || !!uploadPostKey || meta?.upload_post_configured;

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
            Publicação automática desativada: falta a chave do Upload-Post ou do Postiz (serviços externos; confira limites e preços no site de cada um antes de usar).
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

// Cookies of the person's own YouTube account, for when YouTube asks the
// cloud server to sign in. Saved on the server (owner-only file, outside the
// repo); the content never comes back to the browser.
function YoutubeCookiesCard() {
  const [st, setSt] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { apiJson('/api/gaming/youtube-cookies').then(setSt).catch(() => {}); }, []);
  const send = async (method, body) => {
    setBusy(true); setMsg(null);
    try {
      const r = await apiJson('/api/gaming/youtube-cookies', { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      setSt(r); setText('');
      setMsg({ tone: 'ok', text: method === 'DELETE' ? 'Cookies apagados.' : `Cookies salvos (${r.cookies} do YouTube). Tente o link de novo.` });
    } catch (e) { setMsg({ tone: 'error', text: errText(e) }); }
    setBusy(false);
  };
  return (
    <section className="card p-5 mb-5" aria-labelledby="yt-cookies-h">
      <h2 id="yt-cookies-h" className="text-sm text-ink mb-1">Cookies do YouTube (para links que dão erro)</h2>
      <p className="text-xs text-muted mb-3 max-w-3xl">
        O YouTube costuma pedir login a servidores na nuvem ("confirme que não é um robô"). Com os cookies da sua conta o download funciona.
        No navegador do PC, exporte os cookies de <code>youtube.com</code> no formato Netscape (<code>cookies.txt</code>) e cole o arquivo inteiro aqui.
        Ficam num arquivo protegido do servidor, fora do repositório, e não voltam para a tela. Prefira uma conta secundária.
      </p>
      <p className="text-xs mb-3" aria-live="polite">
        Situação: {st == null ? '…' : st.configured
          ? <span className="text-ok">configurados ({st.source === 'secret' ? 'Secret do Codespaces' : `${st.cookies} cookies, salvos em ${(st.saved_at || '').replace('T', ' ')}`})</span>
          : <span className="text-muted">não configurados</span>}
      </p>
      <label htmlFor="yt-cookies" className="sr-only">Conteúdo do cookies.txt</label>
      <textarea id="yt-cookies" rows={4} spellCheck={false} autoComplete="off" className="input-field w-full font-mono text-xs"
        placeholder="# Netscape HTTP Cookie File ..." value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy || !text.trim()} onClick={() => send('PUT', { cookies: text })}>Salvar cookies</button>
        {st?.source === 'painel' && <button type="button" className="btn-ghost" disabled={busy} onClick={() => send('DELETE')}>Apagar cookies</button>}
      </div>
      {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
    </section>
  );
}

// Gemini key saved on the server: one paste, valid on the PC and the phone app.
// The key is never sent back (only its last 4 characters).
function GeminiCard({ keys, apiKey }) {
  const [st, setSt] = useState(null);
  const [chave, setChave] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  useEffect(() => { apiJson('/api/gaming/gemini-chave').then(setSt).catch(() => {}); }, []);
  const avisar = () => window.dispatchEvent(new Event('os-gemini-mudou'));
  const chamar = async (tag, method, path, body) => {
    setBusy(tag); setMsg(null);
    try {
      return await apiJson(path, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch (e) { setMsg({ tone: 'error', text: errText(e) }); return null; } finally { setBusy(''); }
  };
  const testar = async () => {
    const r = await chamar('testar', 'POST', '/api/gaming/gemini-chave/testar', chave.trim() ? { chave: chave.trim() } : {});
    if (r) setMsg({ tone: r.ok ? 'ok' : 'error', text: r.mensagem });
  };
  const salvar = async () => {
    const t = await chamar('salvar', 'POST', '/api/gaming/gemini-chave/testar', { chave: chave.trim() });
    if (!t) return;
    // A wrong key is not saved; a network failure is (the key may be fine).
    if (!t.ok && !t.rede) { setMsg({ tone: 'error', text: `${t.mensagem} Nada foi salvo.` }); return; }
    const r = await chamar('salvar', 'PUT', '/api/gaming/gemini-chave', { chave: chave.trim() });
    if (!r) return;
    setSt(r); setChave('');
    if (apiKey) keys?.setApiKey(''); // a key typed only in this browser would win over the server one
    setMsg(t.ok
      ? { tone: 'ok', text: 'Chave salva no servidor: a IA profissional já vale no PC e no celular.' }
      : { tone: 'warn', text: `Chave salva, mas não deu para testar agora: ${t.mensagem}` });
    avisar();
  };
  const apagar = async () => {
    if (!window.confirm('Apagar a chave do Gemini salva no servidor? Os próximos vídeos usarão o motor local gratuito.')) return;
    const r = await chamar('apagar', 'DELETE', '/api/gaming/gemini-chave');
    if (r) { setSt(r); setMsg({ tone: 'ok', text: 'Chave apagada.' }); avisar(); }
  };
  return (
    <section className="card p-5 mb-5" aria-labelledby="gemini-h">
      <h2 id="gemini-h" className="text-sm text-ink mb-1">IA profissional (Google Gemini)</h2>
      <p className="text-xs text-muted mb-3 max-w-3xl">
        Pegue a chave em <b>aistudio.google.com</b> → <b>Get API key</b> → <b>Create API key</b>, cole abaixo e salve.
        Ela fica num arquivo protegido do servidor e vale no PC e no app do celular. O Google tem cota gratuita com limites; acima dela pode cobrar.
      </p>
      <p className="text-xs mb-3" aria-live="polite">
        Situação: {st == null ? '…' : st.configured
          ? <span className="text-ok">ligada ({st.source === 'secret' ? 'Secret do Codespaces / .env' : 'salva no painel'}, termina em …{st.final})</span>
          : <span className="text-muted">desligada: usando o motor local gratuito</span>}
      </p>
      <label htmlFor="gemini-chave" className="sr-only">Chave do Gemini</label>
      <input id="gemini-chave" type="password" autoComplete="off" spellCheck={false} className="input-field w-full font-mono text-sm"
        placeholder="Cole a chave do AI Studio" value={chave} onChange={(e) => setChave(e.target.value)} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={!!busy || !chave.trim()} onClick={salvar}>
          {busy === 'salvar' ? 'Testando e salvando…' : 'Testar e salvar'}
        </button>
        <button type="button" className="btn-ghost" disabled={!!busy || (!chave.trim() && !st?.configured)} onClick={testar}>
          {busy === 'testar' ? 'Testando…' : chave.trim() ? 'Só testar' : 'Testar a chave salva'}
        </button>
        {st?.source === 'painel' && <button type="button" className="btn-ghost" disabled={!!busy} onClick={apagar}>Apagar</button>}
      </div>
      {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
    </section>
  );
}

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
      <Header ord="12 · CHAVES E INTEGRAÇÕES" title="Chaves e Integrações" hint="As chaves ficam no arquivo .env do servidor ou só neste navegador; nunca são gravadas nos vídeos nem nos registros.">
      </Header>
      {err && <div className="mb-4"><Notice tone="error">{err}</Notice></div>}
      {keys && <GeminiCard keys={keys} apiKey={apiKey} />}
      {keys && (
        <section className="card p-5 mb-5" aria-label="Chaves opcionais">
          <h2 className="text-sm text-ink mb-1">Chaves opcionais</h2>
          <p className="text-xs text-muted mb-4 max-w-3xl">
            O sistema funciona sem nenhuma chave. Digitadas aqui, elas ficam só neste navegador, apenas embaralhadas (não é criptografia forte).
            O lugar mais seguro é o arquivo <code>.env</code> do servidor (UPLOAD_POST_API_KEY, UPLOAD_POST_USER, GEMINI_API_KEY): assim a chave nunca passa pelo navegador.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Chave do Upload-Post (publicar e ver resultados)" hint="Serviço de terceiros; pode ter custo.">
              <input id="cfg-upload-key" type="password" autoComplete="off" className="input-field w-full" value={uploadPostKey || ''} onChange={(e) => keys.setUploadPostKey(e.target.value.trim())} />
            </Field>
            <Field label="Nome do perfil no Upload-Post" hint="O perfil onde suas redes estão conectadas.">
              <input id="cfg-upload-user" type="text" autoComplete="off" className="input-field w-full" value={uploadUserId || ''} onChange={(e) => keys.setUploadUserId(e.target.value.trim())} />
            </Field>
            <Field label="Chave do Gemini (só neste navegador)" hint="Prefira o quadro “IA profissional” acima: vale no PC e no celular.">
              <input id="cfg-gemini-key" type="password" autoComplete="off" className="input-field w-full" value={apiKey || ''} onChange={(e) => keys.setApiKey(e.target.value.trim())} />
            </Field>
          </div>
        </section>
      )}
      {keys && <PostizCard />}
      {keys && <YoutubeCookiesCard />}
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

/* Postiz: alternative publisher ------------------------------------------- */
function PostizCard() {
  const [key, setKey] = useState(postizKey);
  const [url, setUrl] = useState(postizUrl);
  const [test, setTest] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = (k, u) => { setPostizKey(k); setPostizUrl(u); };
  const check = async () => {
    setBusy(true); setTest(null);
    try { setTest(await jsonReq('/api/gaming/postiz/check', 'POST', {}, postizHeaders())); }
    catch (e) { setTest({ ok: false, error: errText(e) }); }
    finally { setBusy(false); }
  };
  const NET = { youtube: 'YouTube', instagram: 'Instagram', 'instagram-standalone': 'Instagram', tiktok: 'TikTok' };
  return (
    <section className="card p-5 mb-5" aria-label="Postiz">
      <h2 className="text-sm text-ink mb-1">Postiz (alternativa ao Upload-Post para publicar)</h2>
      <p className="text-xs text-muted mb-4 max-w-3xl">
        Com a chave do Postiz, o botão “Aprovar e enviar” publica pelo Postiz em vez do Upload-Post.
        Conecte suas contas do YouTube, Instagram e TikTok dentro do Postiz primeiro.
        Custo: o Postiz Cloud é pago (tem teste grátis); instalado no seu próprio servidor é gratuito, mas exige configurar cada rede.
        Confira os preços em postiz.com antes de assinar.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Chave da API do Postiz" hint="Postiz → Settings → Public API.">
          <input id="cfg-postiz-key" type="password" autoComplete="off" className="input-field w-full" value={key}
            onChange={(e) => { const v = e.target.value.trim(); setKey(v); save(v, url); }} />
        </Field>
        <Field label="Endereço do Postiz (opcional)" hint="Só se instalar o Postiz no seu servidor. Em branco: Postiz Cloud.">
          <input id="cfg-postiz-url" type="url" placeholder="https://api.postiz.com" autoComplete="off" className="input-field w-full" value={url}
            onChange={(e) => { const v = e.target.value.trim(); setUrl(v); save(key, v); }} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-ghost btn-sm" disabled={busy} onClick={check}>
          {busy ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null}Testar conexão
        </button>
        {test && !test.configured && <span className="text-xs text-muted">Coloque a chave para testar.</span>}
        {test && test.configured && test.ok === false && <span className="text-xs text-danger">{test.error}</span>}
        {test && test.ok && (
          <span className="text-xs text-ok">
            Conectado. Contas no Postiz: {test.accounts.length ? test.accounts.map((a) => `${NET[a.network] || a.network}${a.name ? ` (${a.name})` : ''}${a.active ? '' : ' — reconectar'}`).join(', ') : 'nenhuma ainda'}.
          </span>
        )}
      </div>
    </section>
  );
}
