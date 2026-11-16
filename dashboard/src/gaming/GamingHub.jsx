import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, CalendarClock, Clapperboard, Gamepad2, History, LayoutDashboard, Library,
  Scissors, Settings, Share2, Type, Upload,
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';
import { errText, JOB_KEY } from './util';
import { Notice } from './ui';
import { AnalysisSection, DashboardSection, GamesSection, ImportSection } from './SectionsCore';
import { ClipsSection, EditorSection, SubtitlesSection, VideoLibrarySection } from './SectionsMedia';
import { ConfigSection, HistorySection, ScheduleSection, SocialSection } from './SectionsPublish';

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'games', label: 'Biblioteca de jogos', icon: Gamepad2 },
  { id: 'import', label: 'Importação', icon: Upload },
  { id: 'analysis', label: 'Análise inteligente', icon: Activity },
  { id: 'clips', label: 'Cortes encontrados', icon: Scissors },
  { id: 'editor', label: 'Editor de vídeos', icon: Clapperboard },
  { id: 'subtitles', label: 'Legendas', icon: Type },
  { id: 'videos', label: 'Biblioteca de vídeos', icon: Library },
  { id: 'social', label: 'Redes sociais', icon: Share2 },
  { id: 'schedule', label: 'Agendamentos', icon: CalendarClock },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'config', label: 'Configurações', icon: Settings },
];

const DEFAULT_FORM = {
  file: null, url: '', game_id: 'auto', category: 'other', clip_seconds: 30, layout: 'auto',
  engine: 'local', max_clips: 8, min_score: 30, captions: true, zoom: true, auto_hook: true,
  acknowledged: false,
};

const ACTIVE = ['queued', 'processing'];

