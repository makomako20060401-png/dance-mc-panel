import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store';
import { DialogProvider } from './components/common/Dialogs';
import './styles.css';
// Service Worker の登録（オフライン対応）。読み込むだけで登録が始まる
import './offline';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </StoreProvider>
  </StrictMode>,
);
