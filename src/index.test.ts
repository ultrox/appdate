import { expect, test, describe, beforeAll } from "bun:test";
// import { expect, describe, test } from 'vitest';
import { AppDate, setAppDateLanguage } from "./index";

beforeAll(async () => {
  await setAppDateLanguage("de");
});

/**
 * @description this is just helper to test date
 */
const getFixedDate = () => AppDate.fromDateString("1985-10-24");

test("default time zone is Europe/Zurich", () => {
  const d = AppDate.fromDateString("2024-10-10");
  expect(d.timezone).toBe("Europe/Zurich");
});

test("successfully create invalid date", () => {
  const d = AppDate.invalid();
  expect(d.isValid()).toBe(false);
});

test("localizedDate String", () => {
  const d = AppDate.fromDateString("2010-10-10");
  expect(d.toLocalizedDateString()).toBe("10.10.2010");
});

test("fromLocalTime", () => {
  const d = AppDate.fromLocalTime("11:12");
  expect(d.isValid()).toBe(true);
});

describe("fromDateString", () => {
  test("success on valid pattern", () => {
    const k = AppDate.fromDateString("2020-10-24");
    expect(k.isValid()).toBe(true);
  });

  test("handles empty by giving back invalid date", () => {
    const k = AppDate.fromDateString("");
    expect(k.isValid()).toBe(false);
  });

  test("Invalid date on out of bounds", () => {
    expect(AppDate.fromDateString("2020-88-24").isValid()).toBe(false);
    expect(AppDate.fromDateString("2020-88-44").isValid()).toBe(false);
    expect(AppDate.fromDateString("2020-88-500").isValid()).toBe(false);
  });
});

test("format", () => {
  expect(AppDate.fromDateString("2020-10-24").format("[++] YYYY")).toBe("++ 2020");
  expect(AppDate.fromDateString("2020-10-24").format("MMM")).toBe("Okt.");
});

/**
 *
 *
 *
 *
 */

test("formatShort", () => {
  // code
  const d = AppDate.fromDateString("2020-10-24").formatShort();
  expect(d).toBe("Sa, 24.10.");
});

test("formatDateTime", () => {
  const result = getFixedDate().toLocalizedDateString({
    includeDayOfWeek: false,
  });
  expect(result).toBe("24.10.1985");
});

describe("fromEpochSeconds", () => {
  test("creates date from unix timestamp", async () => {
    await setAppDateLanguage("de");
    const date = AppDate.fromEpochSeconds(1704067200); // 2024-01-01 00:00:00 UTC
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe("2024-01-01");
  });

  test("handles zero timestamp (unix epoch)", () => {
    const date = AppDate.fromEpochSeconds(0);
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe("1970-01-01");
  });
});

describe("fromUtcString", () => {
  test("creates date from UTC date string", () => {
    const date = AppDate.fromUtcString("2024-06-15");
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe("2024-06-15");
  });

  test("creates current date when no argument passed", () => {
    const date = AppDate.fromUtcString();
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe(AppDate.now().toDateString());
  });
});

describe("fromUtcTime", () => {
  test("creates date from UTC time string", () => {
    const date = AppDate.fromUtcTime("14:30:00+00:00");
    expect(date.isValid()).toBe(true);
    expect(date.toLocalTime()).toBe("15:30"); // UTC+1 (Europe/Zurich winter)
  });

  test("handles midnight UTC", () => {
    const date = AppDate.fromUtcTime("00:00:00+00:00");
    expect(date.isValid()).toBe(true);
  });
});

describe("fromEpochMillis", () => {
  test("creates date from milliseconds timestamp", () => {
    const date = AppDate.fromEpochMillis(1704067200000); // 2024-01-01 00:00:00 UTC
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe("2024-01-01");
  });

  test("handles zero timestamp (unix epoch)", () => {
    const date = AppDate.fromEpochMillis(0);
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe("1970-01-01");
  });

  test("roundtrips with toEpochMillis", () => {
    const now = AppDate.now();
    const millis = now.toEpochMillis();
    const restored = AppDate.fromEpochMillis(millis);
    expect(restored.toDateString()).toBe(now.toDateString());
  });
});