// OpenShorts Gaming Edition: one self-contained workspace. It talks to the
// same backend as the rest of the dashboard and reuses its endpoints for
// editing, captions and publishing.
export default function GamingHub({ apiKey, uploadPostKey, uploadUserId, onOpenSettings }) {
  const [section, setSection] = useState(() => localStorage.getItem('os_gaming_section') || 'dashboard');
  const [meta, setMeta] = useState(null);
  const [games, setGames] = useState(null);
  const [dash, setDash] = useState(null);
  const [clips, setClips] = useState(null);
  const [pubs, setPubs] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [job, setJob] = useState(() => {
    const id = localStorage.getItem(JOB_KEY);
    return id ? { id, status: 'processing', logs: [] } : null;
  });
  const [selected, setSelected] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [loadError, setLoadError] = useState('');
  const lastClipCount = useRef(0);

  const go = useCallback((id) => { setSection(id); localStorage.setItem('os_gaming_section', id); }, []);

  const loadGames = useCallback(() => apiJson('/api/games').then((d) => setGames(d.games)), []);
  const loadDash = useCallback(() => apiJson('/api/gaming/dashboard').then(setDash), []);
  const loadClips = useCallback(() => apiJson('/api/gaming/clips').then((d) => setClips(d.clips)), []);
  const loadPubs = useCallback(() => apiJson('/api/gaming/publications').then((d) => setPubs(d.items)), []);
  const reloadAll = useCallback(
    () => Promise.all([loadGames(), loadDash(), loadClips(), loadPubs()])
      .then(() => setLoadError(''))
      .catch((e) => setLoadError(`Não foi possível falar com o servidor (${errText(e)}). Verifique se o OpenShorts está em execução.`)),
    [loadGames, loadDash, loadClips, loadPubs],
  );

  useEffect(() => {
    apiJson('/api/gaming/meta').then(setMeta).catch(() => {});
    reloadAll();
  }, [reloadAll]);

  // Poll the running job. Clips are refreshed as each one finishes rendering.
  const jobId = job?.id;
  const jobActive = job && ACTIVE.includes(job.status);
  useEffect(() => {
    if (!jobId || !jobActive) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const res = await apiFetch(`/api/status/${jobId}`);
        if (stop) return;
        if (res.status === 404) {
          localStorage.removeItem(JOB_KEY);
          setJob(null);
          return;
        }
        const d = await res.json();
        const n = d.result?.clips?.length || 0;
        setJob({ id: jobId, status: d.status, logs: d.logs || [], error: d.error });
        if (n !== lastClipCount.current) { lastClipCount.current = n; loadClips().catch(() => {}); }
        if (!ACTIVE.includes(d.status)) {
          setCancelling(false);
          reloadAll();
        }
      } catch { /* transient network error: the next tick retries */ }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => { stop = true; clearInterval(t); };
  }, [jobId, jobActive, loadClips, reloadAll]);

  const start = async () => {
    setStarting(true); setStartError('');
    try {
      const gaming = {
        game_id: form.game_id, category: form.category, engine: form.engine, layout: form.layout,
        clip_seconds: Number(form.clip_seconds), max_clips: Number(form.max_clips),
        min_score: Number(form.min_score), zoom: !!form.zoom,
      };
      const headers = apiKey ? { 'X-Gemini-Key': apiKey } : {};
      let body;
      if (form.file) {
        body = new FormData();
        body.append('file', form.file);
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
      lastClipCount.current = 0;
      setJob({ id: d.job_id, status: 'queued', logs: [] });
      setForm((p) => ({ ...p, file: null, url: '' }));
      go('analysis');
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
  const reloadMedia = () => Promise.all([loadClips(), loadDash()]);

  const body = {
    dashboard: <DashboardSection dash={dash} job={job} go={go} uploadPostKey={uploadPostKey} uploadUserId={uploadUserId} />,
    games: <GamesSection meta={meta} games={games} reload={() => Promise.all([loadGames(), loadDash()])} />,
    import: <ImportSection meta={meta} games={games} form={form} setForm={setForm} onStart={start} starting={starting} startError={startError} job={job} />,
    analysis: <AnalysisSection job={job} onCancel={cancel} cancelling={cancelling} go={go} />,
    clips: <ClipsSection clips={clips} job={job} meta={meta} reload={reloadMedia} openEditor={openEditor} openSubs={openSubs} go={go} />,
    editor: <EditorSection clips={clips} selected={selected} onSelect={setSelected} reload={reloadMedia} />,
    subtitles: <SubtitlesSection clips={clips} selected={selected} onSelect={setSelected} reload={reloadMedia} />,
    videos: <VideoLibrarySection clips={clips} games={games} openEditor={openEditor} />,
    social: <SocialSection clips={clips} pubs={pubs} meta={meta} reload={() => Promise.all([loadPubs(), loadDash()])} uploadPostKey={uploadPostKey} uploadUserId={uploadUserId} go={go} />,
    schedule: <ScheduleSection clips={clips} pubs={pubs} reload={() => Promise.all([loadPubs(), loadDash()])} uploadPostKey={uploadPostKey} />,
    history: <HistorySection dash={dash} pubs={pubs} clips={clips} />,
    config: <ConfigSection meta={meta} apiKey={apiKey} uploadPostKey={uploadPostKey} onOpenSettings={onOpenSettings} />,
  }[section];

  return (
    <div className="h-full flex flex-col md:flex-row animate-fade">
      <nav aria-label="Módulos do Gaming Edition"
        className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-rule overflow-x-auto md:overflow-y-auto">
        <p className="eyebrow px-4 pt-4 pb-2 hidden md:block">GAMING EDITION</p>
        <ul className="flex md:flex-col gap-0.5 p-2">
          {SECTIONS.map((s, i) => {
            const on = s.id === section;
            const Icon = s.icon;
            const live = s.id === 'analysis' && jobActive;
            return (
              <li key={s.id} className="shrink-0">
                <button onClick={() => go(s.id)} aria-current={on ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 rounded-input px-3 py-2 text-sm whitespace-nowrap text-left transition-colors ${on ? 'bg-paper3 text-ink' : 'text-muted hover:text-ink'}`}>
                  <span className="font-mono text-micro w-5 hidden md:inline">{String(i + 1).padStart(2, '0')}</span>
                  <Icon size={16} className={on ? 'text-brass' : ''} />
                  <span>{s.label}</span>
                  {live && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brass animate-pulse" aria-label="em andamento" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-5 md:p-8 max-w-6xl mx-auto">
          {loadError && <div className="mb-4"><Notice tone="error">{loadError}</Notice></div>}
          {body}
        </div>
      </div>
    </div>
  );
}
