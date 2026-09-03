import { expect, test, describe, setSystemTime } from "bun:test";
import dayjs from "dayjs";
// import { expect, describe, test } from 'vitest';
import {
  AppDate,
  extendAppDate,
  formatLocalTime,
  getLocalizedDateString,
  initializeAppDate,
  isDateString,
  type AppDateLanguage,
} from "./index";
import { resolveSystemTimezone } from "./system-timezone";

declare module "./index" {
  interface AppDate {
    returnSelfForTest(): AppDate;
  }
}

const configure = (language: AppDateLanguage = "de", timeZone = "Europe/Zurich") =>
  initializeAppDate({ language, timeZone });
const SUMMER_INSTANT = "2026-07-15T15:00:00Z";
const SUMMER_EPOCH_MILLIS = Date.parse(SUMMER_INSTANT);
const SYSTEM_INSTANT = "2026-07-15T10:00:00Z";

/**
 * @description this is just helper to test date
 */
const getFixedDate = () => AppDate.fromDateString("1985-10-24");

test("configured IANA timezones produce invalid dates without Intl", async () => {
  const intlDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Intl");
  const guess = dayjs.tz.guess;
  let guessCalls = 0;

  dayjs.tz.guess = () => {
    guessCalls += 1;
    return guess();
  };
  Reflect.deleteProperty(globalThis, "Intl");

  try {
    const cacheBustedIndex = "./index?intl-absent";
    const configuredModule = await import(cacheBustedIndex);

    const timeZones = ["Europe/Zurich", "America/New_York", "Asia/Tokyo"] as const;

    for (const timeZone of timeZones) {
      await configuredModule.initializeAppDate({ language: "en", timeZone });
      const date = configuredModule.AppDate.fromDateString("2024-01-15");

      expect(date.isValid()).toBe(false);
      expect(date.timezone).toBe(timeZone);
    }
    expect(guessCalls).toBe(0);
  } finally {
    dayjs.tz.guess = guess;
    if (intlDescriptor) {
      Object.defineProperty(globalThis, "Intl", intlDescriptor);
    }
  }
});

test("keeps the unconfigured UTC default usable without Intl", async () => {
  const intlDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Intl");
  Reflect.deleteProperty(globalThis, "Intl");

  try {
    const cacheBustedIndex = "./index?intl-absent-utc-default";
    const unconfiguredModule = await import(cacheBustedIndex);
    const date = unconfiguredModule.AppDate.fromEpochMillis(SUMMER_EPOCH_MILLIS);

    expect(date.timezone).toBe("UTC");
    expect(date.isValid()).toBe(true);
    expect(date.format("YYYY-MM-DD HH:mm Z")).toBe("2026-07-15 15:00 +00:00");
  } finally {
    if (intlDescriptor) {
      Object.defineProperty(globalThis, "Intl", intlDescriptor);
    }
  }
});

test("keeps instant and wall-clock construction valid with malformed Hermes iOS parts", async () => {
  const DateTimeFormat = Intl.DateTimeFormat;
  let simulateHermesIos = true;

  function HermesIosDateTimeFormat(
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions
  ): Intl.DateTimeFormat {
    const formatter = new DateTimeFormat(locales, options);
    const formatToParts = formatter.formatToParts.bind(formatter);

    Object.defineProperty(formatter, "formatToParts", {
      value: (date?: Date | number) =>
        formatToParts(date).flatMap((part) => {
          if (!simulateHermesIos || part.type !== "timeZoneName") {
            return [part];
          }

          const offset = part.value.match(/^(.*?)([+-])(\d+)$/);
          // Hermes iOS splits GMT+2 and labels the trailing offset hour as another minute part.
          return offset
            ? [
                { type: "timeZoneName", value: offset[1] },
                { type: "literal", value: offset[2] },
                { type: "minute", value: offset[3] },
              ]
            : [part];
        }),
    });
    return formatter;
  }

  Intl.DateTimeFormat = HermesIosDateTimeFormat as unknown as typeof Intl.DateTimeFormat;
  setSystemTime(new Date(SUMMER_INSTANT));

  try {
    const hermesModuleSpecifier = "./index?hermes-ios-named-offset-parts";
    const hermesModule = await import(hermesModuleSpecifier);
    await hermesModule.initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });

    const namedOffsetParts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: "Europe/Zurich",
      timeZoneName: "short",
      year: "numeric",
    }).formatToParts(new Date(SUMMER_INSTANT));
    expect(
      namedOffsetParts.filter((part) => part.type === "minute").map((part) => part.value)
    ).toEqual(["00", "2"]);

    const now = hermesModule.AppDate.now();
    expect(now.isValid()).toBe(true);
    expect(Number.isFinite(now.toEpochMillis())).toBe(true);
    expect(now.toEpochMillis()).toBe(SUMMER_EPOCH_MILLIS);
    expect(now.format("YYYY-MM-DD HH:mm Z")).toBe("2026-07-15 17:00 +02:00");
    expect(now.toUtcString()).toBe("2026-07-15T15:00:00+00:00");

    const localDate = hermesModule.AppDate.fromDateString("2026-07-15");
    expect(localDate.isValid()).toBe(true);
    expect(localDate.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-07-15 00:00:00");
    expect(localDate.toUtcString()).toBe("2026-07-14T22:00:00+00:00");

    const localTime = hermesModule.AppDate.fromLocalTime("09:30");
    expect(localTime.isValid()).toBe(true);
    expect(localTime.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-07-15 09:30:00");
  } finally {
    simulateHermesIos = false;
    Intl.DateTimeFormat = DateTimeFormat;
    setSystemTime();
  }
});

