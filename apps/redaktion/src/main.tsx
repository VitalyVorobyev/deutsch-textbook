import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@da/ui/tokens.css';
import { App } from './App';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
