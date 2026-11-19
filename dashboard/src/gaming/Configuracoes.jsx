import React, { useEffect, useState } from 'react';
import { Archive, Copy, FileText, Power, KeyRound, Send, Music, LogOut, Smartphone, Moon, Palette, Play, ShieldCheck, Sun, User, Volume2, VolumeX, X } from 'lucide-react';
import {
  musicaLigada, setMusica, setVolume, setVolumeMusica, somAprovado, somConcluido, somErroAgente, somFinal,
  volume as volumeAtual, volumeMusica,
} from './sons';

import { NOME_PADRAO } from './nome';
import { gravarAutoPub, lerAutoPub, REDES_AUTO } from './autoPublicar';
import { sair } from './sair';
import { aoMudar, instalado, instalar, podeInstalar } from './pwa';
import BackupCard from './Backup';
import { apiJson } from '../lib/api';
import { guardarCodespace, lerCodespace } from './codespace';

function Card({ icon, title, children, id }) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-[20px] border border-rule2 bg-paper2 p-5" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
      <h3 id={id} className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-ink">
        {React.createElement(icon, { size: 16, className: 'text-brass', 'aria-hidden': true })} {title}
      </h3>
      {children}
    </section>
  );
}

function Opcao({ on, onClick, icon, children }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${on ? 'border-brass bg-brass/10 text-ink' : 'border-rule2 text-ink2 hover:border-brass/60'}`}>
      {React.createElement(icon, { size: 16, 'aria-hidden': true })} {children}
    </button>
  );
}

function AppCelular() {
  const [, atualizar] = useState(0);
  useEffect(() => aoMudar(() => atualizar((n) => n + 1)), []);
  return (
    <Card icon={Smartphone} title="App no celular" id="cfg-app">
      {instalado() ? (
        <p className="text-sm text-ok">Você está usando o app instalado.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink2">
            Instale o painel como app: ícone na tela inicial e tela cheia. O codespace precisa estar ligado para o app funcionar.
          </p>
          {podeInstalar() ? (
            <button type="button" className="sede-btn-accent px-4" onClick={instalar}>Instalar no celular</button>
          ) : (
            <p className="text-xs leading-relaxed text-muted">
              No Chrome do Android: menu <b className="text-ink2">⋮</b> → <b className="text-ink2">Instalar app</b> (ou &quot;Adicionar à tela inicial&quot;).
              No Samsung Internet: menu <b className="text-ink2">≡</b> → <b className="text-ink2">Adicionar página a</b> → <b className="text-ink2">Tela inicial</b>.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// The page GitHub shows for a stopped codespace is "page not found": the link
// that wakes it, kept where the owner can save it before it happens.
function Religar() {
  const [cs, setCs] = useState(lerCodespace);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    apiJson('/api/gaming/vivo').then((d) => { guardarCodespace(d.codespace); setCs(d.codespace || null); }).catch(() => {});
  }, []);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(cs.religar_url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch (_) { /* no clipboard */ }
  };
  return (
    <Card icon={Power} title="Se o painel der “página não encontrada”" id="cfg-religar">
      <p className="mb-3 text-sm text-ink2">
        É o GitHub que desligou o Codespace por ficar sem uso. Não crie outro (viria vazio): religue este pelo link abaixo,
        espere 1 a 2 minutos e abra o painel de novo. <b className="text-ink">Salve o link nos favoritos.</b>
      </p>
      {cs?.religar_url ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <a className="sede-btn-accent min-w-0 max-w-full truncate px-4" href={cs.religar_url} target="_blank" rel="noreferrer">{cs.religar_url.replace('https://', '')}</a>
          <button type="button" onClick={copiar}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rule2 px-3 py-2 text-sm font-bold text-ink2 hover:border-brass">
            <Copy size={14} aria-hidden="true" /> {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      ) : (
        <p className="mb-4 text-sm text-ink2">
          Fora do Codespaces não há o que religar. No Codespaces: <a className="underline" href="https://github.com/codespaces" target="_blank" rel="noreferrer">github.com/codespaces</a> → clique no seu.
        </p>
      )}
      <p className="mb-1.5 text-xs font-bold text-ink">Para desligar menos e nunca perder os arquivos (uma vez só, no GitHub):</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink2">
        <li><a className="underline" href="https://github.com/settings/codespaces" target="_blank" rel="noreferrer">github.com/settings/codespaces</a> → <b>Default idle timeout</b>: 240 minutos (o máximo).</li>
        <li>Na mesma página, <b>Default retention period</b>: 30 dias.</li>
        <li><a className="underline" href="https://github.com/codespaces" target="_blank" rel="noreferrer">github.com/codespaces</a> → <b>⋯</b> do seu Codespace → desmarque <b>Auto-delete codespace</b>.</li>
      </ol>
      <p className="mt-2 text-xs text-muted">A cota grátis do GitHub é de cerca de 60 horas ligado por mês: deixar ligado o tempo todo gasta tudo em poucos dias.</p>
    </Card>
  );
}

const ABAS = [
  { id: 'geral', label: 'Geral', icon: User },
  { id: 'audio', label: 'Áudio', icon: Volume2 },
  { id: 'publicacao', label: 'Publicação', icon: Send },
  { id: 'celular', label: 'Celular', icon: Smartphone },
  { id: 'conta', label: 'Conta e chaves', icon: KeyRound },
  { id: 'backup', label: 'Backup', icon: Archive },
  { id: 'termos', label: 'Termos e privacidade', icon: ShieldCheck },
];
const ABA_KEY = 'os_cfg_aba';
const abaSalva = () => {
  try { const v = localStorage.getItem(ABA_KEY); return ABAS.some((a) => a.id === v) ? v : 'geral'; } catch (_) { return 'geral'; }
};

// One subject at a time: a list of sections on the left (a row of tabs on the
// phone) and only the chosen one open.
export default function Configuracoes({ nome, onNome, theme, onTheme, som, onSom, onAbrirChaves, servicoPublicacao = false, onRestaurado }) {
  const [aba, setAba] = useState(abaSalva);
  const [vol, setVol] = useState(volumeAtual);
  const [autoPub, setAutoPub] = useState(lerAutoPub);
  const [musica, setMusicaEstado] = useState(musicaLigada);
  const [volMus, setVolMus] = useState(volumeMusica);
  const [rascunho, setRascunho] = useState(nome);
  const salvarNome = () => onNome(rascunho.trim() || NOME_PADRAO);
  const escolher = (id) => { setAba(id); try { localStorage.setItem(ABA_KEY, id); } catch (_) { /* private mode */ } };

  return (
    <div className="rounded-[20px] border border-rule2 bg-paper2/60 p-4 md:p-5">
      <h2 className="mb-4 text-[20px] font-extrabold text-ink">Configurações</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Seções das configurações" className="flex flex-wrap gap-1 md:flex-col">
          {ABAS.map((a) => (
            <button key={a.id} type="button" className="sede-pill md:w-full md:justify-start" aria-current={aba === a.id ? 'page' : undefined}
              onClick={() => escolher(a.id)}>
              <a.icon size={15} aria-hidden="true" /> {a.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          {aba === 'geral' && (
            <>
        <Religar />

        <Card icon={User} title="Nome no topo" id="cfg-nome">
          <label htmlFor="cfg-nome-campo" className="mb-1.5 block text-xs font-bold text-ink">Nome exibido</label>
          <div className="flex gap-2">
            <input id="cfg-nome-campo" className="sede-select !bg-none min-w-0 flex-1 !pr-3" maxLength={40} value={rascunho}
              onChange={(e) => setRascunho(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') salvarNome(); }} />
            <button type="button" className="sede-btn-accent px-4" onClick={salvarNome}>Salvar</button>
          </div>
        </Card>

        <Card icon={Palette} title="Tema" id="cfg-tema">
          <div className="flex gap-2">
            <Opcao on={theme === 'classic'} onClick={() => onTheme('classic')} icon={Moon}>Escuro</Opcao>
            <Opcao on={theme === 'nova'} onClick={() => onTheme('nova')} icon={Sun}>Claro</Opcao>
          </div>
        </Card>

            </>
          )}
          {aba === 'audio' && (
            <>
        <Card icon={Volume2} title="Áudio dos agentes" id="cfg-audio">
          <div className="mb-4 flex gap-2">
            <Opcao on={som} onClick={() => onSom(true)} icon={Volume2}>Sons ligados</Opcao>
            <Opcao on={!som} onClick={() => onSom(false)} icon={VolumeX}>Sem som</Opcao>
          </div>
          <label htmlFor="cfg-volume" className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink">
            <span>Volume</span><span className="font-mono text-ink2">{vol}%</span>
          </label>
          <div className="flex items-center gap-3">
            <VolumeX size={16} className="shrink-0 text-muted" aria-hidden="true" />
            <input id="cfg-volume" type="range" min="0" max="100" step="5" value={vol} disabled={!som}
              className="h-6 flex-1 cursor-pointer accent-[var(--color-accent)] disabled:opacity-40"
              onChange={(e) => setVol(setVolume(e.target.value))} />
            <Volume2 size={16} className="shrink-0 text-muted" aria-hidden="true" />
          </div>
          <p className="mt-4 mb-1.5 text-xs font-bold text-ink">Testar os sons</p>
          <div className="flex flex-wrap gap-2">
            {[
              ['IA terminou', () => somConcluido('editor916')],
              ['Erro de uma IA', () => somErroAgente('vision')],
              ['Corte aprovado', somAprovado],
              ['Tudo pronto', somFinal],
            ].map(([rotulo, tocar]) => (
              <button key={rotulo} type="button" disabled={!som} onClick={tocar}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rule2 px-3 py-2 text-xs font-bold text-ink2 hover:border-brass disabled:opacity-40">
                <Play size={14} aria-hidden="true" /> {rotulo}
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-rule2 pt-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-bold text-ink"><Music size={15} className="text-brass" aria-hidden="true" /> Música de fundo</p>
            <div className="mb-3 flex gap-2">
              <Opcao on={musica} onClick={() => { setMusica(true); setMusicaEstado(true); }} icon={Music}>Tocar</Opcao>
              <Opcao on={!musica} onClick={() => { setMusica(false); setMusicaEstado(false); }} icon={VolumeX}>Sem música</Opcao>
            </div>
            <label htmlFor="cfg-volume-musica" className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink">
              <span>Volume da música</span><span className="font-mono text-ink2">{volMus}%</span>
            </label>
            <input id="cfg-volume-musica" type="range" min="0" max="100" step="5" value={volMus} disabled={!som || !musica}
              className="h-6 w-full cursor-pointer accent-[var(--color-accent)] disabled:opacity-40"
              onChange={(e) => setVolMus(setVolumeMusica(e.target.value))} />
            <p className="mt-1 text-[11px] text-muted">Trilha ambiente gerada pelo próprio programa. Pausa sozinha quando você sai do app.</p>
          </div>
        </Card>

            </>
          )}
          {aba === 'publicacao' && (
            <>
        <Card icon={Send} title="Publicação automática" id="cfg-autopub">
          <p className="mb-3 text-sm text-ink2">Ao clicar em <b className="text-ink">Aprovar</b> num corte, ele já vai para as redes marcadas. Antes de enviar, o painel pede confirmação.</p>
          <div className="mb-3 flex gap-2">
            <Opcao on={autoPub.ativo} onClick={() => setAutoPub(gravarAutoPub({ ...autoPub, ativo: true }))} icon={Send}>Publicar ao aprovar</Opcao>
            <Opcao on={!autoPub.ativo} onClick={() => setAutoPub(gravarAutoPub({ ...autoPub, ativo: false }))} icon={X}>Só aprovar</Opcao>
          </div>
          {REDES_AUTO.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm text-ink2">
              <input type="checkbox" disabled={!autoPub.ativo} checked={autoPub.plataformas.includes(r.id)}
                onChange={(e) => setAutoPub(gravarAutoPub({ ...autoPub, plataformas: e.target.checked ? [...autoPub.plataformas, r.id] : autoPub.plataformas.filter((p) => p !== r.id) }))} />
              {r.label} · <span className="text-muted">publicado como público</span>
            </label>
          ))}
          <p className="mt-2 text-[11px] text-muted">Instagram e TikTok entram depois.</p>
          {servicoPublicacao ? (
            <p className="mt-3 text-xs text-ok">Serviço de publicação configurado.</p>
          ) : (
            <p className="mt-3 text-xs text-warn">
              Falta configurar o Upload-Post ou o Postiz (onde o seu YouTube fica conectado).{' '}
              <button type="button" className="underline font-bold" onClick={onAbrirChaves}>Abrir Chaves e Integrações</button>
            </p>
          )}
        </Card>

            </>
          )}
          {aba === 'celular' && <AppCelular />}
          {aba === 'backup' && <BackupCard onRestaurado={onRestaurado} />}
          {aba === 'conta' && (
            <>
        <Card icon={LogOut} title="Acesso" id="cfg-acesso">
          <p className="mb-3 text-sm text-ink2">O login vale por 7 dias neste aparelho. Para bloquear agora, saia.</p>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-xl border border-rule2 px-4 py-2 text-sm font-bold text-ink2 hover:border-brass"
            onClick={sair}>
            <LogOut size={15} aria-hidden="true" /> Sair
          </button>
        </Card>

        <Card icon={KeyRound} title="Chaves e integrações" id="cfg-chaves">
          <p className="mb-3 text-sm text-ink2">
            Chave do Gemini (IA profissional), Upload-Post, Postiz e demais integrações ficam em Módulos → Chaves.
            Nunca cole chaves em conversas ou arquivos do repositório.
          </p>
          <button type="button" className="sede-btn-accent px-4" onClick={onAbrirChaves}>Abrir Chaves e Integrações</button>
        </Card>
            </>
          )}
          {aba === 'termos' && (
            <>
      <Card icon={FileText} title="Termos de uso" id="cfg-termos">
        <div className="space-y-2 text-sm leading-relaxed text-ink2">
          <p>1. O programa é de uso pessoal e roda no seu próprio ambiente (Codespaces ou computador).</p>
          <p>2. Use apenas vídeos seus ou de canais que autorizaram o uso. Você é responsável pelos direitos do conteúdo que corta e publica.</p>
          <p>3. Nada é publicado sozinho: cada corte só vai para as redes depois da sua aprovação.</p>
          <p>4. Serviços externos (Google Gemini, Upload-Post, Postiz, YouTube) têm regras e preços próprios. O programa não contrata nenhum serviço pago por conta própria.</p>
          <p>5. O código é aberto (licença MIT) e vem sem garantia. Confira os cortes antes de publicar.</p>
        </div>
      </Card>

      <Card icon={ShieldCheck} title="Privacidade" id="cfg-privacidade">
        <div className="space-y-2 text-sm leading-relaxed text-ink2">
          <p><b className="text-ink">Vídeos:</b> ficam nas pastas <code>uploads/</code> e <code>output/</code> do seu ambiente. Apague o que não precisar.</p>
          <p><b className="text-ink">Transcrição:</b> feita no próprio ambiente (Whisper), sem enviar o áudio para fora.</p>
          <p><b className="text-ink">IA profissional (Gemini), se ligada:</b> envia ao Google 3 quadros e a fala de cada momento candidato.</p>
          <p><b className="text-ink">Publicação:</b> só quando você aprova, o corte e o texto vão ao Upload-Post ou ao Postiz.</p>
          <p><b className="text-ink">Chaves e cookies:</b> ficam no navegador, no arquivo <code>.env</code> ou nos Secrets do Codespaces. Nome, tema e volume ficam só neste navegador.</p>
          <p><b className="text-ink">Acesso:</b> a porta do painel é privada; só abre com o seu login do GitHub.</p>
        </div>
      </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
