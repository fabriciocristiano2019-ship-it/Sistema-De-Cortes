import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { PLATFORMS } from './util';
import { textoDoCorte } from './autoPublicar';
import { Notice } from './ui';

// "Publicar / Republicar" from the video library: any clip, any network, now.
// Publishing itself goes through the same path as "publicar ao aprovar"
// (onPublicar -> /api/gaming/publications + /approve); this only gathers the
// choice. Networks a clip already went to are shown so a repost is a choice.
const ESCOLHA_KEY = 'os_republicar_redes';
const lerEscolha = () => {
  try {
    const v = JSON.parse(localStorage.getItem(ESCOLHA_KEY) || '["youtube"]');
    return Array.isArray(v) && v.length ? v.filter((p) => PLATFORMS.some((x) => x.id === p)) : ['youtube'];
  } catch (_) { return ['youtube']; }
};

export default function PublicarDialog({ clip, jaFoi = [], servico, onPublicar, onFechar, onAbrirChaves }) {
  const [redes, setRedes] = useState(lerEscolha);
  const [titulo, setTitulo] = useState(() => textoDoCorte(clip).titulo);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (d?.open) d.close(); };
  }, []);

  const alternar = (id) => setRedes((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const enviar = async () => {
    setEnviando(true); setErro('');
    try { localStorage.setItem(ESCOLHA_KEY, JSON.stringify(redes)); } catch (_) { /* private mode */ }
    try {
      await onPublicar(clip, redes, titulo.trim() || textoDoCorte(clip).titulo);
      onFechar();
    } catch (e) { setErro(e?.message || 'Não deu para publicar.'); } finally { setEnviando(false); }
  };
  const repost = redes.some((r) => jaFoi.includes(r));

  return (
    <dialog ref={ref} onClose={onFechar} aria-labelledby="pub-titulo"
      className="w-[min(30rem,calc(100vw-2rem))] rounded-[20px] border border-rule2 bg-paper2 p-0 text-ink2 backdrop:bg-black/60">
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="pub-titulo" className="text-lg font-extrabold text-ink">{jaFoi.length ? 'Publicar de novo' : 'Publicar'}</h2>
          <button type="button" className="btn-quiet btn-sm" onClick={onFechar} aria-label="Fechar"><X size={16} /></button>
        </div>

        {!servico ? (
          <Notice tone="warn">
            Falta conectar o Upload-Post ou o Postiz (onde ficam o seu YouTube e as outras redes).{' '}
            <button type="button" className="font-bold underline" onClick={() => { onFechar(); onAbrirChaves(); }}>Abrir Chaves e Integrações</button>
          </Notice>
        ) : (
          <>
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-ink">Onde publicar</legend>
              <div className="space-y-2">
                {PLATFORMS.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 rounded-xl border border-rule2 px-3 py-2.5 text-sm">
                    <input type="checkbox" checked={redes.includes(p.id)} onChange={() => alternar(p.id)} />
                    <span className="flex-1 text-ink">{p.label}</span>
                    {jaFoi.includes(p.id) && <span className="text-[11px] font-bold text-ok">já publicado aqui</span>}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-ink">Título</span>
              <input className="input-field w-full" maxLength={100} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              <span className="mt-1 block text-[11px] text-muted">{titulo.length}/100 · a descrição e as hashtags do corte vão junto</span>
            </label>
            {repost && <p className="text-xs text-warn">Este corte já foi para uma dessas redes: vai sair um post novo, repetido.</p>}
            <p className="text-xs text-muted">Sai como <b className="text-ink2">público</b>, agora. Para outro dia e hora, use Módulos → Redes.</p>
            {erro && <Notice tone="error">{erro}</Notice>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button>
              <button type="button" className="btn-primary" disabled={enviando || redes.length === 0} onClick={enviar}>
                {enviando ? <Loader2 size={15} className="mr-1 inline animate-spin" /> : <Send size={15} className="mr-1 inline" aria-hidden="true" />}
                Publicar agora
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
