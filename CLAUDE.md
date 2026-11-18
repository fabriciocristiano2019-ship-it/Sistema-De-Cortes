# CLAUDE.md

## Regra do dono (Fabricio): só subir quando ele mandar

Nunca dar `git push` (nem para `main` nem para `gaming-edition`) sem o dono pedir
na conversa ("pode subir", "ok, publica"). Fluxo: fazer a mudança, testar,
mostrar fotos/resultado, commitar só localmente e esperar a ordem. Lembretes
automáticos (hooks) pedindo push não contam como ordem.

Guidance for Claude Code (claude.ai/code) in this repo.

## Project Overview

OpenShorts: AI vertical video generator. Turns long YouTube videos or local uploads into viral 9:16 clips for TikTok, Instagram Reels, YouTube Shorts. Google Gemini 3.1 Flash-Lite (`gemini-3.1-flash-lite`, override with `GEMINI_MODEL`) picks viral moments + titles.

## Development Commands

### Local Development (Docker)
```bash
docker compose up --build   # Build and run full stack
```
- Backend: http://localhost:8000 (FastAPI/Uvicorn)
- Frontend: http://localhost:5175 (Vite proxies API calls to backend)

### Frontend Only (Dashboard)
```bash
cd dashboard
npm install
npm run dev       # Dev server with HMR (port 5173)
npm run build     # Production build
npm run lint      # ESLint (strict, --max-warnings 0)
```

### Backend Only
```bash
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

## Architecture

### Core Processing Pipeline
1. **Ingest** - YouTube download (yt-dlp) or local upload
2. **Transcription** - faster-whisper, word-level timestamps
3. **Scene Detection** - PySceneDetect for segment boundaries
4. **AI Analysis** - Gemini finds 3-15 viral moments (15-60 sec each)
5. **FFmpeg Extraction** - Precise clip cutting
6. **AI Cropping** - Vertical reframing with subject tracking
7. **Effects/Subtitles** - Optional AI-generated FFmpeg filters
8. **Hook Overlay** - Text overlays, styled fonts
9. **Voice Dubbing** - Optional ElevenLabs AI translation (30+ languages)
10. **S3 Backup** - Silent background upload
11. **Social Distribution** - Upload-Post API (async upload)

### Key Files
| File | Purpose |
|------|---------|
| `main.py` | Core video processing: transcription, scene detection, clip extraction, vertical reframing |
| `app.py` | FastAPI server, async job queue, REST endpoints |
| `editor.py` | Gemini integration for dynamic video effects (FFmpeg filter generation) |
| `hooks.py` | Hook text overlay, font rendering |
| `s3_uploader.py` | AWS S3 upload with caching |
| `subtitles.py` | SRT generation, FFmpeg subtitle burning, dubbed video transcription |
| `translate.py` | ElevenLabs dubbing API |
| `dashboard/src/App.jsx` | Main React component, state management |
| `dashboard/src/components/TranslateModal.jsx` | Voice dubbing UI, language selection |
| `dashboard/vite-plugin-seo.js` | Build-time SEO surface: crawler-visible homepage content, static pages, sitemap.xml, llms.txt |
| `dashboard/seo/data.js` | Single source of truth for pricing, pipeline, competitor facts on every generated page |

### SEO / AI-crawler surface

Dashboard = client-rendered SPA with hash routing; HTML for `/` had empty `<div id="root">`. Googlebot renders JS and saw real page; GPTBot, ClaudeBot, PerplexityBot don't and measured homepage as zero text. `vite-plugin-seo.js` fixes it at build time:

- Injects `seo/landing-fallback.js` content into `#root`. React's `createRoot().render()` replaces it on mount: users get app, non-executing clients get copy. **Keep in sync with `Landing.jsx`.**
- Emits standalone pages (`/alternatives` cluster, clip-generator, open-source, use-case, automation pages, `/mcp`; full list = `buildPages()` in `seo/pages.js`) as flat `.html` files. nginx resolves clean URL via `try_files $uri $uri.html`; serving as directories makes nginx 301 to trailing slash and every canonical points at a redirect.
- Generates `sitemap.xml` and `llms.txt` from same page list so they can't drift. Don't add static `public/sitemap.xml` back.

