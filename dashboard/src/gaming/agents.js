// Each agent's signature colour, and the order they sit around J.A.R.V.I.S.
// (clockwise from the top, following the real pipeline). The agents
// themselves come from the backend (gaming/pipeline.py): this file only draws.
export const LOOK = {
  ingest: { color: '#06b6d4' },
  library: { color: '#3b82f6' },
  homer: { color: '#84cc16' },
  whisper: { color: '#a855f7' },
  vision: { color: '#f43f5e' },
  x51: { color: '#ef4444' },
  slicer: { color: '#f59e0b' },
  aida: { color: '#f97316' },
  editor916: { color: '#10b981' },
  captions: { color: '#ec4899' },
  social: { color: '#4f46e5' },
  herbie: { color: '#14b8a6' },
  baymax: { color: '#e2e8f0' },
};

export const ORDEM = ['ingest', 'library', 'homer', 'whisper', 'vision', 'x51', 'slicer', 'aida',
  'editor916', 'captions', 'social', 'herbie', 'baymax'];

// Positions on an ellipse around the centre, in % of the map box.
export function anel(ids, rx, ry) {
  const lista = ORDEM.filter((id) => ids.includes(id)).concat(ids.filter((id) => !ORDEM.includes(id)));
  const n = lista.length || 1;
  return Object.fromEntries(lista.map((id, i) => {
    const ang = (-90 + (i * 360) / n) * (Math.PI / 180);
    return [id, { x: 50 + rx * Math.cos(ang), y: 50 + ry * Math.sin(ang) }];
  }));
}
