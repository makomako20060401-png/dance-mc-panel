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
