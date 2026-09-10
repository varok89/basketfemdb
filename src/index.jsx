import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { inject } from '@vercel/analytics';
import * as Sentry from '@sentry/react';

if (window.location.hostname !== 'localhost') {
  Sentry.init({
    dsn: 'https://e3f3c0ec5b9bfaa8e245b07d9b6ba430@o4512051062374400.ingest.de.sentry.io/4512051072204880',
    release: process.env.REACT_APP_SENTRY_RELEASE || undefined,
    // Tunnel via /api/monitoring: sortea adblockers que bloquean *.sentry.io.
    tunnel: '/api/monitoring',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  });
}

inject();

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
