import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { getApiUrl } from '../config';
import './sede.css';

// Self-host access password (acesso_local.py). Off by default: the server
// answers exige_senha=false and the app renders straight away. When the
// password is on and the session is missing or expired, this screen asks for
// it; the session itself is an HttpOnly cookie the page never reads.
const call = (path, body) => fetch(getApiUrl(path), {
  method: body ? 'POST' : 'GET',
  credentials: 'include',
  headers: body ? { 'Content-Type': 'application/json' } : {},
  body: body ? JSON.stringify(body) : undefined,
});

export default function AcessoGate({ children }) {
  const [state, setState] = useState('checking'); // checking | open | locked
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const check = useCallback(async () => {
    try {
      const r = await call('/api/acesso/estado');
      if (!r.ok) { setState('open'); return; }   // older server or cloud mode: no gate
      const d = await r.json();
      setState(!d.exige_senha || d.autenticado ? 'open' : 'locked');
    } catch (_) { setState('open'); }            // server down: the app shows its own error
  }, []);

  useEffect(() => {
    check();
    const lock = () => setState('locked');
    window.addEventListener('os-acesso-necessario', lock);
    return () => window.removeEventListener('os-acesso-necessario', lock);
  }, [check]);

  const entrar = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await call('/api/acesso/entrar', { senha });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Não foi possível entrar.');
      setSenha('');
      setState('open');
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  if (state === 'checking') {
    return <div className="min-h-screen grid place-items-center bg-paper"><Loader2 className="animate-spin text-muted" aria-label="Carregando" /></div>;
  }
  if (state === 'open') return children;
  return (
    <div className="sede sede-classic min-h-screen grid place-items-center px-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-[20px] border border-rule2 bg-paper2 p-6 space-y-4" aria-labelledby="acesso-titulo">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-brass" aria-hidden="true" />
          <h1 id="acesso-titulo" className="text-[15px] font-extrabold tracking-wide text-ink">OPENSHORTS GAMING EDITION</h1>
        </div>
        <p className="text-sm text-muted">Este painel está protegido. Digite a senha de acesso.</p>
        <label className="block">
          <span className="block text-xs text-ink2 mb-1.5">Senha</span>
          <input type="password" autoComplete="current-password" autoFocus required maxLength={256}
            className="sede-select w-full !bg-none" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button type="submit" className="sede-btn-accent w-full disabled:opacity-60" disabled={busy || !senha}>
          {busy ? <Loader2 size={16} className="inline animate-spin mr-1.5" /> : null}Entrar
        </button>
      </form>
    </div>
  );
}
