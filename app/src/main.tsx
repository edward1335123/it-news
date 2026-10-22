import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { dataUrl } from './lib/useRemoteData';
import { warmDataCacheOnFirstControl } from './lib/warmDataCache';
import './styles/tokens.css';
import './styles/global.css';

warmDataCacheOnFirstControl(['news.json', 'events.json', 'sources.json'].map(dataUrl));

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root が見つかりません');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
