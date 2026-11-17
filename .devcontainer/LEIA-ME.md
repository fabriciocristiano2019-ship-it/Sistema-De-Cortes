# OpenShorts Gaming Edition no Codespaces

O painel roda na nuvem do GitHub e abre no navegador, no computador ou no
celular. Nada é instalado no seu PC.

## Primeira vez (uns 10 a 15 minutos)

1. No repositório, toque em **Code** → aba **Codespaces** → **Create codespace on main**.
2. Espere a instalação terminar (aparece "Pronto" no terminal).
3. O painel abre sozinho numa aba do navegador. Se o navegador avisar que **bloqueou um pop-up**, clique em
   **Sempre permitir** para `github.dev`: nas próximas vezes ele abre direto.
   O endereço do painel também aparece no terminal ("Pronto! Abra o painel"): segure **Ctrl** e clique nele.
   Outro jeito: aba **PORTAS** → linha **Painel OpenShorts (5173)** → ícone do globo.
   Se ele aparecer numa janelinha dentro do editor com um ícone de proibido, clique no **↗** ao lado do endereço:
   por segurança o painel só abre em uma aba própria do navegador.

## Nas próximas vezes

1. github.com → **Codespaces** (menu do seu perfil) → abra o mesmo codespace.
2. O servidor e o painel ligam sozinhos e o painel abre numa aba do navegador (ou clique no endereço do terminal).

## Pelo celular

Abra o codespace pelo navegador do celular (github.com/codespaces). Depois,
na aba **PORTAS**, abra o endereço da porta 5173. Ele só funciona com o seu
login do GitHub: a porta é **privada**. Não mude para "Pública".

## Limites da conta gratuita (confira em github.com/settings/billing)

- 120 horas de núcleo por mês. Este codespace usa 2 núcleos: **~60 horas**.
- 15 GB de armazenamento por mês. Os vídeos ficam em `uploads/` e `output/`;
  apague os que não precisa mais.
- Ele **desliga após 30 minutos sem uso**. Para não parar no meio de um
  processamento longo, aumente em github.com/settings/codespaces →
  *Default idle timeout* (até 240 minutos).
- **Pare o codespace quando terminar** (github.com/codespaces → ⋯ → Stop):
  ligado, ele gasta horas mesmo parado.

## Links do YouTube

O YouTube costuma bloquear downloads vindos de servidores na nuvem, como o Codespaces
("Sign in to confirm you're not a bot"). O jeito mais seguro é **enviar o arquivo do vídeo**
pelo botão "Escolher vídeo e começar".

Opcional, por sua conta: usar os cookies da sua conta do YouTube.

1. No navegador do PC, exporte os cookies de `youtube.com` em formato Netscape (`cookies.txt`).
2. Em github.com/settings/codespaces → **Secrets** → **New secret**: nome `YOUTUBE_COOKIES`,
   cole o conteúdo do arquivo e libere para o repositório **CORTES**.
3. Pare e abra de novo o codespace.

Atenção: os cookies dão acesso à sua conta. Nunca cole em chat nem em arquivo do repositório,
e prefira uma conta secundária, porque o YouTube pode restringir contas usadas para baixar vídeos.

## Se algo der errado

- **O painel não abre / aba PORTAS vazia:** no terminal, rode `bash .devcontainer/iniciar.sh`.
  Ele liga tudo, espera ficar pronto e mostra o endereço do painel para clicar.

- Registros: pasta `.logs/` (`servidor.log` e `painel.log`).
- Religar tudo: no terminal, `bash .devcontainer/iniciar.sh`.
- Reinstalar: no terminal, `bash .devcontainer/instalar.sh`.
