import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import DemoAccessProvider from './auth/DemoAccessProvider'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DemoAccessProvider>
        <App />
      </DemoAccessProvider>
    </BrowserRouter>
  </StrictMode>,
)
