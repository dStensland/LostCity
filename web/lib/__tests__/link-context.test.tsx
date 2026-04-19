import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  LinkContextProvider,
  useLinkContext,
  useResolvedLinkContext,
  type LinkContext,
} from "@/lib/link-context";

function AmbientProbe() {
  const ctx = useLinkContext();
  return <span data-testid="ambient">{ctx}</span>;
}

function ResolvedProbe({ override }: { override?: LinkContext }) {
  const ctx = useResolvedLinkContext(override);
  return <span data-testid="resolved">{ctx}</span>;
}

describe("useLinkContext", () => {
  it("defaults to 'canonical' when no provider is in scope", () => {
    render(<AmbientProbe />);
    expect(screen.getByTestId("ambient").textContent).toBe("canonical");
  });

  it("returns 'overlay' when wrapped in overlay provider", () => {
    render(
      <LinkContextProvider value="overlay">
        <AmbientProbe />
      </LinkContextProvider>,
    );
    expect(screen.getByTestId("ambient").textContent).toBe("overlay");
  });

  it("returns 'canonical' when wrapped in canonical provider", () => {
    render(
      <LinkContextProvider value="canonical">
        <AmbientProbe />
      </LinkContextProvider>,
    );
    expect(screen.getByTestId("ambient").textContent).toBe("canonical");
  });

  it("inner provider overrides outer", () => {
    render(
      <LinkContextProvider value="overlay">
        <LinkContextProvider value="canonical">
          <AmbientProbe />
        </LinkContextProvider>
      </LinkContextProvider>,
    );
    expect(screen.getByTestId("ambient").textContent).toBe("canonical");
  });
});

describe("useResolvedLinkContext", () => {
  it("returns the ambient context when no override is passed", () => {
    render(
      <LinkContextProvider value="overlay">
        <ResolvedProbe />
      </LinkContextProvider>,
    );
    expect(screen.getByTestId("resolved").textContent).toBe("overlay");
  });

  it("returns the ambient context when override is undefined", () => {
    render(
      <LinkContextProvider value="overlay">
        <ResolvedProbe override={undefined} />
      </LinkContextProvider>,
    );
    expect(screen.getByTestId("resolved").textContent).toBe("overlay");
  });

  it("returns the override when explicitly passed", () => {
    render(
      <LinkContextProvider value="overlay">
        <ResolvedProbe override="canonical" />
      </LinkContextProvider>,
    );
    expect(screen.getByTestId("resolved").textContent).toBe("canonical");
  });

  it("returns the override even when no provider is in scope", () => {
    render(<ResolvedProbe override="overlay" />);
    expect(screen.getByTestId("resolved").textContent).toBe("overlay");
  });

  it("does NOT short-circuit on falsy values beyond undefined", () => {
    // Sanity: override is typed as LinkContext | undefined, so callers
    // can't pass null/"". But if this contract ever loosens, this test
    // guards against `override ?? ambient` behaving wrong for empty strings.
    render(
      <LinkContextProvider value="overlay">
        <ResolvedProbe override={"canonical" as LinkContext} />
      </LinkContextProvider>,
    );
    expect(screen.getByTestId("resolved").textContent).toBe("canonical");
  });
});
