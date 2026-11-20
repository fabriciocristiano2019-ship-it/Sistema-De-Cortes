# Skills do projeto (Claude Code)

Qualquer sessão do Claude Code aberta neste repositório (no PC ou no Codespaces) carrega estas skills sozinha.
Cópias fiéis dos originais, sem alteração no conteúdo. Cada pasta traz a licença original.

| Skill | Para que serve aqui | Origem (commit) | Licença |
|---|---|---|---|
| `ffmpeg-skill` | Editar, conferir e exportar vídeo/áudio com FFmpeg local: cortes, legendas, volume (-14 LUFS), formatos de Shorts/Reels/TikTok | kajisho5/ffmpeg-skill (f1c97cb) | MIT |
| `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` | Mudanças pequenas e revisão de qualidade do código | DietrichGebert/ponytail (96608e0) | MIT |
| `hyperframes`, `hyperframes-cli`, `hyperframes-registry` | Animações em HTML que viram vídeo: aberturas, títulos, sobreposições para os cortes | heygen-com/hyperframes (06578d9) | Apache-2.0 |
| `fastapi-patterns`, `python-patterns`, `python-testing`, `api-design`, `error-handling` | Boas práticas do servidor (FastAPI/Python) e dos testes | affaan-m/ECC (3f14a10) | MIT |
| `react-patterns`, `react-performance`, `frontend-a11y`, `accessibility`, `make-interfaces-feel-better`, `motion-patterns`, `design-system` | Painel React: desempenho, acessibilidade, acabamento visual | affaan-m/ECC (3f14a10) | MIT |
| `e2e-testing`, `production-audit`, `codebase-onboarding`, `search-first` | Testes no navegador, auditoria antes de publicar, guia do código, pesquisar antes de programar | affaan-m/ECC (3f14a10) | MIT |
| `impeccable-design-polish`, `web-design-guidelines`, `ui-animation`, `design-md` | Acabamento e revisão do painel (padrões da Vercel), animações de interface, guia visual do projeto | nexu-io/open-design (0725880) | Apache-2.0 |
| `short-video-distribution`, `remotion-video-creation`, `cost-aware-llm-pipeline` | Conferir cortes contra as regras de TikTok/Shorts/Reels, vídeos em React, custo do Gemini | affaan-m/ECC (3f14a10) | MIT |
| `brand-intake`, `motion-brief-writer`, `motion-prompt-writer`, `motion-effects`, `reference-to-motion`, `animated-chart`, `milestone-reveal`, `launch-video`, `newsletter-promo`, `vox-explainer`, `title-sequence-3d`, `apple-launch-film`, `loop-cover`, `model-showdown`, `reel-export` | Motion graphics feitos em código (HTML com `window.seek`, exportado para MP4/GIF): aberturas, gráficos animados, marcos de seguidores, vídeos de lançamento, versão vertical para Reels/TikTok | charlie947/motion-graphics-skills (229022e) | MIT |

## Regras de uso neste projeto

- **HyperFrames:** antes do primeiro uso, rode `npx hyperframes telemetry disable`. Não rode `events` nem `feedback` (enviam dados de uso). Recursos pagos da HeyGen (avatar, voz, `media-use`) não estão instalados e não devem ser contratados.
- **ffmpeg-skill:** pede FFmpeg 6.1 ou mais novo. O Codespaces (Debian bookworm) vem com 5.1: a maioria dos comandos funciona, mas alguns podem recusar.
- Nenhuma skill daqui pode receber chave de API colada no chat.
- **Motion graphics (charlie947):** comece pelo `brand-intake` só se quiser um padrão visual próprio; ele cria `brand.md`, `MOTION.md` e acrescenta um bloco ao `CLAUDE.md` (confira antes de commitar: o `CLAUDE.md` daqui tem a regra de só subir com ordem do dono). Algumas skills sugerem instalar outras (`emilkowalski/skills` apple-design): pergunte antes. Para exportar, use a `hyperframes` já instalada (telemetria desligada). `motion-prompt-writer` e `reference-to-motion` escrevem prompts para o Claude Motion; não constroem nada sozinhas. Os `.zip` da pasta `downloads` do repositório original vieram vazios e não foram copiados.

