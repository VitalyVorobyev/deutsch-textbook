import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@da/ui/tokens.css';
import { App } from './App';
import { HinweisProvider } from './components/Hinweis';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    {/* One tooltip provider for the app: it owns the shared open/close timing, so moving between
        two findings does not re-wait the delay each time. */}
    <HinweisProvider>
      <App />
    </HinweisProvider>
  </StrictMode>,
);
