// "Publicar ao aprovar": settings kept in this browser. For now YouTube only
// (the owner's choice); the platforms list is ready for Instagram/TikTok.
const KEY = 'os_auto_publicar';
export const REDES_AUTO = [{ id: 'youtube', label: 'YouTube (Shorts)', publico: true }];

export function lerAutoPub() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    const plataformas = (Array.isArray(d.plataformas) ? d.plataformas : ['youtube']).filter((p) => REDES_AUTO.some((r) => r.id === p));
    return { ativo: d.ativo === true, plataformas };
  } catch (_) { return { ativo: false, plataformas: ['youtube'] }; }
}

export function gravarAutoPub(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) { /* private mode */ }
  return lerAutoPub();
}

const NOMES = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };
export const nomesRedes = (ids) => {
  const n = ids.map((id) => NOMES[id] || id);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}` : n.join('');
};

// Title and description of a clip for YouTube: what the AI (or the local
// engine) wrote, hashtags at the end.
export function textoDoCorte(clip) {
  const titulo = (clip.video_title_for_youtube_short || clip.title || 'Gameplay').slice(0, 100);
  const tags = Array.isArray(clip.hashtags) ? clip.hashtags.join(' ') : '';
  const desc = [clip.description || '', tags].filter(Boolean).join('\n\n').slice(0, 2200);
  return { titulo, desc };
}
