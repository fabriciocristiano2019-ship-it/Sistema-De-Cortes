// Where each room sits on the map (% of the map box) and its signature colour.
// The pipeline order and the agents themselves come from the backend
// (gaming/pipeline.py): this file only draws them.
export const LOOK = {
  library: { x: 18, y: 19, color: '#3b82f6' },
  ingest: { x: 50, y: 12.5, color: '#06b6d4' },
  whisper: { x: 82, y: 19, color: '#a855f7' },
  vision: { x: 13, y: 50, color: '#f43f5e' },
  slicer: { x: 87, y: 50, color: '#f59e0b' },
  editor916: { x: 18, y: 81, color: '#10b981' },
  captions: { x: 50, y: 87.5, color: '#ec4899' },
  social: { x: 82, y: 81, color: '#6366f1' },
};
