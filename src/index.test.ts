import { expect, test, describe, beforeAll, setSystemTime } from "bun:test";
// import { expect, describe, test } from 'vitest';
import { AppDate, initializeAppDate, setAppDateLanguage, setTimezone } from "./index";

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

test("invalid input stays silent", () => {
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    expect(AppDate.fromDateString("not-a-date").isValid()).toBe(false);

    setTimezone("Invalid/Zone");
    expect(AppDate.fromLocalTime("11:12").isValid()).toBe(false);
    expect(warnings).toEqual([]);
  } finally {
    setTimezone("Europe/Zurich");
    console.warn = originalWarn;
  }
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

describe("timezone preservation", () => {
  test("add preserves the instance timezone and wall-clock time", () => {
    setTimezone("Europe/Zurich");
    try {
      const date = AppDate.fromDateString("2024-01-15");
      setTimezone("America/New_York");

      const nextDay = date.add(1, "day");

      expect(nextDay.timezone).toBe("Europe/Zurich");
      expect(nextDay.toDateString()).toBe("2024-01-16");
      expect(nextDay.toLocalTime()).toBe("00:00");
    } finally {
      setTimezone("Europe/Zurich");
    }
  });
});

describe("comparison and UTC conversion methods", () => {
  test("converts a local date across the UTC calendar-day boundary", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));

    try {
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
      const date = AppDate.fromEpochMillis(1705275000000);

      expect(date.toDateString()).toBe("2024-01-15");
      expect(date.toLocalTime()).toBe("00:30");
      expect(date.toUtcTime()).toBe("23:30:00+00:00");
      expect(date.toUtcDateString()).toBe("2024-01-14");
      expect(date.toUtcString()).toBe("2024-01-14T23:30:00+00:00");
      expect(date.toEpochSeconds()).toBe(1705275000);
    } finally {
      setSystemTime();
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    }
  });

  test("compares exact instants and calendar-day granularity", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));

    try {
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
      const morning = AppDate.fromEpochMillis(1705305600000);
      const evening = AppDate.fromEpochMillis(1705338000000);

      expect(morning.isBefore(evening)).toBe(true);
      expect(morning.isBefore(evening, "day")).toBe(false);
      expect(evening.isAfter(morning)).toBe(true);
      expect(evening.isAfter(morning, "day")).toBe(false);
      expect(morning.isSame(evening)).toBe(false);
      expect(morning.isSame(evening, "day")).toBe(true);
      expect(morning.isSame(morning)).toBe(true);
    } finally {
      setSystemTime();
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    }
  });

  test("calculates day and month boundaries in the instance timezone", async () => {
    setSystemTime(new Date("2024-02-15T12:00:00Z"));

    try {
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
      const date = AppDate.fromEpochMillis(1707996896789);
      const startOfDay = date.startOf("day");
      const endOfDay = date.endOf("day");
      const startOfMonth = date.startOf("month");
      const endOfMonth = date.endOf("month");
      const tomorrow = date.tomorrow();

      expect(startOfDay.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe("2024-02-15 00:00:00.000");
      expect(endOfDay.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe("2024-02-15 23:59:59.999");
      expect(startOfMonth.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe("2024-02-01 00:00:00.000");
      expect(endOfMonth.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe("2024-02-29 23:59:59.999");
      expect(tomorrow.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe("2024-02-16 12:34:56.789");

      for (const result of [startOfDay, endOfDay, startOfMonth, endOfMonth, tomorrow]) {
        expect(result.timezone).toBe("Europe/Zurich");
      }
    } finally {
      setSystemTime();
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    }
  });
});

describe("isToday", () => {
  test("compares today in the configured timezone", () => {
    setSystemTime(new Date("2024-01-01T02:00:00Z"));
    setTimezone("America/New_York");

    try {
      expect(AppDate.fromDateString("2023-12-31").isToday()).toBe(true);
      expect(AppDate.fromDateString("2024-01-01").isToday()).toBe(false);
    } finally {
      setSystemTime();
      setTimezone("Europe/Zurich");
    }
  });
});

describe("isFirstDayOfWeek", () => {
  test("honours the English Sunday week start", async () => {
    setSystemTime(new Date("2024-01-07T12:00:00Z"));
    await setAppDateLanguage("en");

    try {
      expect(AppDate.fromDateString("2024-01-07").isFirstDayOfWeek()).toBe(true);
      expect(AppDate.fromDateString("2024-01-08").isFirstDayOfWeek()).toBe(false);
    } finally {
      setSystemTime();
      await setAppDateLanguage("de");
    }
  });

  test("keeps Monday as the first day for German", async () => {
    setSystemTime(new Date("2024-01-08T12:00:00Z"));
    await setAppDateLanguage("de");

    try {
      expect(AppDate.fromDateString("2024-01-07").isFirstDayOfWeek()).toBe(false);
      expect(AppDate.fromDateString("2024-01-08").isFirstDayOfWeek()).toBe(true);
    } finally {
      setSystemTime();
      await setAppDateLanguage("de");
    }
  });
});

describe("working day and range logic", () => {
  test("identifies working days across a full week", () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    setTimezone("Europe/Zurich");

    try {
      const week = [
        ["2024-01-08", true],
        ["2024-01-09", true],
        ["2024-01-10", true],
        ["2024-01-11", true],
        ["2024-01-12", true],
        ["2024-01-13", false],
        ["2024-01-14", false],
      ] as const;

      for (const [date, expected] of week) {
        expect(AppDate.fromDateString(date).isWorkingDay()).toBe(expected);
      }
    } finally {
      setSystemTime();
      setTimezone("Europe/Zurich");
    }
  });

  test("finds the next working day across weekends", () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    setTimezone("Europe/Zurich");

    try {
      const cases = [
        ["2024-01-12", "2024-01-15"],
        ["2024-01-13", "2024-01-15"],
        ["2024-01-14", "2024-01-15"],
        ["2024-01-15", "2024-01-16"],
      ] as const;

      for (const [date, expected] of cases) {
        expect(AppDate.fromDateString(date).nextWorkingDay().toDateString()).toBe(expected);
      }
    } finally {
      setSystemTime();
      setTimezone("Europe/Zurich");
    }
  });

  test("finds the previous working day across weekends", () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    setTimezone("Europe/Zurich");

    try {
      const cases = [
        ["2024-01-12", "2024-01-11"],
        ["2024-01-13", "2024-01-12"],
        ["2024-01-14", "2024-01-12"],
        ["2024-01-15", "2024-01-12"],
      ] as const;

      for (const [date, expected] of cases) {
        expect(AppDate.fromDateString(date).previousWorkingDay().toDateString()).toBe(expected);
      }
    } finally {
      setSystemTime();
      setTimezone("Europe/Zurich");
    }
  });

  test("adds working days and preserves the guard behavior", () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    setTimezone("Europe/Zurich");

    try {
      const wednesday = AppDate.fromDateString("2024-01-10");

      expect(wednesday.addWorkingDays(1).toDateString()).toBe("2024-01-11");
      expect(wednesday.addWorkingDays(5).toDateString()).toBe("2024-01-17");
      expect(wednesday.addWorkingDays(10).toDateString()).toBe("2024-01-24");

      for (const days of [0, -1, 1.5]) {
        expect(wednesday.addWorkingDays(days)).toBe(wednesday);
      }
    } finally {
      setSystemTime();
      setTimezone("Europe/Zurich");
    }
  });

  test("adds twenty thousand working days without overflowing the stack", async () => {
    setSystemTime(new Date("2024-01-03T12:00:00Z"));

    try {
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });

      const start = AppDate.fromDateString("2024-01-03");
      expect(start.addWorkingDays(20000).toDateString()).toBe("2100-09-01");
    } finally {
      setSystemTime();
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    }
  });

  test("supports every isBetween inclusivity mode and default bounds", () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    setTimezone("Europe/Zurich");

    try {
      const from = AppDate.fromDateString("2024-01-10");
      const inside = AppDate.fromDateString("2024-01-15");
      const to = AppDate.fromDateString("2024-01-20");
      const modes = [
        ["()", false, false],
        ["[]", true, true],
        ["[)", true, false],
        ["(]", false, true],
      ] as const;

      for (const [inclusivity, includesFrom, includesTo] of modes) {
        expect(from.isBetween(from, to, "day", inclusivity)).toBe(includesFrom);
        expect(to.isBetween(from, to, "day", inclusivity)).toBe(includesTo);
      }

      expect(inside.isBetween()).toBe(true);
      expect(AppDate.minDate().isBetween()).toBe(true);
      expect(AppDate.maxDate().isBetween()).toBe(false);
    } finally {
      setSystemTime();
      setTimezone("Europe/Zurich");
    }
  });
});

