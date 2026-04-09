import { describe, it, expect } from "vitest";
import { confidenceTier } from "./confidence-badge";

describe("confidenceTier", () => {
  it("classifies >= 0.9 as High", () => {
    expect(confidenceTier(0.9).label).toBe("High");
    expect(confidenceTier(1.0).label).toBe("High");
    expect(confidenceTier(0.95).label).toBe("High");
  });

  it("classifies 0.8-0.89 as Medium", () => {
    expect(confidenceTier(0.8).label).toBe("Medium");
    expect(confidenceTier(0.85).label).toBe("Medium");
    expect(confidenceTier(0.89).label).toBe("Medium");
  });

  it("classifies 0.5-0.79 as Low", () => {
    expect(confidenceTier(0.5).label).toBe("Low");
    expect(confidenceTier(0.7).label).toBe("Low");
    expect(confidenceTier(0.79).label).toBe("Low");
  });

  it("classifies < 0.5 as Unverified", () => {
    expect(confidenceTier(0.49).label).toBe("Unverified");
    expect(confidenceTier(0).label).toBe("Unverified");
    expect(confidenceTier(0.1).label).toBe("Unverified");
  });

  it("returns appropriate CSS classes per tier", () => {
    expect(confidenceTier(0.95).className).toContain("green");
    expect(confidenceTier(0.85).className).toContain("yellow");
    expect(confidenceTier(0.65).className).toContain("orange");
    expect(confidenceTier(0.3).className).toContain("red");
  });
});
