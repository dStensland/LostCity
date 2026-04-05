import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

describe("middleware legacy portal redirects", () => {
  it("keeps HelpATL on its canonical root-domain slug path", () => {
    const request = new NextRequest("https://lostcity.ai/helpatl/groups");
    const response = middleware(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-lc-vertical")).toBeNull();
  });
});
