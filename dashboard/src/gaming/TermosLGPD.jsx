import React, { useEffect, useRef, useState } from 'react';

// Terms of use / LGPD acceptance shown on first use. Same text, key and
// behaviour as the owner's HTML snippet, as a React component: the panel stays
// behind (inert) until "Li e concordo" is ticked and "Continuar" is pressed.
export const TERMOS_KEY = 'jarvis_termos_aceitos';

function aceitou() {
  try { return localStorage.getItem(TERMOS_KEY) === 'true'; } catch (_) { return false; }
}

export default function TermosLGPD({ children }) {
  const [aberto, setAberto] = useState(() => !aceitou());
  const [marcado, setMarcado] = useState(false);
  const caixa = useRef(null);

  useEffect(() => { if (aberto) caixa.current?.focus(); }, [aberto]);

  const continuar = () => {
    if (!marcado) return;
    try { localStorage.setItem(TERMOS_KEY, 'true'); } catch (_) { /* private mode: ask again next time */ }
    setAberto(false);
  };

  // Keep Tab inside the dialog while it is open.
  const prenderFoco = (e) => {
    if (e.key !== 'Tab') return;
    const itens = [...e.currentTarget.querySelectorAll('input, button:not([disabled]), [tabindex="0"]')];
    if (!itens.length) return;
    const i = itens.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); itens[itens.length - 1].focus(); }
    else if (!e.shiftKey && i === itens.length - 1) { e.preventDefault(); itens[0].focus(); }
  };

  return (
    <>
      <div inert={aberto ? '' : undefined} aria-hidden={aberto || undefined} className="h-full">{children}</div>
      {aberto && (
        <div id="modal-termos-lgpd" onKeyDown={prenderFoco}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="termos-titulo" aria-describedby="termos-texto"
            style={{ background: '#111827', color: '#f3f4f6', padding: 30, borderRadius: 12, maxWidth: 600, width: '100%',
              border: '1px solid #374151', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <h2 id="termos-titulo" style={{ marginTop: 0, marginBottom: 16, color: '#38bdf8', fontSize: 22, fontWeight: 700 }}>
              Termos de Uso e Privacidade (LGPD)
            </h2>
            <div id="termos-texto" tabIndex={0} role="region" aria-label="Texto dos termos"
              style={{ maxHeight: 200, overflowY: 'auto', fontSize: 14, color: '#9ca3af', marginBottom: 20, paddingRight: 10, lineHeight: 1.5 }}>
              <p style={{ marginBottom: 12 }}><strong style={{ color: '#e5e7eb' }}>1. Responsabilidade de Conteúdo:</strong> O uso deste software é de inteira responsabilidade do usuário. Você é o único responsável pelos vídeos baixados, cortados e publicados, bem como pelo respeito aos direitos autorais de terceiros e diretrizes do YouTube.</p>
              <p style={{ marginBottom: 12 }}><strong style={{ color: '#e5e7eb' }}>2. Credenciais e Chaves:</strong> Suas chaves de API e cookies de acesso são armazenados localmente no seu ambiente de execução. O desenvolvedor não tem acesso a essas credenciais.</p>
              <p><strong style={{ color: '#e5e7eb' }}>3. Privacidade:</strong> Em conformidade com a LGPD, garantimos a proteção e privacidade de quaisquer dados de navegação coletados para o funcionamento da ferramenta.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <input ref={caixa} type="checkbox" id="aceite-termos" checked={marcado} onChange={(e) => setMarcado(e.target.checked)}
                style={{ marginRight: 10, width: 20, height: 20, cursor: 'pointer', flexShrink: 0, accentColor: '#0369a1' }} />
              <label htmlFor="aceite-termos" style={{ fontSize: 14, cursor: 'pointer' }}>
                Li e concordo com os Termos de Uso e a Política de Privacidade.
              </label>
            </div>
            <button id="btn-continuar" type="button" disabled={!marcado} onClick={continuar}
              style={{ background: marcado ? '#0369a1' : '#4b5563', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 6,
                fontWeight: 'bold', cursor: marcado ? 'pointer' : 'not-allowed', width: '100%', transition: 'background 0.3s' }}>
              Continuar para o J.A.R.V.I.S.
            </button>
          </div>
        </div>
      )}
    </>
  );
}
