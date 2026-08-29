import { describe, expect, it } from "vitest";

import { arabicName, teamName } from "./teamNames";

describe("arabicName", () => {
  it("translates a club the fixtures feed only returns in English", () => {
    // TheSportsDB has no Arabic column, so an unmapped Arabic scoreboard
    // prints "Ghazl El Mahalla" beside «الجولة 13».
    expect(arabicName("Al Ahly")).toBe("الأهلي");
    expect(arabicName("Zamalek")).toBe("الزمالك");
  });

  it("matches regardless of case or stray whitespace", () => {
    // The feed's own strings are not normalised.
    expect(arabicName("  al ahly  ")).toBe("الأهلي");
    expect(arabicName("ZAMALEK")).toBe("الزمالك");
  });

  it("falls through to the English string rather than dropping it", () => {
    // A cup opponent with no entry is still a readable fixture.
    expect(arabicName("Some Unlisted FC")).toBe("Some Unlisted FC");
  });

  it("answers empty for a missing value instead of printing undefined", () => {
    expect(arabicName(null)).toBe("");
    expect(arabicName(undefined)).toBe("");
    expect(arabicName("")).toBe("");
  });
});

describe("teamName", () => {
  it("maps for the Arabic edition and leaves the English one alone", () => {
    expect(teamName("Al Ahly", "ar")).toBe("الأهلي");
    expect(teamName("Al Ahly", "en")).toBe("Al Ahly");
  });

  it("never returns null into the markup", () => {
    expect(teamName(null, "en")).toBe("");
    expect(teamName(null, "ar")).toBe("");
  });
});
