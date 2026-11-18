import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, CalendarClock, KeyRound, Cpu, Eye, Film, Gamepad2, History, Layers, Moon, MoreVertical, Scissors, Settings,
  Share2, SlidersHorizontal, Sun, Terminal, Type, Upload, Volume2, VolumeX,
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';
import { errText, JOB_KEY } from './util';
import { ModuleCtx } from './ctx';
import { enviarVideo, mensagemHttp } from './envio';
import { Notice } from './ui';
import SedeMap from './SedeMap';
import Configuracoes from './Configuracoes';
import { NOME_KEY, nomeSalvo } from './nome';
import JarvisOrb from './JarvisOrb';
import { iniciarZumbido, pararZumbido, setSom, somConcluido, somFalha, somFinal, somInicio, somLigado } from './sons';
import { ClipsStrip, ConsolePanel, OrchestratorPanel, PipelineView, PreviewPanel, Toast } from './SedePanels';
import { AnalysisSection, DashboardSection, GamesSection, ImportSection } from './SectionsCore';
import { ClipsSection, EditorSection, SubtitlesSection, VideoLibrarySection } from './SectionsMedia';
import { ConfigSection, HistorySection, ScheduleSection, SocialSection } from './SectionsPublish';
import './sede.css';

const MODULES = [
  { id: 'dashboard', label: 'Painel Geral', icon: BarChart3 },
  { id: 'games', label: 'Biblioteca de Jogos', icon: Gamepad2 },
  { id: 'import', label: 'Importação de Gameplays', icon: Upload },
  { id: 'analysis', label: 'Análise Inteligente', icon: Eye },
  { id: 'clips', label: 'Cortes Encontrados', icon: Scissors },
  { id: 'editor', label: 'Editor de Vídeos 9:16', icon: SlidersHorizontal },
  { id: 'subtitles', label: 'Legendas PT-BR', icon: Type },
  { id: 'videos', label: 'Biblioteca de Vídeos', icon: Film },
  { id: 'social', label: 'Redes Sociais', icon: Share2 },
  { id: 'schedule', label: 'Agendamentos', icon: CalendarClock },
  { id: 'history', label: 'Histórico & Registros', icon: History },
  { id: 'config', label: 'Chaves e Integrações', icon: KeyRound },
];
const MODULE_HINT = 'Módulo integrado ao fluxo local OpenShorts Gaming Edition (Windows + Docker Desktop).';

const VIEWS = [
  { id: 'hq', label: 'Sede', icon: Cpu, hint: 'Sala virtual: os agentes trabalhando' },
  { id: 'modules', label: 'Módulos', icon: Layers, hint: 'Os 12 módulos: cortes, editor, legendas, redes sociais…' },
  { id: 'pipeline', label: 'Fluxo', icon: Terminal, hint: 'Etapas do processamento e registros completos' },
];

const DEFAULT_FORM = {
  file: null, url: '', game_id: 'auto', category: 'other', clip_seconds: 30, layout: 'auto',
  engine: 'auto', max_clips: 10, fill: true, min_score: 30, captions: true, zoom: true, auto_hook: true,
  acknowledged: false,
};

const ACTIVE = ['queued', 'processing'];
const GPU_ENCODER = /nvenc|qsv|vaapi|amf|videotoolbox/i;
const stored = (k, fallback, allowed) => {
  const v = localStorage.getItem(k);
  return v && (!allowed || allowed.includes(v)) ? v : fallback;
};

