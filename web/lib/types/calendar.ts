// Canonical calendar types — single source of truth
// Mirrors shapes from /api/user/calendar route.ts

export type RSVPStatus = "going" | "interested" | "went";

export type CalendarView = "month" | "week" | "agenda";

export type StatusFilter = "all" | "going" | "interested";

export type SheetType =
  | "event-preview"
  | "plan-preview"
  | "create-plan"
  | "add-to-plan"
  | "filter"
  | "change-rsvp"
  | "conflict";

export type SheetState =
  | { sheet: null }
  | { sheet: "event-preview"; data: CalendarEvent }
  | { sheet: "plan-preview"; data: CalendarPlan }
  | { sheet: "create-plan" }
  | { sheet: "add-to-plan"; data: CalendarEvent }
  | { sheet: "filter" }
  | { sheet: "change-rsvp"; data: CalendarEvent }
  | { sheet: "conflict"; data: { newEvent: CalendarEvent; conflicts: CalendarEvent[] } };

export interface CalendarEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  genres?: string[] | null;
  image_url: string | null;
  description: string | null;
  ticket_url: string | null;
  source_url: string | null;
  rsvp_status: RSVPStatus;
  rsvp_created_at: string;
  venue: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

export interface CalendarPlan {
  id: string;
  title: string;
  description: string | null;
  plan_date: string;
  plan_time: string | null;
  status: string;
  item_count: number;
  creator: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  participants: Array<{
    user_id: string;
    status: string;
    user: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  }>;
  is_creator: boolean;
  participant_status: string | null;
}

export interface FriendCalendarEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  category: string | null;
  rsvp_status: "going" | "interested";
  friend: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface Friend {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface DayData {
  date: Date;
  events: CalendarEvent[];
  friendEvents: FriendCalendarEvent[];
  plans: CalendarPlan[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

export interface CalendarPreferences {
  default_view: CalendarView;
  week_start: "sunday" | "monday";
  show_friend_events: boolean;
  show_past_events: boolean;
}

export interface CalendarSummary {
  total: number;
  going: number;
  interested: number;
  plans: number;
  daysWithEvents: number;
}

export interface CalendarState {
  currentMonth: Date;
  selectedDate: Date | null;
  currentView: CalendarView;
  statusFilter: StatusFilter;
  friendsPanelOpen: boolean;
  selectedFriendIds: Set<string>;
  sheetState: SheetState;
  syncMenuOpen: boolean;
}

export type CalendarAction =
  | { type: "SET_MONTH"; month: Date }
  | { type: "SELECT_DATE"; date: Date | null }
  | { type: "SET_VIEW"; view: CalendarView }
  | { type: "SET_STATUS_FILTER"; filter: StatusFilter }
  | { type: "TOGGLE_FRIENDS_PANEL" }
  | { type: "TOGGLE_FRIEND"; friendId: string }
  | { type: "CLEAR_FRIENDS" }
  | { type: "OPEN_SHEET"; sheetState: Exclude<SheetState, { sheet: null }> }
  | { type: "CLOSE_SHEET" }
  | { type: "GO_TO_TODAY" }
  | { type: "NEXT_MONTH" }
  | { type: "PREV_MONTH" }
  | { type: "TOGGLE_SYNC_MENU" };

export const STATUS_FILTER_OPTIONS: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "all", label: "All RSVPs" },
  { value: "going", label: "Going" },
  { value: "interested", label: "Interested" },
];
