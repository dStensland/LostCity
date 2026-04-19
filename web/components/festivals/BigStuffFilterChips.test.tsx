import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import BigStuffFilterChips, { type FilterValue } from "./BigStuffFilterChips";

describe("BigStuffFilterChips", () => {
  const counts = { festival: 28, convention: 11, sports: 4, community: 2, other: 0 };

  it("renders a chip for each primary bucket + All", () => {
    const { getByText } = render(
      <BigStuffFilterChips counts={counts} active="all" onChange={vi.fn()} />,
    );
    expect(getByText(/All 45/i)).toBeDefined();
    expect(getByText(/Festivals 28/i)).toBeDefined();
    expect(getByText(/Conventions 11/i)).toBeDefined();
    expect(getByText(/Sports 4/i)).toBeDefined();
    expect(getByText(/Community 2/i)).toBeDefined();
  });

  it("does NOT render an 'Other' chip", () => {
    const { queryByText } = render(
      <BigStuffFilterChips counts={counts} active="all" onChange={vi.fn()} />,
    );
    expect(queryByText(/Other/i)).toBeNull();
  });

  it("invokes onChange with the bucket when an inactive chip is clicked", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <BigStuffFilterChips counts={counts} active="all" onChange={onChange} />,
    );
    fireEvent.click(getByText(/Festivals 28/i));
    expect(onChange).toHaveBeenCalledWith("festival");
  });

  it("invokes onChange('all') when the active chip is clicked (toggle off)", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <BigStuffFilterChips counts={counts} active="festival" onChange={onChange} />,
    );
    fireEvent.click(getByText(/Festivals 28/i));
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("has role=tablist on the container and role=tab on each chip", () => {
    const { container } = render(
      <BigStuffFilterChips counts={counts} active="all" onChange={vi.fn()} />,
    );
    expect(container.querySelector('[role="tablist"]')).toBeDefined();
    expect(container.querySelectorAll('[role="tab"]').length).toBeGreaterThanOrEqual(5);
  });

  it("hides a chip when count < 2", () => {
    const sparseCounts = { festival: 28, convention: 11, sports: 1, community: 0, other: 0 };
    const { queryByText } = render(
      <BigStuffFilterChips counts={sparseCounts} active="all" onChange={vi.fn()} />,
    );
    expect(queryByText(/Sports/i)).toBeNull();
    expect(queryByText(/Community/i)).toBeNull();
    // All is always shown, regardless of count.
    expect(queryByText(/All/i)).not.toBeNull();
  });
});
