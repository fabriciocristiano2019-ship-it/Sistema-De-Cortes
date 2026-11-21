import React, { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { apiJson } from '../lib/api';
import { mediaUrl } from './util';

// Palco do agente (owner, 21-nov-2026: "segue o vídeo"). Like the ad, the
// stage being worked on is shown as a big card of its agent doing the job:
// radar (Tema), roteiro.txt with gancho / virada / clímax (Roteiro), voice
// bars (Voz), the vertical frame (Mídia), the timeline (Edição) and, at the
// end, the folder of new videos. Everything shown is real: the stage states
// come from the backend and the script lines from the clip itself.
const ETAPAS = {
  tema: { n: '01', label: 'Tema', agente: 'ULTRON', frase: ['ACHA O', 'MOMENTO FORTE'], agentes: ['ingest', 'library', 'whisper', 'vision', 'x51', 'homer', 'slicer'] },
  roteiro: { n: '02', label: 'Roteiro', agente: 'A.I.D.A.', frase: ['ESCREVE O', 'GANCHO'], agentes: ['aida'] },
  voz: { n: '03', label: 'Voz', agente: 'I.S.A.A.C.', frase: ['NARRA', 'A ABERTURA'], agentes: ['isaac'] },
  midia: { n: '04', label: 'Mídia', agente: 'VISION', frase: ['MONTA', 'EM PÉ'], agentes: ['editor916'] },
  edicao: { n: '05', label: 'Edição', agente: 'JOCASTA', frase: ['LEGENDA', 'E FINALIZA'], agentes: ['captions'] },
  pasta: { n: '06', label: 'Entrega', agente: 'VERONICA', frase: ['ABRA', 'A PASTA'], agentes: ['social'] },
};
const ORDEM = ['tema', 'roteiro', 'voz', 'midia', 'edicao', 'pasta'];
const seg = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

function padrao(id, st, clip) {
  if (id === 'pasta') return 'Cada corte pronto cai na pasta com o texto para postar.';
  if (id === 'roteiro' && clip?.auto_hook?.text) return `Gancho escrito: “${clip.auto_hook.text}”.`;
  if (st === 'skipped') return id === 'voz' ? 'Etapa pulada: sem voz instalada neste computador.' : 'Etapa pulada neste corte.';
  if (st === 'done') return 'Etapa concluída.';
  if (st === 'working') return 'Trabalhando agora…';
  return 'Aguardando a sua vez na linha.';
}

function etapaAtual(linha, ativo) {
  const l = linha || [];
  const trabalhando = l.find((e) => e.state === 'working');
  if (trabalhando) return trabalhando.id;
  if (ativo) return (l.find((e) => e.state === 'waiting') || { id: 'tema' }).id;
  return 'pasta';
}

function Radar({ clip, rodando }) {
  const ev = (clip?.evidence || []).slice(0, 5);
  return (
    <div className="palco-radar" aria-hidden="true">
      <div className={`palco-radar-varre ${rodando ? 'is-on' : ''}`} />
      {(ev.length ? ev : [0, 1, 2]).map((_, i) => (
        <i key={i} style={{ left: `${30 + ((i * 37) % 45)}%`, top: `${25 + ((i * 53) % 50)}%` }} />
      ))}
    </div>
  );
}

function Roteiro({ clip }) {
  const dur = clip ? Math.max(0, (clip.end || 0) - (clip.start || 0)) : 0;
  const pico = clip ? (clip.peak_time ?? clip.start) - clip.start : 0;
  const gancho = clip?.auto_hook?.text || clip?.viral_hook_text || 'aguardando o corte…';
  return (
    <div className="palco-roteiro">
      <div className="palco-papel">
        <p className="palco-papel-nome">ROTEIRO.TXT</p>
        <p><mark>CENA 1 · GANCHO FORTE</mark> {gancho}</p>
        <p><b>CENA 2 · A VIRADA</b> {clip ? `${(clip.moment_label || 'momento').toLowerCase()} aos ${seg(pico)}` : '—'}</p>
        <p><b>CENA 3 · CLÍMAX</b> {clip ? `fecha em ${seg(dur)} (${Math.round(dur)} s)` : '—'}</p>
      </div>
      <div className="palco-tags" aria-hidden="true"><span className="is-on">GANCHO</span><span>VIRADA</span><span>CLÍMAX</span></div>
    </div>
  );
}

function Voz({ clip, rodando }) {
  const narr = clip?.auto_hook?.narracao;
  return (
    <div className="palco-voz">
      <div className={`palco-ondas ${rodando ? 'is-on' : ''}`} aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 6) * 0.11}s`, height: `${20 + ((i * 37) % 70)}%` }} />)}
      </div>
      <p className="palco-legenda">{narr ? `“${narr}”` : 'Sem voz instalada: o gancho entra escrito na faixa vermelha.'}</p>
    </div>
  );
}

function Midia({ clip }) {
  return (
    <div className="palco-midia">
      <div className="palco-celular">
        {clip?.video_url
          ? <video src={`${mediaUrl(clip.video_url)}#t=${Math.max(0.5, (clip.peak_time ?? clip.start) - clip.start)}`} muted playsInline preload="metadata" aria-label="Quadro do corte em pé" />
          : <span>9:16</span>}
      </div>
      <p className="palco-legenda">1080×1920 · {clip?.layout === 'webcam' ? 'webcam no cartão em cima' : 'jogo em tela cheia'}</p>
    </div>
  );
}

