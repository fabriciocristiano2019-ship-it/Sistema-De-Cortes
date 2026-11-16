import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, CalendarClock, Cpu, Eye, Film, Gamepad2, History, Layers, Moon, Scissors, Settings,
  Share2, SlidersHorizontal, Sun, Terminal, Type, Upload,
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';
import { errText, JOB_KEY } from './util';
import { ModuleCtx } from './ctx';
import { Notice } from './ui';
import SedeMap from './SedeMap';
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
  { id: 'config', label: 'Configurações (.env)', icon: Settings },
];
const MODULE_HINT = 'Módulo integrado ao fluxo local OpenShorts Gaming Edition (Windows + Docker Desktop).';

const VIEWS = [
  { id: 'hq', label: 'Sala Virtual (Sede)', icon: Cpu },
  { id: 'modules', label: 'Módulos (12)', icon: Layers },
  { id: 'pipeline', label: 'Fluxo & Registros', icon: Terminal },
];

const DEFAULT_FORM = {
  file: null, url: '', game_id: 'auto', category: 'other', clip_seconds: 30, layout: 'auto',
  engine: 'local', max_clips: 8, min_score: 30, captions: true, zoom: true, auto_hook: true,
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
export default function GamingHub({ apiKey, uploadPostKey, uploadUserId, onOpenSettings, onLegacy }) {
  const [theme, setTheme] = useState(() => stored('os_sede_theme', 'classic', ['classic', 'nova']));
  const [view, setView] = useState(() => stored('os_sede_view', 'hq', VIEWS.map((v) => v.id)));
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

  const start = async (file) => {
    setStarting(true); setStartError('');
    try {
      const f = file || form.file;
      const gaming = {
        game_id: form.game_id, category: form.category, engine: form.engine, layout: form.layout,
        clip_seconds: Number(form.clip_seconds), max_clips: Number(form.max_clips),
        min_score: Number(form.min_score), zoom: !!form.zoom,
      };
      const headers = apiKey ? { 'X-Gemini-Key': apiKey } : {};
      let body;
      if (f) {
        body = new FormData();
        body.append('file', f);
        body.append('acknowledged', 'true');
        body.append('output_format', 'vertical');
        body.append('captions', form.captions ? 'true' : 'false');
        body.append('auto_hook', form.auto_hook ? '1' : '0');
        body.append('force_low_quality', 'true');
        body.append('gaming', JSON.stringify(gaming));
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
          url: form.url.trim(), acknowledged: true, output_format: 'vertical',
          captions: form.captions, auto_hook: form.auto_hook ? '1' : '0', force_low_quality: true, gaming,
        });
      }
      const res = await apiFetch('/api/process', { method: 'POST', headers, body });
      const text = await res.text();
      let d = {};
      try { d = JSON.parse(text); } catch { /* non-JSON error body */ }
      if (!res.ok) throw new Error(typeof d.detail === 'string' ? d.detail : text || `Erro ${res.status}`);
      localStorage.setItem(JOB_KEY, d.job_id);
      lastReady.current = 0;
      watching.current = true;
      setSelected(null);
      setJob({ id: d.job_id, status: 'queued', snap: null });
      setForm((p) => ({ ...p, file: null, url: '' }));
      goHQ();
    } catch (e) { setStartError(errText(e)); } finally { setStarting(false); }
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
      boot.push({ t: bootAt, level: 'info', text: 'J.A.R.V.I.S. (núcleo) conectado ao servidor mo3y/openshorts.' });
      boot.push(system.ffmpeg
        ? { t: bootAt, level: 'ok', text: `${system.ffmpeg.replace(/ Copyright.*/, '')} · codificador ${system.encoder}.` }
        : { t: bootAt, level: 'error', text: 'FFmpeg não encontrado no servidor.' });
      boot.push({ t: bootAt, level: 'ok', text: `Faster-Whisper configurado (modelo ${system.whisper_model}, ${system.whisper_device}).` });
      boot.push({ t: bootAt, level: 'info', text: `${system.games} jogos na biblioteca. Motor local ativo, sem custo de API.` });
      if (!snap) boot.push({ t: bootAt, level: 'info', text: 'Aguardando importação de gameplay para delegar aos agentes.' });
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
    if (!a && !q) return 'Fila: 0';
    return `Fila: ${a} em curso${q ? ` · ${q} aguardando` : ''}`;
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
    config: <ConfigSection meta={meta} apiKey={apiKey} uploadPostKey={uploadPostKey} onOpenSettings={onOpenSettings} />,
  }[mod.id];

  const closeToast = useCallback(() => setToast(null), []);

  return (
    <div className={`sede ${theme === 'nova' ? 'sede-nova' : 'sede-classic'} h-full overflow-y-auto`}>
      <header className="sticky top-0 z-40 border-b border-rule2 bg-paper/95 backdrop-blur-md px-4 md:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="sede-core-chip grid h-10 w-10 shrink-0 place-items-center rounded-xl"><Eye size={20} aria-hidden="true" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[15px] font-extrabold tracking-wide text-ink">OPENSHORTS GAMING EDITION</h1>
                <span className="rounded-full border border-ok/50 bg-ok/10 px-2 py-0.5 text-[9.5px] font-extrabold tracking-wider text-ok">MOTOR LOCAL • CUSTO ZERO</span>
              </div>
              <p className="text-[11.5px] text-muted truncate">Base: mo3y/openshorts • Orquestração Multi-Agentes PT-BR</p>
            </div>
          </div>
          <nav aria-label="Áreas do painel" className="sede-seg max-w-full overflow-x-auto">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => pickView(v.id)}>
                <v.icon size={14} aria-hidden="true" /> {v.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-3 rounded-full border border-rule2 bg-paper2 px-3.5 py-1.5 text-[12px] text-ink2" aria-live="polite">
            <span className="flex items-center gap-2 font-extrabold text-ink">
              <span className={`h-2 w-2 rounded-full ${working ? 'bg-warn animate-pulse' : 'bg-brass'}`} aria-hidden="true" />
              {working ? `${working} ativo${working > 1 ? 's' : ''}` : `${agents.length} prontos`}
            </span>
            <span className="text-rule2" aria-hidden="true">|</span>
            <span title={system ? `Transcrição: ${system.whisper_device} · vídeo: ${system.encoder}` : undefined}>GPU/CPU: Local</span>
            <span className="text-rule2" aria-hidden="true">|</span>
            <span>{queueText}</span>
          </p>
          <div className="sede-seg sede-seg-soft" role="group" aria-label="Tema do painel">
            <button type="button" aria-pressed={theme === 'classic'} onClick={() => pickTheme('classic')}><Moon size={13} aria-hidden="true" /> Clássica</button>
            <button type="button" aria-pressed={theme === 'nova'} onClick={() => pickTheme('nova')}><Sun size={13} aria-hidden="true" /> Nova</button>
          </div>
          {onLegacy && (
            <button type="button" onClick={onLegacy} className="ml-auto text-[11.5px] text-muted underline-offset-2 hover:text-ink hover:underline">
              Ferramentas originais do OpenShorts →
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-4 p-4 md:p-5 lg:grid-cols-[304px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-[124px]">
          <OrchestratorPanel meta={meta} games={games} form={form} setForm={setForm} job={job} starting={starting} startError={startError}
            cancelling={cancelling} onStartFile={start} onCancel={cancel} onAddGame={() => go('games')} onImportLink={() => go('import')} />
          <ConsolePanel lines={consoleLines} roles={roles} host={window.location.host} />
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
              <nav aria-label="Módulos" className="flex flex-wrap gap-1.5 border-b border-rule pb-4 mb-5">
                {MODULES.map((m, i) => (
                  <button key={m.id} type="button" className="sede-pill" aria-current={m.id === mod.id ? 'page' : undefined} onClick={() => go(m.id)}>
                    <m.icon size={14} aria-hidden="true" /> {i + 1}. {m.label}
                  </button>
                ))}
              </nav>
              <ModuleCtx.Provider value={{ label: `${modIndex}. ${mod.label}`, hint: MODULE_HINT, onBack: goHQ }}>
                {moduleBody}
              </ModuleCtx.Provider>
            </section>
          )}

          {view === 'pipeline' && <PipelineView agents={agents} jobId={jobId} jobStatus={job?.status} system={system} />}
        </main>
      </div>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
