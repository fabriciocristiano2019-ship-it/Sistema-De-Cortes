// Postiz key/address kept in this browser only (like the other optional keys).
// The safer place is POSTIZ_API_KEY in the server's .env or a Codespaces secret.
const K = 'os_postiz_key';
const U = 'os_postiz_url';
const get = (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
const set = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (_) { /* private mode */ } };

export const postizKey = () => get(K);
export const postizUrl = () => get(U);
export const setPostizKey = (v) => set(K, v);
export const setPostizUrl = (v) => set(U, v);

export function postizHeaders() {
  const h = {};
  if (postizKey()) h['X-Postiz-Key'] = postizKey();
  if (postizUrl()) h['X-Postiz-Url'] = postizUrl();
  return h;
}