test("defaults to the resolved system timezone before initialization", () => {
  expect(AppDate.fromDateString("2024-10-10").timezone).toBe(dayjs.tz.guess() || "UTC");
});

describe("Hermes timezone conversion", () => {
  const hermesDateString = "not parseable by Hermes";

  const instantFactories = () =>
    [
      ["now", AppDate.now(), "2026-07-15 12:00 +02:00"],
      [
        "fromEpochSeconds",
        AppDate.fromEpochSeconds(SUMMER_EPOCH_MILLIS / 1000),
        "2026-07-15 17:00 +02:00",
      ],
      ["fromEpochMillis", AppDate.fromEpochMillis(SUMMER_EPOCH_MILLIS), "2026-07-15 17:00 +02:00"],
      ["fromUtcString", AppDate.fromUtcString(SUMMER_INSTANT), "2026-07-15 17:00 +02:00"],
      ["fromUtcTime", AppDate.fromUtcTime("15:00:00+00:00"), "2026-07-15 17:00 +02:00"],
      ["fromLocalTime", AppDate.fromLocalTime("17:00"), "2026-07-15 17:00 +02:00"],
    ] as const;

  const expectInstantFactoriesToBeInvalid = () => {
    for (const [factory, date] of instantFactories()) {
      expect(date.isValid(), factory).toBe(false);
    }
  };

  test("converts every instant factory without parsing localized date strings", async () => {
    const toLocaleString = Date.prototype.toLocaleString;
    setSystemTime(new Date(SYSTEM_INSTANT));
    await configure();
    Date.prototype.toLocaleString = () => hermesDateString;

    try {
      for (const [factory, date, expected] of instantFactories()) {
        expect(date.format("YYYY-MM-DD HH:mm Z"), factory).toBe(expected);
      }

      const winter = AppDate.fromEpochMillis(Date.parse("2026-01-15T15:00:00Z"));
      expect(winter.format("YYYY-MM-DD HH:mm Z")).toBe("2026-01-15 16:00 +01:00");

      const reportedDate = AppDate.fromEpochMillis(SUMMER_EPOCH_MILLIS);
      expect(reportedDate.formatDateTime({ includeDayOfWeek: true })).toBe("Mi, 15.07.2026, 17:00");

      await configure("en", "America/New_York");
      const nonHostDate = AppDate.fromEpochMillis(SUMMER_EPOCH_MILLIS);
      expect(nonHostDate.format("YYYY-MM-DD HH:mm Z")).toBe("2026-07-15 11:00 -04:00");
    } finally {
      Date.prototype.toLocaleString = toLocaleString;
      setSystemTime();
      await configure();
    }
  });

  test("returns invalid dates when timezone parts are incomplete", async () => {
    const DateTimeFormat = Intl.DateTimeFormat;
    setSystemTime(new Date(SYSTEM_INSTANT));
    await configure();

    function IncompleteDateTimeFormat(
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions
    ) {
      const formatter = new DateTimeFormat(locales, options);
      Object.defineProperty(formatter, "formatToParts", {
        value: () => [{ type: "year", value: "2026" }],
      });
      return formatter;
    }

    Intl.DateTimeFormat = IncompleteDateTimeFormat as unknown as typeof Intl.DateTimeFormat;

    try {
      expectInstantFactoriesToBeInvalid();
    } finally {
      Intl.DateTimeFormat = DateTimeFormat;
      setSystemTime();
      await configure();
    }
  });

  test("returns invalid dates when timezone parts produce a non-finite offset", async () => {
    const DateTimeFormat = Intl.DateTimeFormat;
    setSystemTime(new Date(SYSTEM_INSTANT));
    await configure();

    function NonFiniteDateTimeFormat(
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions
    ) {
      const formatter = new DateTimeFormat(locales, options);
      const formatToParts = formatter.formatToParts.bind(formatter);
      Object.defineProperty(formatter, "formatToParts", {
        value: (date?: Date | number) =>
          formatToParts(date).map((part) =>
            part.type === "year" ? { ...part, value: "not-a-number" } : part
          ),
      });
      return formatter;
    }

    Intl.DateTimeFormat = NonFiniteDateTimeFormat as unknown as typeof Intl.DateTimeFormat;

    try {
      expectInstantFactoriesToBeInvalid();
    } finally {
      Intl.DateTimeFormat = DateTimeFormat;
      setSystemTime();
      await configure();
    }
  });

  test("returns invalid dates when formatToParts is unavailable", async () => {
    const DateTimeFormat = Intl.DateTimeFormat;
    setSystemTime(new Date(SYSTEM_INSTANT));
    await configure();

    function DateTimeFormatWithoutParts(
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions
    ) {
      const formatter = new DateTimeFormat(locales, options);
      Object.defineProperty(formatter, "formatToParts", { value: undefined });
      return formatter;
    }

    Intl.DateTimeFormat = DateTimeFormatWithoutParts as unknown as typeof Intl.DateTimeFormat;

    try {
      expectInstantFactoriesToBeInvalid();
    } finally {
      Intl.DateTimeFormat = DateTimeFormat;
      setSystemTime();
      await configure();
    }
  });

  test("returns invalid dates when Intl is unavailable", async () => {
    const intlDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Intl");
    setSystemTime(new Date(SYSTEM_INSTANT));
    await configure();
    Reflect.deleteProperty(globalThis, "Intl");

    try {
      expectInstantFactoriesToBeInvalid();
    } finally {
      if (intlDescriptor) {
        Object.defineProperty(globalThis, "Intl", intlDescriptor);
      }
      setSystemTime();
      await configure();
    }
  });
});

