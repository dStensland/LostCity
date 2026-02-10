export default function LoadingDots({ text = "Loading" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8">
      <span className="text-[var(--soft)] font-mono text-sm">{text}</span>
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral)] animate-loading-dot-1" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral)] animate-loading-dot-2" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral)] animate-loading-dot-3" />
      </div>
    </div>
  );
}
