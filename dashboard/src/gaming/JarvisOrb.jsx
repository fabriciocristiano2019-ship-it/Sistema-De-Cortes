import React, { useEffect, useRef } from 'react';

// J.A.R.V.I.S. as a holographic neural sphere: points on a sphere joined to
// their neighbours, slowly turning. When the agents are working ("busy") it
// turns faster, breathes, wobbles and glows brighter; the change is eased so
// it never jumps. Drawn on a canvas, purely decorative (aria-hidden).

function buildSphere(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.399963;                       // golden angle: even spread
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, ph: (i * 1.618) % (Math.PI * 2) });
  }
  // Each point joins its 3 nearest neighbours, plus a few longer chords so
  // the shape reads as a network and not as a mesh.
  const edges = new Set();
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
  pts.forEach((p, i) => {
    pts.map((q, j) => [j, d2(p, q)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3)
      .forEach(([j]) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`));
  });
  for (let k = 0; k < Math.round(n / 5); k++) {
    const i = (k * 37) % n;
    const j = (k * 53 + 11) % n;
    if (i !== j && d2(pts[i], pts[j]) < 1.1) edges.add(i < j ? `${i}-${j}` : `${j}-${i}`);
  }
  return { pts, edges: [...edges].map((e) => e.split('-').map(Number)) };
}

export default function JarvisOrb({ size = 160, busy = false, theme = 'classic', className = '' }) {
  const ref = useRef(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dark = theme !== 'nova';
    const rgb = dark ? '110, 215, 255' : '14, 116, 190';
    const core = dark ? '190, 245, 255' : '8, 80, 150';
    const { pts, edges } = buildSphere(size > 80 ? 150 : 56);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const proj = pts.map(() => [0, 0, 0]);
    let angle = 0.6;
    let energy = busyRef.current ? 1 : 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now) => {
      const dt = Math.min(50, now - last);
      last = now;
      energy += ((busyRef.current ? 1 : 0) - energy) * 0.035;
      angle += dt * (0.00022 + energy * 0.0009);
      const cx = size / 2;
      const cy = size / 2;
      const R = size * 0.36 * (1 + energy * 0.035 * Math.sin(now / 170));
      const tilt = 0.35 + 0.08 * Math.sin(now / 2600);
      const ca = Math.cos(angle); const sa = Math.sin(angle);
      const ct = Math.cos(tilt); const st = Math.sin(tilt);
      const wob = 0.05 + energy * 0.09;
      const speed = 1 + energy * 2.2;

      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.45);
      glow.addColorStop(0, `rgba(${rgb}, ${dark ? 0.26 + energy * 0.22 : 0.12 + energy * 0.1})`);
      glow.addColorStop(0.55, `rgba(${rgb}, ${dark ? 0.08 + energy * 0.08 : 0.04})`);
      glow.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const k = 1 + wob * Math.sin((now / 520) * speed + p.ph) * Math.cos((now / 830) * speed + p.ph * 2);
        const x1 = (p.x * ca + p.z * sa) * k;
        const z1 = (-p.x * sa + p.z * ca) * k;
        const y1 = p.y * k;
        const y2 = y1 * ct - z1 * st;
        const z2 = y1 * st + z1 * ct;
        const persp = 1 / (1.9 - z2 * 0.55);
        proj[i][0] = cx + x1 * R * persp * 1.8;
        proj[i][1] = cy + y2 * R * persp * 1.8;
        proj[i][2] = z2;
      }

      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      ctx.lineWidth = size > 80 ? 0.7 : 0.6;
      for (const [i, j] of edges) {
        const z = (proj[i][2] + proj[j][2]) / 2;
        const a = (0.05 + 0.32 * ((z + 1) / 2)) * (0.65 + energy * 0.55);
        ctx.strokeStyle = `rgba(${rgb}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(proj[i][0], proj[i][1]);
        ctx.lineTo(proj[j][0], proj[j][1]);
        ctx.stroke();
      }
      for (let i = 0; i < pts.length; i++) {
        const z = (proj[i][2] + 1) / 2;
        const flick = 0.75 + 0.25 * Math.sin(now / 300 + pts[i].ph * 3);
        const a = (0.25 + 0.7 * z) * flick * (0.7 + energy * 0.4);
        ctx.fillStyle = `rgba(${core}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(proj[i][0], proj[i][1], (size > 80 ? 0.7 : 0.5) + z * (size > 80 ? 1.5 : 0.9), 0, Math.PI * 2);
        ctx.fill();
      }
      // Bright heart of the sphere, stronger while working.
      const heart = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.45);
      heart.addColorStop(0, `rgba(${core}, ${0.35 + energy * 0.35})`);
      heart.addColorStop(1, `rgba(${core}, 0)`);
      ctx.fillStyle = heart;
      ctx.fillRect(0, 0, size, size);

      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, theme]);

  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-hidden="true" />;
}
