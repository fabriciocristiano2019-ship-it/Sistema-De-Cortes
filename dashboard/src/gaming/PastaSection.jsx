import React, { useCallback, useEffect, useState } from 'react';
import { CheckCheck, Download, FileText, FolderOpen, Loader2, PackageOpen } from 'lucide-react';
import { apiJson } from '../lib/api';
import { getApiUrl } from '../config';
import { errText, fmtDate } from './util';
import { Empty, Header, Notice } from './ui';

// Pasta de vídeos novos (owner, 21-nov-2026): nothing is posted
// automatically; every finished clip lands in prontos/AAAA-MM-DD with a .txt
// of its title, description and hashtags. On the PC that is a real folder;
// here it can also be downloaded, one by one or the new ones in a .zip.
const arquivo = (caminho) => getApiUrl(`/api/gaming/prontos/arquivo?caminho=${encodeURIComponent(caminho)}`);
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

export default function PastaSection() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const carregar = useCallback(() => apiJson('/api/gaming/prontos').then(setD).catch((e) => setErr(errText(e))), []);
  useEffect(() => { carregar(); }, [carregar]);
  const marcarVisto = async () => {
    setBusy(true);
    try { setD(await apiJson('/api/gaming/prontos/visto', { method: 'POST' })); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  if (!d && !err) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brass" /></div>;
  const itens = d?.itens || [];
  const dias = [...new Set(itens.map((i) => i.dia))];
  return (
    <div>
      <Header ord="09 · PASTA DE VÍDEOS NOVOS" title="Vídeos novos" hint="Cada corte pronto cai aqui com um .txt do título, descrição e hashtags. É só postar.">
        {d?.novos > 0 && (
          <a className="sede-btn-accent inline-flex items-center gap-1.5 px-4" href={getApiUrl('/api/gaming/prontos/novos.zip')} download>
            <PackageOpen size={15} aria-hidden="true" /> Baixar os {d.novos} novos (.zip)
          </a>
        )}
        {d?.novos > 0 && (
          <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={marcarVisto} disabled={busy}>
            <CheckCheck size={15} aria-hidden="true" /> Marcar como vistos
          </button>
        )}
      </Header>
      {err && <div className="mb-4"><Notice tone="error">{err}</Notice></div>}
      {d && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <FolderOpen size={14} className="text-brass" aria-hidden="true" />
          No computador, a pasta fica em <code className="break-all text-ink2">{d.pasta}</code>
          <span>· {d.total} vídeo(s), {d.novos} novo(s)</span>
        </p>
      )}
      {itens.length === 0 ? (
        <Empty title="A pasta ainda está vazia">Processe uma gameplay: cada corte pronto aparece aqui sozinho.</Empty>
      ) : dias.map((dia) => (
        <section key={dia} className="mb-5" aria-label={`Vídeos de ${dia}`}>
          <h3 className="mb-2 font-mono text-xs font-bold text-ink2">📁 {dia.split('-').reverse().join('/')}</h3>
          <ul className="card divide-y divide-rule">
            {itens.filter((i) => i.dia === dia).map((i) => (
              <li key={i.caminho} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                {i.novo && <span className="rounded-md bg-ok/15 px-1.5 py-0.5 text-[10px] font-extrabold text-ok">NOVO</span>}
                <span className="min-w-0 flex-1 truncate text-ink" title={i.nome}>{i.nome.replace(/\.mp4$/i, '')}</span>
                <span className="font-mono text-[11px] text-muted">{fmtDate(i.em)} · {mb(i.bytes)}</span>
                <span className="flex gap-1">
                  {i.tem_texto && (
                    <a className="btn-quiet btn-sm" href={arquivo(i.caminho.replace(/\.mp4$/i, '.txt'))} target="_blank" rel="noreferrer"
                      aria-label={`Texto para postar: ${i.nome}`} title="Título, descrição e hashtags"><FileText size={14} /></a>
                  )}
                  <a className="btn-quiet btn-sm" href={arquivo(i.caminho)} download aria-label={`Baixar ${i.nome}`}><Download size={14} /></a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