## Plugins oficiais da Anthropic (`.claude/settings.json`)

Ligados no projeto a partir de `anthropics/claude-plugins-official` (Apache-2.0, commit d7d3279):
`frontend-design` (painel React), `code-review` e `pr-review-toolkit` (revisão), `feature-dev` (funções novas
passo a passo), `code-simplifier` (limpeza de código) e `claude-md-management` (manter o CLAUDE.md em dia).

- No seu PC: abra o Claude Code nesta pasta, aceite a confiança da pasta e rode uma vez
  `claude plugin install <nome>@claude-plugins-official --scope project` para cada um.
- Sessões na nuvem (claude.ai/code) **não** carregam plugins do repositório; lá valem as skills desta pasta.
- Fora de propósito: `security-guidance` (instala um SDK a cada sessão e chama a API do Claude a cada resposta,
  custo escondido), os de LSP (pedem programas extras), `playwright` (o projeto já testa com Playwright direto)
  e os de outras linguagens ou serviços.

## Headroom (headroomlabs-ai/headroom, Apache-2.0): no seu Claude Code, não no sistema

Comprime o que a IA lê para gastar menos tokens. Não entra no código do sistema: ele comprime mensagens no
formato OpenAI/Anthropic, e o sistema fala com o Gemini pela biblioteca `google-genai`; e o que vai para a IA é
transcrição (texto corrido) e imagens, onde o próprio projeto mede economia pequena. Onde ajuda: nas suas
sessões longas do Claude Code no PC, com `uv tool install --python 3.13 "headroom-ai[all]"` e `headroom wrap claude`
(desfaz com `headroom unwrap claude`).

## Avaliados e não instalados

| Repositório | Motivo |
|---|---|
| browser-use/video-use | A transcrição depende só da ElevenLabs (paga) e a skill pede a chave colada no chat. O projeto já transcreve de graça com Whisper local. |
| OpenMontageInc/OpenMontage | Licença AGPL-3.0: copiar o código obrigaria o projeto inteiro a virar AGPL. |
| thedotmack/claude-mem | Plugin com serviço em segundo plano e banco de memória. No Codespaces o banco se perde quando o ambiente é apagado. Se quiser, instale no seu PC com `/plugin marketplace add thedotmack/claude-mem`. |
| modelscope/FunClip | Programa próprio (Gradio + reconhecimento de fala Paraformer, focado em chinês). Não é skill; o projeto já faz cortes por IA. |
| Anil-matcha/AI-Youtube-Shorts-Generator | A skill só comanda o programa dele, que faz o mesmo que o nosso. |
| affaan-m/ECC (outras 308) | Fora do assunto do projeto (outras linguagens, finanças, saúde, redes), já instaladas na sua conta (~80), ou: `social-publisher` (serviço pago SocialClaw), `repo-scan` e `security-scan` (baixam e executam código externo), `web-perimeter-owasp-2025-audit` (varre sites externos), `documentation-lookup` (exige conector Context7), `security-review` (mesmo nome da revisão embutida do Claude). |
| mutonby/openshorts | Mesma família do OpenShorts que serviu de base ao CORTES. A skill dele usa a API paga openshorts.app. Juntar o código novo dele de uma vez quebraria a versão Gaming. |
| nexu-io/open-design (outras 558) | É um aplicativo inteiro de design (com plano pago "Go/Cloud"), não um pacote de skills. Ficaram de fora: as de outros assuntos (slides, revistas, Figma, SwiftUI), as que usam serviços pagos (`fal-*`, `venice-*`, `imagegen-*`), `video-downloader` (baixar vídeo de terceiros) e `ui-ux-pro-max` (só um atalho vazio, sem o conteúdo). |
