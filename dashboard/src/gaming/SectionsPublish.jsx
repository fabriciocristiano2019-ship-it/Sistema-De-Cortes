import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, Send, Trash2 } from 'lucide-react';
import { apiJson } from '../lib/api';
import { errText, fmtDate, PLATFORMS, STATUS_LABEL } from './util';
import { Badge, Empty, Field, Header, Notice } from './ui';

const clipLabel = (clips, p) => {
  const c = (clips || []).find((x) => x.job_id === p.job_id && x.clip_index === p.clip_index);
  return c ? `${c.game_name} · ${c.moment_label}` : `Corte ${p.clip_index + 1}`;
};

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
      <Header ord="11 · HISTÓRICO" title="Histórico" hint="Análises realizadas (e publicações antigas), da mais recente para a mais antiga." />
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

export function ConfigSection({ meta, apiKey, keys }) {
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
      {keys && <YoutubeCookiesCard />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
            <Row k="Postagem">Manual: os cortes prontos ficam na pasta de vídeos novos</Row>
          </dl>
          <p className="text-xs text-muted mt-3">
            O Gemini é um serviço de terceiros e pode cobrar conforme o uso. O sistema nunca o ativa sozinho: só funciona com a chave que você informar.
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
