/**
 * Notification types and categories for user preferences
 */

export type NotificationChannel = "email" | "push" | "in_app";

export interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
  channels: NotificationChannel[];
}

export interface NotificationSettings {
  // Event notifications
  event_reminders: boolean;
  event_updates: boolean;
  new_matching_events: boolean;
  // Social notifications
  friend_activity: boolean;
  new_followers: boolean;
  event_invites: boolean;
  // System notifications
  weekly_digest: boolean;
  announcements: boolean;
  tips_and_features: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  // Events - on by default
  event_reminders: true,
  event_updates: true,
  new_matching_events: true,
  // Social - some on by default
  friend_activity: true,
  new_followers: true,
  event_invites: true,
  // System - digest on, others optional
  weekly_digest: true,
  announcements: false,
  tips_and_features: false,
};

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  // Event notifications
  {
    id: "event_reminders",
    name: "Event Reminders",
    description: "Reminders before events you're attending",
    icon: "clock",
    defaultEnabled: true,
    channels: ["push", "email"],
  },
  {
    id: "event_updates",
    name: "Event Updates",
    description: "Changes to events you're attending (time, venue, cancellation)",
    icon: "refresh",
    defaultEnabled: true,
    channels: ["push", "email"],
  },
  {
    id: "new_matching_events",
    name: "Recommended Events",
    description: "New events matching your preferences",
    icon: "sparkles",
    defaultEnabled: true,
    channels: ["email", "in_app"],
  },
  // Social notifications
  {
    id: "friend_activity",
    name: "Friend Activity",
    description: "When friends RSVP to events or join groups",
    icon: "users",
    defaultEnabled: true,
    channels: ["push", "in_app"],
  },
  {
    id: "new_followers",
    name: "New Followers",
    description: "When someone follows your profile",
    icon: "user-plus",
    defaultEnabled: true,
    channels: ["in_app"],
  },
  {
    id: "event_invites",
    name: "Event Invites",
    description: "When someone invites you to an event",
    icon: "mail",
    defaultEnabled: true,
    channels: ["push", "email", "in_app"],
  },
  // System notifications
  {
    id: "weekly_digest",
    name: "Weekly Digest",
    description: "Weekly roundup of events and activity",
    icon: "newspaper",
    defaultEnabled: true,
    channels: ["email"],
  },
  {
    id: "announcements",
    name: "Announcements",
    description: "Important updates about Lost City",
    icon: "megaphone",
    defaultEnabled: false,
    channels: ["email"],
  },
  {
    id: "tips_and_features",
    name: "Tips & Features",
    description: "Learn about new features and get usage tips",
    icon: "lightbulb",
    defaultEnabled: false,
    channels: ["email"],
  },
];

// Group categories by type
export const NOTIFICATION_GROUPS = {
  events: {
    label: "Events",
    categories: ["event_reminders", "event_updates", "new_matching_events"],
  },
  social: {
    label: "Social",
    categories: ["friend_activity", "new_followers", "event_invites"],
  },
  system: {
    label: "System",
    categories: ["weekly_digest", "announcements", "tips_and_features"],
  },
};