test("falls back to UTC when Intl has no timezone", () => {
  const DateTimeFormat = Intl.DateTimeFormat;
  Intl.DateTimeFormat = (() => ({
    resolvedOptions: () => ({}),
  })) as unknown as typeof Intl.DateTimeFormat;

  try {
    expect(resolveSystemTimezone()).toBe("UTC");
  } finally {
    Intl.DateTimeFormat = DateTimeFormat;
  }
});

test("falls back to UTC when Intl is unavailable", () => {
  const intlDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Intl");
  Reflect.deleteProperty(globalThis, "Intl");

  try {
    expect(resolveSystemTimezone()).toBe("UTC");
  } finally {
    if (intlDescriptor) {
      Object.defineProperty(globalThis, "Intl", intlDescriptor);
    }
  }
});

test("applies an explicitly initialized timezone", async () => {
  try {
    await configure("de", "America/New_York");
    expect(AppDate.fromDateString("2024-10-10").timezone).toBe("America/New_York");
  } finally {
    await configure();
  }
});

test("successfully create invalid date", () => {
  const d = AppDate.invalid();
  expect(d.isValid()).toBe(false);
});

test("localizedDate String", async () => {
  await configure();
  const date = AppDate.fromDateString("2010-10-10");
  expect(date.toLocalizedDateString()).toBe("10.10.2010");
});

