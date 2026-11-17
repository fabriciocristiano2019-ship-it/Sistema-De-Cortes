# Skills do projeto (Claude Code)

Qualquer sessão do Claude Code aberta neste repositório (no PC ou no Codespaces) carrega estas skills sozinha.
Cópias fiéis dos originais, sem alteração no conteúdo. Cada pasta traz a licença original.

| Skill | Para que serve aqui | Origem (commit) | Licença |
|---|---|---|---|
| `ffmpeg-skill` | Editar, conferir e exportar vídeo/áudio com FFmpeg local: cortes, legendas, volume (-14 LUFS), formatos de Shorts/Reels/TikTok | kajisho5/ffmpeg-skill (f1c97cb) | MIT |
| `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` | Mudanças pequenas e revisão de qualidade do código | DietrichGebert/ponytail (96608e0) | MIT |
| `hyperframes`, `hyperframes-cli`, `hyperframes-registry` | Animações em HTML que viram vídeo: aberturas, títulos, sobreposições para os cortes | heygen-com/hyperframes (06578d9) | Apache-2.0 |

## Regras de uso neste projeto

- **HyperFrames:** antes do primeiro uso, rode `npx hyperframes telemetry disable`. Não rode `events` nem `feedback` (enviam dados de uso). Recursos pagos da HeyGen (avatar, voz, `media-use`) não estão instalados e não devem ser contratados.
- **ffmpeg-skill:** pede FFmpeg 6.1 ou mais novo. O Codespaces (Debian bookworm) vem com 5.1: a maioria dos comandos funciona, mas alguns podem recusar.
- Nenhuma skill daqui pode receber chave de API colada no chat.

## Avaliados e não instalados

| Repositório | Motivo |
|---|---|
| browser-use/video-use | A transcrição depende só da ElevenLabs (paga) e a skill pede a chave colada no chat. O projeto já transcreve de graça com Whisper local. |
| OpenMontageInc/OpenMontage | Licença AGPL-3.0: copiar o código obrigaria o projeto inteiro a virar AGPL. |
| thedotmack/claude-mem | Plugin com serviço em segundo plano e banco de memória. No Codespaces o banco se perde quando o ambiente é apagado. Se quiser, instale no seu PC com `/plugin marketplace add thedotmack/claude-mem`. |
| modelscope/FunClip | Programa próprio (Gradio + reconhecimento de fala Paraformer, focado em chinês). Não é skill; o projeto já faz cortes por IA. |
| Anil-matcha/AI-Youtube-Shorts-Generator | A skill só comanda o programa dele, que faz o mesmo que o nosso. |
| mutonby/openshorts | Mesma família do OpenShorts que serviu de base ao CORTES. A skill dele usa a API paga openshorts.app. Juntar o código novo dele de uma vez quebraria a versão Gaming. |
