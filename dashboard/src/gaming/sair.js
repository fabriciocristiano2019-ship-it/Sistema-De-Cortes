import { getApiUrl } from '../config';

// Ends the 7-day login on this device and shows the login screen again.
export async function sair() {
  try { await fetch(getApiUrl('/api/acesso/sair'), { method: 'POST', credentials: 'include' }); } catch (_) { /* offline: reload shows the gate anyway */ }
  window.location.reload();
}
