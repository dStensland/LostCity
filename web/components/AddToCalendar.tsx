"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  title: string;
  date: string;
  time: string | null;
  venue?: string;
  address?: string | null;
  city?: string;
  state?: string;
}

export default function AddToCalendar({
  title,
  date,
  time,
  venue,
  address,
  city,
  state,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Build location string
  const location = [venue, address, city && state ? `${city}, ${state}` : city || state]
    .filter(Boolean)
    .join(", ");

  // Parse date and time
  const startDate = new Date(date);
  if (time) {
    const [hours, minutes] = time.split(":");
    startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
  } else {
    startDate.setHours(12, 0, 0); // Default to noon if no time specified
  }

  // End time is 2 hours after start (default duration)
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 2);

  // Format for Google Calendar (YYYYMMDDTHHmmss)
  const formatGoogleDate = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  // Format for ICS (YYYYMMDDTHHMMSS)
  const formatICSDate = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  // Google Calendar URL
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&location=${encodeURIComponent(location)}&details=${encodeURIComponent(`Event discovered on Lost City - lostcity.ai`)}`;

  // Generate ICS file content
  const generateICS = () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Lost City//Event Calendar//EN
BEGIN:VEVENT
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${title}
LOCATION:${location}
DESCRIPTION:Event discovered on Lost City - lostcity.ai
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, "_")}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  // Outlook Web URL
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${encodeURIComponent(location)}&body=${encodeURIComponent(`Event discovered on Lost City - lostcity.ai`)}`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[var(--twilight)] text-[var(--soft)] font-medium rounded-lg hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors w-full sm:w-auto"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Add to Calendar
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z" />
            </svg>
            Google Calendar
          </a>
          <button
            type="button"
            onClick={generateICS}
            className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors w-full text-left"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            Apple Calendar
          </button>
          <a
            href={outlookUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.01V2.55q0-.44.3-.75.3-.3.75-.3h6.93q.44 0 .75.3.3.3.3.75V6h6.97q.3 0 .57.12.26.12.45.32.19.2.31.47.12.26.12.57zm-8.02-6V4.2H8.01V6h7.97zm0 10.36V12H8.01v4.36h7.97zM22.5 12h-5.2v4.36h5.2V12zm0 6H8.01v2.55h14.49V18zm-6.96-2.55H8.01V18h7.53v-2.55z" />
            </svg>
            Outlook
          </a>
        </div>
      )}
    </div>
  );
}
