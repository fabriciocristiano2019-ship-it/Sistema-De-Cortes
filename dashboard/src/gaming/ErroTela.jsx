import React from 'react';

// A render error used to unmount the whole panel and leave an empty dark
// screen with no clue. This catches it, says what happened and offers a
// reload; the job keeps running on the server, so reloading loses nothing.
export default class ErroTela extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erro: null, copiado: false };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('Erro na tela do painel:', erro, info?.componentStack);
  }

  detalhes() {
    const e = this.state.erro;
    return `${e?.name || 'Erro'}: ${e?.message || e}\n${(e?.stack || '').split('\n').slice(0, 6).join('\n')}\n${navigator.userAgent}`;
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#06101f', color: '#e5e7eb', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 520, width: '100%', border: '1px solid #334155', borderRadius: 16, padding: 24, background: '#0b1220' }}>
          <h1 style={{ margin: 0, fontSize: 20, color: '#fbbf24' }}>Algo deu errado na tela</h1>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, color: '#cbd5e1' }}>
            O processamento dos vídeos continua no servidor. Recarregue para voltar ao painel.
            Se repetir, mande um print desta mensagem.
          </p>
          <pre style={{ marginTop: 12, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12, background: '#020617', padding: 10, borderRadius: 8, color: '#fca5a5' }}>
            {this.detalhes()}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => window.location.reload()}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 0, background: '#22d3ee', color: '#0b1020', fontWeight: 800, cursor: 'pointer' }}>
              Recarregar
            </button>
            <button type="button"
              onClick={() => navigator.clipboard?.writeText(this.detalhes()).then(() => this.setState({ copiado: true })).catch(() => {})}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#e5e7eb', fontWeight: 700, cursor: 'pointer' }}>
              {this.state.copiado ? 'Copiado' : 'Copiar detalhes'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
