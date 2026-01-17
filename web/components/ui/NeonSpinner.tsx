interface NeonSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "magenta" | "cyan" | "coral" | "gold";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-3",
};

const colorClasses = {
  magenta: "border-[var(--neon-magenta)] shadow-[0_0_10px_var(--neon-magenta)]",
  cyan: "border-[var(--neon-cyan)] shadow-[0_0_10px_var(--neon-cyan)]",
  coral: "border-[var(--coral)] shadow-[0_0_10px_var(--coral)]",
  gold: "border-[var(--gold)] shadow-[0_0_10px_var(--gold)]",
};

export default function NeonSpinner({
  size = "md",
  color = "magenta",
  className = "",
}: NeonSpinnerProps) {
  return (
    <div
      className={`
        rounded-full
        border-t-transparent
        animate-neon-spin
        ${sizeClasses[size]}
        ${colorClasses[color]}
        ${className}
      `}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
