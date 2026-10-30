import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import { App } from './App';
import { redeemLaunchCode, setToken, shellToken, takeLaunchCode } from './auth';

// Before the first render, and outside React: StrictMode runs effects twice in development, and a
// launch code redeemed twice is a launch code refused.
const vomShell = shellToken();
if (vomShell) setToken(vomShell);
const code = vomShell ? null : takeLaunchCode();

createRoot(document.getElementById('tonwerk')!).render(
  <StrictMode>
    <App anmeldung={code ? redeemLaunchCode(code) : undefined} />
  </StrictMode>,
);
