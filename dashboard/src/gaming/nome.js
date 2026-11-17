// The name shown at the top of the panel (Settings). Stored only in this browser.
export const NOME_KEY = 'os_nome_painel';
export const NOME_PADRAO = 'Fabricio Cristiano';

export function nomeSalvo() {
  try { return (localStorage.getItem(NOME_KEY) || '').trim() || NOME_PADRAO; } catch (_) { return NOME_PADRAO; }
}
