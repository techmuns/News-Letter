import { Component, type ReactNode } from 'react'

/** App-wide safety net. A render error inside the tree is caught here and shown
    as a recoverable panel instead of unmounting everything to a blank screen.
    (React error boundaries must be class components.) */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Surface it for debugging without taking down the app.
    console.error('Caught by ErrorBoundary:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#14121c',
          color: '#e8e6f0',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            Something hiccupped
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#a7a4b5', margin: '0 0 18px' }}>
            The page hit an unexpected error and stopped rendering. Your saved work is safe —
            reload to continue.
          </p>
          <button
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
            style={{
              background: '#5b4bd6',
              color: '#fff',
              border: 0,
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
