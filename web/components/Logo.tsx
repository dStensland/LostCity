import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
}

export default function Logo({ size = "md", href = "/", className = "" }: LogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const content = (
    <span className={`logo-text font-bold tracking-tight ${sizeClasses[size]} relative inline-block`}>
      Lost City
      {/* Gradient underline */}
      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[var(--neon-magenta)] to-[var(--neon-cyan)] transition-all duration-300 group-hover:w-full" />
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={`group ${className}`}>
        {content}
      </Link>
    );
  }

  return <span className={className}>{content}</span>;
}
