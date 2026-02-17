"use client";

import ProfileTabs, { type ProfileSection } from "@/components/profile/ProfileTabs";
import ProfileActivity from "@/components/profile/ProfileActivity";
import ProfileUpcoming from "@/components/profile/ProfileUpcoming";
import ProfileVenues from "@/components/profile/ProfileVenues";
import ProfileTaste from "@/components/profile/ProfileTaste";

type Activity = {
  id: number | string;
  activity_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  event?: { id: number; title: string; start_date: string } | null;
  venue?: { id: number; name: string; slug: string } | null;
};

interface ProfileTabsClientProps {
  username: string;
  initialActivities: Activity[];
}

export default function ProfileTabsClient({
  username,
  initialActivities,
}: ProfileTabsClientProps) {
  return (
    <ProfileTabs username={username}>
      {(activeSection: ProfileSection) => {
        switch (activeSection) {
          case "activity":
            return <ProfileActivity activities={initialActivities} />;
          case "upcoming":
            return <ProfileUpcoming username={username} />;
          case "venues":
            return <ProfileVenues username={username} />;
          case "taste":
            return <ProfileTaste username={username} />;
          default:
            return <ProfileActivity activities={initialActivities} />;
        }
      }}
    </ProfileTabs>
  );
}
