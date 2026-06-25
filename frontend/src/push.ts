/* PWA install + Web Push.
   - registerSW() installs the service worker (also required for installability).
   - enablePush() asks permission, subscribes via VAPID, and registers the
     subscription with the backend so the server can buzz the phone on key
     moments (vote opening, an elimination, the mood turning critical).
   On iPhone, push only works once the app is added to the Home Screen (iOS 16.4+). */

import { api } from "./api";
import type { Identity } from "./types";

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** True when running as an installed PWA (Home Screen / standalone). */
export function isInstalled(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushResult = "ok" | "unsupported" | "denied" | "no-vapid" | "error";

export async function enablePush(identity: Identity): Promise<PushResult> {
  if (!pushSupported()) return "unsupported";
  try {
    const { key } = await api.pushPublicKey();
    if (!key) return "no-vapid";

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const reg = (await navigator.serviceWorker.ready) ?? (await registerSW());
    if (!reg) return "error";

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      }));

    await api.pushSubscribe(identity.gameId, identity.playerId, identity.token, sub.toJSON());
    return "ok";
  } catch {
    return "error";
  }
}

export function notificationStatus(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}
