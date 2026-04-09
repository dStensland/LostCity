"use client";

import { Fragment, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { InfoCard } from "@/components/detail";
import { SectionHeader } from "@/components/detail/SectionHeader";
import SmartImage from "@/components/SmartImage";
import Badge from "@/components/ui/Badge";
import type { ScreeningBundle } from "@/lib/screenings";

type PlaceScreeningsSectionProps = {
  screenings: ScreeningBundle;
  title?: string;
  onTimeClick?: (eventId: number) => void;
};

const MAX_TITLES = 8;

export default function PlaceScreeningsSection({
  screenings,
  title = "Now Showing",
  onTimeClick,
}: PlaceScreeningsSectionProps) {
  const groupedTitles = useMemo(() => {
    const timeMap = new Map(
      screenings.times.map((time) => [time.id, time]),
    );
    const timesByRun = new Map<string, typeof screenings.times>();
    for (const time of screenings.times) {
      const list = timesByRun.get(time.screening_run_id) ?? [];
      list.push(time);
      timesByRun.set(time.screening_run_id, list);
    }

    return screenings.titles
      .map((screeningTitle) => {
        const runs = screenings.runs
          .filter((run) => run.screening_title_id === screeningTitle.id)
          .map((run) => ({
            ...run,
            times: (timesByRun.get(run.id) ?? [])
              .map((time) => timeMap.get(time.id)!)
              .sort((left, right) => {
                if (left.start_date !== right.start_date) {
                  return left.start_date.localeCompare(right.start_date);
                }
                return (left.start_time || "").localeCompare(right.start_time || "");
              }),
          }));

        return {
          title: screeningTitle,
          runs,
        };
      })
      .filter((group) => group.runs.length > 0)
      .slice(0, MAX_TITLES);
  }, [screenings]);

  if (groupedTitles.length === 0) return null;

  return (
    <InfoCard accentColor="var(--gold)">
      <SectionHeader title={title} count={groupedTitles.length} variant="inline" />
      <div className="mt-4 space-y-4">
        {groupedTitles.map(({ title: screeningTitle, runs }) => {
          const leadRun = runs[0];
          const visibleDates = Array.from(
            new Set(
              leadRun.times.length > 0
                ? leadRun.times.map((time) => time.start_date)
                : [leadRun.start_date],
            ),
          ).slice(0, 3);

          return (
            <div
              key={screeningTitle.id}
              className="rounded-lg border border-[var(--twilight)]/30 bg-[var(--void)]/30 p-3 sm:p-4"
            >
              <div className="flex gap-3">
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--twilight)]/20">
                  {screeningTitle.poster_image_url ? (
                    <SmartImage
                      src={screeningTitle.poster_image_url}
                      alt={screeningTitle.canonical_title}
                      fill
                      className="object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-medium text-[var(--cream)]">
                        {screeningTitle.canonical_title}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--soft)]">
                        {leadRun.start_date === leadRun.end_date
                          ? format(parseISO(leadRun.start_date), "EEE, MMM d")
                          : `${format(parseISO(leadRun.start_date), "MMM d")} - ${format(parseISO(leadRun.end_date), "MMM d")}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {screeningTitle.kind === "festival_screening_block" ? (
                        <Badge variant="accent" accentColor="var(--gold)" size="sm">
                          Festival
                        </Badge>
                      ) : null}
                      {leadRun.is_special_event ? (
                        <Badge variant="accent" accentColor="var(--coral)" size="sm">
                          Special
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {visibleDates.map((date) => {
                      const dayTimes = leadRun.times.filter((time) => time.start_date === date);
                      return (
                        <Fragment key={`${screeningTitle.id}:${date}`}>
                          <div className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                            {format(parseISO(date), "EEE, MMM d")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {dayTimes.length > 0 ? (
                              dayTimes.map((time) => (
                                <button
                                  key={time.id}
                                  type="button"
                                  onClick={() => onTimeClick?.(time.event_id)}
                                  className="min-h-[36px] rounded-full border border-[var(--twilight)]/40 bg-[var(--night)] px-3 py-1.5 text-sm text-[var(--cream)] transition-colors hover:border-[var(--coral)]/60 hover:text-[var(--coral)]"
                                >
                                  {time.start_time
                                    ? format(parseISO(`${time.start_date}T${time.start_time}`), "h:mm a")
                                    : "Time TBD"}
                                </button>
                              ))
                            ) : (
                              <span className="min-h-[36px] rounded-full border border-[var(--twilight)]/40 bg-[var(--night)] px-3 py-1.5 text-sm text-[var(--soft)]">
                                Time TBD
                              </span>
                            )}
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </InfoCard>
  );
}