describe("initializeAppDate", () => {
  test("rejects invalid timezones without changing the current config", async () => {
    await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });

    await expect(initializeAppDate({ language: "en", timeZone: "Invalid/Zone" })).rejects.toThrow(
      "Invalid timezone: Invalid/Zone"
    );

    const date = AppDate.fromDateString("2024-01-15");
    expect(date.timezone).toBe("Europe/Zurich");
    expect(date.format("MMMM")).toBe("Januar");
  });

  test("applies the language and timezone together", async () => {
    try {
      await initializeAppDate({ language: "en", timeZone: "America/New_York" });

      const date = AppDate.fromDateString("2024-01-15");
      expect(date.timezone).toBe("America/New_York");
      expect(date.format("MMMM")).toBe("January");
    } finally {
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    }
  });

  test("can be called again with a different config", async () => {
    try {
      await initializeAppDate({ language: "en", timeZone: "America/New_York" });
      await initializeAppDate({ language: "fr", timeZone: "Europe/Paris" });

      const date = AppDate.fromDateString("2024-01-15");
      expect(date.timezone).toBe("Europe/Paris");
      expect(date.format("MMMM")).toBe("janvier");
    } finally {
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    }
  });

  test("applies custom working weeks", async () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));

    try {
      await initializeAppDate({
        language: "de",
        timeZone: "Europe/Zurich",
        workingDays: [0, 1, 2, 3, 4],
      });

      const thursday = AppDate.fromDateString("2024-01-11");
      const sunday = AppDate.fromDateString("2024-01-14");
      const friday = AppDate.fromDateString("2024-01-12");

      expect(sunday.isWorkingDay()).toBe(true);
      expect(friday.isWorkingDay()).toBe(false);
      expect(thursday.nextWorkingDay().toDateString()).toBe("2024-01-14");
      expect(sunday.previousWorkingDay().toDateString()).toBe("2024-01-11");
      expect(thursday.addWorkingDays(3).toDateString()).toBe("2024-01-16");

      await initializeAppDate({
        language: "de",
        timeZone: "Europe/Zurich",
        workingDays: [3],
      });

      const tuesday = AppDate.fromDateString("2024-01-09");
      const wednesday = AppDate.fromDateString("2024-01-10");

      expect(wednesday.isWorkingDay()).toBe(true);
      expect(thursday.isWorkingDay()).toBe(false);
      expect(tuesday.nextWorkingDay().toDateString()).toBe("2024-01-10");
      expect(thursday.previousWorkingDay().toDateString()).toBe("2024-01-10");
      expect(tuesday.addWorkingDays(2).toDateString()).toBe("2024-01-17");

      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });

      expect(friday.isWorkingDay()).toBe(true);
      expect(sunday.isWorkingDay()).toBe(false);
    } finally {
      setSystemTime();
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    }
  });

  test("rejects invalid working days atomically", async () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    const invalidWorkingDays: unknown[] = [[], [7], [-1], [1, 1], [1.5], "1,2", null, {}];

    try {
      await initializeAppDate({
        language: "de",
        timeZone: "Europe/Zurich",
        workingDays: [3],
      });

      for (const invalid of invalidWorkingDays) {
        await expect(
          initializeAppDate({
            language: "en",
            timeZone: "America/New_York",
            workingDays: invalid as number[],
          })
        ).rejects.toThrow(`Invalid workingDays: ${String(invalid)}`);

        const wednesday = AppDate.fromDateString("2024-01-10");
        const thursday = AppDate.fromDateString("2024-01-11");

        expect(wednesday.timezone).toBe("Europe/Zurich");
        expect(wednesday.format("MMMM")).toBe("Januar");
        expect(wednesday.isWorkingDay()).toBe(true);
        expect(thursday.isWorkingDay()).toBe(false);
      }
    } finally {
      setSystemTime();
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    }
  });
});

