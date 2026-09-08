import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HostSessionProvider } from './lib/HostSessionProvider'
import { AppSecretGate } from './components/AppSecretGate'
// Handwritten fonts for the hand-drawn market card (loaded so the canvas
// renderer can draw with them).
import '@fontsource/caveat/600.css'
import '@fontsource/caveat/700.css'
import '@fontsource/kalam/400.css'
import '@fontsource/kalam/700.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppSecretGate>
        <HostSessionProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </HostSessionProvider>
      </AppSecretGate>
    </ErrorBoundary>
  </React.StrictMode>,
)
