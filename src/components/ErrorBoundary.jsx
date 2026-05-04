import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application crashed:', error, errorInfo);
  }

  handleReload = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
            color: '#e2e8f0',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '640px',
              borderRadius: '24px',
              padding: '28px',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.35)',
            }}
          >
            <p style={{ margin: 0, color: '#fda4af', fontWeight: 700 }}>Cowculator hit an error</p>
            <h1 style={{ margin: '12px 0 8px', fontSize: '2rem', lineHeight: 1.1 }}>
              The app can recover without a blank screen now.
            </h1>
            <p style={{ margin: 0, color: '#94a3b8' }}>
              Try reloading the dashboard. If the problem continues, the error details below will help us fix it quickly.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                marginTop: '20px',
                border: 'none',
                borderRadius: '999px',
                padding: '12px 18px',
                background: '#10b981',
                color: '#022c22',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reload App
            </button>
            {this.state.error?.message && (
              <pre
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  borderRadius: '16px',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  background: 'rgba(2, 6, 23, 0.8)',
                  color: '#cbd5e1',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
