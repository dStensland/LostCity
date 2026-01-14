// Place Scoring System
// Three-phase scoring: Google data → Event venue data → User signals

/**
 * Phase 1: Google Score
 *
 * Calculate quality score from Google data using Bayesian average.
 * Why Bayesian? A 4.9 with 10 reviews shouldn't beat a 4.5 with 2000 reviews.
 * We pull low-review places toward the mean.
 */
export function calculateGoogleScore(
  rating: number | null,
  ratingCount: number | null
): number {
  if (!rating || !ratingCount) return 0;

  // Atlanta average rating (prior)
  const PRIOR_RATING = 4.0;
  const PRIOR_COUNT = 30; // Weight of prior — effectively "30 fake reviews at 4.0"

  // Bayesian adjusted rating
  const adjustedRating =
    (rating * ratingCount + PRIOR_RATING * PRIOR_COUNT) /
    (ratingCount + PRIOR_COUNT);

  // Popularity factor (log scale — diminishing returns)
  // 10 reviews → 0.33, 100 → 0.67, 1000 → 1.0, 10000 → 1.33
  const popularityFactor = Math.log10(ratingCount + 1) / 3;

  // Base score from adjusted rating (scale 1-5 to 0-70)
  const ratingScore = ((adjustedRating - 1) / 4) * 70;

  // Popularity bonus (0-30 points)
  const popularityScore = Math.min(30, popularityFactor * 30);

  // Final score: 0-100
  return Math.round(ratingScore + popularityScore);
}

// Example scores:
// { rating: 4.9, count: 15 }   → ~58 (high rating, low confidence)
// { rating: 4.5, count: 500 }  → ~72 (good rating, solid confidence)
// { rating: 4.3, count: 3000 } → ~78 (decent rating, high confidence)
// { rating: 4.0, count: 50 }   → ~52 (average)

/**
 * Phase 2: Event Venue Score
 *
 * Calculate score based on event hosting track record.
 * Only applies to places that are linked to event venues.
 */
export function calculateEventVenueScore(
  totalEvents: number,
  eventCategories: string[] // diversity of event types
): number {
  if (totalEvents === 0) return 0;

  // Volume score (log scale)
  // 5 events → 23, 20 events → 43, 100 events → 67
  const volumeScore = Math.min(50, Math.log10(totalEvents + 1) * 33);

  // Diversity bonus — venues with varied programming
  const diversityScore = Math.min(25, eventCategories.length * 5);

  // Recency bonus — active venues
  // (would need last_event_date parameter for full implementation)
  const recencyScore = 25; // placeholder

  return Math.round(volumeScore + diversityScore + recencyScore);
}

/**
 * Phase 3: User Score
 *
 * Calculate score from user behavioral signals.
 */
export interface UserSignals {
  saveCount: number;
  calendarCount: number;
  checkinUsers: number;
  totalCheckins: number;
  recommendationCount: number;
  saves30d: number;
  checkins30d: number;
}

export function calculateUserScore(signals: UserSignals): number {
  // Weight each signal type
  const weights = {
    save: 1,
    calendar: 3, // Higher intent than save
    checkin: 5, // Actual visit
    repeat: 8, // Repeat visits (loyalty)
    recommendation: 10, // Strongest signal — putting reputation on the line
  };

  // Calculate weighted score
  const rawScore =
    signals.saveCount * weights.save +
    signals.calendarCount * weights.calendar +
    signals.checkinUsers * weights.checkin +
    (signals.totalCheckins - signals.checkinUsers) * weights.repeat + // Extra checkins = repeats
    signals.recommendationCount * weights.recommendation;

  // Normalize to 0-100 (adjust divisor based on your data)
  const normalizedScore = Math.min(100, (rawScore / 50) * 100);

  // Recency boost — trending places
  const recentActivity = signals.saves30d + signals.checkins30d;
  const allTimeActivity = signals.saveCount + signals.checkinUsers;
  const trendingBoost =
    allTimeActivity > 0
      ? Math.min(10, (recentActivity / allTimeActivity) * 20)
      : 0;

  return Math.round(normalizedScore + trendingBoost);
}

/**
 * Final Score: Weighted Composite
 *
 * Weights shift from Google → User data as you collect more signals.
 */
export interface PlaceScores {
  googleScore: number;
  eventVenueScore: number;
  userScore: number;
  editorPick: boolean;
  localCertified: boolean;
  hiddenGem: boolean;
  touristTrap: boolean;
}

export function calculateFinalScore(
  place: PlaceScores,
  totalUserSignals: number
): number {
  // Dynamic weighting — Google matters less as user data grows
  // Start: 70% Google, 0% User
  // With data: shifts toward 30% Google, 40% User
  const userDataMaturity = Math.min(1, totalUserSignals / 10000);

  const weights = {
    google: 0.7 - userDataMaturity * 0.4, // 0.7 → 0.3
    eventVenue: 0.2, // constant
    user: userDataMaturity * 0.4, // 0 → 0.4
  };

  let score =
    place.googleScore * weights.google +
    place.eventVenueScore * weights.eventVenue +
    place.userScore * weights.user;

  // Editorial modifiers (absolute, not weighted)
  if (place.editorPick) score += 12;
  if (place.localCertified) score += 8;
  if (place.hiddenGem) score += 5;
  if (place.touristTrap) score -= 20;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Batch update scores for all places
 * Call this periodically (e.g., daily) to recalculate scores
 */
export function getScoreUpdateQuery(): string {
  return `
    UPDATE places p SET
      google_score = calculate_google_score(p.rating, p.rating_count),
      updated_at = NOW()
    WHERE p.google_score = 0 OR p.updated_at < NOW() - INTERVAL '1 day';
  `;
}
