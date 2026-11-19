import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { getApiUrl } from '../config';
import { nomeSalvo } from './nome';
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
  const [usuario, setUsuario] = useState('');
  const [pedeUsuario, setPedeUsuario] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const check = useCallback(async () => {
    try {
      const r = await call('/api/acesso/estado');
      if (!r.ok) { setState('open'); return; }   // older server or cloud mode: no gate
      const d = await r.json();
      setPedeUsuario(!!d.pede_usuario);
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
      const r = await call('/api/acesso/entrar', { senha, usuario });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Não foi possível entrar.');
      setSenha(''); setUsuario('');
      setState('open');
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  if (state === 'checking') {
    return <div className="min-h-screen grid place-items-center bg-paper"><Loader2 className="animate-spin text-muted" aria-label="Carregando" /></div>;
  }
  if (state === 'open') return children;
  return (
    <div className="sede sede-rgb min-h-screen grid place-items-center px-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-[20px] border border-rule2 bg-paper2 p-6 space-y-4" aria-labelledby="acesso-titulo">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-brass" aria-hidden="true" />
          <h1 id="acesso-titulo" className="text-[17px] font-extrabold tracking-tight text-ink">{nomeSalvo()}</h1>
        </div>
        <p className="text-sm text-muted">{pedeUsuario ? 'Digite seu usuário e senha para entrar.' : 'Este painel está protegido. Digite a senha de acesso.'}</p>
        {pedeUsuario && (
          <label className="block">
            <span className="block text-xs text-ink2 mb-1.5">Usuário</span>
            <input type="text" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              autoFocus required maxLength={80} className="sede-select w-full !bg-none" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </label>
        )}
        <label className="block">
          <span className="block text-xs text-ink2 mb-1.5">Senha</span>
          <input type="password" name="password" autoComplete="current-password" autoFocus={!pedeUsuario} required maxLength={256}
            className="sede-select w-full !bg-none" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button type="submit" className="sede-btn-accent w-full disabled:opacity-60" disabled={busy || !senha || (pedeUsuario && !usuario.trim())}>
          {busy ? <Loader2 size={16} className="inline animate-spin mr-1.5" /> : null}Entrar
        </button>
      </form>
    </div>
  );
}
