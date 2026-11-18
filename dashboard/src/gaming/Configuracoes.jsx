import React, { useEffect, useState } from 'react';
import { FileText, KeyRound, Smartphone, Moon, Palette, Play, ShieldCheck, Sun, User, Volume2, VolumeX } from 'lucide-react';
import { setVolume, somConcluido, volume as volumeAtual } from './sons';

import { NOME_PADRAO } from './nome';
import { aoMudar, instalado, instalar, podeInstalar } from './pwa';

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

export default function Configuracoes({ nome, onNome, theme, onTheme, som, onSom, onAbrirChaves }) {
  const [vol, setVol] = useState(volumeAtual);
  const [rascunho, setRascunho] = useState(nome);
  const salvarNome = () => onNome(rascunho.trim() || NOME_PADRAO);

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-rule2 bg-paper2 p-5" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
        <h2 className="text-[20px] font-extrabold text-ink">Configurações</h2>
        <p className="mt-1 text-sm text-ink2">Ajustes do programa. Ficam salvos neste navegador.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
          <button type="button" disabled={!som} onClick={() => somConcluido('editor916')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rule2 px-3 py-2 text-xs font-bold text-ink2 hover:border-brass disabled:opacity-40">
            <Play size={14} aria-hidden="true" /> Testar som
          </button>
        </Card>

        <AppCelular />

        <Card icon={KeyRound} title="Chaves e integrações" id="cfg-chaves">
          <p className="mb-3 text-sm text-ink2">
            Chave do Gemini (IA profissional), Upload-Post, Postiz e demais integrações ficam no módulo 12.
            Nunca cole chaves em conversas ou arquivos do repositório.
          </p>
          <button type="button" className="sede-btn-accent px-4" onClick={onAbrirChaves}>Abrir Chaves e Integrações</button>
        </Card>
      </div>

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
    </div>
  );
}
