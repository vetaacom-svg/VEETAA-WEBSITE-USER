import React from 'react';
import ReactDOM from 'react-dom/client';
import './debug';
import './index.css';
import {
  sanitizeVeetaaStorage,
  scheduleVeetaaStorageSanitizeOnVisible,
  autoClearVeetaaDataIfHeavy,
} from './lib/storage';
import { setupRuntimeLogging } from './lib/runtime-logging';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

sanitizeVeetaaStorage();
setupRuntimeLogging();

/** Si panier / favoris / cache dépassent ~2,5 Mo : même nettoyage que « Vider les données locales », puis reload une fois. */
if (autoClearVeetaaDataIfHeavy()) {
  window.location.reload();
} else {
  scheduleVeetaaStorageSanitizeOnVisible();
  const bootstrap = async () => {
    const { default: App } = await import('./App');
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  };
  void bootstrap();
}
