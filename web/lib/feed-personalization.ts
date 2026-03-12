export type FeedRecommendationReason = {
  type:
    | "followed_venue"
    | "followed_organization"
    | "followed_channel"
    | "neighborhood"
    | "price"
    | "friends_going"
    | "trending"
    | "category";
  label: string;
  detail?: string;
};

export type FeedFriend = {
  user_id: string;
  username: string;
  display_name: string | null;
};

type FeedChannelMatch = {
  channel_name: string;
};

type FeedRecommendationLabels = Partial<
  Record<
    | "followed_venue"
    | "followed_organization"
    | "followed_channel"
    | "neighborhood"
    | "category",
    string
  >
>;

export type PersonalizedFeedEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_free: boolean;
  price_min: number | null;
  category: string | null;
  genres: string[] | null;
  tags: string[] | null;
  image_url: string | null;
  organization_id: string | null;
  source_id: number | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
  score?: number;
  reasons?: FeedRecommendationReason[];
  friends_going?: FeedFriend[];
};

export type PersonalizedFeedSectionId =
  | "tonight_for_you"
  | "this_week_fits_your_taste"
  | "from_places_people_you_follow"
  | "explore_something_new";

export type PersonalizedFeedSection<T extends PersonalizedFeedEvent> = {
  id: PersonalizedFeedSectionId;
  title: string;
  description: string;
  events: T[];
};

function eventMatchesNeeds(
  event: PersonalizedFeedEvent,
  needsAccessibility: string[],
  needsDietary: string[],
  needsFamily: string[],
): boolean {
  if (
    !needsAccessibility.length &&
    !needsDietary.length &&
    !needsFamily.length
  ) {
    return false;
  }

  const haystack = [
    event.title,
    ...(event.tags || []),
    ...(event.genres || []),
  ]
    .join(" ")
    .toLowerCase();

  if (
    needsAccessibility.length &&
    needsAccessibility.some((need) => haystack.includes(need))
  ) {
    return true;
  }
  if (
    needsDietary.length &&
    ((event.category || "").toLowerCase() === "food_drink" ||
      needsDietary.some((need) => haystack.includes(need)))
  ) {
    return true;
  }
  if (
    needsFamily.length &&
    ((event.category || "").toLowerCase() === "family" ||
      needsFamily.some((need) => haystack.includes(need)))
  ) {
    return true;
  }

  return false;
}

function eventMatchesTaste(
  event: PersonalizedFeedEvent,
  favoriteCategories: string[],
  favoriteGenreSet: Set<string>,
  favoriteNeighborhoods: string[],
): boolean {
  return Boolean(
    (event.category && favoriteCategories.includes(event.category)) ||
      event.genres?.some(
        (genre) =>
          typeof genre === "string" &&
          favoriteGenreSet.has(genre.toLowerCase()),
      ) ||
      (event.venue?.neighborhood &&
        favoriteNeighborhoods.includes(event.venue.neighborhood)),
  );
}

function eventIsFollowedOrSocial(event: PersonalizedFeedEvent): boolean {
  return Boolean(
    event.friends_going?.length ||
      event.reasons?.some(
        (reason) =>
          reason.type === "friends_going" ||
          reason.type === "followed_venue" ||
          reason.type === "followed_organization" ||
          reason.type === "followed_channel",
      ),
  );
}

export function rankAndFilterPersonalizedFeedEvents<
  T extends PersonalizedFeedEvent,
