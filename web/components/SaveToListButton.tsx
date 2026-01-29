"use client";

import { useState, useEffect, useRef, memo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { IconButton } from "./ui/Button";

interface SaveToListButtonProps {
  itemType: "venue" | "event" | "organization";
  itemId: number;
  className?: string;
}

interface UserList {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  contains_item?: boolean;
}

export const SaveToListButton = memo(function SaveToListButton({
  itemType,
  itemId,
  className = "",
}: SaveToListButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lists, setLists] = useState<UserList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [savingToList, setSavingToList] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Check auth status
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  // Fetch user's lists when dropdown opens
  const fetchLists = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        item_type: itemType,
        item_id: itemId.toString(),
      });

      const response = await fetch(`/api/users/me/lists?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 401) {
          setError("Please sign in to save items");
          return;
        }
        throw new Error("Failed to fetch lists");
      }

      const data = await response.json();
      setLists(data.lists || []);
    } catch (err) {
      console.error("Error fetching lists:", err);
      setError("Failed to load lists");
    } finally {
      setIsLoading(false);
    }
  }, [user, itemType, itemId]);

  // Toggle dropdown
  const handleButtonClick = () => {
    if (!user) {
      // Redirect to sign in
      window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname);
      return;
    }

    if (!isOpen) {
      fetchLists();
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Add/remove item from list
  const toggleListItem = async (listId: string, currentlyContains: boolean) => {
    if (!user) return;

    setSavingToList(listId);
    setError(null);

    try {
      if (currentlyContains) {
        // Show confirmation or just toggle off (for now, just show message)
        setError("Item already in this list");
        setSavingToList(null);
        return;
      }

      // Add to list
      const response = await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_type: itemType,
          venue_id: itemType === "venue" ? itemId : null,
          event_id: itemType === "event" ? itemId : null,
          organization_id: itemType === "organization" ? itemId : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add item to list");
      }

      // Update local state
      setLists(lists.map(list =>
        list.id === listId
          ? { ...list, contains_item: true }
          : list
      ));

      // Close dropdown after a brief delay
      setTimeout(() => {
        setIsOpen(false);
      }, 500);
    } catch (err) {
      console.error("Error toggling list item:", err);
      setError("Failed to update list");
    } finally {
      setSavingToList(null);
    }
  };

  // Check if item is saved to any list
  const isSavedToAnyList = lists.some(list => list.contains_item);

  return (
    <div className={`relative ${className}`}>
      <IconButton
        ref={buttonRef}
        variant="ghost"
        size="md"
        label="Save to list"
        onClick={handleButtonClick}
        className="relative"
      >
        {isSavedToAnyList ? (
          <BookmarkIconFilled className="w-5 h-5" />
        ) : (
          <BookmarkIcon className="w-5 h-5" />
        )}
      </IconButton>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-72 bg-[var(--night)] border border-[var(--twilight)] rounded-lg shadow-2xl shadow-black/20 z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--twilight)]">
            <h3 className="text-sm font-mono font-semibold text-[var(--cream)]">
              Save to list
            </h3>
          </div>

          {/* Lists */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading && (
              <div className="p-4 text-center">
                <div className="animate-spin h-5 w-5 border-2 border-[var(--neon-magenta)] border-t-transparent rounded-full mx-auto" />
                <p className="text-xs text-[var(--soft)] mt-2">Loading lists...</p>
              </div>
            )}

            {error && !isLoading && (
              <div className="p-4 text-center">
                <p className="text-xs text-[var(--coral)]">{error}</p>
              </div>
            )}

            {!isLoading && !error && lists.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-sm text-[var(--soft)] mb-3">
                  You don&apos;t have any lists yet
                </p>
                <Link
                  href="/community/lists/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg text-sm font-mono hover:bg-[var(--rose)] transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Create your first list
                </Link>
              </div>
            )}

            {!isLoading && !error && lists.length > 0 && (
              <>
                <div className="py-1">
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => toggleListItem(list.id, list.contains_item || false)}
                      disabled={savingToList === list.id}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--twilight)] transition-colors disabled:opacity-50 focus:outline-none focus:bg-[var(--twilight)] focus:ring-2 focus:ring-inset focus:ring-[var(--coral)]/50"
                    >
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            list.contains_item
                              ? "border-[var(--neon-green)] bg-[var(--neon-green)]/20"
                              : "border-[var(--muted)]"
                          }`}
                        >
                          {list.contains_item && (
                            <CheckIcon className="w-3 h-3 text-[var(--neon-green)]" />
                          )}
                          {savingToList === list.id && (
                            <div className="w-3 h-3 border border-[var(--neon-green)] border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--cream)] font-medium truncate">
                            {list.title}
                          </p>
                          {list.category && (
                            <p className="text-xs text-[var(--soft)] capitalize">
                              {list.category.replace(/_/g, " ")}
                            </p>
                          )}
                        </div>
                      </div>
                      {!list.is_public && (
                        <LockIcon className="w-3.5 h-3.5 text-[var(--muted)] ml-2" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Create new list button */}
                <div className="border-t border-[var(--twilight)] p-2">
                  <Link
                    href="/community/lists/create"
                    className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Create new list
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export type { SaveToListButtonProps };

// Icons
function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

function BookmarkIconFilled({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 2a2 2 0 00-2 2v16l8-4 8 4V4a2 2 0 00-2-2H6z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}