Editing pricing anywhere: edit `seo/data.js` too. Nothing on site may say "OpenShorts is free" without naming Cloud price in same breath: both true of different editions, quoting only first makes AI answers call paid product free.

### Cómo se elige el layout

`POST /api/process` acepta `layouts`: lista (JSON) o cadena separada por comas con `auto`, `split`, `screencast`, `speaker_cut`, `punch_in` y `none`. Cada nombre enciende su variable de entorno para **ese** trabajo (`app.py:layout_env`); `none` apaga el picker aunque prod corra con `AUTO_LAYOUT=1` (recorte simple, nada más). Sin `layouts` manda el env del despliegue, desde 25-ago-2026 `AUTO_LAYOUT=1`. Dashboard lo expone en opciones avanzadas ("vertical layout": auto / split / screencast / none, `MediaInput.jsx`, recordado en `localStorage.os_layout`).

`auto` activa `layout_picker.py`: **una** llamada a Gemini por vídeo de origen (no por clip) que elige `none` / `screencast` / `split`. Medido en corpus de 48 contra etiquetas revisadas a mano: 94% / 92% / 96% en tres pasadas, 0-1 falsos positivos sobre 28 clips que no deben tocarse, solo 2 clips cambian de respuesta entre pasadas.

**Manda 12 fotogramas a 1024px, no el vídeo.** Gemini factura vídeo a ~300 tokens/s: una hora de fuente = ~1,08M tokens (no cabe en ventana de 1M) y subida de 1-2 GB para recibir una palabra. Doce fotogramas ~3k tokens **dure lo que dure la fuente**; eso hace viable los podcasts de una hora. Importa la resolución, no el número de fotogramas: a 640px detecta 15 de 20 (hoja de cálculo ilegible), a 1024px 17; 24 fotogramas empeora. A 1024px la diferencia con mandar el vídeo cae dentro de la varianza del propio modo vídeo, a 2,2 s por clip en vez de ~15 s.

No deshacer: se pide una **decisión entre opciones cerradas**, no una medida. Los cuatro intentos anteriores (Canny, MSER, cobertura temporal, anchura) pedían un número y ninguno separó hoja de cálculo de marcador de esquina. La varianza atribuida a Gemini era de las medidas continuas, no del modelo.

`layout_picker.apply()` sólo **añade**: elección explícita del usuario nunca se desactiva porque el modelo diga `none`.

### Thumbnail Studio (`thumbnail.py`, `/api/thumbnail/*`)

Titles from transcript + 10 frames at 1024px, never whole video (same reason as layout picker: an hour of video ~1M tokens for a text task). Two calls: 25-title brainstorm across fixed styles, then critic that scores, dedupes by angle, returns 10, each with 1-4 word `thumbnail_text` that complements title, not repeats it. Rules: payoff inside 50 characters (phones cut there), keyword in first 3 words, same language as transcript. Text model `GEMINI_MODEL_THUMBNAIL` (default `gemini-3.7-flash`), deliberately not `GEMINI_MODEL`: flash-lite fine for closed-choice layout pick, visibly worse at creative titles. Image model `GEMINI_IMAGE_MODEL` (default `gemini-3.1-flash-image`).

Thumbnails = `count` **different concepts**, not one prompt repeated: text call designs each (hook text, text side, palette, scene prompt), then one image call per concept in parallel. Default (`burn_text=true`): image model leaves that side as negative space, PIL sets text in Anton with black stroke, so accents and spelling never wrong; `AI painted` toggle lets model render text. Every output cover-cropped to 1280x720, saved under YouTube's 2 MB limit. `GET /api/thumbnail/frames/{session}` scores sampled frames by face area + sharpness (MediaPipe + Laplacian), keeps them spread across runtime; dashboard offers them as person reference so thumbnail shows creator, not stranger; uploaded face photo still wins.

