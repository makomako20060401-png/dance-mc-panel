import { useEffect, useState } from 'react';
import { canDownload } from './storage';

export type OfflineStatus = 'ready' | 'preparing' | 'unavailable';

/** 通常のWebサイトとして開かれ、Service Worker が使える場合だけオフライン対応できる */
const supported =
  import.meta.env.PROD && 'serviceWorker' in navigator && canDownload && window.isSecureContext;

const registration: Promise<ServiceWorkerRegistration | null> = supported
  ? new Promise((resolve) => {
      const register = () =>
        navigator.serviceWorker
          .register('./sw.js')
          .then(() => navigator.serviceWorker.ready)
          .then(resolve, () => resolve(null));
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
    })
  : Promise.resolve(null);

export const APP_VERSION = __APP_VERSION__;

/*
 * 更新の検知。
 * ホーム画面に追加したアプリは裏から戻るだけで再起動されないことが多く、古い版のまま使い続けてしまう。
 * 画面に戻るたびに更新を確認し、新しい版が有効になったら画面に「更新する」を出す。
 */
let updateReady = false;
const updateListeners = new Set<() => void>();

if (supported) {
  // 初回インストール時も controllerchange が起きるため、
  // 切り替わる前に別の版が動いていた場合だけ「更新」として扱う
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const wasControlled = controlled;
    controlled = true;
    if (!wasControlled || updateReady) return;
    updateReady = true;
    updateListeners.forEach((f) => f());
  });
  const check = () => registration.then((r) => r?.update().catch(() => {}));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  registration.then(check);
}

/** 新しい版が使える状態になったか（再読み込みで反映される） */
export function useUpdateReady(): boolean {
  const [ready, setReady] = useState(updateReady);
  useEffect(() => {
    const f = () => setReady(true);
    updateListeners.add(f);
    return () => void updateListeners.delete(f);
  }, []);
  return ready;
}

export function applyUpdate(): void {
  window.location.reload();
}

/** 画面に「電波がなくても起動できるか」を出すための状態 */
export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>(supported ? 'preparing' : 'unavailable');
  useEffect(() => {
    let alive = true;
    registration.then((r) => alive && setStatus(r?.active ? 'ready' : 'unavailable'));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
