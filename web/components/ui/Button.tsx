import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] disabled:bg-[var(--coral)]/50",
  secondary:
    "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--muted)] disabled:bg-[var(--twilight)]/50",
  ghost:
    "bg-transparent text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] disabled:text-[var(--muted)]/50",
  danger:
    "bg-[var(--neon-red)]/20 text-[var(--neon-red)] hover:bg-[var(--neon-red)]/30 border border-[var(--neon-red)]/30 disabled:opacity-50",
};

// Touch target minimum: 44px height on mobile, relaxed on desktop
const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-2.5 text-xs gap-1.5 min-h-[44px] sm:min-h-[36px] sm:py-1.5",
  md: "px-4 py-2.5 text-sm gap-2 min-h-[44px] sm:min-h-[40px] sm:py-2",
  lg: "px-5 py-3 text-base gap-2.5 min-h-[48px] sm:min-h-[44px] sm:py-2.5",
};

const iconSizes: Record<ButtonSize, string> = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-mono font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] disabled:cursor-not-allowed";

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <svg
            className={`animate-spin ${iconSizes[size]}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon && <span className={iconSizes[size]}>{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className={iconSizes[size]}>{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;

// Icon button variant for compact icon-only buttons
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  label: string; // Required for accessibility
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = "ghost",
      size = "md",
      isLoading = false,
      label,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] disabled:cursor-not-allowed";

    // Touch target minimum: 44px on mobile
    const iconButtonSizes: Record<ButtonSize, string> = {
      sm: "p-2.5 min-w-[44px] min-h-[44px] sm:p-1.5 sm:min-w-[32px] sm:min-h-[32px]",
      md: "p-2.5 min-w-[44px] min-h-[44px] sm:p-2 sm:min-w-[36px] sm:min-h-[36px]",
      lg: "p-3 min-w-[48px] min-h-[48px] sm:p-2.5 sm:min-w-[44px] sm:min-h-[44px]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-label={label}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${iconButtonSizes[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <svg
            className={`animate-spin ${iconSizes[size]}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <span className={iconSizes[size]}>{children}</span>
        )}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