>(
  events: T[],
  input: {
    now: Date;
    tagsFilter?: string[];
    neighborhoodsFilter?: string[];
    favoriteCategories: string[];
    favoriteGenreSet: Set<string>;
    favoriteNeighborhoods: string[];
    needsAccessibility: string[];
    needsDietary: string[];
    needsFamily: string[];
    followedVenueIds: number[];
    followedOrganizationIds: string[];
    sourceOrganizationMap: Record<number, string>;
    channelMatchesByEventId: Map<number, FeedChannelMatch[]>;
    friendsGoingMap: Record<number, FeedFriend[]>;
    recommendationLabels?: FeedRecommendationLabels | null;
    pricePreference?: "free" | "budget" | string | null;
    restrictToPersonalizedMatches: boolean;
    shouldSuppressRegularShowtime: (event: T) => boolean;
  },
): T[] {
  let rankedEvents = events.map((event) => {
    let score = 0;
    const reasons: FeedRecommendationReason[] = [];
    const tasteMatches: string[] = [];
    const eventGenres = (event.genres || []).map((genre) => genre.toLowerCase());
    const haystack = [event.title, ...(event.tags || []), ...eventGenres]
      .join(" ")
      .toLowerCase();

    const friendsGoing = input.friendsGoingMap[event.id] || [];
    if (friendsGoing.length > 0) {
      score += 60 + friendsGoing.length * 10;
      const friendNames = friendsGoing
        .slice(0, 2)
        .map((friend) => friend.display_name || `@${friend.username}`);
      const othersCount = friendsGoing.length - 2;
      let detail = friendNames.join(" and ");
      if (othersCount > 0) {
        detail = `${friendNames[0]} and ${friendsGoing.length - 1} others`;
      }
      reasons.push({
        type: "friends_going",
        label: "Friends going",
        detail,
      });
    }

    if (event.venue?.id && input.followedVenueIds.includes(event.venue.id)) {
      score += 50;
      reasons.push({
        type: "followed_venue",
        label:
          input.recommendationLabels?.followed_venue ?? "You follow this venue",
        detail: event.venue.name,
      });
    }

    const eventOrganizationId =
      event.organization_id ||
      (event.source_id ? input.sourceOrganizationMap[event.source_id] : null);
    if (
      eventOrganizationId &&
      input.followedOrganizationIds.includes(eventOrganizationId)
    ) {
      score += 45;
      reasons.push({
        type: "followed_organization",
        label:
          input.recommendationLabels?.followed_organization ??
          "From an organizer you follow",
      });
    }

    const channelMatches = input.channelMatchesByEventId.get(event.id) || [];
    if (channelMatches.length > 0) {
      score += 40 + Math.min(10, (channelMatches.length - 1) * 3);
      reasons.push({
        type: "followed_channel",
        label:
          input.recommendationLabels?.followed_channel ??
          "Matches your channels",
        detail: channelMatches
          .slice(0, 2)
          .map((match) => match.channel_name)
          .join(", "),
      });
    }

    if (
      event.category &&
      input.favoriteCategories.includes(event.category)
    ) {
      score += 25;
      tasteMatches.push(event.category);
    }

    const matchingGenres = eventGenres.filter((genre) =>
      input.favoriteGenreSet.has(genre),
    );
    if (matchingGenres.length > 0) {
      score += Math.min(24, 8 + matchingGenres.length * 4);
      tasteMatches.push(...matchingGenres.slice(0, 2));
    }

    if (
      event.venue?.neighborhood &&
      input.favoriteNeighborhoods.includes(event.venue.neighborhood)
    ) {
      score += 30;
      reasons.push({
        type: "neighborhood",
        label:
          input.recommendationLabels?.neighborhood ?? "In your favorite area",
        detail: event.venue.neighborhood,
      });
    }

    if (
      input.needsAccessibility.length > 0 &&
      input.needsAccessibility.some((need) => haystack.includes(need))
    ) {
      score += 8;
    }
    if (
      input.needsDietary.length > 0 &&
      ((event.category || "").toLowerCase() === "food_drink" ||
        input.needsDietary.some((need) => haystack.includes(need)))
    ) {
      score += 8;
    }
    if (
      input.needsFamily.length > 0 &&
      ((event.category || "").toLowerCase() === "family" ||
        input.needsFamily.some((need) => haystack.includes(need)))
    ) {
      score += 12;
    }

    if (input.pricePreference === "free" && event.is_free) {
      score += 20;
      reasons.push({
        type: "price",
        label: "Free event",
      });
    } else if (input.pricePreference === "budget") {
      if (event.is_free || (event.price_min !== null && event.price_min <= 25)) {
        score += 15;
        reasons.push({
          type: "price",
          label: "Budget-friendly",
        });
      }
    }

    if (event.image_url) {
      score += 5;
    }

    const daysAway = Math.max(
      0,
      Math.floor(
        (new Date(event.start_date).getTime() - input.now.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    if (daysAway <= 7) {
      score += Math.max(0, 14 - daysAway * 2);
    } else if (daysAway <= 14) {
      score += Math.max(0, 7 - (daysAway - 7));
    }

    if (tasteMatches.length > 0) {
      const detail = tasteMatches[0]
        .split("-")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
      reasons.push({
        type: "category",
        label: input.recommendationLabels?.category ?? "Fits your interests",
        detail,
      });
    }

    return {
      ...event,
      score,
      reasons: reasons.length > 0 ? reasons : undefined,
      friends_going: friendsGoing.length > 0 ? friendsGoing : undefined,
    };
  });

  if (input.tagsFilter?.length) {
    rankedEvents = rankedEvents.filter((event) => {
      const eventTags = event.tags || [];
      return input.tagsFilter?.some((tag) => eventTags.includes(tag));
    });
  }

  if (input.neighborhoodsFilter?.length) {
    rankedEvents = rankedEvents.filter(
      (event) =>
        Boolean(
          event.venue?.neighborhood &&
            input.neighborhoodsFilter?.includes(event.venue.neighborhood),
        ),
    );
  }

  rankedEvents = rankedEvents.filter(
    (event) => !input.shouldSuppressRegularShowtime(event),
  );

  if (input.restrictToPersonalizedMatches) {
    rankedEvents = rankedEvents.filter((event) => {
      if (event.venue?.id && input.followedVenueIds.includes(event.venue.id)) {
        return true;
      }
      const eventOrgId =
        event.organization_id ||
        (event.source_id ? input.sourceOrganizationMap[event.source_id] : null);
      if (eventOrgId && input.followedOrganizationIds.includes(eventOrgId)) {
        return true;
      }
      if (input.channelMatchesByEventId.has(event.id)) {
        return true;
      }
      if (
        event.category &&
        input.favoriteCategories.includes(event.category)
      ) {
        return true;
      }
      if (
        event.genres?.some((genre) =>
          input.favoriteGenreSet.has(genre.toLowerCase()),
        )
      ) {
        return true;
      }
      if (
        event.venue?.neighborhood &&
        input.favoriteNeighborhoods.includes(event.venue.neighborhood)
      ) {
        return true;
      }
      if (eventMatchesNeeds(
        event,
        input.needsAccessibility,
        input.needsDietary,
        input.needsFamily,
      )) {
        return true;
      }
      if (input.friendsGoingMap[event.id]?.length) {
        return true;
      }
      return false;
    });
  }

  rankedEvents.sort((left, right) => {
    const scoreDiff = (right.score || 0) - (left.score || 0);
    if (scoreDiff !== 0) return scoreDiff;

    const dateCompare = left.start_date.localeCompare(right.start_date);
    if (dateCompare !== 0) return dateCompare;

    const timeLeft = left.start_time || "23:59:59";
    const timeRight = right.start_time || "23:59:59";
    const timeCompare = timeLeft.localeCompare(timeRight);
    if (timeCompare !== 0) return timeCompare;

    return left.id - right.id;
  });

  return rankedEvents;
}

export function buildPersonalizedFeedSections<
  T extends PersonalizedFeedEvent,
>(
  events: T[],
  input: {
    now: Date;
    today: string;
    weekFromNow: string;
    favoriteCategories: string[];
    favoriteGenreSet: Set<string>;
    favoriteNeighborhoods: string[];
    needsAccessibility: string[];
    needsDietary: string[];
    needsFamily: string[];
  },
): PersonalizedFeedSection<T>[] {
  const sections: PersonalizedFeedSection<T>[] = [];
  const sectionSeenIds = new Set<number>();
  const takeForSection = (candidates: T[], maxEvents = 8): T[] => {
    const selected: T[] = [];
    for (const candidate of candidates) {
      if (sectionSeenIds.has(candidate.id)) continue;
      sectionSeenIds.add(candidate.id);
      selected.push(candidate);
      if (selected.length >= maxEvents) break;
    }
    return selected;
  };

  const tonightCandidates = events.filter(
    (event) =>
      event.start_date === input.today &&
      ((event.score || 0) >= 20 ||
        eventIsFollowedOrSocial(event) ||
        eventMatchesTaste(
          event,
          input.favoriteCategories,
          input.favoriteGenreSet,
          input.favoriteNeighborhoods,
        )),
  );
  const dayOfWeek = input.now.getDay();
  const isWeekendNight = dayOfWeek === 5 || dayOfWeek === 6;
  const tonightMax = isWeekendNight ? 12 : 8;
  const tonightForYou = takeForSection(tonightCandidates, tonightMax);
  if (tonightForYou.length >= 2) {
    sections.push({
      id: "tonight_for_you",
      title: "Your Tonight",
      description: "What's calling your name today.",
      events: tonightForYou,
    });
  }

  const thisWeekCandidates = events.filter((event) => {
    if (event.start_date < input.today || event.start_date > input.weekFromNow) {
      return false;
    }
    return (
      eventMatchesTaste(
        event,
        input.favoriteCategories,
        input.favoriteGenreSet,
        input.favoriteNeighborhoods,
      ) ||
      eventMatchesNeeds(
        event,
        input.needsAccessibility,
        input.needsDietary,
        input.needsFamily,
      )
    );
  });
  const thisWeekFitsYourTaste = takeForSection(thisWeekCandidates, 10);
  if (thisWeekFitsYourTaste.length >= 2) {
    sections.push({
      id: "this_week_fits_your_taste",
      title: "On Your Radar",
      description: "This week's picks based on what you love.",
      events: thisWeekFitsYourTaste,
    });
  }

  const followedCandidates = events.filter((event) =>
    eventIsFollowedOrSocial(event),
  );
  const fromPlacesPeopleYouFollow = takeForSection(followedCandidates, 10);
  if (fromPlacesPeopleYouFollow.length >= 2) {
    sections.push({
      id: "from_places_people_you_follow",
      title: "Your Scene",
      description: "From the spots and people you're into.",
      events: fromPlacesPeopleYouFollow,
    });
  }

  const exploreCandidates = events.filter(
    (event) =>
      !eventIsFollowedOrSocial(event) &&
      !eventMatchesTaste(
        event,
        input.favoriteCategories,
        input.favoriteGenreSet,
        input.favoriteNeighborhoods,
      ),
  );
  const exploreSomethingNew = takeForSection(
    exploreCandidates.length > 0 ? exploreCandidates : events,
    6,
  );
  if (exploreSomethingNew.length >= 2) {
    sections.push({
      id: "explore_something_new",
      title: "Wild Card",
      description: "Something outside your usual orbit.",
      events: exploreSomethingNew,
    });
  }

  return sections;
}
