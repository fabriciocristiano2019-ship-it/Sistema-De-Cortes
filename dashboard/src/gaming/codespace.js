// The codespace's own links (from /api/gaming/vivo), kept in this browser so
// the panel can still show them after the codespace went down.
const CHAVE = 'os_codespace';

export function lerCodespace() {
  try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch { return null; }
}

export function guardarCodespace(cs) {
  try {
    if (cs && cs.religar_url) localStorage.setItem(CHAVE, JSON.stringify(cs));
  } catch { /* private mode */ }
}