// OpenShorts Gaming Edition — Sede Virtual. One screen: the eight agents are
// the real pipeline stages of the backend, the console is its real output, and
// the twelve modules reuse the same endpoints as the rest of the dashboard.
export default function GamingHub({ apiKey, uploadPostKey, uploadUserId, keys }) {
  const [theme, setTheme] = useState(() => stored('os_sede_theme', 'classic', ['classic', 'nova']));
  const [view, setView] = useState(() => stored('os_sede_view', 'hq', [...VIEWS.map((v) => v.id), 'settings']));
  const [section, setSection] = useState(() => stored('os_gaming_section', 'dashboard', MODULES.map((m) => m.id)));
  const [meta, setMeta] = useState(null);
  const [system, setSystem] = useState(null);
  const [bootAt, setBootAt] = useState(null);
  const [games, setGames] = useState(null);
  const [dash, setDash] = useState(null);
  const [clips, setClips] = useState(null);
  const [pubs, setPubs] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [job, setJob] = useState(() => {
    const id = localStorage.getItem(JOB_KEY);
    return id ? { id, status: 'processing', snap: null, restoring: true } : null;
  });
  const [selected, setSelected] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const lastReady = useRef(0);
  const watching = useRef(false);   // true once this tab has seen the job running

  const pickTheme = (t) => { setTheme(t); localStorage.setItem('os_sede_theme', t); };
  const pickView = useCallback((v) => { setView(v); localStorage.setItem('os_sede_view', v); }, []);
  const go = useCallback((id) => {
    setSection(id); localStorage.setItem('os_gaming_section', id);
    setView('modules'); localStorage.setItem('os_sede_view', 'modules');
    window.scrollTo({ top: 0 });
  }, []);
  const goHQ = useCallback(() => { pickView('hq'); window.scrollTo({ top: 0 }); }, [pickView]);

  const loadGames = useCallback(() => apiJson('/api/games').then((d) => setGames(d.games)), []);
  const loadDash = useCallback(() => apiJson('/api/gaming/dashboard').then(setDash), []);
  const loadClips = useCallback(() => apiJson('/api/gaming/clips').then((d) => setClips(d.clips)), []);
  const loadPubs = useCallback(() => apiJson('/api/gaming/publications').then((d) => setPubs(d.items)), []);
  const loadSystem = useCallback(() => apiJson('/api/gaming/system').then((d) => { setSystem(d); setBootAt((t) => t || Date.now() / 1000); }), []);
  const reloadAll = useCallback(
    () => Promise.all([loadGames(), loadDash(), loadClips(), loadPubs(), loadSystem()])
      .then(() => setLoadError(''))
      .catch((e) => setLoadError(`Não foi possível falar com o servidor (${errText(e)}). Verifique se o OpenShorts está em execução.`)),
    [loadGames, loadDash, loadClips, loadPubs, loadSystem],
  );

  useEffect(() => {
    apiJson('/api/gaming/meta').then(setMeta).catch(() => {});
    reloadAll();
  }, [reloadAll]);

  // Follow the tracked job through the per-agent pipeline endpoint. A finished
  // job is fetched once, so the room still shows what the agents did.
  const jobId = job?.id;
  const jobActive = !!job && ACTIVE.includes(job.status);
  useEffect(() => {
    if (!jobId || !jobActive) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const res = await apiFetch(`/api/gaming/pipeline/${jobId}`);
        if (stop) return;
        if (res.status === 404) {
          localStorage.removeItem(JOB_KEY);
          setJob(null);
          return;
        }
        if (!res.ok) return;
        const d = await res.json();
        const isActive = ACTIVE.includes(d.status);
        if (isActive) watching.current = true;
        setJob({ id: jobId, status: d.status, snap: d });
        const ready = d.clips?.ready || 0;
        if (ready !== lastReady.current) { lastReady.current = ready; loadClips().catch(() => {}); }
        if (!isActive) {
          setCancelling(false);
          reloadAll();
          if (watching.current) {
            watching.current = false;
            if (d.status === 'completed') setToast({ text: `Processamento concluído! ${d.clips?.total ?? ready} corte(s) pronto(s) para revisão.` });
            else if (d.status === 'failed') setToast({ tone: 'error', text: 'O processamento falhou. Veja o motivo no terminal.' });
          }
        }
      } catch { /* transient network error: the next tick retries */ }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { stop = true; clearInterval(t); };
  }, [jobId, jobActive, loadClips, reloadAll]);

  const [uploadPct, setUploadPct] = useState(null);
  const start = async (file) => {
    setStarting(true); setStartError(''); setUploadPct(null);
    try {
      const f = file || form.file;
      const gaming = {
        game_id: form.game_id, category: form.category, engine: form.engine, layout: form.layout,
        clip_seconds: Number(form.clip_seconds), max_clips: Number(form.max_clips),
        min_score: Number(form.min_score), zoom: !!form.zoom, fill: form.fill !== false,
      };
      const headers = { 'Content-Type': 'application/json', ...(apiKey ? { 'X-Gemini-Key': apiKey } : {}) };
      const common = {
        acknowledged: true, output_format: 'vertical', captions: form.captions,
        auto_hook: form.auto_hook ? '1' : '0', force_low_quality: true, gaming,
      };
      let source;
      if (f) {
        // In parts: one big request is refused by Codespaces ("413").
        const uploadId = await enviarVideo(f, setUploadPct);
        source = { upload_id: uploadId };
      } else {
        source = { url: form.url.trim() };
      }
      const res = await apiFetch('/api/process', { method: 'POST', headers, body: JSON.stringify({ ...source, ...common }) });
      const text = await res.text();
      let d = {};
      try { d = JSON.parse(text); } catch { /* non-JSON error body */ }
      if (!res.ok) throw new Error(mensagemHttp(res.status, text));
      localStorage.setItem(JOB_KEY, d.job_id);
      lastReady.current = 0;
      watching.current = true;
      setSelected(null);
      setJob({ id: d.job_id, status: 'queued', snap: null });
      setForm((p) => ({ ...p, file: null, url: '' }));
      goHQ();
    } catch (e) { setStartError(errText(e)); } finally { setStarting(false); setUploadPct(null); }
  };

  const cancel = async () => {
    if (!window.confirm('Cancelar o processamento em andamento?\n\nO vídeo original e os cortes já prontos são preservados.')) return;
    setCancelling(true);
    try { await apiJson(`/api/jobs/${job.id}/cancel`, { method: 'POST' }); }
    catch (e) { setCancelling(false); setStartError(errText(e)); }
  };

  const pick = (c) => setSelected({ job_id: c.job_id, clip_index: c.clip_index });
  const openEditor = (c) => { pick(c); go('editor'); };
  const openSubs = (c) => { pick(c); go('subtitles'); };
  const reloadMedia = useCallback(() => Promise.all([loadClips(), loadDash()]), [loadClips, loadDash]);

  // Agents: the tracked job's real states, or the idle roster from the backend.
  const snap = job?.snap;
  const agents = useMemo(() => {
    const base = snap?.agents || (meta?.agents || []).map((a) => ({ ...a, state: 'idle' }));
    const gpu = GPU_ENCODER.test(system?.encoder || '');
    return base.map((a) => (a.id === 'editor916' && system ? { ...a, role: `${a.role} ${gpu ? 'GPU' : 'CPU'}` } : a));
  }, [snap, meta, system]);
  const roles = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a.role])), [agents]);
  const working = agents.filter((a) => a.state === 'working').length;

  // Sounds: react to real state changes of the tracked job (never on the
  // first snapshot, so reopening a finished job stays silent).
  const [som, setSomState] = useState(somLigado);
  const [nome, setNome] = useState(nomeSalvo);
  const pickNome = (n) => { setNome(n); try { localStorage.setItem(NOME_KEY, n); } catch (_) { /* private mode */ } };
  const pickSom = (v) => { setSom(v); setSomState(v); };
  useEffect(() => { document.title = nome; }, [nome]);
  const prevStates = useRef(null);
  const prevStatus = useRef(null);
  useEffect(() => {
    const now = Object.fromEntries(agents.map((a) => [a.id, a.state]));
    const before = prevStates.current;
    prevStates.current = now;
    if (!before || !som) return;
    for (const a of agents) {
      if (a.state === before[a.id]) continue;
      if (a.state === 'working') somInicio(a.id);
      else if (a.state === 'done' && before[a.id] === 'working') somConcluido(a.id);
    }
  }, [agents, som]);
  useEffect(() => {
    if (som && working > 0) iniciarZumbido(); else pararZumbido();
  }, [working, som]);
  useEffect(() => () => pararZumbido(), []);
  useEffect(() => {
    const st = job?.status;
    const before = prevStatus.current;
    prevStatus.current = st;
    if (!som || !before || before === st) return;
    if (st === 'completed' && ACTIVE.includes(before)) somFinal();
    if (st === 'failed' && ACTIVE.includes(before)) somFalha();
  }, [job?.status, som]);
  const toggleSom = () => { const v = !som; setSom(v); setSomState(v); };
  const core = job?.status === 'queued' ? 'queued' : jobActive ? 'working' : job?.status === 'failed' ? 'failed' : 'idle';

  const details = useMemo(() => {
    const pending = (pubs || []).filter((p) => p.status === 'aguardando_aprovacao').length;
    return {
      library: games && meta ? `${games.length} jogos cadastrados em ${meta.categories.length} categorias.` : '',
      ingest: 'Aceita MP4, MKV, MOV, WebM e links.',
      whisper: system ? `Modelo ${system.whisper_model} (${system.whisper_device}).` : '',
      vision: 'Motor local, sem custo de API.',
      slicer: meta ? `Durações: ${meta.durations.join(', ')} s ou personalizada.` : '',
      editor916: system ? `Codificador ${system.encoder}.` : '',
      captions: 'Destaque palavra por palavra em PT-BR.',
      social: `${pending} publicação(ões) aguardando aprovação.`,
    };
  }, [games, meta, system, pubs]);

  // Console: what the backend really reported. Boot facts first, then the job.
  const consoleLines = useMemo(() => {
    const boot = [];
    if (system && bootAt) {
      boot.push({ t: bootAt, level: 'info', text: 'Conectado ao servidor. Agentes prontos.' });
      boot.push(system.ffmpeg
        ? { t: bootAt, level: 'ok', text: `Editor de vídeo pronto (${system.ffmpeg.replace(/ Copyright.*/, '').replace(/^ffmpeg version /, 'FFmpeg ')}, ${system.encoder}).` }
        : { t: bootAt, level: 'error', text: 'FFmpeg não encontrado no servidor.' });
      boot.push({ t: bootAt, level: 'ok', text: `Transcrição pronta (Whisper ${system.whisper_model}, ${system.whisper_device === 'cpu' ? 'processador' : system.whisper_device}).` });
      boot.push({ t: bootAt, level: 'info', text: `${system.games} jogos na biblioteca. Tudo processado sem custo de API.` });
      if (!snap) boot.push({ t: bootAt, level: 'info', text: 'Aguardando uma gameplay. Use o painel acima para começar.' });
    }
    const lines = [...boot, ...(snap?.console || [])];
    if (snap?.error && !ACTIVE.includes(snap.status)) lines.push({ t: null, level: 'error', text: snap.error });
    return lines;
  }, [system, bootAt, snap]);

  // HQ strip: the tracked job's clips, else the most recent job's.
  const hqClips = useMemo(() => {
    if (!clips?.length) return [];
    const mine = jobId ? clips.filter((c) => c.job_id === jobId) : [];
    if (mine.length) return mine;
    if (jobActive) return [];
    return clips.filter((c) => c.job_id === clips[0].job_id);
  }, [clips, jobId, jobActive]);
  const selKey = selected ? `${selected.job_id}:${selected.clip_index}` : null;
  const previewClip = hqClips.find((c) => `${c.job_id}:${c.clip_index}` === selKey) || hqClips.find((c) => c.video_url) || hqClips[0] || null;
  const previewKey = previewClip ? `${previewClip.job_id}:${previewClip.clip_index}` : null;

  const queueText = (() => {
    const a = snap && jobActive ? Math.max(1, snap.jobs_active || 0) : (system?.jobs_active || 0);
    const q = snap && jobActive ? (snap.jobs_queued || 0) : (system?.jobs_queued || 0);
    if (!a && !q) return 'fila vazia';
    return `${a} em processamento${q ? ` · ${q} na fila` : ''}`;
  })();

  const mod = MODULES.find((m) => m.id === section) || MODULES[0];
  const modIndex = MODULES.indexOf(mod) + 1;
  const moduleBody = {
    dashboard: <DashboardSection dash={dash} job={job} go={go} uploadPostKey={uploadPostKey} uploadUserId={uploadUserId} clips={clips} pubs={pubs}
      working={working} agentCount={agents.length} connected={!!(uploadPostKey || meta?.upload_post_configured)} />,
    games: <GamesSection meta={meta} games={games} reload={() => Promise.all([loadGames(), loadDash()])} />,
    import: <ImportSection meta={meta} games={games} form={form} setForm={setForm} onStart={() => start()} starting={starting} startError={startError} job={job} />,
    analysis: <AnalysisSection job={job} onCancel={cancel} cancelling={cancelling} go={go} />,
    clips: <ClipsSection clips={clips} job={job} meta={meta} reload={reloadMedia} openEditor={openEditor} openSubs={openSubs} go={go} />,
    editor: <EditorSection clips={clips} selected={selected} onSelect={setSelected} reload={reloadMedia} />,
    subtitles: <SubtitlesSection clips={clips} selected={selected} onSelect={setSelected} reload={reloadMedia} />,
    videos: <VideoLibrarySection clips={clips} games={games} openEditor={openEditor} />,
    social: <SocialSection clips={clips} pubs={pubs} meta={meta} reload={() => Promise.all([loadPubs(), loadDash()])} uploadPostKey={uploadPostKey} uploadUserId={uploadUserId} go={go} />,
    schedule: <ScheduleSection clips={clips} pubs={pubs} reload={() => Promise.all([loadPubs(), loadDash()])} uploadPostKey={uploadPostKey} />,
    history: <HistorySection dash={dash} pubs={pubs} clips={clips} />,
    config: <ConfigSection meta={meta} apiKey={apiKey} uploadPostKey={uploadPostKey} uploadUserId={uploadUserId} keys={keys} />,
  }[mod.id];

  const closeToast = useCallback(() => setToast(null), []);

  // The module list closes on Escape or a click anywhere else.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  return (
    <div className={`sede ${theme === 'nova' ? 'sede-nova' : 'sede-classic'} h-full overflow-y-auto`}>
      <header className="sticky top-0 z-40 border-b border-rule2 bg-paper/95 backdrop-blur-md px-4 md:px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="mr-auto flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: '#06101f' }}>
              <JarvisOrb size={40} busy={working > 0} />
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-[17px] font-extrabold tracking-tight text-ink">{nome}</h1>
            </div>
          </div>
          <nav aria-label="Áreas do painel" className="sede-seg order-3 w-full overflow-x-auto md:order-none md:w-auto">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => pickView(v.id)} title={v.hint}>
                <v.icon size={14} aria-hidden="true" /> {v.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <p className="flex items-center gap-2 rounded-full border border-rule2 bg-paper2 px-3 py-1.5 text-[12px] text-ink2" aria-live="polite"
              title={system ? `Transcrição: ${system.whisper_device} · vídeo: ${system.encoder}` : undefined}>
              <span className={`h-2 w-2 rounded-full ${working ? 'bg-warn animate-pulse' : 'bg-ok'}`} aria-hidden="true" />
              <span className="font-bold text-ink">{working ? 'Trabalhando' : 'Pronto'}</span>
              <span className="text-muted" aria-hidden="true">·</span>
              <span className="text-muted">{queueText}</span>
            </p>
            <button type="button" onClick={toggleSom} aria-pressed={som}
              aria-label={som ? 'Desligar os sons dos agentes' : 'Ligar os sons dos agentes'} title={som ? 'Sons ligados' : 'Sons desligados'}
              className="grid h-9 w-9 place-items-center rounded-xl border border-rule2 bg-paper2 text-ink2 hover:border-brass hover:text-ink">
              {som ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => pickView('settings')} aria-label="Configurações: nome, tema, áudio, termos e privacidade"
              aria-pressed={view === 'settings'} title="Configurações"
              className={`grid h-9 w-9 place-items-center rounded-xl border text-ink2 hover:border-brass hover:text-ink ${view === 'settings' ? 'border-brass bg-brass/15 text-ink' : 'border-rule2 bg-paper2'}`}>
              <Settings size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 p-4 md:p-5 lg:grid-cols-[304px_minmax(0,1fr)] lg:items-start">
        <aside className={`min-w-0 space-y-4 lg:sticky lg:top-[72px] ${view === 'settings' ? 'hidden lg:block' : ''}`}>
          <OrchestratorPanel meta={meta} games={games} form={form} setForm={setForm} job={job} starting={starting} startError={startError}
            cancelling={cancelling} onStartFile={start} onStartUrl={() => start()} uploadPct={uploadPct} proAI={!!(apiKey || meta?.gemini_configured)} onProAI={() => go('config')} onCancel={cancel} onAddGame={() => go('games')} onImportLink={() => go('import')} />
          <ConsolePanel lines={consoleLines} roles={roles} />
        </aside>

        <main className="min-w-0 space-y-4">
          {loadError && <Notice tone="error">{loadError}</Notice>}

          {view === 'hq' && (
            <>
              <SedeMap agents={agents} core={core} theme={theme} details={details} onOpen={(a) => go(a.module)} />
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                <ClipsStrip clips={hqClips} selectedKey={previewKey} onSelect={pick} onReload={reloadMedia}
                  onOpenEditor={() => (previewClip ? openEditor(previewClip) : go('editor'))} rendering={jobActive} />
                <PreviewPanel clip={previewClip} />
              </div>
            </>
          )}

          {view === 'modules' && (
            <section className="rounded-[20px] border border-rule2 bg-paper2/60 p-4 md:p-5">
              <div className="relative mb-5 flex items-center gap-3 border-b border-rule pb-4" ref={menuRef}>
                <button type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Abrir lista de módulos" title="Módulos"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-rule2 bg-paper2 text-ink hover:border-brass">
                  <MoreVertical size={20} aria-hidden="true" />
                </button>
                <span className="text-xs font-bold text-muted">Módulos · {modIndex} de {MODULES.length}</span>
                {menuOpen && (
                  <nav aria-label="Módulos" role="menu"
                    className="absolute left-0 top-12 z-30 flex w-72 max-w-[calc(100vw-48px)] flex-col gap-0.5 rounded-2xl border border-rule2 bg-paper2 p-2 shadow-2xl">
                    {MODULES.map((m, i) => (
                      <button key={m.id} type="button" role="menuitem" className="sede-pill w-full justify-start" aria-current={m.id === mod.id ? 'page' : undefined}
                        onClick={() => { setMenuOpen(false); go(m.id); }}>
                        <m.icon size={15} aria-hidden="true" /> {i + 1}. {m.label}
                      </button>
                    ))}
                  </nav>
                )}
              </div>
              <ModuleCtx.Provider value={{ label: `${modIndex}. ${mod.label}`, hint: MODULE_HINT, onBack: goHQ }}>
                {moduleBody}
              </ModuleCtx.Provider>
            </section>
          )}

          {view === 'pipeline' && <PipelineView agents={agents} jobId={jobId} jobStatus={job?.status} system={system} />}
          {view === 'settings' && (
            <Configuracoes nome={nome} onNome={pickNome} theme={theme} onTheme={pickTheme} som={som} onSom={pickSom}
              onAbrirChaves={() => go('config')} />
          )}
        </main>
      </div>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
