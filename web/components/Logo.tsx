import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
}

export default function Logo({ size = "md", href = "/", className = "" }: LogoProps) {
  const sizeConfig = {
    sm: { fontSize: "1.5rem", lineHeight: 0.85 },
    md: { fontSize: "2rem", lineHeight: 0.85 },
    lg: { fontSize: "3.5rem", lineHeight: 0.85 },
  };

  const config = sizeConfig[size];

  const content = (
    <span
      className={`inline-flex flex-col items-start`}
      style={{ lineHeight: config.lineHeight }}
    >
      <span
        className="font-[var(--font-bebas)] tracking-[0.02em] text-[var(--coral)]"
        style={{
          fontFamily: "var(--font-bebas), sans-serif",
          fontSize: config.fontSize,
          fontWeight: 400,
        }}
      >
        LOST
      </span>
      <span
        className="font-[var(--font-bebas)] tracking-[0.02em]"
        style={{
          fontFamily: "var(--font-bebas), sans-serif",
          fontSize: config.fontSize,
          fontWeight: 400,
          color: "transparent",
          WebkitTextStroke: "1.5px #ffffff",
        }}
      >
        CITY
      </span>
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
