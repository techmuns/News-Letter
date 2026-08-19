import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HostSessionProvider } from './lib/HostSessionProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HostSessionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HostSessionProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
