import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { LaneFilterInput } from "@/components/find/LaneFilterInput";

describe("LaneFilterInput", () => {
  it("renders an input with the given placeholder", () => {
    render(<LaneFilterInput value="" onChange={() => {}} placeholder="Search events..." />);
    expect(screen.getByPlaceholderText("Search events...")).toBeInTheDocument();
  });

  it("calls onChange (debounced) when user types", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<LaneFilterInput value="" onChange={onChange} />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "jazz" } });
    act(() => { vi.advanceTimersByTime(250); });
    expect(onChange).toHaveBeenCalledWith("jazz");
    vi.useRealTimers();
  });

  it("shows clear button when value is non-empty", () => {
    render(<LaneFilterInput value="jazz" onChange={() => {}} />);
    expect(screen.getByLabelText("Clear filter")).toBeInTheDocument();
  });
});