test("fromLocalTime", async () => {
  setSystemTime(new Date("2024-01-15T12:00:00Z"));

  try {
    await configure();
    expect(AppDate.fromLocalTime("11:12").isValid()).toBe(true);

    for (const time of ["25:00", "23:60", "-1:00", "14:30junk", "14:30:00"]) {
      expect(AppDate.fromLocalTime(time).isValid()).toBe(false);
    }
  } finally {
    setSystemTime();
    await configure();
  }
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

describe("exported helpers and extension hook", () => {
  test("validates strict date strings", () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));

    try {
      const cases = [
        ["2024-02-29", true],
        ["2024-02-30", false],
        ["2024-2-01", false],
        ["2024-02-01T00:00:00Z", false],
        ["", false],
        [undefined, false],
        [null, false],
      ] as const;

      for (const [value, expected] of cases) {
        expect(isDateString(value)).toBe(expected);
      }
    } finally {
      setSystemTime();
    }
  });

  test("formats dates and local times through the exported helpers", async () => {
    setSystemTime(new Date("2024-01-11T12:00:00Z"));

    try {
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });

      expect(getLocalizedDateString("2024-01-11")).toBe("11.01.2024");
      expect(getLocalizedDateString("2024-01-11", { includeDayOfWeek: true })).toBe(
        "Do, 11.01.2024"
      );
      expect(formatLocalTime("08:05")).toBe("08:05");
    } finally {
      setSystemTime();
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    }
  });

  test("binds extension methods to the AppDate instance", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));

    try {
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
      const date = AppDate.fromDateString("2024-01-15");

      extendAppDate({
        returnSelfForTest(this: AppDate) {
          expect(this).toBe(date);
          expect(this).toBeInstanceOf(AppDate);
          return this;
        },
      });

      expect(date.returnSelfForTest()).toBe(date);
    } finally {
      setSystemTime();
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    }
  });
});

test("invalid input stays silent", async () => {
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    await configure();
    expect(AppDate.fromDateString("not-a-date").isValid()).toBe(false);
    expect(AppDate.fromLocalTime("not-a-time").isValid()).toBe(false);
    expect(warnings).toEqual([]);
  } finally {
    await configure();
    console.warn = originalWarn;
  }
});

describe("format", () => {
  test("formats supported Day.js templates", async () => {
    await configure();
    const date = AppDate.fromDateString("2020-10-24");

    expect(date.format("[++] YYYY")).toBe("++ 2020");
    expect(date.format("dd, DD.MM.")).toBe("Sa, 24.10.");
    expect(date.format("LLLL")).toBe("Samstag, 24. Oktober 2020 00:00");
    expect(date.format("DD.MM.YY · HH:mm")).toBe("24.10.20 · 00:00");
    expect(date.format("MMM")).toBe("Okt.");
  });

  test("throws on foreign LDML weekday tokens", async () => {
    await configure();
    const date = AppDate.fromDateString("2020-10-24");

    for (const token of ["E", "EE", "EEE", "EEEE", "EEEEE"]) {
      expect(() => date.format(token)).toThrow(
        `Unsupported format token "${token}". AppDate uses Day.js tokens — use "dddd" for the day of week.`
      );
    }
    expect(() => date.format("EEEE, d MMMM")).toThrow(/"EEEE".*"dddd"/);
  });

  test("throws on foreign LDML year tokens", async () => {
    await configure();
    const date = AppDate.fromDateString("2020-10-24");

    for (const token of ["y", "yy", "yyy", "yyyy", "yyyyy"]) {
      expect(() => date.format(token)).toThrow(
        `Unsupported format token "${token}". AppDate uses Day.js tokens — use "YYYY" for the year.`
      );
    }
  });

  test("throws on the first foreign token", async () => {
    await configure();
    const date = AppDate.fromDateString("2020-10-24");

    expect(() => date.format("yy EEEE")).toThrow(/token "yy".*use "YYYY"/);
  });

  test("preserves escaped tokens and harmless literal letters", async () => {
    await configure();
    const date = AppDate.fromDateString("2020-10-24");

    expect(date.format("[EEEE] dddd")).toBe("EEEE Samstag");
    expect(date.format("[yyyy] YYYY")).toBe("yyyy 2020");
    expect(date.format("TQ")).toBe("TQ");
  });

  test("keeps the default template valid", async () => {
    await configure();
    const date = AppDate.fromDateString("2020-10-24");
    const expected = "2020-10-24T00:00:00+02:00Z";

    expect(date.format()).toBe(expected);
    expect(date.format("YYYY-MM-DDTHH:mm:ssZ[Z]")).toBe(expected);
  });
});

/**
 *
 *
 *
 *
 */

test("formatShort", async () => {
  await configure();
  expect(AppDate.fromDateString("2020-10-24").formatShort()).toBe("Sa, 24.10.");
});

