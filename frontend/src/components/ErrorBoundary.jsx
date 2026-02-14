import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
                    <h1 style={{ color: '#EF4444' }}>Algo salió mal.</h1>
                    <p>La aplicación ha encontrado un error crítico.</p>
                    <details style={{ whiteSpace: 'pre-wrap', background: '#f1f5f9', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Ver detalles del error</summary>
                        <p style={{ marginTop: '0.5rem', color: '#DC2626' }}>{this.state.error && this.state.error.toString()}</p>
                        <p style={{ fontSize: '0.875rem', color: '#64748B' }}>{this.state.errorInfo && this.state.errorInfo.componentStack}</p>
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', background: '#0891B2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Recargar Página
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
