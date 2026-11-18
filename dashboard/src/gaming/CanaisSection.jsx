import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ExternalLink, KeyRound, Loader2, Plus, Radio, Scissors, Search, ShieldAlert, Star, Trash2 } from 'lucide-react';
import { apiJson } from '../lib/api';
import { errText, jsonReq, safeHttpUrl } from './util';
import { Header, Notice } from './ui';

// Buscar canais: YouTube videos the owner may cut, each with the reason it is
// allowed (youtube_canais.py). Nothing here publishes: "Fazer cortes" only
// starts the normal job, whose clips still wait for approval.

const NIVEL = {
  lista: { label: 'Sua lista', cls: 'border-brass/50 bg-brass/10 text-brass', icon: Star },
  cc: { label: 'Creative Commons', cls: 'border-ok/40 bg-ok/10 text-ok', icon: BadgeCheck },
  texto: { label: 'Criador diz que libera', cls: 'border-warn/40 bg-warn/10 text-warn', icon: ShieldAlert },
};
const MODOS = [
  ['todos', 'Tudo'], ['lista', 'Só minha lista'], ['cc', 'Só Creative Commons'], ['liberados', 'Só "cortes liberados"'],
];
const dur = (s) => (s ? `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}h` : ''}${String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}min` : '');

function ChaveYoutube({ chave, onMudou }) {
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const agir = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ tone: 'error', text: errText(e) }); } finally { setBusy(false); }
  };
  const salvar = () => agir(async () => {
    await jsonReq('/api/gaming/youtube-chave', 'PUT', { chave: valor });
    setValor('');
    const t = await jsonReq('/api/gaming/youtube-chave/testar', 'POST', {});
    setMsg({ tone: t.ok ? 'ok' : 'error', text: t.mensagem });
    onMudou();
  });
  const testar = () => agir(async () => {
    const t = await jsonReq('/api/gaming/youtube-chave/testar', 'POST', {});
    setMsg({ tone: t.ok ? 'ok' : 'error', text: t.mensagem });
  });

  if (chave?.configured) {
    return (
      <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
        <KeyRound size={16} className="text-ok" aria-hidden="true" />
        <span className="text-ink2">Chave do YouTube ligada <span className="font-mono text-muted">(…{chave.final})</span></span>
        <button type="button" className="btn-ghost ml-auto" disabled={busy} onClick={testar}>Testar</button>
        {msg && <div className="w-full"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      </div>
    );
  }
  return (
    <div className="card space-y-3 p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><KeyRound size={16} className="text-brass" aria-hidden="true" /> Chave do YouTube (grátis)</h3>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink2">
        <li>Abra o <a className="text-brass underline" href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener noreferrer">YouTube Data API v3</a> e clique em <b>Ativar</b> (pode usar o mesmo projeto do Gemini).</li>
        <li>Vá em <a className="text-brass underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Credenciais</a> → <b>Criar credenciais</b> → <b>Chave de API</b> e copie.</li>
        <li>Cole aqui. Ela fica guardada no servidor, nunca no chat.</li>
      </ol>
      <div className="flex gap-2">
        <input type="password" autoComplete="off" className="input-field min-w-0 flex-1" placeholder="Chave da API do YouTube"
          value={valor} onChange={(e) => setValor(e.target.value)} aria-label="Chave da API do YouTube" />
        <button type="button" className="btn-primary" disabled={busy || valor.trim().length < 20} onClick={salvar}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : 'Salvar'}
        </button>
      </div>
      <p className="text-xs text-muted">Cota grátis: cerca de 50 buscas completas por dia.</p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

function Resultado({ r, onCortar, ocupado }) {
  const n = NIVEL[r.nivel];
  const thumb = safeHttpUrl(r.thumb);
  return (
    <li className="card flex min-w-0 flex-col overflow-hidden">
      <div className="relative aspect-video shrink-0 overflow-hidden bg-paper3">
        {thumb && <img src={thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
        {r.segundos > 0 && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white">{dur(r.segundos)}</span>}
        {r.ao_vivo && <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-danger px-1.5 py-0.5 text-[11px] font-bold text-white"><Radio size={11} aria-hidden="true" /> AO VIVO</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-bold text-ink" title={r.titulo}>{r.titulo}</p>
        <p className="truncate text-xs text-muted">{r.canal}</p>
        <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${n.cls}`}>
          <n.icon size={12} aria-hidden="true" /> {n.label}
        </span>
        <p className="line-clamp-3 text-xs leading-snug text-ink2" title={r.prova}>{r.prova}</p>
        <div className="mt-auto flex gap-2 pt-1">
          <button type="button" className="btn-primary flex-1 !px-2" disabled={ocupado || r.ao_vivo}
            title={r.ao_vivo ? 'Espere a live terminar para cortar' : 'Baixa o vídeo e faz os cortes com o crédito'}
            onClick={() => onCortar(r)}>
            <Scissors size={14} className="mr-1 inline" aria-hidden="true" />{r.ao_vivo ? 'Ao vivo agora' : 'Fazer cortes'}
          </button>
          <a className="btn-ghost !px-2.5" href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir no YouTube: ${r.titulo}`}>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </li>
  );
}

function MinhaLista({ canais, onMudou }) {
  const [novo, setNovo] = useState({ entrada: '', prova_url: '' });
  const [provas, setProvas] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const agir = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); onMudou(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="card space-y-3 p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Star size={16} className="text-brass" aria-hidden="true" /> Meus canais liberados</h3>
      <p className="text-xs text-muted">Canal só entra na busca com a prova de que o criador libera cortes (link de post, vídeo ou print). Sem prova, fica &quot;aguardando prova&quot;.</p>
      <ul className="divide-y divide-rule">
        {canais.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate font-bold text-ink">{c.nome}</span>
            {c.situacao === 'liberado' ? (
              <span className="rounded-full border border-ok/40 bg-ok/10 px-2 py-0.5 text-[11px] font-bold text-ok">Liberado</span>
            ) : (
              <span className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[11px] font-bold text-warn">Aguardando prova</span>
            )}
            <button type="button" className="btn-ghost !px-2" aria-label={`Tirar ${c.nome} da lista`} disabled={busy}
              onClick={() => window.confirm(`Tirar ${c.nome} da lista?`) && agir(() => apiJson(`/api/gaming/canais/${c.id}`, { method: 'DELETE' }))}>
              <Trash2 size={14} aria-hidden="true" />
            </button>
            {c.situacao === 'liberado' ? (
              <p className="w-full truncate text-xs text-muted">Prova: {safeHttpUrl(c.prova_url)
                ? <a className="underline" href={safeHttpUrl(c.prova_url)} target="_blank" rel="noopener noreferrer">{c.prova_url}</a> : c.prova_texto}</p>
            ) : (
              <div className="flex w-full gap-2">
                <input className="input-field min-w-0 flex-1 text-xs" placeholder="Link de onde ele libera os cortes" aria-label={`Prova de ${c.nome}`}
                  value={provas[c.id] || ''} onChange={(e) => setProvas((p) => ({ ...p, [c.id]: e.target.value }))} />
                <button type="button" className="btn-ghost text-xs" disabled={busy || !(provas[c.id] || '').trim()}
                  onClick={() => agir(() => jsonReq(`/api/gaming/canais/${c.id}`, 'PATCH', { prova_url: provas[c.id].trim() }))}>Salvar prova</button>
              </div>
            )}
          </li>
        ))}
        {canais.length === 0 && <li className="py-2 text-sm text-muted">Nenhum canal ainda.</li>}
      </ul>
      <div className="grid grid-cols-1 gap-2 border-t border-rule pt-3 sm:grid-cols-[1fr_1fr_auto]">
        <input className="input-field" placeholder="@canal ou link do canal" aria-label="Canal" value={novo.entrada}
          onChange={(e) => setNovo((p) => ({ ...p, entrada: e.target.value }))} />
        <input className="input-field" placeholder="Link da prova (opcional agora)" aria-label="Link da prova" value={novo.prova_url}
          onChange={(e) => setNovo((p) => ({ ...p, prova_url: e.target.value }))} />
        <button type="button" className="btn-primary" disabled={busy || !novo.entrada.trim()}
          onClick={() => agir(async () => { await jsonReq('/api/gaming/canais', 'POST', novo); setNovo({ entrada: '', prova_url: '' }); })}>
          <Plus size={15} className="mr-1 inline" aria-hidden="true" />Adicionar
        </button>
      </div>
      {err && <Notice tone="error">{err}</Notice>}
    </div>
  );
}

export default function CanaisSection({ onCortar, ocupado, erroInicio = '' }) {
  const [dados, setDados] = useState(null);
  const [q, setQ] = useState('');
  const [modo, setModo] = useState('todos');
  const [res, setRes] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [err, setErr] = useState('');

  const carregar = useCallback(() => apiJson('/api/gaming/canais').then(setDados).catch((e) => setErr(errText(e))), []);
  useEffect(() => { carregar(); }, [carregar]);

  const buscar = async (e) => {
    e?.preventDefault();
    setBuscando(true); setErr('');
    try {
      const d = await apiJson(`/api/gaming/buscar?${new URLSearchParams({ q, modo })}`);
      setRes(d.resultados);
    } catch (e2) { setErr(errText(e2)); setRes(null); } finally { setBuscando(false); }
  };

  const cortar = (r) => {
    const credito = { canal: r.canal, url: r.url, nivel: r.nivel, prova: r.prova };
    const ok = window.confirm(`Fazer cortes de "${r.titulo}"?\n\nTodo corte vai sair com:\nCréditos: ${r.canal} – ${r.url}\n\nMotivo da liberação: ${r.prova}\n\nOs cortes continuam esperando a sua aprovação antes de publicar.`);
    if (ok) onCortar(r.url, credito);
  };

  if (!dados) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brass" /></div>;
  const semChave = !dados.chave?.configured;

  return (
    <div className="space-y-4">
      <Header title="Buscar canais" hint="Acha lives e vídeos de jogo que podem virar corte, mostra por que estão liberados e já coloca o crédito do criador em cada corte." />
      <ChaveYoutube chave={dados.chave} onMudou={carregar} />

      <form onSubmit={buscar} className="card grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1fr_auto_auto]">
        <input className="input-field" placeholder='Ex.: "Free Fire live", "GTA RP", "Minecraft"' value={q} onChange={(e) => setQ(e.target.value)}
          aria-label="O que buscar" disabled={semChave} />
        <select className="input-field" value={modo} onChange={(e) => setModo(e.target.value)} aria-label="Onde buscar" disabled={semChave}>
          {MODOS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
        </select>
        <button type="submit" className="btn-primary" disabled={semChave || buscando || (!q.trim() && modo !== 'lista' && modo !== 'todos')}>
          {buscando ? <Loader2 size={15} className="mr-1 inline animate-spin" /> : <Search size={15} className="mr-1 inline" aria-hidden="true" />}Buscar
        </button>
      </form>

      {err && <Notice tone="error">{err}</Notice>}
      {erroInicio && <Notice tone="error">Não deu para começar os cortes: {erroInicio}</Notice>}
      {ocupado && <Notice tone="info">Já tem um vídeo sendo processado. Quando terminar, você pode fazer cortes de outro.</Notice>}
      {res && (res.length === 0 ? (
        <Notice tone="info">Nada liberado encontrado. Tente outras palavras ou adicione canais na sua lista.</Notice>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {res.map((r) => <Resultado key={r.video_id} r={r} onCortar={cortar} ocupado={ocupado} />)}
        </ul>
      ))}

      <MinhaLista canais={dados.canais} onMudou={carregar} />

      <p className="text-xs leading-relaxed text-muted">
        <b className="text-ink2">Níveis:</b> <span className="text-brass">Sua lista</span> = canal que você adicionou com prova ·{' '}
        <span className="text-ok">Creative Commons</span> = licença oficial do YouTube, reutilização permitida com crédito ·{' '}
        <span className="text-warn">Criador diz que libera</span> = está escrito na descrição; confira antes de publicar.
        A liberação pode mudar: a prova fica salva junto com cada corte.
      </p>
    </div>
  );
}
