// Install as a phone app (PWA). Chrome fires beforeinstallprompt early, before
// the Settings screen exists, so it is kept here until the person asks.
let pedido = null;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedido = e; avisar(); });
  window.addEventListener('appinstalled', () => { pedido = null; avisar(); });
}

export const instalado = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches;

export const podeInstalar = () => !!pedido;

export function aoMudar(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

export async function instalar() {
  if (!pedido) return false;
  const p = pedido;
  pedido = null;
  await p.prompt();
  const { outcome } = await p.userChoice;
  avisar();
  return outcome === 'accepted';
}
