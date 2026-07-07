import { useCallback, useEffect, useState } from 'react';
import { pushApi } from '../lib/push.api';

// Converts the VAPID public key (URL-safe base64, as returned by the server)
// into the Uint8Array shape the Push API's applicationServerKey expects.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const isSupported =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? Notification.permission : 'denied'
  );
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Register the service worker once, and check whether a push subscription
  // already exists (e.g. the user enabled this on a previous visit).
  useEffect(() => {
    if (!isSupported) return;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const existing = await registration.pushManager.getSubscription();
        setIsEnabled(!!existing);
      } catch (err) {
        console.error('Service worker registration failed', err);
      }
    })();
  }, [isSupported]);

  const enable = useCallback(async () => {
    if (!isSupported) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      const { data } = await pushApi.getVapidPublicKey();

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey) as BufferSource,
        });
      }

      await pushApi.subscribe(subscription.toJSON() as any);
      setIsEnabled(true);
    } catch (err) {
      console.error('Failed to enable push notifications', err);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const disable = useCallback(async () => {
    if (!isSupported) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await pushApi.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsEnabled(false);
    } catch (err) {
      console.error('Failed to disable push notifications', err);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  return { isSupported, permission, isEnabled, loading, enable, disable };
}