import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MusicShowtimeChip } from "./MusicShowtimeChip";

const baseProps = {
  doorsTime: null as string | null,
  showTime: null as string | null,
  ticketStatus: null as string | null,
  isFree: false,
  agePolicy: null as string | null,
  onTap: vi.fn(),
};

describe("MusicShowtimeChip", () => {
  it("renders DOORS + SHOW stacked when both present", () => {
    render(<MusicShowtimeChip {...baseProps} doorsTime="19:00" showTime="21:00" />);
    expect(screen.getByText(/DOORS/)).toBeInTheDocument();
    expect(screen.getByText(/SHOW/)).toBeInTheDocument();
  });

  it("renders SHOW only when just start_time present", () => {
    render(<MusicShowtimeChip {...baseProps} showTime="21:00" />);
    // SHOW label and time render in adjacent spans; check button text content.
    const button = screen.getByRole("button");
    expect(button.textContent?.replace(/\s+/g, " ").trim()).toMatch(/SHOW\s*9PM/);
    expect(screen.queryByText(/DOORS/)).not.toBeInTheDocument();
  });

  it("renders SOLD OUT state with strike-through", () => {
    render(<MusicShowtimeChip {...baseProps} showTime="21:00" ticketStatus="sold-out" />);
    expect(screen.getByText(/SOLD OUT/)).toBeInTheDocument();
  });

  it("renders FREE pill when is_free", () => {
    render(<MusicShowtimeChip {...baseProps} showTime="21:00" isFree />);
    expect(screen.getByText(/FREE/)).toBeInTheDocument();
  });
});