test("formatDateTime", async () => {
  setSystemTime(new Date("1985-10-24T12:00:00Z"));

  try {
    await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
    const date = getFixedDate();

    expect(date.formatDateTime({ includeDayOfWeek: false })).toBe("24.10.1985, 00:00");
    expect(date.formatDateTime({ includeDayOfWeek: true })).toBe("Do, 24.10.1985, 00:00");
  } finally {
    setSystemTime();
    await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
  }
});

describe("timezone preservation", () => {
  test("add preserves the instance timezone and wall-clock time", async () => {
    await configure();
    try {
      const date = AppDate.fromDateString("2024-01-15");
      await configure("de", "America/New_York");

      const nextDay = date.add(1, "day");

      expect(nextDay.timezone).toBe("Europe/Zurich");
      expect(nextDay.toDateString()).toBe("2024-01-16");
      expect(nextDay.toLocalTime()).toBe("00:00");
    } finally {
      await configure();
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
  test("compares today in the configured timezone", async () => {
    setSystemTime(new Date("2024-01-01T02:00:00Z"));
    await configure("de", "America/New_York");

    try {
      expect(AppDate.fromDateString("2023-12-31").isToday()).toBe(true);
      expect(AppDate.fromDateString("2024-01-01").isToday()).toBe(false);
    } finally {
      setSystemTime();
      await configure();
    }
  });
});

describe("isFirstDayOfWeek", () => {
  test("honours the English Sunday week start", async () => {
    setSystemTime(new Date("2024-01-07T12:00:00Z"));
    await configure("en");

    try {
      expect(AppDate.fromDateString("2024-01-07").isFirstDayOfWeek()).toBe(true);
      expect(AppDate.fromDateString("2024-01-08").isFirstDayOfWeek()).toBe(false);
    } finally {
      setSystemTime();
      await configure("de");
    }
  });

  test("keeps Monday as the first day for German", async () => {
    setSystemTime(new Date("2024-01-08T12:00:00Z"));
    await configure("de");

    try {
      expect(AppDate.fromDateString("2024-01-07").isFirstDayOfWeek()).toBe(false);
      expect(AppDate.fromDateString("2024-01-08").isFirstDayOfWeek()).toBe(true);
    } finally {
      setSystemTime();
      await configure("de");
    }
  });
});

describe("working day and range logic", () => {
  test("identifies working days across a full week", async () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    await configure();

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
      await configure();
    }
  });

  test("finds the next working day across weekends", async () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    await configure();

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
      await configure();
    }
  });

  test("finds the previous working day across weekends", async () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    await configure();

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
      await configure();
    }
  });

  test("adds working days and preserves the guard behavior", async () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    await configure();

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
      await configure();
    }
  });

  test("matches step-wise working-day traversal", async () => {
    const workingWeekCases = [[1, 2, 3, 4, 5], [0, 1, 2, 3, 4], [3]];

    try {
      for (const workingDays of workingWeekCases) {
        await initializeAppDate({ language: "de", timeZone: "Europe/Zurich", workingDays });
        const start = AppDate.fromUtcString("2024-01-03T11:00:00Z");
        let stepWise = start;

        for (let days = 1; days <= 60; days += 1) {
          stepWise = stepWise.nextWorkingDay();
          // Working-day traversal is a calendar operation; its contract is the resulting day.
          expect(start.addWorkingDays(days).toDateString()).toBe(stepWise.toDateString());
        }
      }
    } finally {
      await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
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

  test("supports every isBetween inclusivity mode and default bounds", async () => {
    setSystemTime(new Date("2024-01-10T12:00:00Z"));
    await configure();

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
      await configure();
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
  test("mirrors Day.js units, signs, truncation, and floating results", async () => {
    await configure("de", "UTC");

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
      await configure();
    }
  });
});

describe("fromEpochSeconds", () => {
  test("creates date from unix timestamp", async () => {
    await configure();
    const date = AppDate.fromEpochSeconds(1704067200); // 2024-01-01 00:00:00 UTC
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe("2024-01-01");
  });

  test("handles zero timestamp (unix epoch)", async () => {
    await configure();
    const date = AppDate.fromEpochSeconds(0);
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe("1970-01-01");
  });
});

describe("fromUtcString", () => {
  test("creates date from UTC date string", async () => {
    await configure();
    const date = AppDate.fromUtcString("2024-06-15");
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe("2024-06-15");
  });

  test("creates date from a full ISO 8601 UTC datetime", async () => {
    setSystemTime(new Date("2026-01-13T12:00:00Z"));
    await configure();

    try {
      const date = AppDate.fromUtcString("2026-01-13T10:30:00Z");
      expect(date.isValid()).toBe(true);
      expect(date.toDateString()).toBe("2026-01-13");
      expect(date.toLocalTime()).toBe("11:30");
    } finally {
      setSystemTime();
      await configure();
    }
  });

  test("preserves valid ISO 8601 datetime offsets", async () => {
    await configure();

    const date = AppDate.fromUtcString("2026-01-13T10:30:00+05:45");

    expect(date.isValid()).toBe(true);
    expect(date.toUtcString()).toBe("2026-01-13T04:45:00+00:00");
  });

  test("rejects impossible dates instead of normalizing them", async () => {
    await configure();

    for (const date of ["2026-02-29", "2026-13-01", "2026-01-32", "2026-02-29T10:30:00Z"]) {
      expect(AppDate.fromUtcString(date).isValid()).toBe(false);
    }
  });

  test("creates current date when no argument passed", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));

    try {
      await configure();
      const date = AppDate.fromUtcString();
      expect(date.isValid()).toBe(true);
      expect(date.toDateString()).toBe("2024-01-15");
    } finally {
      setSystemTime();
      await configure();
    }
  });
});

