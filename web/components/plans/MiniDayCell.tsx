"use client";

interface MiniDayCellProps {
  date: Date;
  commitmentCount: number;
  hasFriendOnly: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export function MiniDayCell({
  date,
  commitmentCount,
  hasFriendOnly,
  isToday,
  isCurrentMonth,
  isSelected,
  onClick,
}: MiniDayCellProps) {
  const dayNum = date.getDate();

  return (
    <button
      onClick={onClick}
      className={`
        w-full aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg
        text-xs transition-colors duration-200
        ${isCurrentMonth ? "text-[var(--cream)]" : "text-[var(--muted)]/30"}
        ${isToday ? "ring-1 ring-[var(--gold)]" : ""}
        ${isSelected ? "bg-[var(--twilight)]" : "hover:bg-[var(--twilight)]/50"}
      `}
      aria-label={`${date.toLocaleDateString()}, ${commitmentCount} plans`}
    >
      <span className="leading-none">{dayNum}</span>
      {commitmentCount > 0 && (
        <div className="flex gap-0.5">
          {commitmentCount <= 3 ? (
            [...Array(commitmentCount)].map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-[var(--cream)]"
                style={{ opacity: 0.4 + i * 0.2 }}
              />
            ))
          ) : (
            <span className="text-[8px] text-[var(--cream)]/60">{commitmentCount}</span>
          )}
        </div>
      )}
      {commitmentCount === 0 && hasFriendOnly && (
        <div className="w-1 h-1 rounded-full bg-[var(--vibe)]" />
      )}
    </button>
  );
}