describe("diff", () => {
  test("mirrors Day.js units, signs, truncation, and floating results", () => {
    setTimezone("UTC");

    try {
      const earlier = AppDate.fromEpochMillis(Date.parse("2024-01-01T00:00:00Z"));
      const later = AppDate.fromEpochMillis(Date.parse("2024-01-02T23:00:00Z"));

      expect(later.diff(earlier)).toBe(47 * 60 * 60 * 1000);
      expect(later.diff(earlier, "second")).toBe(47 * 60 * 60);
      expect(later.diff(earlier, "hour")).toBe(47);
      expect(earlier.diff(later, "hour")).toBe(-47);
      expect(later.diff(earlier, "day")).toBe(1);
      expect(earlier.diff(later, "day")).toBe(-1);
      expect(later.diff(earlier, "day", true)).toBeCloseTo(47 / 24);
    } finally {
      setTimezone("Europe/Zurich");
    }
  });
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

  test("creates date from a full ISO 8601 UTC datetime", () => {
    setSystemTime(new Date("2026-01-13T12:00:00Z"));
    setTimezone("Europe/Zurich");

    try {
      const date = AppDate.fromUtcString("2026-01-13T10:30:00Z");
      expect(date.isValid()).toBe(true);
      expect(date.toDateString()).toBe("2026-01-13");
      expect(date.toLocalTime()).toBe("11:30");
    } finally {
      setSystemTime();
      setTimezone("Europe/Zurich");
    }
  });

  test("creates current date when no argument passed", () => {
    const date = AppDate.fromUtcString();
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe(AppDate.now().toDateString());
  });
});

