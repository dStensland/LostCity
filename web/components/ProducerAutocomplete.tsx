"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface ProducerResult {
  id: string;
  name: string;
  slug: string;
  org_type: string | null;
  neighborhood: string | null;
  logo_url: string | null;
  is_verified: boolean;
  displayLabel: string;
}

interface ProducerAutocompleteProps {
  value: { id: string; name: string } | null;
  onChange: (producer: { id: string; name: string } | null) => void;
  onCreateNew?: (name: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export default function ProducerAutocomplete({
  value,
  onChange,
  onCreateNew,
  placeholder = "Search for an organization...",
  required = false,
  disabled = false,
  error,
}: ProducerAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProducerResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Search producers
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const searchProducers = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/producers/search?q=${encodeURIComponent(debouncedQuery)}&limit=8&include_unverified=true`
        );
        const data = await res.json();
        setResults(data.producers || []);
      } catch (err) {
        console.error("Producer search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    searchProducers();
  }, [debouncedQuery]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && results[highlightedIndex]) {
            selectProducer(results[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, highlightedIndex, results]
  );

  const selectProducer = (producer: ProducerResult) => {
    onChange({ id: producer.id, name: producer.name });
    setQuery(producer.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsOpen(true);
    setHighlightedIndex(-1);

    // Clear selection if user is typing
    if (value && value.name !== newQuery) {
      onChange(null);
    }
  };

  const handleCreateNew = () => {
    if (onCreateNew && query.trim()) {
      onCreateNew(query.trim());
      setIsOpen(false);
    }
  };

  const formatOrgType = (type: string | null) => {
    if (!type) return null;
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const showCreateOption = onCreateNew && query.length >= 2 && !loading;
  const noResults = !loading && results.length === 0 && query.length >= 2;

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none transition-colors ${
            error
              ? "border-red-500 focus:border-red-500"
              : "border-[var(--twilight)] focus:border-[var(--coral)]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {value && !loading && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--cream)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 font-mono text-xs mt-1">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] shadow-xl max-h-64 overflow-y-auto"
        >
          {results.map((producer, index) => (
            <button
              key={producer.id}
              type="button"
              onClick={() => selectProducer(producer)}
              className={`w-full px-4 py-3 text-left hover:bg-[var(--twilight)] transition-colors ${
                highlightedIndex === index ? "bg-[var(--twilight)]" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                {producer.logo_url && (
                  <img
                    src={producer.logo_url}
                    alt=""
                    className="w-6 h-6 rounded object-cover"
                  />
                )}
                <div className="flex-1">
                  <div className="font-mono text-sm text-[var(--cream)] flex items-center gap-2">
                    {producer.name}
                    {producer.is_verified && (
                      <svg className="w-3.5 h-3.5 text-[var(--coral)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  {(producer.org_type || producer.neighborhood) && (
                    <div className="font-mono text-xs text-[var(--muted)] mt-0.5">
                      {[formatOrgType(producer.org_type), producer.neighborhood]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}

          {noResults && !showCreateOption && (
            <div className="px-4 py-3 text-[var(--muted)] font-mono text-sm">
              No organizations found
            </div>
          )}

          {showCreateOption && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="w-full px-4 py-3 text-left border-t border-[var(--twilight)] hover:bg-[var(--twilight)] transition-colors"
            >
              <div className="flex items-center gap-2 text-[var(--coral)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-mono text-sm">
                  Add new organization: &quot;{query}&quot;
                </span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
