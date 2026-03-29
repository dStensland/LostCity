"use client";

import { useState, useRef } from "react";
import type { GoblinTag } from "@/lib/goblin-log-utils";

interface Props {
  tags: GoblinTag[];
  selectedIds: number[];
  onToggle: (tagId: number) => void;
  onCreate: (name: string) => Promise<GoblinTag | null>;
}

export default function GoblinTagPicker({ tags, selectedIds, onToggle, onCreate }: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    const name = newName.trim().toLowerCase();
    if (!name || creating) return;
    setCreating(true);
    const tag = await onCreate(name);
    if (tag) {
      onToggle(tag.id); // auto-select the newly created tag
    }
    setNewName("");
    setIsCreating(false);
    setCreating(false);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const isSelected = selectedIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            className="px-2.5 py-1 rounded-full text-xs font-mono font-medium
              border transition-all duration-200"
            style={{
              backgroundColor: isSelected ? `${tag.color}20` : "transparent",
              borderColor: isSelected ? `${tag.color}60` : "var(--twilight)",
              color: isSelected ? tag.color || "var(--cream)" : "var(--soft)",
              boxShadow: isSelected ? `0 0 8px ${tag.color}15` : "none",
            }}
          >
            {tag.name}
          </button>
        );
      })}

      {isCreating ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="flex items-center gap-1"
        >
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="tag name"
            maxLength={50}
            autoFocus
            className="w-24 px-2 py-1 rounded-full text-xs font-mono
              bg-[var(--dusk)] border border-[var(--twilight)]
              text-[var(--cream)] placeholder:text-[var(--muted)]
              focus:outline-none focus:border-[var(--coral)]"
            onBlur={() => {
              if (!newName.trim()) setIsCreating(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setNewName("");
                setIsCreating(false);
              }
            }}
          />
        </form>
      ) : (
        <button
          onClick={() => {
            setIsCreating(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="px-2.5 py-1 rounded-full text-xs font-mono
            border border-dashed border-[var(--twilight)] text-[var(--muted)]
            hover:border-[var(--soft)] hover:text-[var(--soft)] transition-colors"
        >
          + tag
        </button>
      )}
    </div>
  );
}
