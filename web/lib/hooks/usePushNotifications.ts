"use client";

import { useState, useEffect, useCallback } from "react";

type PushState = "unsupported" | "denied" | "granted" | "default" | "loading";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>(() => {
    if (typeof window === "undefined") return "loading";
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return "unsupported";
    }
    return Notification.permission as PushState;
  });

  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (state === "unsupported" || state === "loading") return;

    // Check existing subscription
    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    });
  }, [state]);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return false;

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw-push.js");

      // Request permission
      const permission = await Notification.requestPermission();
      setState(permission as PushState);

      if (permission !== "granted") return false;

      // Subscribe to push
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return false;

      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      // Send subscription to server
      const authKey = subscription.getKey("auth");
      const p256dhKey = subscription.getKey("p256dh");

      if (!authKey || !p256dhKey) {
        return false;
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          auth_key: btoa(
            String.fromCharCode(...new Uint8Array(authKey))
          ),
          p256dh_key: btoa(
            String.fromCharCode(...new Uint8Array(p256dhKey))
          ),
        }),
      });

      if (res.ok) {
        setIsSubscribed(true);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Push subscription failed:", err);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from server
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
      return false;
    }
  }, []);

  return {
    state,
    isSubscribed,
    subscribe,
    unsubscribe,
    isSupported: state !== "unsupported",
  };
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
