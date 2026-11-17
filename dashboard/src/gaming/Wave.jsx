import React from 'react';

// Sound-wave bars. "on" animates (the agent is working), "done" freezes a
// waveform, anything else rests low. Purely decorative: aria-hidden.
const SHAPE = [0.45, 0.8, 0.55, 1, 0.65, 0.9, 0.4, 0.75, 0.5, 0.95, 0.6, 0.85, 0.45, 0.7, 0.55, 0.9];

export default function Wave({ mode = 'rest', bars = 12, color, height = 18, className = '' }) {
  return (
    <span className={`sede-wave sede-wave-${mode} ${className}`} style={{ height, color }} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} style={{ '--h': SHAPE[i % SHAPE.length], animationDelay: `${-((i * 137) % 900)}ms`, animationDuration: `${700 + ((i * 89) % 500)}ms` }} />
      ))}
    </span>
  );
}
