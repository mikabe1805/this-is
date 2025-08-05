import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { NavigationProvider } from './contexts/NavigationContext.tsx'
import { ModalProvider } from './contexts/ModalContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NavigationProvider>
          <ModalProvider>
            <App />
          </ModalProvider>
        </NavigationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
