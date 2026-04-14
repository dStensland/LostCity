import { describe, it, expect, beforeEach } from "vitest";
import { useSearchStore } from "@/lib/search/store";
import type { PresentedResults } from "@/lib/search/presenting/types";

const makeResults = (): PresentedResults => ({
  topMatches: [],
  sections: [],
  totals: {},
  diagnostics: {
    total_ms: 0,
    cache_hit: "miss",
    degraded: false,
    retrieve_total_ms: 0,
    retriever_ms: {},
    result_type_counts: {},
  },
});

describe("useSearchStore", () => {
  beforeEach(() => {
    useSearchStore.setState({
      raw: "",
      results: null,
      status: "idle",
      requestId: null,
      error: null,
      mode: "inline",
      overlayOpen: false,
      filters: {},
    });
  });

  it("setRaw updates raw field", () => {
    useSearchStore.getState().setRaw("jazz");
    expect(useSearchStore.getState().raw).toBe("jazz");
  });

  it("openOverlay sets overlayOpen + mode", () => {
    useSearchStore.getState().openOverlay();
    expect(useSearchStore.getState().overlayOpen).toBe(true);
    expect(useSearchStore.getState().mode).toBe("overlay");
  });

  it("closeOverlay clears overlayOpen", () => {
    useSearchStore.getState().openOverlay();
    useSearchStore.getState().closeOverlay();
    expect(useSearchStore.getState().overlayOpen).toBe(false);
  });

  it("commitResults updates results if requestId matches", () => {
    useSearchStore.setState({ requestId: "req-1", status: "fetching" });
    useSearchStore.getState().commitResults(makeResults(), "req-1");
    expect(useSearchStore.getState().status).toBe("ready");
    expect(useSearchStore.getState().results).not.toBeNull();
  });

  it("commitResults ignores stale requestId", () => {
    useSearchStore.setState({ requestId: "req-2", status: "fetching" });
    useSearchStore.getState().commitResults(makeResults(), "req-1");
    expect(useSearchStore.getState().results).toBeNull();
  });
});