describe("fromUtcTime", () => {
  test("creates date from UTC time string", () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));
    try {
      const date = AppDate.fromUtcTime("14:30:00+00:00");
      expect(date.isValid()).toBe(true);
      expect(date.toLocalTime()).toBe("15:30"); // UTC+1 (Europe/Zurich winter)
    } finally {
      setSystemTime();
    }
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

  test("keeps large English caps in days for past and future dates", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));
    await setAppDateLanguage("en");

    try {
      for (const cap of [7, 9, 30, 45]) {
        const past = AppDate.now().subtract(cap + 10, "day");
        const future = AppDate.now().add(cap + 10, "day");

        expect(past.toRelative({ cap })).toBe(`${cap}+ days ago`);
        expect(future.toRelative({ cap })).toBe(`in ${cap}+ days`);
      }
    } finally {
      setSystemTime();
      await setAppDateLanguage("de");
    }
  });

  test("keeps large sr-ije caps in days for past and future dates", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));
    await setAppDateLanguage("sr-ije");

    try {
      for (const cap of [7, 9, 30, 45]) {
        const past = AppDate.now().subtract(cap + 10, "day");
        const future = AppDate.now().add(cap + 10, "day");

        expect(past.toRelative({ cap })).toBe(`prije ${cap}+ dana`);
        expect(future.toRelative({ cap })).toBe(`za ${cap}+ dana`);
      }
    } finally {
      setSystemTime();
      await setAppDateLanguage("de");
    }
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
