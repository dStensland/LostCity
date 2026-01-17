// Map Supabase auth error messages to user-friendly messages
const AUTH_ERROR_MAP: Record<string, string> = {
  // Login errors
  "Invalid login credentials": "Email or password is incorrect. Please try again.",
  "Email not confirmed": "Please check your email and click the verification link before signing in.",
  "Invalid email or password": "Email or password is incorrect. Please try again.",

  // Signup errors
  "User already registered": "This email is already registered. Try signing in or resetting your password.",
  "Password should be at least 6 characters": "Password must be at least 6 characters long.",
  "Unable to validate email address: invalid format": "Please enter a valid email address.",

  // Rate limiting
  "For security purposes, you can only request this once every 60 seconds": "Please wait a minute before trying again.",
  "Email rate limit exceeded": "Too many attempts. Please wait a few minutes before trying again.",

  // Password reset
  "Email link is invalid or has expired": "This password reset link has expired. Please request a new one.",

  // General
  "Signups not allowed for this instance": "Signups are currently disabled. Please try again later.",
  "Database error saving new user": "Something went wrong creating your account. Please try again.",
};

export function getAuthErrorMessage(error: string): string {
  // Check for exact matches first
  if (AUTH_ERROR_MAP[error]) {
    return AUTH_ERROR_MAP[error];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(AUTH_ERROR_MAP)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Return a generic message for unknown errors
  return "Something went wrong. Please try again.";
}