describe("fromUtcTime", () => {
  test("creates date from UTC time string", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));
    try {
      await configure();
      const date = AppDate.fromUtcTime("14:30:00+00:00");
      expect(date.isValid()).toBe(true);
      expect(date.toLocalTime()).toBe("15:30"); // UTC+1 (Europe/Zurich winter)
    } finally {
      setSystemTime();
      await configure();
    }
  });

  test("handles midnight UTC", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));

    try {
      await configure();
      expect(AppDate.fromUtcTime("00:00:00+00:00").isValid()).toBe(true);
    } finally {
      setSystemTime();
      await configure();
    }
  });

  test("preserves valid numeric offsets", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));

    try {
      await configure();
      const date = AppDate.fromUtcTime("14:30:00+02:00");

      expect(date.isValid()).toBe(true);
      expect(date.toUtcTime()).toBe("12:30:00+00:00");
    } finally {
      setSystemTime();
      await configure();
    }
  });

  test("rejects impossible times and offsets instead of normalizing them", async () => {
    await configure();

    for (const time of ["25:00:00+00:00", "23:60:00+00:00", "14:30:00+99:99"]) {
      expect(AppDate.fromUtcTime(time).isValid()).toBe(false);
    }
  });
});

describe("fromEpochMillis", () => {
  test("creates date from milliseconds timestamp", async () => {
    await configure();
    const date = AppDate.fromEpochMillis(1704067200000); // 2024-01-01 00:00:00 UTC
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe("2024-01-01");
  });

  test("handles zero timestamp (unix epoch)", async () => {
    await configure();
    const date = AppDate.fromEpochMillis(0);
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe("1970-01-01");
  });

  test("roundtrips with toEpochMillis", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));

    try {
      await configure();
      const now = AppDate.now();
      const millis = now.toEpochMillis();
      const restored = AppDate.fromEpochMillis(millis);
      expect(restored.toDateString()).toBe("2024-01-15");
    } finally {
      setSystemTime();
      await configure();
    }
  });
});

describe("serbian locales", () => {
  test("sr (ekavian) formats days correctly", async () => {
    await configure("sr");
    const monday = AppDate.fromDateString("2024-01-08");
    expect(monday.format("dddd")).toBe("Ponedeljak");
    expect(monday.format("dd")).toBe("po");
  });

  test("sr-ije (ijekavian) formats days correctly", async () => {
    await configure("sr-ije");
    const monday = AppDate.fromDateString("2024-01-08");
    const wednesday = AppDate.fromDateString("2024-01-10");
    const sunday = AppDate.fromDateString("2024-01-07");

    expect(monday.format("dddd")).toBe("Ponedjeljak");
    expect(wednesday.format("dddd")).toBe("Srijeda");
    expect(sunday.format("dddd")).toBe("Nedjelja");
  });

  test("sr-ije localized date format", async () => {
    await configure("sr-ije");
    const date = AppDate.fromDateString("2024-01-11");
    expect(date.toLocalizedDateString()).toBe("11.01.2024");
    expect(date.toLocalizedDateString({ includeDayOfWeek: true })).toBe("če, 11.01.2024");
  });
});