function Edicao({ rodando }) {
  const faixas = [['VÍDEO', ['#4c1d95', '#7e22ce', '#1e3a8a', '#78552b', '#0f766e']], ['LEGENDA', ['#fff', '#f59e0b', '#fff', '#f59e0b', '#fff', '#f59e0b']], ['TRILHA', ['#334155']]];
  return (
    <div className="palco-edicao">
      <p className="palco-legenda">TIMELINE · AUTO</p>
      {faixas.map(([nome, cores]) => (
        <div key={nome} className="palco-faixa">
          <span>{nome}</span>
          <div>{cores.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
        </div>
      ))}
      <b className={`palco-agulha ${rodando ? 'is-on' : ''}`} aria-hidden="true" />
    </div>
  );
}

function Pasta({ novos, onAbrir }) {
  return (
    <button type="button" className="palco-pasta" onClick={onAbrir} title="Abrir a pasta de vídeos novos">
      <FolderOpen size={22} aria-hidden="true" />
      <span>VÍDEOS NOVOS</span>
      <b>+{novos ?? 0}</b>
    </button>
  );
}

export default function PalcoAgente({ linha, console: linhas = [], clip, ativo = false, onAbrirPasta, atualizar = 0 }) {
  const atual = etapaAtual(linha, ativo);
  const [vendo, setVendo] = useState(null);
  const [novos, setNovos] = useState(null);
  useEffect(() => { setVendo(null); }, [atual]);
  useEffect(() => {
    let vivo = true;
    apiJson('/api/gaming/prontos').then((d) => vivo && setNovos(d.novos)).catch(() => {});
    return () => { vivo = false; };
  }, [atualizar]);

  const id = vendo || atual;
  const e = ETAPAS[id];
  const st = id === 'pasta' ? (ativo ? 'waiting' : 'done') : ((linha || []).find((x) => x.id === id)?.state || 'idle');
  const rodando = st === 'working';
  const ultima = [...linhas].reverse().find((c) => e.agentes.includes(c.agent));
  const corpo = {
    tema: <Radar clip={clip} rodando={rodando} />, roteiro: <Roteiro clip={clip} />, voz: <Voz clip={clip} rodando={rodando} />,
    midia: <Midia clip={clip} />, edicao: <Edicao rodando={rodando} />, pasta: <Pasta novos={novos} onAbrir={onAbrirPasta} />,
  }[id];

  return (
    <section className="palco mb-4" aria-label={`Agente da etapa ${e.label}`}>
      <div className="palco-luzes" aria-hidden="true"><i /><i /><i /></div>
      <div className="palco-grade">
        <div className={`palco-cartao is-${st}`}>
          <div className="palco-topo">
            <span className="palco-num">{e.n}</span>
            <span className="palco-nome">{e.label.toUpperCase()}</span>
            <span className="palco-agente">AGENTE · {e.agente}</span>
            <span className={`palco-luz is-${st}`} title={st} />
          </div>
          <div className="palco-corpo">{corpo}</div>
        </div>
        <div className="palco-lado">
          <p className="palco-frase"><span>{e.frase[0]}</span> <em>{e.frase[1]}</em></p>
          <p className="palco-status" aria-live="polite">{ultima?.text || padrao(id, st, clip)}</p>
          <nav className="palco-dots" aria-label="Ver outra etapa">
            {ORDEM.map((k) => (
              <button key={k} type="button" aria-label={ETAPAS[k].label} aria-current={k === id ? 'step' : undefined}
                className={k === atual ? 'is-atual' : ''} onClick={() => setVendo(k === atual ? null : k)} />
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
