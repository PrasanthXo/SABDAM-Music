import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Only proxy relative API calls when strictly running inside a native mobile APK (Capacitor/file protocol)
if (typeof window !== 'undefined') {
  const isNative =
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'app:' ||
    window.location.protocol === 'file:';

  if (isNative) {
    const BACKEND_URL = 'https://ais-pre-eavywet5zknxtgryw4gwib-602144079882.asia-southeast1.run.app';
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input && typeof input === 'object' && 'url' in input) {
        url = (input as any).url;
      }

      if (url.startsWith('/api/') || url.startsWith('api/')) {
        const path = url.startsWith('/') ? url : `/${url}`;
        const target = `${BACKEND_URL}${path}`;
        if (typeof input === 'string' || input instanceof URL) {
          return originalFetch(target, init);
        }
        return originalFetch(new Request(target, input), init);
      }
      return originalFetch(input, init);
    };
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
