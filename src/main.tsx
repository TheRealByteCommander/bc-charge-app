import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AccessibilityProvider } from './context/AccessibilityContext.tsx';
import { LocaleProvider } from './i18n/LocaleContext.tsx';
import { registerServiceWorker } from './utils/registerServiceWorker.ts';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AccessibilityProvider>
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  </StrictMode>
);
