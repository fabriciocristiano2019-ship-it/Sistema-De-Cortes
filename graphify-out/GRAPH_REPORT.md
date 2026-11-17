# Graph Report - openshorts  (2026-11-17)

## Corpus Check
- 272 files · ~277,468 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: (none) 11, .css 4, .bat 4)

## Summary
- 3921 nodes · 8541 edges · 172 communities (143 shown, 29 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 331 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Pipeline de vídeo (main.py)
- Servidor e fila de jobs
- Painel Gaming (Sede, sons, util)
- Downloads, hooks e ZIP de cortes
- Painel original (App.jsx)
- Transcrição Whisper
- Segurança e senha de acesso
- Migrações do banco (nuvem)
- Alertas de proxy (nuvem)
- Gancho na tela (hooks.py)
- Dependências do painel
- Quem está falando (active speaker)
- Páginas de SEO do site
- Shorts com IA (SaaS)
- Serviço de renderização
- Reenquadramento v2 e FFmpeg
- Login OAuth do MCP (nuvem)
- Troca de versão sem parar jobs
- Cobrança Stripe (nuvem)
- API Gaming e publicações
- Modais de legenda e gancho
- API REST e webhooks (docs)
- Landing, login e preços
- Biblioteca de jogos
- Layout screencast
- Medição de uso (nuvem)
- Vídeos e retenção (nuvem)
- Legendas e recorte rápido
- Webcam no canto (inset)
- Estúdio de thumbnail
- Conta e API do painel
- Zoom nos picos (punch-in)
- Testes de re-render
- Dependências do Remotion
- Diário dos agentes (pipeline)
- Configuração da nuvem
- Autenticação (nuvem)
- Motor local de momentos
- Layout em painéis
- Testes de upload por agente
- Arquitetura e implantação (docs)
- Dublagem por IA
- Chaves de API osk_
- Efeitos FFmpeg por IA
- Galeria e backup S3
- Openshorts cli
- Testes: email_policy
- Docker-compose
- Layout ranges
- Testes: panel_layout
- Testes: mcp_endpoint
- Readme
- Storage
- Testes: metering_free_plan
- Gemini worker
- Testes: email_policy (2)
- Testes: ffmpeg_utils
- Ci
- Testes: account_erasure
- Recut
- Testes: gaming_moments
- Testes: speaker_tracker
- Testes: hook_layers
- Metering
- Editor
- Testes: account_local_purge
- Design
- Testes: gaming_api
- App
- Testes: billing_states
- Gemini judge
- Types
- Testes: probe_plan
- Testes: social_tenant_isolation
- Claude
- Docker-compose.cloud
- Testes: gemini_retry
- Subtitles
- Videoeffects
- Pipeline
- Testes: mcp_protocol
- Testes: mcp_ui
- Requirements-billing
- Testes: split_layout
- Testes: subtitles
- Testes: process_handover
- Testes: transcript_checkpoint
- App (2)
- Emails
- App (3)
- Social profiles
- Testes: gaming_thumbs
- Testes: layout_picker
- Mcp server
- Testes: clip_selection
- Testes: layout_picker (2)
- Videoeffects (2)
- Testes: filename_limits
- Testes: short_source_gate
- Testes: clip_selection (2)
- Subtitles (2)
- Types (2)
- Mcp server (2)
- Testes: recut
- Testes: recut (2)
- Tsconfig
- Testes: clip_ready_marker
- Testes: gaming_gemini
- Sedemap
- Hookoverlay
- Profiles
- Hookoverlay (2)
- Subtitles (3)
- Tsconfig (2)
- Scene detection
- Split layout
- Testes: reframe_endpoint
- Testes: sparse_speech
- Log view
- Testes: recut (3)
- Testes: reframe_v2
- App (4)
- Testes: gemini_block_split
- Testes: reframe_endpoint (2)
- Testes: scene_cut_reset
- App (5)
- Testes: recut (4)
- Testes: generation_controls
- Claude (2)
- Testes: subtitle_metering
- Signals
- Testes: layout_picker (3)
- Testes: subtitles (2)
- Index
- Testes: clip_selection (3)
- Server
- Testes: split_layout (2)
- Testes: subtitles (3)
- Testes: download_plan
- Testes: generation_controls (2)
- Testes: account_erasure (2)
- Digest
- Testes: layout_ranges
- Docker-compose.e2e.local
- Gaming api
- Testes: subtitles (4)
- Testes: account_erasure (3)
- Testes: subtitles (5)
- Resultsboard
- Main
- Mcp ui
- Testes: clip_selection (4)
- Testes: gemini_retry (2)
- Pipeline (2)
- Testes: split_layout (3)
- Testes: subtitles (6)
- Moments
- Testes: gaming_gemini (2)
- Testes: hooks
- Testes: mcp_oauth
- App (6)
- Thumbnail
- Managed keys
- Panel layout
- App (7)
- Iniciar
- Instalar
- Subtitles (4)
- Subtitles (5)
- Pyproject

## God Nodes (most connected - your core abstractions)
1. `session()` - 52 edges
2. `get()` - 51 edges
3. `lucide-react` - 48 edges
4. `apiJson()` - 44 edges
5. `App()` - 36 edges
6. `GamingHub()` - 36 edges
7. `User` - 32 edges
8. `getApiUrl()` - 32 edges
9. `render()` - 31 edges
10. `Settings` - 30 edges

## Surprising Connections (you probably didn't know these)
- `SoftwareApplication: OpenShorts Self-hosted (MIT, price 0)` --references--> `Gemini 3.1 Flash-Lite (GEMINI_MODEL)`  [INFERRED]
  dashboard/index.html → CLAUDE.md
- `JSON-LD Structured Data Graph` --semantically_similar_to--> `Pricing Honesty Rule (never just 'free')`  [INFERRED] [semantically similar]
  dashboard/index.html → CLAUDE.md
- `Skill Rules (rights, confirm publishing, never 'free')` --semantically_similar_to--> `Pricing Honesty Rule (never just 'free')`  [INFERRED] [semantically similar]
  skills/openshorts/SKILL.md → CLAUDE.md
- `Webhook HMAC-SHA256 Verification (n8n Code node)` --conceptually_related_to--> `Webhook Delivery and Raw-body HMAC Verification`  [AMBIGUOUS]
  examples/n8n/README.md → skills/openshorts/reference.md
- `resolve_upload_post()` --calls--> `upload_post_key()`  [EXTRACTED]
  app.py → cloud/managed_keys.py

## Import Cycles
- 2-file cycle: `cloud/database.py -> cloud/models.py -> cloud/database.py`
- 2-file cycle: `cloud/__init__.py -> cloud/account.py -> cloud/__init__.py`
- 2-file cycle: `cloud/__init__.py -> cloud/api_keys.py -> cloud/__init__.py`
- 2-file cycle: `cloud/__init__.py -> cloud/auth.py -> cloud/__init__.py`
- 2-file cycle: `cloud/__init__.py -> cloud/billing.py -> cloud/__init__.py`
- 2-file cycle: `cloud/__init__.py -> cloud/digest.py -> cloud/__init__.py`
- 2-file cycle: `cloud/__init__.py -> cloud/mcp_oauth.py -> cloud/__init__.py`
- 2-file cycle: `cloud/__init__.py -> cloud/metering.py -> cloud/__init__.py`
- 2-file cycle: `cloud/__init__.py -> cloud/oauth.py -> cloud/__init__.py`
- 2-file cycle: `cloud/__init__.py -> cloud/social_profiles.py -> cloud/__init__.py`
- 2-file cycle: `cloud/__init__.py -> cloud/videos.py -> cloud/__init__.py`
- 2-file cycle: `render-service/src/render-worker.ts -> render-service/src/server.ts -> render-service/src/render-worker.ts`
- 3-file cycle: `cloud/__init__.py -> cloud/account.py -> cloud/api_keys.py -> cloud/__init__.py`
- 3-file cycle: `cloud/__init__.py -> cloud/mcp_oauth.py -> cloud/api_keys.py -> cloud/__init__.py`
- 3-file cycle: `cloud/__init__.py -> cloud/oauth.py -> cloud/auth.py -> cloud/__init__.py`
- 3-file cycle: `cloud/__init__.py -> cloud/auth.py -> cloud/api_keys.py -> cloud/__init__.py`
- 3-file cycle: `cloud/__init__.py -> cloud/auth.py -> cloud/metering.py -> cloud/__init__.py`
- 3-file cycle: `cloud/__init__.py -> cloud/billing.py -> cloud/auth.py -> cloud/__init__.py`
- 3-file cycle: `cloud/__init__.py -> cloud/videos.py -> cloud/auth.py -> cloud/__init__.py`
- 3-file cycle: `cloud/__init__.py -> cloud/videos.py -> cloud/metering.py -> cloud/__init__.py`

## Hyperedges (group relationships)
- **Pricing honesty: never describe OpenShorts as simply free** — claude_pricing_honesty_rule, skills_openshorts_skill_rules, dashboard_index_json_ld_graph, dashboard_index_cloud_service, readme_self_hosted_vs_hosted [INFERRED 0.85]
- **osk_ API key authentication across REST, MCP OAuth, CLI and n8n** — claude_api_keys_osk, claude_mcp_oauth, readme_rest_api_keys, cli_readme_auth_env_vars, examples_n8n_readme_header_auth, skills_openshorts_reference_http_reference [INFERRED 0.85]
- **Signed one-shot completion webhook contract** — claude_completion_webhooks, claude_assert_public_url, readme_completion_webhooks, cli_readme_webhook_over_wait, examples_n8n_readme_webhook_payload, skills_openshorts_reference_webhook [INFERRED 0.85]

## Communities (172 total, 29 thin omitted)

### Community 0 - "Pipeline de vídeo (main.py)"
Cohesion: 0.04
Nodes (34): analyze_scenes_strategy(), apply_watermark(), auto_caption_clip(), auto_hook_clip(), _checkpoint_source_key(), clear_transcript_checkpoint(), create_general_frame(), detect_face_candidates() (+26 more)

### Community 1 - "Servidor e fila de jobs"
Cohesion: 0.04
Nodes (47): _archive_managed_job(), _begin_drain(), cancel_job(), _check_analytics_rate(), _check_instance_marker(), _clear_resume_manifest(), _drain_then_exit(), _enqueue_job() (+39 more)

### Community 2 - "Painel Gaming (Sede, sons, util)"
Cohesion: 0.09
Nodes (74): ModuleCtx, ACTIVE, DEFAULT_FORM, GamingHub(), MODULES, stored(), VIEWS, AnalysisSection() (+66 more)

### Community 3 - "Downloads, hooks e ZIP de cortes"
Cohesion: 0.06
Nodes (41): add_hook(), _assert_job_owner(), download_all_clips(), edit_clip(), _ensure_job_files(), gemini_missing_error(), generate_effects_config(), get_clip_edl() (+33 more)

### Community 4 - "Painel original (App.jsx)"
Cohesion: 0.07
Nodes (50): App(), decrypt(), encrypt(), formatRetention(), isAutoProfileId(), pollJob(), ProfileNetworkIcons(), TikTokIcon() (+42 more)

### Community 5 - "Transcrição Whisper"
Cohesion: 0.05
Nodes (41): _configure_stdio(), get_whisper_config(), _log(), transcribe_audio(), fake_faster_whisper(), fake_parakeet(), FakeFloat, _seg() (+33 more)

### Community 6 - "Segurança e senha de acesso"
Cohesion: 0.05
Nodes (37): _assinar(), cabecalhos_seguranca(), _caminho_bloqueado(), criar_router(), _cookie(), entrar(), estado(), sair() (+29 more)

### Community 7 - "Migrações do banco (nuvem)"
Cohesion: 0.05
Nodes (18): conferir_senha(), _do_run(), run_migrations_online(), _now(), register_local_purge(), get_db(), get_sessionmaker(), AccountDeletion (+10 more)

### Community 8 - "Alertas de proxy (nuvem)"
Cohesion: 0.06
Nodes (30): _classify_failure(), _cooldown_ok(), _looks_like_proxy_error(), _probe_one(), proxy_watch_loop(), proxy_watch_tick(), record_job_outcome(), _watch_targets() (+22 more)

### Community 9 - "Gancho na tela (hooks.py)"
Cohesion: 0.07
Nodes (20): run_hook(), add_hook_to_video(), _break_long_word(), create_hook_image(), download_font_if_needed(), _draw_mixed(), _emoji_scale(), _load_emoji_font() (+12 more)

### Community 10 - "Dependências do painel"
Cohesion: 0.05
Nodes (55): dependencies, lucide-react@^0.344.0, react@^18.2.0, react-dom@^18.2.0, remotion@4.0.539, @remotion/media@4.0.539, @remotion/media-utils@4.0.539, @remotion/player@4.0.539 (+47 more)

### Community 11 - "Quem está falando (active speaker)"
Cohesion: 0.06
Nodes (16): attribute_windows(), audio_envelope(), decode_activity(), hold(), is_conversation(), mouth_region(), normalise_activity(), shares() (+8 more)

### Community 12 - "Páginas de SEO do site"
Cohesion: 0.09
Nodes (42): CANONICAL_ANSWERS, CITED_STATS, COMPARISON_ROWS, COMPETITORS, EDITIONS, PIPELINE_STEPS, SAME_AS, SITE (+34 more)

### Community 13 - "Shorts com IA (SaaS)"
Cohesion: 0.07
Nodes (24): run_analysis(), social_metrics(), _count(), analyze_saas(), composite_video(), _fal_run(), _fal_upload_file(), _format_ass_time() (+16 more)

### Community 14 - "Serviço de renderização"
Cohesion: 0.06
Nodes (42): express, @remotion/bundler, @remotion/renderer, tsx, @types/express, @types/uuid, uuid, dependencies (+34 more)

### Community 15 - "Reenquadramento v2 e FFmpeg"
Cohesion: 0.07
Nodes (21): probe_file_minutes(), escape_filter_value(), nvenc_available(), _probe_nvenc(), _analyze_trajectory(), apply_crop_overrides(), concat_list_content(), dedupe_sendcmd_lines() (+13 more)

### Community 16 - "Login OAuth do MCP (nuvem)"
Cohesion: 0.09
Nodes (25): add_query(), authorization_server(), authorize(), base_url(), _client_allows(), client_info(), consent(), consent_url() (+17 more)

### Community 17 - "Troca de versão sem parar jobs"
Cohesion: 0.06
Nodes (12): _manifest(), out(), TestDrain, scenario(), TestHeartbeat, TestReadiness, TestResumeScan, TestStatusFromDisk (+4 more)

### Community 18 - "Cobrança Stripe (nuvem)"
Cohesion: 0.10
Nodes (28): send_admin_alert(), _apply_topup(), _blocking_sub_status(), CheckoutRequest, create_checkout(), create_portal(), end_trial(), ensure_stripe_customer() (+20 more)

### Community 19 - "API Gaming e publicações"
Cohesion: 0.10
Nodes (32): approve_pub(), cancel_pub(), _check_id(), _clean_clip_file(), ClipPatch, create_game(), delete_game(), _dir_bytes() (+24 more)

### Community 20 - "Modais de legenda e gancho"
Cohesion: 0.09
Nodes (36): ENTRANCE_OPTIONS, HOOK_STYLES, HookModal(), loadHookPrefs(), POSITION_OPTIONS, SIZE_OPTIONS, RemotionPreview(), clipDurationSeconds() (+28 more)

### Community 21 - "API REST e webhooks (docs)"
Cohesion: 0.08
Nodes (39): OpenShorts REST API Endpoints, API Keys (osk_ tokens, cloud/api_keys.py), security_utils.assert_public_url, Completion Webhooks (webhook_url, X-OpenShorts-Signature), MCP Server (mcp_server.py, /mcp), Resume Manifest (.resume.json heartbeat), OPENSHORTS_API_KEY / OPENSHORTS_API_URL, OpenShorts CLI (+31 more)

### Community 22 - "Landing, login e preços"
Cohesion: 0.10
Nodes (33): LoginModal(), OAuthConsent(), readParams(), DemoFigure(), FAQItem(), FAQS, HOSTED_VS_SELF, PricingPage() (+25 more)

### Community 23 - "Biblioteca de jogos"
Cohesion: 0.10
Nodes (29): clean_prefs(), create(), delete(), display_source(), identify(), load(), _new_id(), _normalise() (+21 more)

### Community 24 - "Layout screencast"
Cohesion: 0.08
Nodes (12): content_bands(), detect_faces_full_res(), detect_screencast_scenes(), _face_centre(), overlapping_width(), screencast_filtergraph(), speaker_crop(), TestContentBands (+4 more)

### Community 25 - "Medição de uso (nuvem)"
Cohesion: 0.08
Nodes (20): _notify_clip_activity(), init_engine(), setup_async(), _active_subscription(), _balance(), _D(), free_period_end(), get_balance() (+12 more)

### Community 26 - "Vídeos e retenção (nuvem)"
Cohesion: 0.10
Nodes (20): purge_stale_deletion_records(), purge_stale_magic_tokens(), session(), send_clips_expiring_email(), is_free_user(), ClipExpiryWarning, Project, UserVideo (+12 more)

### Community 27 - "Legendas e recorte rápido"
Cohesion: 0.07
Nodes (25): add_subtitles(), run_transcribe_srt(), _archive_clip_edit_bg(), _run(), _clip_recipe_parts(), get_source_video(), _locate_source(), _probe_youtube_quality() (+17 more)

### Community 28 - "Webcam no canto (inset)"
Cohesion: 0.09
Nodes (11): detect(), inset_box(), inset_filtergraph(), is_cornered(), nearest_corner(), usable(), TestInsetBox, TestInsetFiltergraph (+3 more)

### Community 29 - "Estúdio de thumbnail"
Cohesion: 0.08
Nodes (21): test_burn_text_no_text_is_a_noop(), test_burn_text_wraps_and_stays_in_its_half(), test_finalize_cover_crops_to_1280x720_under_2mb(), test_normalise_concepts_clamps_and_pads(), test_parse_json_ignores_trailing_garbage(), test_parse_json_tolerates_fences_and_prose(), test_pick_spread_keeps_picks_apart_in_time(), test_rank_frame_rejects_tiny_faces() (+13 more)

### Community 30 - "Conta e API do painel"
Cohesion: 0.13
Nodes (27): AccountPage(), fmt1(), PAYMENT_ISSUE_STATES, ApiKeysCard(), ClipEditor(), editorReducer(), fmt(), SEGMENT_COLORS (+19 more)

### Community 31 - "Zoom nos picos (punch-in)"
Cohesion: 0.09
Nodes (9): crop_boxes(), _ease(), emphasis_times(), sendcmd_lines(), zoom_curve(), TestCropBoxes, TestEmphasisTimes, TestSendcmdLines (+1 more)

### Community 32 - "Testes de re-render"
Cohesion: 0.09
Nodes (8): fake_recut(), job(), _request(), TestGetEdl, TestMcpTool, TestRerenderPaths, TestRerenderPersistence, TestRerenderValidation

### Community 33 - "Dependências do Remotion"
Cohesion: 0.08
Nodes (34): @remotion/cli, @remotion/google-fonts, @remotion/layout-utils, dependencies, react@^18.2.0, react-dom@^18.2.0, remotion@^4.0.0, @remotion/cli@^4.0.0 (+26 more)

### Community 34 - "Diário dos agentes (pipeline)"
Cohesion: 0.12
Nodes (24): classify(), _clean(), snapshot(), cut_after(), logs(), states(), test_analysis_stage(), test_cancel_stops_agents_without_marking_them_failed() (+16 more)

### Community 36 - "Autenticação (nuvem)"
Cohesion: 0.14
Nodes (18): AttributionPayload, _clip(), CurrentUser, _decode_jwt(), get_current_user_optional(), get_current_user_required(), get_me(), issue_jwt() (+10 more)

### Community 37 - "Motor local de momentos"
Cohesion: 0.12
Nodes (17): build_copy(), detect_moments(), _excerpt(), _fit(), fmt_ts(), _norm(), _pick(), _slug_tag() (+9 more)

### Community 38 - "Layout em painéis"
Cohesion: 0.11
Nodes (8): neighbour_gaps(), panel_filtergraph(), panel_geometry(), tile_grid(), TestNeighbourClamp, TestPanelFiltergraph, TestPanelGeometry, TestTileGrid

### Community 39 - "Testes de upload por agente"
Cohesion: 0.13
Nodes (21): _client(), dirs(), _mcp(), _do(), test_auto_hook_false_opts_out(), _put(), test_auto_hook_reaches_the_job_env(), _put() (+13 more)

### Community 40 - "Arquitetura e implantação (docs)"
Cohesion: 0.09
Nodes (25): YOUTUBE_COOKIES Codespaces Secret, Async Job Queue (MAX_CONCURRENT_JOBS semaphore), Coolify Rolling Update, Core Processing Pipeline (11 steps), faster-whisper Transcription (word-level timestamps), Gemini 3.1 Flash-Lite (GEMINI_MODEL), OpenShorts AI Vertical Video Generator, PySceneDetect Scene Detection (+17 more)

### Community 41 - "Dublagem por IA"
Cohesion: 0.11
Nodes (16): run_translate(), no_sleep(), test_gives_up_after_max_attempts(), always_fails(), test_non_transient_fails_fast(), test_succeeds_after_transient_failures(), flaky(), create_dubbing_project() (+8 more)

### Community 42 - "Chaves de API osk_"
Cohesion: 0.12
Nodes (13): create_key(), CreateKeyRequest, generate_key(), hash_key(), list_keys(), looks_like_key(), _now(), revoke_key() (+5 more)

### Community 43 - "Efeitos FFmpeg por IA"
Cohesion: 0.16
Nodes (6): build_filter_string(), normalize_edits(), _zoom_term(), _edit(), TestBuildFilterString, TestNormalizeEdits

### Community 44 - "Galeria e backup S3"
Cohesion: 0.09
Nodes (12): gallery_html_page(), saasshorts_actor_gallery(), saasshorts_video_gallery(), video_html_page(), generate_presigned_url(), get_s3_client(), list_actor_gallery(), list_all_clips() (+4 more)

### Community 45 - "Openshorts cli"
Cohesion: 0.19
Nodes (14): _absolutize(), _base(), cmd_clips(), cmd_process(), cmd_publish(), cmd_quota(), cmd_status(), _die() (+6 more)

### Community 46 - "Testes: email_policy"
Cohesion: 0.11
Nodes (5): classify_mx_hosts(), mx_verdict(), TestClassifyMxHosts, TestMxVerdict, nx()

### Community 47 - "Docker-compose"
Cohesion: 0.08
Nodes (26): build, container_name, environment, ports, restart, volumes, context, dockerfile (+18 more)

### Community 48 - "Layout ranges"
Cohesion: 0.12
Nodes (9): normalise(), read(), remap(), sidecar_path(), split_ranges(), write(), TestLayoutEnvNone, TestRemapAcrossCut (+1 more)

### Community 49 - "Testes: panel_layout"
Cohesion: 0.17
Nodes (8): analyze_scene(), usable_faces(), well_separated(), face(), panel(), TestAnalyzeScene, TestUsableFaces, TestWellSeparated

### Community 50 - "Testes: mcp_endpoint"
Cohesion: 0.11
Nodes (7): _call(), _post(), TestCloudModeAuth, TestSelfHostQuota, TestToolsThroughRealEndpoints, TestTransport, TestWebhookSigning

### Community 51 - "Readme"
Cohesion: 0.08
Nodes (25): Agents Diary (Diario dos agentes), Codespaces Free Account Limits, OpenShorts Gaming Edition Codespaces Guide, GEMINI_API_KEY Codespaces Secret, Professional AI Mode (Gemini), iniciar.sh Start Script, instalar.sh Install Script, Free Local Engine (fallback) (+17 more)

### Community 52 - "Storage"
Cohesion: 0.10
Nodes (12): client(), delete_key(), delete_prefix(), download_file(), list_keys(), presigned_get(), upload_file(), user_prefix() (+4 more)

### Community 53 - "Testes: metering_free_plan"
Cohesion: 0.11
Nodes (8): _flag(), is_enabled(), validate_required(), setup_sync(), free_plan_eligible(), register(), TestFreePlanEligible, _user()

### Community 54 - "Gemini worker"
Cohesion: 0.14
Nodes (21): _calculate_cost_analysis(), _config_for_strategy(), _configure_stdio(), DetailClipModel, DetailResponse, _escape_invalid_unicode_escapes(), _extract_json_candidate(), _get_response_text() (+13 more)

### Community 55 - "Testes: email_policy (2)"
Cohesion: 0.12
Nodes (8): disposable_count(), _get_resolver(), _implicit_mx(), is_disposable(), normalize_email(), _resolve(), TestDisposable, TestNormalize

### Community 56 - "Testes: ffmpeg_utils"
Cohesion: 0.12
Nodes (13): EditDecision, EditPlan, reset_encoder_cache(), video_encode_args(), _clean_encoder_state(), test_auto_probes_only_once(), test_default_args_pin_historical_x264_settings(), test_encode_args_stay_free_of_metadata_flags() (+5 more)

### Community 57 - "Ci"
Cohesion: 0.10
Nodes (23): runs-on, steps, run, defaults, runs-on, steps, jobs, backend-tests (+15 more)

### Community 58 - "Testes: account_erasure"
Cohesion: 0.10
Nodes (8): _cancel_subscriptions(), delete_account(), DeleteAccountRequest, _session_user(), _config(), _post(), track(), TestStripeCancel

### Community 59 - "Recut"
Cohesion: 0.12
Nodes (8): _uuid(), audio_encode_args(), concat_command(), cut_commands(), RecutError, run_cut_concat(), _run_ffmpeg(), TestFfmpegCommands

### Community 60 - "Testes: gaming_moments"
Cohesion: 0.24
Nodes (19): add_event(), quiet_features(), run(), test_a_gameplay_where_nothing_happens_yields_no_clips(), test_a_scream_alone_counts_because_it_is_far_louder_than_talking(), test_a_sentence_after_a_pause_is_not_a_moment(), test_audio_and_visual_evidence_together_make_a_clip_around_the_event(), test_every_clip_carries_what_the_panel_and_the_networks_need() (+11 more)

### Community 61 - "Testes: speaker_tracker"
Cohesion: 0.18
Nodes (5): _face(), _lock_onto(), TestJumpConfirmation, TestSwitchCooldown, _tracker()

### Community 62 - "Testes: hook_layers"
Cohesion: 0.16
Nodes (6): _canonical_clip_file(), _strip_burned_hook(), TestCanonicalClipFile, TestLayerChain, TestStripBurnedHook, _touch()

### Community 63 - "Metering"
Cohesion: 0.12
Nodes (8): _deliver_webhook(), _sign_webhook(), _ffprobe_url_seconds(), plan_probe_proxies(), probe_url_minutes(), assert_public_url(), _ip_is_public(), UnsafeURLError

### Community 64 - "Editor"
Cohesion: 0.13
Nodes (3): run_edit(), run_effects_generation(), VideoEditor

### Community 65 - "Testes: account_local_purge"
Cohesion: 0.17
Nodes (7): _owned_by(), _purge_local_jobs_for_user(), TestClipJobs, TestOtherStores, TestPathTraversal, workdir(), _write()

### Community 66 - "Design"
Cohesion: 0.12
Nodes (14): seo/landing-fallback.js (#root fallback content), vite-plugin-seo.js (build-time SEO), Dashboard HTML Entry (index.html), Lumen Fonts (Instrument Serif, Geist, JetBrains Mono), OpenPanel Analytics (opt-in), #root Mount Point, AI Crawlers (GPTBot, ClaudeBot, PerplexityBot, ...), Sitemap (www.openshorts.app/sitemap.xml) (+6 more)

### Community 67 - "Testes: gaming_api"
Cohesion: 0.14
Nodes (16): aggregate_post_metrics(), job_env(), _metric(), parse_gaming(), out(), test_defaults_use_gemini_only_when_a_key_exists(), test_invalid_requests_are_rejected_with_a_400(), test_layout_options_map_to_render_strategies() (+8 more)

### Community 68 - "App"
Cohesion: 0.10
Nodes (15): CaptionWordIn, EditRequest, EffectsGenerateRequest, HookRequest, ProcessRequest, RerenderSegment, SaaSActorRequest, SaaSAnalyzeRequest (+7 more)

### Community 69 - "Testes: billing_states"
Cohesion: 0.14
Nodes (5): _entitles(), _sub(), TestAttentionStates, TestCheckoutBlockingStates, TestEntitles

### Community 70 - "Gemini judge"
Cohesion: 0.15
Nodes (14): apply_corrections(), apply_verdict(), build_candidates(), _clean_tags(), Correction, explain_error(), _frames(), judge() (+6 more)

### Community 71 - "Types"
Cohesion: 0.11
Nodes (17): captionWordSchema, effectsConfigSchema, effectSegmentSchema, hookConfigSchema, HookEntrance, HookPosition, HookSize, HookStyle (+9 more)

### Community 73 - "Testes: social_tenant_isolation"
Cohesion: 0.13
Nodes (4): resolve_post_profile(), TestResolvePostProfileInCloud, TestResolvePostProfileSelfHosted, TestScheduledPostsAreFilteredByProfile

### Community 74 - "Claude"
Cohesion: 0.16
Nodes (17): ALTERNATE Mode (active_speaker.py), Captions on the Seam (subtitles.generate_ass), ElevenLabs Voice Dubbing, GENERAL Mode (blurred background), INSET Mode (camera_inset.py), Layout Picker (layout_picker.py), layout_ranges Sidecar (<clip>.layout.json), Per-job Layout Selection (layouts param) (+9 more)

### Community 75 - "Docker-compose.cloud"
Cohesion: 0.10
Nodes (19): depends_on, environment, condition, container_name, environment, healthcheck, image, restart (+11 more)

### Community 76 - "Testes: gemini_retry"
Cohesion: 0.16
Nodes (13): _BlockedResponse, _PF, _Reason, _client(), _FakeModels, _no_sleep(), test_gives_up_after_three_attempts(), test_non_transient_errors_are_not_retried() (+5 more)

### Community 77 - "Subtitles"
Cohesion: 0.15
Nodes (7): run_burn(), burn_subtitles(), _clamp_number(), _dim_hex_color(), hex_to_ass_color(), _sanitize_font_name(), TestStyleSanitizing

### Community 78 - "Videoeffects"
Cohesion: 0.19
Nodes (13): renderInBrowser(), ShortVideo(), getInterpolatedValues(), InterpolatedValues, lerp(), lerpFromDefaults(), lerpSegments(), lerpToDefaults() (+5 more)

### Community 79 - "Pipeline"
Cohesion: 0.14
Nodes (12): describe_probe(), probe_summary(), _run(), self_test(), encoders_ok(), ffmpeg_ok(), ffprobe_ok(), probe_ok() (+4 more)

### Community 80 - "Testes: mcp_protocol"
Cohesion: 0.17
Nodes (5): _err_tool(), _run(), TestInitialize, TestNotificationsAndErrors, TestTools

### Community 81 - "Testes: mcp_ui"
Cohesion: 0.21
Nodes (5): _req(), _run(), TestResourceSurface, TestToolWiring, fake()

### Community 82 - "Requirements-billing"
Cohesion: 0.15
Nodes (14): OAuth for MCP Clients (cloud/mcp_oauth.py), USER_OWNED_TABLES, Disposable Email Domain Blocklist, Observed Abusive Sign-up Domains (onldm.net, ...), disposable-email-domains Upstream Project, alembic 1.14.0, asyncpg 0.30.0, authlib 1.3.2 (+6 more)

### Community 83 - "Testes: split_layout"
Cohesion: 0.29
Nodes (4): analyze_scene(), face(), TestAnalyzeScene, two_shot()

### Community 84 - "Testes: subtitles"
Cohesion: 0.29
Nodes (4): _escape_ass_text(), generate_ass(), TestGenerateAss, _w()

### Community 85 - "Testes: process_handover"
Cohesion: 0.19
Nodes (11): dirs(), _post_process(), session(), _submitted_job(), test_empty_transcript_is_not_forwarded(), test_handover_links_source_and_transcript(), test_handover_still_requires_attestation(), test_handover_without_ready_transcript_still_processes() (+3 more)

### Community 86 - "Testes: transcript_checkpoint"
Cohesion: 0.21
Nodes (5): _load(), _save(), TestNeverTheWrongTranscript, TestRobustness, TestRoundTrip

### Community 87 - "App (2)"
Cohesion: 0.12
Nodes (10): _check_probe_rate(), layout_env(), _maybe_send_quota_email(), _media_duration_seconds(), process_endpoint(), put_upload(), _reject_short_source(), reserve_process_minutes() (+2 more)

### Community 88 - "Emails"
Cohesion: 0.17
Nodes (7): _notify_clips_ready(), send_account_deleted_email(), send_clips_ready_email(), send_email(), send_magic_link_email(), send_out_of_minutes_email(), _send_sync()

### Community 89 - "App (3)"
Cohesion: 0.13
Nodes (10): run(), _rm_under(), SaaSGenerateRequest, saasshorts_generate(), run_generation(), log_msg(), run(), _safe_under() (+2 more)

### Community 90 - "Social profiles"
Cohesion: 0.18
Nodes (8): _delete_upload_post_profile(), UploadPostProfile, _auth_headers(), _create_remote_profile(), ensure_profile(), get_connect_url(), profile_username_for(), social_connect()

### Community 91 - "Testes: gaming_thumbs"
Cohesion: 0.19
Nodes (10): best_frame(), make(), render(), _wrap(), clip(), test_picks_a_lit_sharp_frame_not_a_black_one(), test_thumbnail_keeps_the_clip_size_and_writes_a_jpeg(), test_title_is_actually_drawn() (+2 more)

### Community 92 - "Testes: layout_picker"
Cohesion: 0.17
Nodes (5): pick(), sample_frames(), TestPick, TestSampleFrames, _frame_parts()

### Community 93 - "Mcp server"
Cohesion: 0.17
Nodes (10): www_authenticate(), _authorized(), _billing_enabled(), call_tool(), _client(), handle_message(), mcp_endpoint(), tool_caller() (+2 more)

### Community 94 - "Testes: clip_selection"
Cohesion: 0.21
Nodes (5): build_transcript_windows(), compact_words(), _seg(), TestBuildTranscriptWindows, TestCompactWords

### Community 95 - "Testes: layout_picker (2)"
Cohesion: 0.23
Nodes (5): apply(), pick_and_apply(), fake_modules(), TestApply, TestShadowMode

### Community 96 - "Videoeffects (2)"
Cohesion: 0.23
Nodes (13): HookOverlay(), ShortVideo(), Subtitles(), getInterpolatedValues(), InterpolatedValues, lerp(), lerpFromDefaults(), lerpSegments() (+5 more)

### Community 97 - "Testes: filename_limits"
Cohesion: 0.12
Nodes (3): TestHookTempName, TestSanitizeFilename, TestTruncateBytes

### Community 98 - "Testes: short_source_gate"
Cohesion: 0.23
Nodes (10): dirs(), _post_process(), _stub_probe(), test_gate_disabled_lets_short_sources_through(), test_long_url_source_passes(), test_short_thumbnail_session_is_rejected(), test_short_upload_is_rejected_and_cleaned_up(), test_short_url_rejected_even_with_force_low_quality() (+2 more)

### Community 99 - "Testes: clip_selection (2)"
Cohesion: 0.20
Nodes (3): clip_count_targets(), TestClipCountTargets, TestDetailPromptCarriesTheCount

### Community 100 - "Subtitles (2)"
Cohesion: 0.25
Nodes (13): POSITION_MAP, SubtitleBlock(), SubtitleBlockProps, Subtitles(), SubtitlesProps, WordSpan(), WordSpanProps, CaptionBlock (+5 more)

### Community 101 - "Types (2)"
Cohesion: 0.13
Nodes (14): captionWordSchema, effectsConfigSchema, effectSegmentSchema, hookConfigSchema, HookEntrance, HookPosition, HookSize, HookStyle (+6 more)

### Community 102 - "Mcp server (2)"
Cohesion: 0.22
Nodes (11): _api_error(), _clip_summaries(), mcp_get(), _tool_add_subtitles(), _tool_create_upload(), _tool_get_job_status(), _tool_get_quota(), _tool_list_clips() (+3 more)

### Community 103 - "Testes: recut"
Cohesion: 0.16
Nodes (3): _main_attr(), perform_recut(), TestPerformRecut

### Community 104 - "Testes: recut (2)"
Cohesion: 0.25
Nodes (4): normalize_segments(), _seg(), TestNormalizeSegments, TestVirtualTranscript

### Community 105 - "Tsconfig"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+6 more)

### Community 106 - "Testes: clip_ready_marker"
Cohesion: 0.18
Nodes (3): _feed(), TestClipReadyMarker, TestMainAnnouncesTheDeliveredFile

### Community 107 - "Testes: gaming_gemini"
Cohesion: 0.24
Nodes (10): _Client, _pool(), test_corrections_keep_timings(), test_judge_failure_keeps_local(), test_judge_sends_frames_and_returns_clips(), test_no_key_means_local(), test_rejected_or_low_scores_are_dropped(), test_verdict_is_validated() (+2 more)

### Community 108 - "Sedemap"
Cohesion: 0.23
Nodes (10): LOOK, buildSphere(), JarvisOrb(), AgentRoom(), BADGE, CORE_BADGE, lineStyle(), SedeMap() (+2 more)

### Community 109 - "Hookoverlay"
Cohesion: 0.20
Nodes (12): HOOK_LOOKS, HookBox(), HookBoxProps, HookLook, HookOverlay(), HookOverlayProps, POSITION_STYLE, SIZE_SCALE (+4 more)

### Community 110 - "Profiles"
Cohesion: 0.16
Nodes (9): dashboard(), gaming_meta(), category(), category_list(), match_moments(), moment_list(), strip_accents(), gaming_transcription_hints() (+1 more)

### Community 111 - "Hookoverlay (2)"
Cohesion: 0.20
Nodes (12): HOOK_LOOKS, HookBox(), HookBoxProps, HookLook, HookOverlayProps, POSITION_STYLE, SIZE_SCALE, textStroke() (+4 more)

### Community 112 - "Subtitles (3)"
Cohesion: 0.25
Nodes (12): POSITION_MAP, SubtitleBlock(), SubtitleBlockProps, SubtitlesProps, WordSpan(), WordSpanProps, CaptionBlock, getActiveWordIndex() (+4 more)

### Community 113 - "Tsconfig (2)"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, jsx, module, moduleResolution, outDir (+5 more)

### Community 114 - "Scene detection"
Cohesion: 0.20
Nodes (6): _detect_pyscenedetect(), detect_scenes(), _detect_transnetv2(), _extract_frames_small(), _get_tn2_model(), _merge_short_scenes()

### Community 115 - "Split layout"
Cohesion: 0.16
Nodes (6): as_box(), _centre(), dedupe_faces(), detect_split_scenes(), _iou(), _two_largest()

### Community 116 - "Testes: reframe_endpoint"
Cohesion: 0.22
Nodes (4): _request(), TestReframeRender, TestReframeValidation, TestRerenderClearsSceneOverrides

### Community 117 - "Testes: sparse_speech"
Cohesion: 0.21
Nodes (4): _t(), TestEdges, TestRealFailures, TestRealSpeechIsKept

### Community 118 - "Log view"
Cohesion: 0.27
Nodes (8): friendly_log_line(), friendly_logs(), _strip_paths(), test_consecutive_duplicates_collapse(), test_errors_kept_without_paths(), test_no_paths_ever_leak(), test_real_job_produces_clean_user_view(), test_technical_lines_are_hidden()

### Community 119 - "Testes: recut (3)"
Cohesion: 0.21
Nodes (4): snap_segments(), transcript_words(), TestSnapSegments, TestTranscriptWords

### Community 121 - "App (4)"
Cohesion: 0.17
Nodes (7): create_upload(), delete_upload(), _owner_id(), thumbnail_titles(), ThumbnailTitlesRequest, _upload_url_base(), refine_titles()

### Community 122 - "Testes: gemini_block_split"
Cohesion: 0.21
Nodes (6): GeminiBlockedError, raise_if_blocked(), test_block_on_pair_isolates_and_drops_only_the_culprit(), fake_stage(), test_no_block_is_a_single_call(), _windows()

### Community 123 - "Testes: reframe_endpoint (2)"
Cohesion: 0.17
Nodes (3): fake_recut(), job(), TestApplyCropOverrides

### Community 124 - "Testes: scene_cut_reset"
Cohesion: 0.36
Nodes (5): _box(), _cam(), _settle(), TestCameramanBeginScene, TestTrackerReset

### Community 125 - "App (5)"
Cohesion: 0.22
Nodes (6): cleanup_jobs(), _dir_size(), _enforce_output_size_cap(), _enforce_uploads_size_cap(), _protected_output_dirs(), _sweep_pending_uploads()

### Community 126 - "Testes: recut (4)"
Cohesion: 0.22
Nodes (4): run_recut(), rebase_segments(), within_range(), TestRangeMath

### Community 127 - "Testes: generation_controls"
Cohesion: 0.25
Nodes (3): _clean_env(), _templates(), TestPromptTemplates

### Community 128 - "Claude (2)"
Cohesion: 0.18
Nodes (10): GEMINI_IMAGE_MODEL (gemini-3.1-flash-image), GEMINI_MODEL_THUMBNAIL (gemini-3.7-flash), GET /api/thumbnail/frames/{session}, Thumbnail Studio (thumbnail.py, /api/thumbnail/*), Shared Component Recipes (.card, .eyebrow, .readout), <Modal> (src/components/ui/Modal.jsx), <SegmentedControl> (src/components/ui/SegmentedControl.jsx), <StepIndicator> (ThumbnailStudio + SaaShortsTab) (+2 more)

### Community 130 - "Signals"
Cohesion: 0.25
Nodes (6): signals_ok(), audio_features(), Cancelled, _ffmpeg_stream(), media_duration(), visual_features()

### Community 131 - "Testes: layout_picker (3)"
Cohesion: 0.25
Nodes (3): _module_flags(), TestDecisionMapping, TestValidDecisions

### Community 132 - "Testes: subtitles (2)"
Cohesion: 0.25
Nodes (4): _collect_word_blocks(), merge_continuation_words(), _normalize_subtitle_word(), TestMergeContinuationWords

### Community 133 - "Index"
Cohesion: 0.22
Nodes (6): seo/data.js (pricing single source of truth), Service: OpenShorts Cloud (AggregateOffer $12-$59), Organization: OpenShorts, SoftwareApplication: OpenShorts Self-hosted (MIT, price 0), NVIDIA GPU Acceleration (NVENC, CUDA), Parakeet Transcription Backend (TRANSCRIBE_BACKEND)

### Community 134 - "Testes: clip_selection (3)"
Cohesion: 0.38
Nodes (3): snap_clip_to_words(), TestSnapClipToWords, _word()

### Community 135 - "Server"
Cohesion: 0.20
Nodes (9): description, name, remotes, repository, source, url, $schema, version (+1 more)

### Community 137 - "Testes: subtitles (3)"
Cohesion: 0.29
Nodes (3): format_srt_block(), generate_srt(), TestGenerateSrt

### Community 140 - "Testes: account_erasure (2)"
Cohesion: 0.31
Nodes (3): email_fingerprint(), _erase_rows(), TestEmailFingerprint

### Community 141 - "Digest"
Cohesion: 0.36
Nodes (6): send_telegram(), _digest_loop(), _format(), send_daily_digest(), start_digest(), _window_stats()

### Community 142 - "Testes: layout_ranges"
Cohesion: 0.31
Nodes (3): TestCaptionerReadsSidecar, TestSeamCaptions, _transcript()

### Community 143 - "Docker-compose.e2e.local"
Cohesion: 0.25
Nodes (7): environment, ports, environment, ports, services, backend, frontend

### Community 144 - "Gaming api"
Cohesion: 0.25
Nodes (6): all_clips(), _clip_url(), _gaming_jobs(), _job_layout(), write_job_config(), test_job_config_records_what_was_asked()

### Community 148 - "Resultsboard"
Cohesion: 0.38
Nodes (6): Kpi(), NET_COLOR, NET_ICON, Node(), ResultsBoard(), ROWS

### Community 149 - "Main"
Cohesion: 0.38
Nodes (5): get_viral_clips(), _detail_prompt(), _payload(), _score_prompt(), _run_stage_split()

### Community 156 - "Moments"
Cohesion: 0.40
Nodes (3): has_evidence(), test_evidence_gate(), test_exceptional_loudness_stands_alone()

### Community 157 - "Testes: gaming_gemini (2)"
Cohesion: 0.40
Nodes (3): _Resp, test_blocked_finish_reason_also_raises(), test_clean_response_is_not_flagged_as_blocked()

### Community 161 - "Thumbnail"
Cohesion: 0.50
Nodes (3): run_background_whisper(), transcribe_video(), analyze_video_for_titles()

## Ambiguous Edges - Review These
- `faster-whisper Transcription (word-level timestamps)` → `py3langid 0.3.0`  [AMBIGUOUS]
  requirements.txt · relation: conceptually_related_to
- `Closed-choice Decision over Continuous Measurement` → `SCREENCAST / WIDE Modes (screencast_layout.py)`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to
- `Video Reframing Modes` → `FAQPage Structured Data`  [AMBIGUOUS]
  dashboard/index.html · relation: conceptually_related_to
- `Self-hosted vs Hosted Editions` → `Skill Rules (rights, confirm publishing, never 'free')`  [AMBIGUOUS]
  skills/openshorts/SKILL.md · relation: conceptually_related_to
- `Built-in MCP Server (mcp.openshorts.app/mcp)` → `MCP Tools (seven listed)`  [AMBIGUOUS]
  skills/openshorts/SKILL.md · relation: conceptually_related_to
- `Webhook HMAC-SHA256 Verification (n8n Code node)` → `Webhook Delivery and Raw-body HMAC Verification`  [AMBIGUOUS]
  examples/n8n/README.md · relation: conceptually_related_to

## Knowledge Gaps
- **26 isolated node(s):** `openshorts`, `Codespaces Free Account Limits`, `Private Dashboard Port 5173`, `Free Local Engine (fallback)`, `GEMINI_API_KEY Codespaces Secret` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1174 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `VideoEditor` connect `Editor` to `Testes: ffmpeg_utils`, `Servidor e fila de jobs`, `Downloads, hooks e ZIP de cortes`, `Testes: gemini_retry (2)`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `session()` (e.g. with `get_current_user_optional()` and `get_me()`) actually correct?**
  _`session()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `openshorts`, `Codespaces Free Account Limits`, `Private Dashboard Port 5173` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Pipeline de vídeo (main.py)` be split into smaller, more focused modules?**
  _Cohesion score 0.03557422969187675 - nodes in this community are weakly interconnected._
- **Why does `get_current_user_required()` connect `Autenticação (nuvem)` to `Servidor e fila de jobs`, `Downloads, hooks e ZIP de cortes`, `Vídeos e retenção (nuvem)`, `Social profiles`, `Migrações do banco (nuvem)`, `Chaves de API osk_`, `Login OAuth do MCP (nuvem)`, `Cobrança Stripe (nuvem)`, `Testes: account_erasure`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `faster-whisper Transcription (word-level timestamps)` and `py3langid 0.3.0`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Closed-choice Decision over Continuous Measurement` and `SCREENCAST / WIDE Modes (screencast_layout.py)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._