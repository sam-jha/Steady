import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { AppProvider } from './data/AppContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter keeps URLs like /#/dashboard, which works on GitHub Pages without server setup. */}
    <ErrorBoundary>
      <HashRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