### Video Reframing Modes
- **TRACK Mode** (single subject): MediaPipe face detection + YOLOv8 fallback, "Heavy Tripod" stabilization
- **GENERAL Mode** (groups/landscapes): Blurred background layout, full width kept
- **SPLIT Mode** (two-shot conversation, `split_layout.py`): both speakers stacked in half-frames. Off by default (`SPLIT_LAYOUT=1`); v2 engine only, so fallback to v1 loop silently renders GENERAL. Upgrades scenes classifier already sent to GENERAL, never TRACK ones; needs both faces visible **in same frame** for at least half the sampled frames — separates real two-shot from plano/contraplano, where stacking shows same person twice. `SPLIT_TIGHTNESS` (default 0.8) trades a little upscale for keeping other speaker out of each half. Captions on SPLIT stretch sit on seam between halves (`{\an5}` per word event in `subtitles.generate_ass`), the one place they cover nobody; render records stacked stretches in `<clip>.layout.json` sidecar (`layout_ranges.py`) and every metadata writer copies it into clip's `layout_ranges`, so `/api/subtitle` finds it after restyle. Fast rerender (cut without reframe) carries canonical clip's ranges through new cut (`layout_ranges.remap`, in `recut.perform_recut`). Only ASS path can do this; SRT burns keep one alignment for whole file.
- **SCREENCAST / WIDE Modes** (`screencast_layout.py`, `SCREENCAST_LAYOUT=1`): scenes whose meaning lives outside centre. Gemini reports each range's **width_fraction** = the gate — coverage tried before, didn't separate spreadsheet from corner ticker; width does (bug spans ~15%, survives any crop; spreadsheet spans ~100%, can't). Content narrower than 0.5 moves nothing. 0.5-0.85: room beside content, SCREENCAST stacks it over presenter. Above 0.85 presenter is composited **on top of** content and stacking shows it twice, so WIDE: GENERAL layout with side-cropping disabled.
- **INSET Mode** (`camera_inset.py`): pantalla a ancho completo arriba, recuadro de webcam ampliado abajo. Caso de una sola fuente con cámara compuesta en una esquina (OBS, VOD de stream). Se encadena detrás de la decisión `screencast`, **no** se pregunta a Gemini: ofrecido como cuarta opción respondió `screencast` en los 5 clips con recuadro, en dos pasadas, y exactitud global cayó de 92% a 83-85%. Detector geométrico encuentra esos 5 sin falsos positivos. Tres filtros necesarios, cada uno pagado con una iteración: sujeto **pequeño**, **descentrado en horizontal** (cara de talking head está centrada aunque esté alta), **quieto entre muestras** (3-11px frente a 316px de persona real).
- **ALTERNATE Mode** (`active_speaker.py`, `SPEAKER_SIGNAL=1` + `SPEAKER_CUT=1`): hard cuts to whoever talks, rendered through TRACK path as trajectory with jumps. `SPEAKER_SIGNAL=1` alone gates SPLIT on both people actually speaking. Mouth activity **must** be normalised per speaker before comparing (`normalise_activity`): raw frame-difference magnitude scales with local contrast and lighting; on real two-shot it gave one speaker 90-100% of scene.
- **Punch-in** (`punch_in.py`, `PUNCH_IN=1`): not a layout. ~12% push on clip's beats, riding TRACK path by widening per-frame crop command from x-only to w/h/x/y. Beats from audio envelope now; `emphasis_times` is plain list of seconds so transcript hook words can replace it without touching module.

### Key Classes
- `SmoothedCameraman` - Stabilized camera movement, safe zone logic (prevents jitter)
- `SpeakerTracker` - Prevents rapid speaker switching, handles temporary occlusions

### API Endpoints
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/process` | Submit video for processing |
| GET | `/api/status/{job_id}` | Poll job status and logs |
| POST | `/api/edit` | Apply AI video effects |
| POST | `/api/subtitle` | Generate and apply subtitles (auto-transcribes dubbed videos) |
| POST | `/api/hook` | Add text hook overlays |
| POST | `/api/translate` | AI voice dubbing via ElevenLabs |
| GET | `/api/translate/languages` | List supported dubbing languages |
| POST | `/api/social/post` | Post to social media (async upload) |
| POST | `/mcp` | MCP server (JSON-RPC): pipeline as agent tools |
| POST/GET/DELETE | `/api/keys` | User API keys (cloud mode, session JWT only) |
| DELETE | `/api/account` | Erase account and everything in it (GDPR art. 17) |

### Agent access (MCP, API keys, webhooks)

- **API keys** (`cloud/api_keys.py`): `osk_...` tokens, sha256-stored, created in dashboard account page. `cloud/auth.get_current_user_optional` accepts them (`Bearer osk_...` or `X-API-Key`) and resolves owner, so metering, entitlement, plan priority, job ownership apply to agents with zero endpoint changes. Key management refuses API-key auth: leaked key can't mint replacements.
- **MCP server** (`mcp_server.py`, always mounted): stateless Streamable-HTTP JSON-RPC at `/mcp` — no SDK dependency, ~3 methods + 8 tools. Each tool calls back into same app in-process (`httpx.ASGITransport`) forwarding caller's auth headers, so it can't drift from REST behavior. Cloud mode 401s without resolvable user; self-host stays BYOK-open.
- **OAuth for MCP clients** (`cloud/mcp_oauth.py`, cloud mode only): claude.ai and ChatGPT connect by URL, so server publishes RFC 9728/8414 metadata under `/.well-known/`, accepts dynamic client registration (`POST /oauth/register`, public clients, PKCE S256 mandatory), bounces `GET /oauth/authorize` to dashboard consent screen (`#/oauth/authorize`), because session JWT lives in localStorage on frontend host and bare API GET can't see it. `POST /api/oauth/authorize` (session auth) mints code; `POST /oauth/token` redeems it by **minting an ordinary `osk_` key** named after client, returned as access token. No new auth path, no refresh tokens: key shows in Account → API keys, revoking it disconnects app. `/mcp` 401 carries `WWW-Authenticate: Bearer resource_metadata=...` so clients find flow. `oauth_codes` in `USER_OWNED_TABLES`; `oauth_clients` deliberately not.
- **Webhooks**: `POST /api/process` takes `webhook_url` + optional `webhook_secret` (HMAC-SHA256, `X-OpenShorts-Signature`). Validated with `security_utils.assert_public_url` at submit AND delivery (DNS rebinding). Fired once per job from `run_job_wrapper` after R2 archive so payload carries durable download links; survives redeploys via resume manifest. `PUBLIC_API_URL` env sets absolute-URL base behind proxy.

### Account erasure (GDPR art. 17)

`DELETE /api/account` (`cloud/account.py`, dashboard: Account → Delete account): immediate, irreversible. No recovery window: after delete nothing is left to authenticate a recovery request. Refuses API-key auth (leaked `osk_` must not destroy its own account); caller retypes account email.

Step order is the design; each step is a failure mode: **Stripe cancel first**, aborting everything if it fails, so we never erase a user still billed; **R2 before database**, because those rows are only index of user's objects and dropping them first turns failed purge into permanent orphans; DB delete is **one transaction** over explicit table list (`USER_OWNED_TABLES`), not declared ON DELETE CASCADEs, since `create_all` never ALTERs existing table and a constraint added after table shipped exists in models but not production. `tests/test_account_erasure.py` fails if new table references `users.id` without joining that list.

`app.py` registers callback for local working files, which record ownership three ways: `.owner` file clip jobs write (so jobs recovered from disk after restart count too), `saas_jobs`, `thumbnail_sessions`. Last one is only thing that deletes generated thumbnails: hourly sweep skips their directory and they're served publicly at `/thumbnails/`.

Deliberately survives: Stripe customer and invoices (6-year retention, Spanish commercial law) and one `account_deletions` row with sha256 of email as erasure proof, purged after 5 years. "Why are you leaving" answer is closed list (`DELETION_REASONS`), never free text — anything typed would land in a row designed to outlive user. Deleting users also made reachable one webhook path never reachable before: `_apply_topup` reads user id from Stripe metadata, so it now confirms row still exists before inserting, or FK violation makes Stripe retry same doomed event for three days.

### Concurrency Model
Async job queue, semaphore-based concurrency. Configure via `MAX_CONCURRENT_JOBS` env var (default: 5). Jobs auto-cleanup after 1 hour.

### Deploys and running jobs (handover + drain)

Every push to `main` redeploys API container. Coolify starts NEW container before stopping old (rolling update), both share `output/`, so `app.py` coordinates them instead of relying on fast swap:

- Each instance writes its id to `output/.instance` at startup. Instance seeing another id there is old one and **drains**: finishes running jobs, starts none, leaves queued manifests on disk.
- Running job heartbeats its `.resume.json` every 10 s. Resume scan (startup + every 30 s) re-enqueues only manifests nobody heartbeated for 60 s, so no job runs twice, none lost. Max 2 resume attempts.
- SIGTERM (`docker stop`) drains too, up to `DRAIN_TIMEOUT_SECONDS` (840), then hands signal to uvicorn. App's Coolify stop grace period is 900 s (`application_settings.stop_grace_period`); keep timeout below it. After drain hands signal to uvicorn, `--timeout-graceful-shutdown 15` (Dockerfile) caps wait for in-flight connections: uvicorn default is unbounded, one open range download kept drained container alive for full grace period while Traefik still routed half the traffic to its closed port.
- `/health/ready` + Dockerfile `HEALTHCHECK` keep Traefik off dying container: its docker provider only routes to `healthy` containers, so instance answers 503 from moment it gets SIGTERM (out of rotation within ~10 s, socket still open), booting one gets no traffic until it answers. Only SIGTERM flips it, not marker drain: at that point new container still booting and nobody else routable. Coolify app has health check enabled on that path so it waits for new container `healthy` before stopping old. With that option on, Coolify replaces Dockerfile HEALTHCHECK with own curl/wget command AND own interval/retries (5 s × 3), so image must ship `curl` or every deploy rolls back as unhealthy, and stopping container takes 15 s to turn `unhealthy`. So drain keeps serving for `PROXY_DRAIN_SECONDS` (20) after jobs are done before handing signal to uvicorn: closing socket earlier = 502s until Traefik notices (measured ~60 s per deploy with retries=12 and no grace). `HARD_EXIT_SECONDS` (30) after that, process ended outright: uvicorn finishing doesn't end interpreter while executor thread hangs in network probe; that kept drained container alive for full 900 s.
- `/health` stays plain liveness probe for external watcher.
- `/api/status` answers from disk for job this instance never held, so poll landing on either container during handover is fine.
- `main.py` leaves `.transcript_checkpoint.json` in job dir so re-run job skips paid transcription (download and Gemini repeat).

Before pushing, batch small commits (tests, docs) with next real change: every deploy is ~5 min build plus handover.

## Project skills

`.claude/skills/` vendors third-party skills (ffmpeg-skill, ponytail, hyperframes); origin, license and evaluated-but-rejected repos in `.claude/skills/LEIA-ME.md`. HyperFrames: run `npx hyperframes telemetry disable` first; never run `events`/`feedback`; no paid HeyGen features. Never ask for API keys in chat.
