import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTheme, Toaster, TooltipProvider } from '@vitavision/ui';
import './styles.css';
import { App } from './App';

// Keeps a "system" choice following the OS; the class itself was set pre-paint in index.html.
initTheme('redaktion-theme');

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    {/* One tooltip provider for the app: it owns the shared open/close timing, so moving between
        two findings does not re-wait the delay each time. Radix tooltips throw without it. */}
    <TooltipProvider>
      <App />
      <Toaster />
    </TooltipProvider>
  </StrictMode>,
);
