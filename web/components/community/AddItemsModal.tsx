"use client";

import { useState, useEffect, useRef } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import Button from "@/components/ui/Button";

type ItemType = "venue" | "event" | "producer";

interface ExistingItem {
  item_type: string;
  venue_id?: number;
  event_id?: number;
  producer_id?: number;
}

interface AddItemsModalProps {
  listId: string;
  existingItems: ExistingItem[];
  onClose: () => void;
  onItemsAdded: () => void;
}

interface VenueResult {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  venue_type: string | null;
}

interface EventResult {
  id: number;
  title: string;
  slug: string;
  start_date: string;
  venue: { name: string } | null;
}

interface ProducerResult {
  id: string;
  name: string;
  slug: string;
  org_type: string | null;
  neighborhood: string | null;
}

export function AddItemsModal({ listId, existingItems, onClose, onItemsAdded }: AddItemsModalProps) {
  const [activeTab, setActiveTab] = useState<ItemType>("venue");
  const [query, setQuery] = useState("");
  const [venues, setVenues] = useState<VenueResult[]>([]);
  const [events, setEvents] = useState<EventResult[]>([]);
  const [producers, setProducers] = useState<ProducerResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Search when query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setVenues([]);
      setEvents([]);
      setProducers([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: debouncedQuery,
          limit: "10",
        });

        if (activeTab === "venue") {
          const res = await fetch(`/api/venues/search?${params}`);
          if (!res.ok) throw new Error("Search failed");
          const data = await res.json();
          setVenues(data.venues || []);
        } else if (activeTab === "event") {
          params.append("upcoming", "true");
          const res = await fetch(`/api/events/search?${params}`);
          if (!res.ok) throw new Error("Search failed");
          const data = await res.json();
          setEvents(data.events || []);
        } else if (activeTab === "producer") {
          const res = await fetch(`/api/producers/search?${params}`);
          if (!res.ok) throw new Error("Search failed");
          const data = await res.json();
          setProducers(data.producers || []);
        }
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery, activeTab]);

  // Reset query when switching tabs
  useEffect(() => {
    setQuery("");
    setVenues([]);
    setEvents([]);
    setProducers([]);
  }, [activeTab]);

  // Check if item is already in list
  const isItemInList = (itemType: ItemType, itemId: number | string) => {
    return existingItems.some((item) => {
      if (itemType === "venue" && item.item_type === "venue") {
        return item.venue_id === itemId;
      }
      if (itemType === "event" && item.item_type === "event") {
        return item.event_id === itemId;
      }
      if (itemType === "producer" && item.item_type === "producer") {
        return item.producer_id === itemId;
      }
      return false;
    });
  };

  // Add item to list
  const handleAddItem = async (itemType: ItemType, itemId: number | string) => {
    setIsAdding(itemId);
    setError(null);

    try {
      const body: Record<string, string | number> = { item_type: itemType };
      if (itemType === "venue") body.venue_id = itemId;
      if (itemType === "event") body.event_id = itemId;
      if (itemType === "producer") body.producer_id = itemId;

      const res = await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add item");
      }

      // Refresh the list
      onItemsAdded();
    } catch (err) {
      console.error("Add item error:", err);
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setIsAdding(null);
    }
  };

  const tabs: { key: ItemType; label: string }[] = [
    { key: "venue", label: "Venues" },
    { key: "event", label: "Events" },
    { key: "producer", label: "Orgs" },
  ];

  const hasResults =
    (activeTab === "venue" && venues.length > 0) ||
    (activeTab === "event" && events.length > 0) ||
    (activeTab === "producer" && producers.length > 0);

  const showNoResults = !isLoading && !hasResults && query.length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--void)]/80 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="w-full max-w-lg max-h-[80vh] rounded-xl border border-[var(--twilight)] shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--void)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
          <h2 className="font-mono text-sm font-medium text-[var(--cream)]">Add Items to List</h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--twilight)]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-3 font-mono text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--coral)]/50 ${
                activeTab === tab.key
                  ? "text-[var(--coral)] border-b-2 border-[var(--coral)]"
                  : "text-[var(--muted)] hover:text-[var(--cream)] border-b-2 border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-[var(--twilight)]">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${activeTab === "venue" ? "venues" : activeTab === "event" ? "events" : "organizations"}...`}
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] focus:ring-2 focus:ring-[var(--coral)]/50 transition-colors"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-[var(--coral)]/10 text-[var(--coral)] text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {query.length < 2 && (
            <div className="text-center py-8 text-[var(--muted)] font-mono text-sm">
              Type at least 2 characters to search
            </div>
          )}

          {showNoResults && (
            <div className="text-center py-8 text-[var(--muted)] font-mono text-sm">
              No {activeTab === "venue" ? "venues" : activeTab === "event" ? "events" : "organizations"} found
            </div>
          )}

          {/* Venue Results */}
          {activeTab === "venue" && venues.length > 0 && (
            <div className="space-y-2">
              {venues.map((venue) => {
                const inList = isItemInList("venue", venue.id);
                return (
                  <div
                    key={venue.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--twilight)] hover:bg-[var(--dusk)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-[var(--cream)] truncate">{venue.name}</div>
                      {venue.neighborhood && (
                        <div className="font-mono text-xs text-[var(--muted)] mt-0.5">{venue.neighborhood}</div>
                      )}
                    </div>
                    <Button
                      variant={inList ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => handleAddItem("venue", venue.id)}
                      disabled={inList || isAdding === venue.id}
                      isLoading={isAdding === venue.id}
                      className="ml-3 shrink-0"
                    >
                      {inList ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Added
                        </>
                      ) : (
                        "Add"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Event Results */}
          {activeTab === "event" && events.length > 0 && (
            <div className="space-y-2">
              {events.map((event) => {
                const inList = isItemInList("event", event.id);
                const startDate = new Date(event.start_date);
                const formattedDate = startDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--twilight)] hover:bg-[var(--dusk)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-[var(--cream)] truncate">{event.title}</div>
                      <div className="font-mono text-xs text-[var(--muted)] mt-0.5">
                        {formattedDate}
                        {event.venue && ` @ ${event.venue.name}`}
                      </div>
                    </div>
                    <Button
                      variant={inList ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => handleAddItem("event", event.id)}
                      disabled={inList || isAdding === event.id}
                      isLoading={isAdding === event.id}
                      className="ml-3 shrink-0"
                    >
                      {inList ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Added
                        </>
                      ) : (
                        "Add"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Producer Results */}
          {activeTab === "producer" && producers.length > 0 && (
            <div className="space-y-2">
              {producers.map((producer) => {
                const inList = isItemInList("producer", producer.id);
                return (
                  <div
                    key={producer.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--twilight)] hover:bg-[var(--dusk)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-[var(--cream)] truncate">{producer.name}</div>
                      {(producer.org_type || producer.neighborhood) && (
                        <div className="font-mono text-xs text-[var(--muted)] mt-0.5">
                          {producer.org_type && producer.org_type.replace(/_/g, " ")}
                          {producer.org_type && producer.neighborhood && " • "}
                          {producer.neighborhood}
                        </div>
                      )}
                    </div>
                    <Button
                      variant={inList ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => handleAddItem("producer", producer.id)}
                      disabled={inList || isAdding === producer.id}
                      isLoading={isAdding === producer.id}
                      className="ml-3 shrink-0"
                    >
                      {inList ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Added
                        </>
                      ) : (
                        "Add"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
