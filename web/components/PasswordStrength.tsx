"use client";

import { memo, useMemo } from "react";

interface PasswordStrengthProps {
  password: string;
}

type StrengthLevel = "weak" | "fair" | "good" | "strong";

interface StrengthResult {
  level: StrengthLevel;
  score: number; // 0-4
  feedback: string;
}

// Common passwords to check against (subset)
const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
  "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
  "ashley", "bailey", "shadow", "123123", "654321", "superman", "qazwsx",
  "michael", "football", "password1", "password123", "welcome", "welcome1",
]);

function checkPasswordStrength(password: string): StrengthResult {
  if (!password) {
    return { level: "weak", score: 0, feedback: "Enter a password" };
  }

  let score = 0;
  const feedback: string[] = [];

  // Length checks
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 0.5;

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  score += varietyCount * 0.5;

  // Penalize common patterns
  const lowerPassword = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lowerPassword)) {
    score = 0;
    feedback.push("Too common");
  }

  // Penalize repeated characters
  if (/(.)\1{2,}/.test(password)) {
    score -= 0.5;
    feedback.push("Avoid repeated characters");
  }

  // Penalize sequential characters
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    score -= 0.5;
    feedback.push("Avoid sequences");
  }

  // Penalize keyboard patterns
  if (/(?:qwerty|asdf|zxcv|qazwsx)/i.test(password)) {
    score -= 1;
    feedback.push("Avoid keyboard patterns");
  }

  // Clamp score
  score = Math.max(0, Math.min(4, score));

  // Determine level
  let level: StrengthLevel;
  if (score < 1.5) {
    level = "weak";
    if (feedback.length === 0) {
      if (password.length < 8) feedback.push("Use 8+ characters");
      else if (varietyCount < 2) feedback.push("Add numbers or symbols");
    }
  } else if (score < 2.5) {
    level = "fair";
    if (feedback.length === 0 && varietyCount < 3) {
      feedback.push("Add more variety");
    }
  } else if (score < 3.5) {
    level = "good";
    if (feedback.length === 0 && password.length < 12) {
      feedback.push("Even longer is better");
    }
  } else {
    level = "strong";
  }

  const finalFeedback = feedback.length > 0
    ? feedback[0]
    : level === "strong"
      ? "Strong password"
      : "";

  return { level, score: Math.round(score), feedback: finalFeedback };
}

export const PasswordStrength = memo(function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => checkPasswordStrength(password), [password]);

  if (!password) return null;

  const colors: Record<StrengthLevel, string> = {
    weak: "bg-red-500",
    fair: "bg-yellow-500",
    good: "bg-blue-500",
    strong: "bg-green-500",
  };

  const textColors: Record<StrengthLevel, string> = {
    weak: "text-red-400",
    fair: "text-yellow-400",
    good: "text-blue-400",
    strong: "text-green-400",
  };

  const labels: Record<StrengthLevel, string> = {
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
  };

  return (
    <div className="mt-2 space-y-1">
      {/* Strength bars */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index < strength.score + 1 ? colors[strength.level] : "bg-[var(--twilight)]"
            }`}
          />
        ))}
      </div>

      {/* Label and feedback */}
      <div className="flex justify-between items-center">
        <span className={`font-mono text-[0.65rem] ${textColors[strength.level]}`}>
          {labels[strength.level]}
        </span>
        {strength.feedback && (
          <span className="font-mono text-[0.65rem] text-[var(--muted)]">
            {strength.feedback}
          </span>
        )}
      </div>
    </div>
  );
});