describe("toRelative", () => {
  test("sr (ekavian) relative time in the past", async () => {
    await configure("sr");
    const twoDaysAgo = AppDate.now().subtract(2, "day");
    expect(twoDaysAgo.toRelative()).toBe("pre 2 dana");
  });

  test("sr (ekavian) relative time in the future", async () => {
    await configure("sr");
    const inTwoDays = AppDate.now().add(2, "day");
    expect(inTwoDays.toRelative()).toBe("za 2 dana");
  });

  test("sr-ije (ijekavian) relative time in the past", async () => {
    await configure("sr-ije");
    const twoDaysAgo = AppDate.now().subtract(2, "day");
    expect(twoDaysAgo.toRelative()).toBe("prije 2 dana");
  });

  test("sr-ije (ijekavian) relative time in the future", async () => {
    await configure("sr-ije");
    const inTwoDays = AppDate.now().add(2, "day");
    expect(inTwoDays.toRelative()).toBe("za 2 dana");
  });

  test("english relative time", async () => {
    await configure("en");
    const threeDaysAgo = AppDate.now().subtract(3, "day");
    expect(threeDaysAgo.toRelative()).toBe("3 days ago");
  });

  test("caps at specified days (past)", async () => {
    await configure("en");
    const fifteenDaysAgo = AppDate.now().subtract(15, "day");
    expect(fifteenDaysAgo.toRelative({ cap: 9 })).toBe("9+ days ago");
  });

  test("caps at specified days (future)", async () => {
    await configure("en");
    const inFifteenDays = AppDate.now().add(15, "day");
    expect(inFifteenDays.toRelative({ cap: 9 })).toBe("in 9+ days");
  });

  test("sr caps at specified days", async () => {
    await configure("sr");
    const fifteenDaysAgo = AppDate.now().subtract(15, "day");
    expect(fifteenDaysAgo.toRelative({ cap: 9 })).toBe("pre 9+ dana");
  });

  test("sr-ije caps at specified days", async () => {
    await configure("sr-ije");
    const fifteenDaysAgo = AppDate.now().subtract(15, "day");
    expect(fifteenDaysAgo.toRelative({ cap: 9 })).toBe("prije 9+ dana");
  });

  test("keeps large English caps in days for past and future dates", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));
    await configure("en");

    try {
      for (const cap of [7, 9, 30, 45]) {
        const past = AppDate.now().subtract(cap + 10, "day");
        const future = AppDate.now().add(cap + 10, "day");

        expect(past.toRelative({ cap })).toBe(`${cap}+ days ago`);
        expect(future.toRelative({ cap })).toBe(`in ${cap}+ days`);
      }
    } finally {
      setSystemTime();
      await configure("de");
    }
  });

  test("keeps large sr-ije caps in days for past and future dates", async () => {
    setSystemTime(new Date("2024-01-15T12:00:00Z"));
    await configure("sr-ije");

    try {
      for (const cap of [7, 9, 30, 45]) {
        const past = AppDate.now().subtract(cap + 10, "day");
        const future = AppDate.now().add(cap + 10, "day");

        expect(past.toRelative({ cap })).toBe(`prije ${cap}+ dana`);
        expect(future.toRelative({ cap })).toBe(`za ${cap}+ dana`);
      }
    } finally {
      setSystemTime();
      await configure("de");
    }
  });

  test("falls back to date after threshold", async () => {
    await configure("en");
    const twentyDaysAgo = AppDate.now().subtract(20, "day");
    const result = twentyDaysAgo.toRelative({
      cap: 9,
      fallbackAfterDays: 14,
    });
    // Should return localized date string (default fallback)
    expect(result).toBe(twentyDaysAgo.toLocalizedDateString());
  });

  test("uses custom fallback formatter", async () => {
    await configure("sr");
    const twentyDaysAgo = AppDate.now().subtract(20, "day");
    const result = twentyDaysAgo.toRelative({
      cap: 9,
      fallbackAfterDays: 14,
      fallback: (d) => d.format("DD.MM."),
    });
    expect(result).toBe(twentyDaysAgo.format("DD.MM."));
  });

  test("does not cap when under threshold", async () => {
    await configure("en");
    const fiveDaysAgo = AppDate.now().subtract(5, "day");
    expect(fiveDaysAgo.toRelative({ cap: 9 })).toBe("5 days ago");
  });
});
