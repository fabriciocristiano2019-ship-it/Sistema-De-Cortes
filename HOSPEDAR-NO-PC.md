# Rodar o sistema no seu PC e abrir pelo celular

O sistema roda no seu computador (Windows) e você abre o painel no celular,
de qualquer lugar, por um link privado do **Tailscale**. Só os aparelhos
conectados na sua conta do Tailscale conseguem abrir o link. O login do
painel continua o mesmo de hoje.

O código continua no GitHub: as atualizações chegam do mesmo jeito.

## O que o PC precisa

- Windows 10 ou 11, 64 bits.
- 8 GB de memória ou mais (16 GB é o ideal).
- 40 GB livres no disco (programas + vídeos).
- Ficar ligado enquanto você quiser usar o sistema.

## Parte 1 – Instalar os programas (uma vez só)

1. **Git**: baixe em https://git-scm.com/download/win e instale clicando em
   *Next* até o fim.
2. **Docker Desktop**: baixe em https://www.docker.com/products/docker-desktop/
   e instale. Se ele pedir para instalar ou atualizar o **WSL**, aceite e
   reinicie o PC. Depois, abra o Docker Desktop e espere aparecer
   *Engine running*.
   - Em *Settings → General*, deixe marcado **Start Docker Desktop when you
     sign in** (assim o sistema liga sozinho com o PC).
3. **Tailscale**: baixe em https://tailscale.com/download/windows, instale e
   entre com uma conta (pode ser a do Google).

## Parte 2 – Baixar e instalar o sistema (uma vez só)

1. Crie uma pasta, por exemplo `C:\Cortes`.
2. Abra essa pasta, clique na barra de endereço, digite `cmd` e aperte Enter.
3. Na janela preta, cole:

   ```
   git clone https://github.com/fabriciocristiano2019-ship-it/Sistema-De-Cortes.git
   ```

   O Windows vai pedir para entrar no GitHub: entre com a sua conta.
4. Abra a pasta `Sistema-De-Cortes` que apareceu e dê dois cliques em
   **instalar.bat**. Na primeira vez demora de 15 a 40 minutos.
5. Dê dois cliques em **iniciar.bat**. O painel abre no navegador do PC.
   Entre com o mesmo usuário e senha de hoje.
6. Em **Configurações → Conta e chaves**, coloque de novo as suas chaves
   (Gemini, Upload-Post). Elas não vêm do Codespace.

## Parte 3 – Abrir no celular

1. No PC, dê dois cliques em **celular.bat**.
   - Na primeira vez o Tailscale pode pedir para ativar *HTTPS* / *Serve*:
     abra o endereço que aparecer, clique em ativar e volte para a janela.
2. A janela mostra o **LINK DO CELULAR** (termina em `.ts.net/#app`).
3. No celular, instale o app **Tailscale** (Play Store ou App Store) e entre
   com a **mesma conta** do PC. Deixe ele ligado.
4. Abra o link no navegador do celular. Para virar um app: menu do navegador
   → **Adicionar à tela inicial**.

O link continua valendo depois de reiniciar o PC; não precisa rodar o
`celular.bat` de novo.

## Parte 4 – Trazer os vídeos do Codespace

1. No painel do **Codespace**: **Configurações → Backup → Baixar backup**.
2. No painel do **PC**: **Configurações → Backup → Restaurar** e escolha o
   arquivo baixado. Nada que já existe no PC é apagado ou trocado.

## Dia a dia

| Quero… | Faça |
|---|---|
| Ligar o sistema | Ele liga sozinho com o PC. Se não ligou: `iniciar.bat` |
| Desligar | `parar.bat` |
| Pegar a versão nova do GitHub | `atualizar.bat` |
| Ver o link do celular | `celular.bat` |

## Cuidados

- Em **Configurações do Windows → Sistema → Energia**, coloque
  **Suspender: Nunca** quando ligado na tomada. PC dormindo = painel fora do ar.
- Não compartilhe a sua conta do Tailscale: quem entrar nela abre o painel
  (ainda precisaria da senha do painel).
- Mantenha o Windows e o Docker Desktop atualizados.

## Deu problema?

| Sintoma | Solução |
|---|---|
| `instalar.bat` diz que o Docker não está rodando | Abra o Docker Desktop e espere *Engine running* |
| Celular não abre o link | Confira se o app Tailscale do celular está **ligado** e na mesma conta |
| "Blocked request. This host is not allowed" | Rode `atualizar.bat` (versão antiga do painel) |
| Painel abre mas não carrega | Feche e abra o navegador; se continuar, mande um print |
