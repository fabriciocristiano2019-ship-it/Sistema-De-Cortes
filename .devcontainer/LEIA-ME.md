# OpenShorts Gaming Edition no Codespaces

Painel roda na nuvem do GitHub, abre no navegador (PC ou celular). Nada instalado no PC.

## Primeira vez (uns 10 a 15 minutos)

1. Repositório → **Code** → aba **Codespaces** → **Create codespace on main**.
2. Espere instalação terminar ("Pronto" no terminal).
3. Painel abre sozinho numa aba. Navegador **bloqueou um pop-up**? Clique **Sempre permitir** para `github.dev`; depois abre direto.
   Endereço também aparece no terminal ("Pronto! Abra o painel"): **Ctrl** + clique.
   Ou: aba **PORTAS** → **Painel OpenShorts (5173)** → ícone do globo.
   Abriu em janelinha dentro do editor com ícone de proibido? Clique **↗** ao lado do endereço: por segurança painel só abre em aba própria.

## Nas próximas vezes

1. github.com → **Codespaces** (menu do perfil) → abra mesmo codespace.
2. Servidor e painel ligam sozinhos; painel abre numa aba (ou clique no endereço do terminal).

## Pelo celular

Abra codespace pelo navegador do celular (github.com/codespaces). Aba **PORTAS** → endereço da porta 5173. Só funciona com seu login do GitHub: porta **privada**. Não mude para "Pública".

## Limites da conta gratuita (confira em github.com/settings/billing)

- 120 horas de núcleo/mês. Codespace usa 2 núcleos: **~60 horas**.
- 15 GB armazenamento/mês. Vídeos em `uploads/` e `output/`; apague os que não precisa.
- **Desliga após 30 minutos sem uso**. Processamento longo: aumente em github.com/settings/codespaces → *Default idle timeout* (até 240 minutos).
- **Pare o codespace ao terminar** (github.com/codespaces → ⋯ → Stop): ligado gasta horas mesmo parado.

## IA profissional (Gemini): cortes e títulos melhores

Sem chave: motor local gratuito. Com chave do Google Gemini: IA assiste melhores momentos, escolhe cortes, ajusta início/fim, escreve título, descrição, hashtags e gancho em português, corrige palavras erradas das legendas.

1. **aistudio.google.com** → entre com conta Google → **Get API key** → **Create API key**.
2. Painel: **Módulos** → **12. Chaves e Integrações** → campo **Chave do Gemini** → cole.
   (Mais seguro: github.com/settings/codespaces → **Secrets** → `GEMINI_API_KEY`, liberado para o Sistema-De-Cortes.)
3. Pronto: próximos vídeos usam IA. Diário dos agentes mostra "IA profissional (Gemini) assistindo…".

Custo: Google tem cota gratuita com limites; acima pode cobrar. Confira valores no AI Studio. Quadros e fala dos momentos candidatos vão ao Google. Chave falhou ou cota acabou: programa avisa e segue no motor local.

## Publicar pelo Postiz (alternativa ao Upload-Post)

1. Conta em **postiz.com** (Postiz Cloud pago, com teste grátis; confira preços) e conecte YouTube, Instagram e TikTok.
2. No Postiz: **Settings → Public API** → copie chave.
3. Painel: **Módulos → 12. Chaves e Integrações → Postiz** → cole → **Testar conexão**.
   (Mais seguro: secret `POSTIZ_API_KEY` em github.com/settings/codespaces, liberado para o Sistema-De-Cortes.)
4. Com chave, **Aprovar e enviar** publica pelo Postiz. Sem ela, segue pelo Upload-Post.

Postiz no seu servidor também funciona (campo "Endereço do Postiz"), mas exige app de desenvolvedor em cada rede.

## Links do YouTube

YouTube costuma bloquear downloads de servidores na nuvem como Codespaces ("Sign in to confirm you're not a bot"). Mais seguro: **enviar arquivo do vídeo** pelo botão "Escolher vídeo e começar".

Opcional, por sua conta: cookies da sua conta do YouTube.

1. No navegador do PC, exporte cookies de `youtube.com` em formato Netscape (`cookies.txt`).
2. Painel: **Módulos → 12. Chaves e Integrações → Cookies do YouTube** → cole arquivo inteiro → **Salvar cookies**. Vale na hora.
   (Alternativa: github.com/settings/codespaces → **Secrets** → `YOUTUBE_COOKIES`, liberado para **Sistema-De-Cortes**; depois pare e abra de novo o codespace.)

Link de canal (`youtube.com/@canal`) ou playlist não é vídeo: abra o vídeo e copie o link dele. Links com `&list=`, `?si=`, `/shorts/`, `/live/` e `youtu.be` são aceitos e convertidos sozinhos.

Atenção: cookies dão acesso à conta. Nunca cole em chat nem em arquivo do repositório. Prefira conta secundária: YouTube pode restringir contas que baixam vídeos.

## Se algo der errado

- **Painel não abre / aba PORTAS vazia:** terminal → `bash .devcontainer/iniciar.sh`. Liga tudo, espera ficar pronto, mostra endereço para clicar.

- Registros: pasta `.logs/` (`servidor.log` e `painel.log`).
- Religar tudo: terminal → `bash .devcontainer/iniciar.sh`.
- Reinstalar: terminal → `bash .devcontainer/instalar.sh`.