describe("serbian locales", () => {
  test("sr (ekavian) formats days correctly", async () => {
    await setAppDateLanguage("sr");
    const monday = AppDate.fromDateString("2024-01-08");
    expect(monday.format("dddd")).toBe("Ponedeljak");
    expect(monday.format("dd")).toBe("po");
  });

  test("sr-ije (ijekavian) formats days correctly", async () => {
    await setAppDateLanguage("sr-ije");
    const monday = AppDate.fromDateString("2024-01-08");
    const wednesday = AppDate.fromDateString("2024-01-10");
    const sunday = AppDate.fromDateString("2024-01-07");

    expect(monday.format("dddd")).toBe("Ponedjeljak");
    expect(wednesday.format("dddd")).toBe("Srijeda");
    expect(sunday.format("dddd")).toBe("Nedjelja");
  });

  test("sr-ije localized date format", async () => {
    await setAppDateLanguage("sr-ije");
    const date = AppDate.fromDateString("2024-01-11");
    expect(date.toLocalizedDateString()).toBe("11.01.2024");
    expect(date.toLocalizedDateString({ includeDayOfWeek: true })).toBe("če, 11.01.2024");
  });
});

describe("toRelative", () => {
  test("sr (ekavian) relative time in the past", async () => {
    await setAppDateLanguage("sr");
    const twoDaysAgo = AppDate.now().subtract(2, "day");
    expect(twoDaysAgo.toRelative()).toBe("pre 2 dana");
  });

  test("sr (ekavian) relative time in the future", async () => {
    await setAppDateLanguage("sr");
    const inTwoDays = AppDate.now().add(2, "day");
    expect(inTwoDays.toRelative()).toBe("za 2 dana");
  });

  test("sr-ije (ijekavian) relative time in the past", async () => {
    await setAppDateLanguage("sr-ije");
    const twoDaysAgo = AppDate.now().subtract(2, "day");
    expect(twoDaysAgo.toRelative()).toBe("prije 2 dana");
  });

  test("sr-ije (ijekavian) relative time in the future", async () => {
    await setAppDateLanguage("sr-ije");
    const inTwoDays = AppDate.now().add(2, "day");
    expect(inTwoDays.toRelative()).toBe("za 2 dana");
  });

  test("english relative time", async () => {
    await setAppDateLanguage("en");
    const threeDaysAgo = AppDate.now().subtract(3, "day");
    expect(threeDaysAgo.toRelative()).toBe("3 days ago");
  });

  test("caps at specified days (past)", async () => {
    await setAppDateLanguage("en");
    const fifteenDaysAgo = AppDate.now().subtract(15, "day");
    expect(fifteenDaysAgo.toRelative({ cap: 9 })).toBe("9+ days ago");
  });

  test("caps at specified days (future)", async () => {
    await setAppDateLanguage("en");
    const inFifteenDays = AppDate.now().add(15, "day");
    expect(inFifteenDays.toRelative({ cap: 9 })).toBe("in 9+ days");
  });

  test("sr caps at specified days", async () => {
    await setAppDateLanguage("sr");
    const fifteenDaysAgo = AppDate.now().subtract(15, "day");
    expect(fifteenDaysAgo.toRelative({ cap: 9 })).toBe("pre 9+ dana");
  });

  test("sr-ije caps at specified days", async () => {
    await setAppDateLanguage("sr-ije");
    const fifteenDaysAgo = AppDate.now().subtract(15, "day");
    expect(fifteenDaysAgo.toRelative({ cap: 9 })).toBe("prije 9+ dana");
  });

  test("falls back to date after threshold", async () => {
    await setAppDateLanguage("en");
    const twentyDaysAgo = AppDate.now().subtract(20, "day");
    const result = twentyDaysAgo.toRelative({
      cap: 9,
      fallbackAfterDays: 14,
    });
    // Should return localized date string (default fallback)
    expect(result).toBe(twentyDaysAgo.toLocalizedDateString());
  });

  test("uses custom fallback formatter", async () => {
    await setAppDateLanguage("sr");
    const twentyDaysAgo = AppDate.now().subtract(20, "day");
    const result = twentyDaysAgo.toRelative({
      cap: 9,
      fallbackAfterDays: 14,
      fallback: (d) => d.format("DD.MM."),
    });
    expect(result).toBe(twentyDaysAgo.format("DD.MM."));
  });

  test("does not cap when under threshold", async () => {
    await setAppDateLanguage("en");
    const fiveDaysAgo = AppDate.now().subtract(5, "day");
    expect(fiveDaysAgo.toRelative({ cap: 9 })).toBe("5 days ago");
  });
});
