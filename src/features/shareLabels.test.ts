import { describe, expect, it } from "vitest";
import { aggregateReviewLabel } from "./shareLabels";

describe("share cards use original report review decisions", () => {
  it("uses a canonical accepted decision without calling it an unreviewed report", () => {
    expect(aggregateReviewLabel(["accepted_for_investigation"])).toBe(
      "Report accepted for investigation",
    );
  });
  it("labels unreviewed content explicitly when other reports have been reviewed", () => {
    expect(
      aggregateReviewLabel(["submitted", "accepted_for_investigation"]),
    ).toBe("Community report — not yet reviewed · mixed review decisions");
  });
  it("does not invent a review decision when data is unavailable", () => {
    expect(aggregateReviewLabel(undefined)).toBe(
      "Report review status unavailable",
    );
    expect(aggregateReviewLabel([])).toBe(
      "No individual report review recorded",
    );
  });
});
