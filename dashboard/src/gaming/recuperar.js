// Recovering the panel when it fails to open (owner, 20-nov-2026).
//
// 1. After an update the build gets new file names. A tab (or the phone app)
//    still holding the old page asks for files that no longer exist and the
//    panel dies with "Failed to fetch dynamically imported module". One
//    automatic reload fixes it: the fresh page names the new files. A guard
//    in sessionStorage stops a reload loop if the reload does not help.
// 2. Screen state saved in this browser by an older version (the open
//    section, the form, a pending upload) can crash a newer one. "Limpar"
//    removes only that state; keys, login, name and terms stay.
const GUARDA = 'os_recarregou_em';

export function erroDeVersao(e) {
  const m = `${e?.name || ''} ${e?.message || e || ''}`;
  return /dynamically imported module|Importing a module script failed|error loading dynamically|Loading (CSS )?chunk|ChunkLoadError|Unable to preload CSS|is not a valid JavaScript MIME type/i.test(m);
}

// Reload once per 30 s at most. Returns true when it reloaded.
export function recarregarUmaVez(agora = Date.now()) {
  try {
    const antes = Number(sessionStorage.getItem(GUARDA) || 0);
    if (agora - antes < 30000) return false;
    sessionStorage.setItem(GUARDA, String(agora));
  } catch (_) { return false; }   // no storage: never risk a loop
  window.location.reload();
  return true;
}

export const ESTADO_DE_TELA = [
  'os_gaming_section', 'os_gaming_job', 'os_sede_form', 'os_cfg_aba', 'os_envio_pendente',
  'os_layout', 'os_layout_v2', 'os_hook_prefs', 'os_auto_hook', 'os_auto_hook_style',
  'os_republicar_redes', 'os_codespace', 'saasshorts_cache', 'os_pending_url',
];

export function limparEstadoDeTela() {
  for (const k of ESTADO_DE_TELA) {
    try { localStorage.removeItem(k); } catch (_) { /* private mode */ }
  }
}

export function instalarRecuperacao() {
  if (typeof window === 'undefined') return;
  // Vite fires this when a lazily loaded part of the panel cannot be fetched.
  window.addEventListener('vite:preloadError', (ev) => {
    if (recarregarUmaVez()) ev.preventDefault();
  });
}
