import React, { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { apiJson } from '../lib/api';

// Linha de produção (owner, 21-nov-2026, from the "15 canais dark" ad): the
// agents as five stages that light up in order: grey waiting, orange working,
// green done. The states come from the backend (gaming/pipeline.py LINHA);
// this only draws them. "Novos" counts the clips in the folder of new videos
// that the owner has not opened yet.
const ETAPAS = [
  { id: 'tema', label: 'Tema' }, { id: 'roteiro', label: 'Roteiro' }, { id: 'voz', label: 'Voz' },
  { id: 'midia', label: 'Mídia' }, { id: 'edicao', label: 'Edição' },
];
const NOME = { idle: 'aguardando', waiting: 'na fila', working: 'trabalhando', done: 'pronto', skipped: 'pulado', failed: 'falhou', stopped: 'parado' };
const dois = (n) => String(Math.max(0, n || 0)).padStart(2, '0');

export default function LinhaProducao({ linha, clipes, ativo = false, atualizar = 0, onAbrirPasta }) {
  const [novos, setNovos] = useState(null);
  useEffect(() => {
    let vivo = true;
    apiJson('/api/gaming/prontos').then((d) => vivo && setNovos(d.novos)).catch(() => {});
    return () => { vivo = false; };
  }, [atualizar, clipes?.ready]);

  const etapas = ETAPAS.map((e) => ({ ...e, state: 'idle', ...(linha || []).find((x) => x.id === e.id) }));
  const feitas = etapas.filter((e) => e.state === 'done' || e.state === 'skipped').length;
  const total = clipes?.total || 0;
  const prontos = clipes?.ready || 0;
  const pct = total ? Math.round((prontos / total) * 100) : Math.round((feitas / etapas.length) * 100);

  return (
    <section className="linha-prod mb-4" aria-label="Linha de produção">
      <div className="linha-prod-topo">
        <span className="linha-prod-titulo">LINHA DE PRODUÇÃO · AUTO</span>
        <span className="linha-prod-online"><i aria-hidden="true" /> {ativo ? 'PRODUZINDO' : 'ONLINE'}</span>
      </div>
      <ol className="linha-prod-etapas">
        {etapas.map((e) => (
          <li key={e.id} className={`linha-prod-etapa is-${e.state}`} title={`${e.label}: ${NOME[e.state] || e.state}${e.does ? ` · ${e.does}` : ''}`}>
            {e.label}
            <span className="sr-only">: {NOME[e.state] || e.state}</span>
          </li>
        ))}
      </ol>
      <div className="linha-prod-base">
        <div className="linha-prod-barra" role="progressbar" aria-label="Cortes prontos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
        <span className="linha-prod-conta">
          EM PRODUÇÃO <b>{dois(prontos)}/{dois(total)}</b>
          <button type="button" className="linha-prod-novos" onClick={onAbrirPasta} title="Abrir a pasta de vídeos novos">
            <FolderOpen size={13} aria-hidden="true" /> NOVOS <b>+{novos ?? 0}</b>
          </button>
        </span>
      </div>
    </section>
  );
}
