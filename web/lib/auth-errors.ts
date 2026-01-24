// Map Supabase auth error messages to user-friendly messages
const AUTH_ERROR_MAP: Record<string, string> = {
  // Login errors
  "Invalid login credentials": "Email or password is incorrect. Please try again.",
  "Email not confirmed": "Please check your email and click the verification link before signing in.",
  "Invalid email or password": "Email or password is incorrect. Please try again.",
  "invalid_credentials": "Email or password is incorrect. Please try again.",
  "invalid_grant": "Email or password is incorrect. Please try again.",

  // Signup errors
  "User already registered": "This email is already registered. Try signing in or resetting your password.",
  "Password should be at least 6 characters": "Password must be at least 6 characters long.",
  "Unable to validate email address: invalid format": "Please enter a valid email address.",
  "A user with this email address has already been registered": "This email is already registered. Try signing in or resetting your password.",
  "Email address not authorized": "This email address is not allowed to sign up.",
  "Password is too weak": "Please choose a stronger password with at least 6 characters.",
  "Password should contain at least one character of each": "Password must include uppercase, lowercase, and a number.",

  // Rate limiting
  "For security purposes, you can only request this once every 60 seconds": "Please wait a minute before trying again.",
  "Email rate limit exceeded": "Too many attempts. Please wait a few minutes before trying again.",
  "Request rate limit reached": "Too many requests. Please wait a moment and try again.",
  "over_request_rate_limit": "Too many requests. Please wait a moment and try again.",
  "over_email_send_rate_limit": "Too many emails sent. Please wait a few minutes.",

  // Password reset
  "Email link is invalid or has expired": "This password reset link has expired. Please request a new one.",
  "Token has expired or is invalid": "This link has expired. Please request a new one.",
  "New password should be different from the old password": "Please choose a password you haven't used before.",

  // OAuth errors
  "OAuth error": "Sign in with Google failed. Please try again.",
  "Error getting user email from external provider": "Could not get your email from Google. Please try again.",
  "Provider does not support email verification": "Could not verify your email. Please try another sign-in method.",

  // Session errors
  "Session expired": "Your session has expired. Please sign in again.",
  "Refresh token is invalid": "Your session has expired. Please sign in again.",
  "Invalid refresh token": "Your session has expired. Please sign in again.",
  "User session not found": "Your session has expired. Please sign in again.",
  "session_not_found": "Your session has expired. Please sign in again.",

  // Network errors
  "Failed to fetch": "Unable to connect. Please check your internet connection.",
  "NetworkError": "Unable to connect. Please check your internet connection.",
  "Network request failed": "Unable to connect. Please check your internet connection.",
  "Load failed": "Unable to connect. Please check your internet connection.",

  // Profile errors
  "profile_failed": "Failed to create your profile. Please try again or contact support.",

  // General
  "Signups not allowed for this instance": "Signups are currently disabled. Please try again later.",
  "Database error saving new user": "Something went wrong creating your account. Please try again.",
  "Auth session missing": "Please sign in to continue.",
  "unexpected_failure": "Something went wrong. Please try again.",
  "server_error": "Our servers are having issues. Please try again later.",
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
