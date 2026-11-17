# OpenShorts Gaming Edition no Codespaces

O painel roda na nuvem do GitHub e abre no navegador, no computador ou no
celular. Nada é instalado no seu PC.

## Primeira vez (uns 10 a 15 minutos)

1. No repositório, toque em **Code** → aba **Codespaces** → **Create codespace on main**.
2. Espere a instalação terminar (aparece "Pronto" no terminal).
3. O painel abre sozinho numa aba do navegador. Se não abrir: aba **PORTAS** → linha **Painel OpenShorts (5173)** → ícone do globo.
   Se ele aparecer numa janelinha dentro do editor com um ícone de proibido, clique no **↗** ao lado do endereço:
   por segurança o painel só abre em uma aba própria do navegador.

## Nas próximas vezes

1. github.com → **Codespaces** (menu do seu perfil) → abra o mesmo codespace.
2. O servidor e o painel ligam sozinhos; abra pela aba **PORTAS** como acima.

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

## Se algo der errado

- **O painel não abre / aba PORTAS vazia:** no terminal, rode `bash .devcontainer/iniciar.sh`.
  Ele liga tudo, espera ficar pronto e mostra o endereço do painel para clicar.

- Registros: pasta `.logs/` (`servidor.log` e `painel.log`).
- Religar tudo: no terminal, `bash .devcontainer/iniciar.sh`.
- Reinstalar: no terminal, `bash .devcontainer/instalar.sh`.
