export type Visibility = "public" | "friends" | "private";

export const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  description: string;
  icon: "globe" | "users" | "lock";
}[] = [
  { value: "public", label: "Public", description: "Anyone can see", icon: "globe" },
  { value: "friends", label: "Friends", description: "Only mutual follows", icon: "users" },
  { value: "private", label: "Private", description: "Only you", icon: "lock" },
];

export const DEFAULT_VISIBILITY: Visibility = "friends";
