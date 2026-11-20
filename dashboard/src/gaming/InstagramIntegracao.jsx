import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Instagram, Loader2, RefreshCw, Send, AlertTriangle } from 'lucide-react';
import { apiJson } from '../lib/api';
import { gravarAutoPub, lerAutoPub } from './autoPublicar';
import { postizHeaders } from './postizConf';

// Instagram tab (owner, 20-nov-2026): YouTube already went out on "Aprovar";
// Instagram did not, because nothing turned it on and nothing showed whether
// the account was connected on the profile the panel uses. This tab checks
// that (read only, GET /api/gaming/instagram) and turns Instagram on for
// "publicar ao aprovar". Publishing itself is the same path as YouTube.
export default function InstagramIntegracao({ uploadPostKey = '', uploadUserId = '', onPerfil, onAbrirChaves }) {
  const [st, setSt] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [auto, setAuto] = useState(lerAutoPub);

  const verificar = useCallback(async () => {
    setCarregando(true);
    try {
      const q = uploadUserId ? `?perfil=${encodeURIComponent(uploadUserId)}` : '';
      setSt(await apiJson(`/api/gaming/instagram${q}`, {
        headers: { ...(uploadPostKey ? { 'X-Upload-Post-Key': uploadPostKey } : {}), ...postizHeaders() },
      }));
    } catch (e) {
      setSt({ conectado: false, erro: e?.message || 'Não deu para verificar agora.' });
    } finally { setCarregando(false); }
  }, [uploadPostKey, uploadUserId]);

  useEffect(() => { verificar(); }, [verificar]);

  const ligado = auto.ativo && auto.plataformas.includes('instagram');
  const alternar = (on) => {
    const plataformas = on ? [...new Set([...auto.plataformas, 'instagram'])] : auto.plataformas.filter((p) => p !== 'instagram');
    setAuto(gravarAutoPub({ ativo: on ? true : auto.ativo && plataformas.length > 0, plataformas }));
  };
  const usarPerfil = (p) => { onPerfil?.(p); };

  return (
    <div className="space-y-4">
      <section aria-labelledby="ig-status" className="min-w-0 rounded-[20px] border border-rule2 bg-paper2 p-5" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
        <h3 id="ig-status" className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-ink">
          <Instagram size={16} className="text-brass" aria-hidden="true" /> Conexão do Instagram
        </h3>
        <div role="status" aria-live="polite" className="mb-3">
          {carregando && !st && <p className="flex items-center gap-2 text-sm text-ink2"><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Verificando…</p>}
          {st && st.conectado && (
            <p className="flex items-center gap-2 text-sm font-bold text-ok">
              <CheckCircle2 size={16} aria-hidden="true" /> Instagram conectado{st.conta ? `: ${st.conta}` : ''}
              <span className="font-normal text-muted">({st.servico === 'postiz' ? 'Postiz' : `Upload-Post, perfil ${st.perfil}`})</span>
            </p>
          )}
          {st && !st.conectado && st.servico === null && (
            <p className="flex items-start gap-2 text-sm text-warn">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Falta a chave do Upload-Post (ou do Postiz). É a mesma que o YouTube usa.{' '}
                <button type="button" className="font-bold underline" onClick={onAbrirChaves}>Abrir Chaves</button></span>
            </p>
          )}
          {st && !st.conectado && st.servico !== null && (
            <p className="flex items-start gap-2 text-sm text-warn">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{st.erro || 'O Instagram ainda não está conectado.'}</span>
            </p>
          )}
        </div>

        {st?.sugestao && (
          <button type="button" className="sede-btn-accent mb-3 px-4" onClick={() => usarPerfil(st.sugestao)}>
            Usar o perfil “{st.sugestao}”
          </button>
        )}

        {Array.isArray(st?.perfis) && st.perfis.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Perfis do Upload-Post</caption>
              <thead><tr className="text-muted"><th className="py-1 pr-3 font-bold">Perfil</th><th className="py-1 pr-3 font-bold">Redes conectadas</th><th className="py-1 font-bold"><span className="sr-only">Ação</span></th></tr></thead>
              <tbody>
                {st.perfis.map((p) => (
                  <tr key={p.perfil} className="border-t border-rule2">
                    <td className="py-1.5 pr-3 font-bold text-ink">{p.perfil}{p.perfil === st.perfil ? ' (em uso)' : ''}</td>
                    <td className="py-1.5 pr-3 text-ink2">{p.redes.length ? p.redes.map((r) => ({ youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' }[r])).join(', ') : 'nenhuma'}</td>
                    <td className="py-1.5 text-right">
                      {p.perfil !== st.perfil && (
                        <button type="button" className="rounded-lg border border-rule2 px-2 py-1 font-bold text-ink2 hover:border-brass" onClick={() => usarPerfil(p.perfil)}>Usar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button type="button" onClick={verificar} disabled={carregando}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rule2 px-4 py-2 text-sm font-bold text-ink2 hover:border-brass disabled:opacity-60">
          {carregando ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />} Verificar de novo
        </button>
      </section>

      <section aria-labelledby="ig-auto" className="min-w-0 rounded-[20px] border border-rule2 bg-paper2 p-5" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
        <h3 id="ig-auto" className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-ink">
          <Send size={16} className="text-brass" aria-hidden="true" /> Publicar no Instagram ao aprovar
        </h3>
        <label className="flex items-start gap-2 text-sm text-ink2">
          <input type="checkbox" className="mt-1 shrink-0" checked={ligado} onChange={(e) => alternar(e.target.checked)} />
          <span>Ao clicar em <b className="text-ink">Aprovar</b>, enviar o corte também para o Instagram (Reels, público)</span>
        </label>
        <p className="mt-2 text-[11px] text-muted">
          A legenda do Reels é a descrição do corte com as hashtags (no máximo 30, regra do Instagram).
          O painel sempre pede confirmação antes de enviar.
        </p>
        {ligado && st && !st.conectado && (
          <p className="mt-2 text-xs text-warn">Ligado, mas o Instagram ainda não está conectado: a publicação vai falhar até conectar.</p>
        )}
      </section>

      <section aria-labelledby="ig-passos" className="min-w-0 rounded-[20px] border border-rule2 bg-paper2 p-5" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
        <h3 id="ig-passos" className="mb-3 text-[15px] font-extrabold text-ink">Como conectar (uma vez só)</h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink2">
          <li>No app do Instagram: <b className="text-ink">Configurações → Tipo de conta → Mudar para conta profissional</b> (Criador de conteúdo). Conta pessoal não aceita publicação automática.</li>
          <li>Abra o Upload-Post, entre no <b className="text-ink">mesmo perfil</b> onde o YouTube está e clique em <b className="text-ink">Connect</b> no Instagram. Aceite todas as permissões.</li>
          <li>Volte aqui e clique em <b className="text-ink">Verificar de novo</b>. Quando aparecer “Instagram conectado”, ligue a opção acima.</li>
        </ol>
        <a className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brass underline" href="https://app.upload-post.com" target="_blank" rel="noreferrer">
          Abrir o Upload-Post <ExternalLink size={14} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
