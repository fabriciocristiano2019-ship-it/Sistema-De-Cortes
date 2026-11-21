import React, { useEffect, useRef, useState } from 'react';
import { Archive, Download, Loader2, Upload } from 'lucide-react';
import { apiJson } from '../lib/api';
import { getApiUrl } from '../config';
import { pedir } from './envio';
import { Notice } from './ui';

// Clips and history live only inside the codespace: deleting it deletes them.
// One .zip out (download), the same .zip back in (restore, sent in 8 MB parts
// because Codespaces refuses a big file in one request).
const PARTE = 8 * 1024 * 1024;

const tamanho = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1024 ** 2))} MB`);

async function enviarBackup(file, onPct) {
  const { id } = await pedir('/api/gaming/backup/restauracao', { method: 'POST' });
  let offset = 0;
  while (offset < file.size) {
    const fim = Math.min(file.size, offset + PARTE);
    for (let tentativa = 1; ; tentativa += 1) {
      try {
        await pedir(`/api/gaming/backup/restauracao/${id}/parte?offset=${offset}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: file.slice(offset, fim),
        });
        break;
      } catch (e) {
        if (tentativa >= 4 || (e.status && e.status < 500 && e.status !== 409)) throw e;
        await new Promise((r) => setTimeout(r, 1500 * tentativa));
      }
    }
    offset = fim;
    onPct(Math.round((offset / file.size) * 100));
  }
  return pedir(`/api/gaming/backup/restauracao/${id}/concluir`, { method: 'POST' });
}

export default function BackupCard({ onRestaurado }) {
  const [resumo, setResumo] = useState(null);
  const [pct, setPct] = useState(null);
  const [fim, setFim] = useState(null);
  const [erro, setErro] = useState('');
  const input = useRef(null);
  const carregar = () => apiJson('/api/gaming/backup/resumo').then(setResumo).catch(() => setResumo({ erro: true }));
  useEffect(() => { carregar(); }, []);

  const restaurar = async (file) => {
    if (!file) return;
    setErro(''); setFim(null); setPct(0);
    try {
      const r = await enviarBackup(file, setPct);
      setFim(r); carregar(); onRestaurado?.();
    } catch (e) {
      setErro(e?.message || 'Não deu para restaurar o backup.');
    } finally {
      setPct(null);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <section aria-labelledby="cfg-backup" className="min-w-0 rounded-[20px] border border-rule2 bg-paper2 p-5" style={{ boxShadow: 'var(--sede-card-shadow)' }}>
      <h3 id="cfg-backup" className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-ink">
        <Archive size={16} className="text-brass" aria-hidden="true" /> Backup dos cortes
      </h3>
      <p className="mb-3 text-sm text-ink2">
        Os cortes e o histórico de publicações ficam <b className="text-ink">só dentro deste Codespace</b>.
        Se ele for apagado, tudo vai junto. Baixe um backup de vez em quando e guarde no seu computador ou no Google Drive.
      </p>
      <p className="mb-3 text-xs text-muted">
        {!resumo ? 'Contando os cortes…' : resumo.erro ? 'Não deu para contar os cortes agora.'
          : resumo.cortes === 0 ? 'Ainda não há cortes prontos para guardar (o histórico vai junto mesmo assim).'
            : `${resumo.cortes} corte${resumo.cortes > 1 ? 's' : ''} de ${resumo.trabalhos} vídeo${resumo.trabalhos > 1 ? 's' : ''} · cerca de ${tamanho(resumo.bytes)}`}
        {resumo && !resumo.erro && (resumo.ultimo_backup
          ? ` · último backup: ${new Date(resumo.ultimo_backup * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${resumo.cortes_sem_backup ? ` (${resumo.cortes_sem_backup} corte${resumo.cortes_sem_backup > 1 ? 's' : ''} novo${resumo.cortes_sem_backup > 1 ? 's' : ''} desde então)` : ''}`
          : ' · nenhum backup baixado ainda')}
      </p>
      <div className="flex flex-wrap gap-2">
        <a className="sede-btn-accent inline-flex items-center gap-1.5 px-4" href={getApiUrl('/api/gaming/backup')} download>
          <Download size={15} aria-hidden="true" /> Baixar backup
        </a>
        <button type="button" disabled={pct !== null} onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rule2 px-4 py-2 text-sm font-bold text-ink2 hover:border-brass disabled:opacity-60">
          {pct !== null ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
          {pct !== null ? (pct < 100 ? `Enviando ${pct}%` : 'Restaurando…') : 'Restaurar backup'}
        </button>
        <input ref={input} type="file" accept=".zip,application/zip" className="hidden" aria-label="Arquivo de backup (.zip)"
          onChange={(e) => restaurar(e.target.files?.[0])} />
      </div>
      <p className="mt-3 text-xs text-muted">
        Restaurar não apaga nada: cortes que já estão aqui ficam como estão, e o histórico é somado.
        As chaves (YouTube, Gemini) não vão no backup; cadastre de novo num Codespace novo.
      </p>
      {fim && (
        <div className="mt-3"><Notice tone="ok">
          Backup restaurado: {fim.cortes} corte{fim.cortes === 1 ? '' : 's'} de {fim.trabalhos} vídeo{fim.trabalhos === 1 ? '' : 's'} voltaram
          {fim.publicacoes ? `, ${fim.publicacoes} publicaç${fim.publicacoes === 1 ? 'ão' : 'ões'} no histórico` : ''}.
          {fim.trabalhos_ja_existiam ? ` ${fim.trabalhos_ja_existiam} já estavam aqui e ficaram como estavam.` : ''}
        </Notice></div>
      )}
      {erro && <div className="mt-3"><Notice tone="error">{erro}</Notice></div>}
    </section>
  );
}
