"use client";

import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { useToast } from "@/components/Toast";

export function PushNotificationToggle() {
  const { state, isSubscribed, subscribe, unsubscribe, isSupported } = usePushNotifications();
  const { showToast } = useToast();

  if (!isSupported) {
    return (
      <div className="flex items-start gap-3 p-4 glass border border-[var(--twilight)] rounded-xl opacity-60">
        <div className="w-8 h-8 rounded-full bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-[var(--muted)]">Push notifications are not supported in this browser.</p>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex items-start gap-3 p-4 glass border border-[var(--coral)]/20 rounded-xl">
        <div className="w-8 h-8 rounded-full bg-[var(--coral)]/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-[var(--cream)]">Notifications blocked</p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            You&apos;ve blocked notifications. Update your browser settings to enable them.
          </p>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        showToast("Notifications disabled", "success");
      }
    } else {
      const success = await subscribe();
      if (success) {
        showToast("Notifications enabled!", "success");
      } else {
        showToast("Failed to enable notifications", "error");
      }
    }
  };

  return (
    <div className="flex items-center justify-between p-4 glass border border-[var(--twilight)] rounded-xl">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isSubscribed ? "bg-[var(--neon-green)]/15" : "bg-[var(--twilight)]"
        }`}>
          <svg className={`w-4 h-4 ${isSubscribed ? "text-[var(--neon-green)]" : "text-[var(--muted)]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-[var(--cream)]">Push notifications</p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Get notified when friends RSVP, accept requests, or invite you.
          </p>
        </div>
      </div>

      <label className="relative flex-shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={isSubscribed}
          onChange={handleToggle}
          className="sr-only peer"
        />
        <div className="w-10 h-6 bg-[var(--twilight)] rounded-full peer-checked:bg-[var(--neon-green)] transition-colors" />
        <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
      </label>
    </div>
  );
}
