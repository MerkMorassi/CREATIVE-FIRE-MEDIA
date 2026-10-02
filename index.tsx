import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { loadMythosData } from './services/mythosData.ts';

async function bootstrap() {
  try {
    // 1. Load critical narrative data first
    await loadMythosData();

    // 2. Locate mount point
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error("Could not find root element to mount to");
    }

    // 3. Initialize React
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );

    // 4. Remove boot-time loader
    const loader = document.getElementById('init-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
    }

  } catch (error) {
    console.error("Bootstrap Failure:", error);
    // window.onerror will handle the UI display for this error
    throw error;
  }
}

// Start sequence
bootstrap();