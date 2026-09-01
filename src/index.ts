import type { Dayjs, ManipulateType, OpUnitType, QUnitType } from "dayjs";
import dayjs from "dayjs";
import "dayjs/locale/de.js";

// https://github.com/iamkun/dayjs/issues/1167
import customParseFormatPlugin from "dayjs/plugin/customParseFormat.js";
import isBetweenPlugin from "dayjs/plugin/isBetween.js";
import localizedFormat from "dayjs/plugin/localizedFormat.js";
import relativeTimePlugin from "dayjs/plugin/relativeTime.js";
import timezonePlugin from "dayjs/plugin/timezone.js";
import utcPlugin from "dayjs/plugin/utc.js";

import { resolveSystemTimezone } from "./system-timezone";

dayjs.extend(utcPlugin);
dayjs.extend(timezonePlugin);
dayjs.extend(customParseFormatPlugin);
dayjs.extend(isBetweenPlugin);
// https://day.js.org/docs/en/display/format#list-of-localized-formats
dayjs.extend(localizedFormat);
dayjs.extend(relativeTimePlugin);

export type AppDateLanguage = "de" | "en" | "fr" | "sr" | "sr-ije";

export type AppDateConfig = {
  language: AppDateLanguage;
  timeZone: string;
  /** 0 = Sunday through 6 = Saturday. Defaults to Monday through Friday. */
  workingDays?: number[];
};

const localeLoaders: Record<AppDateLanguage, () => Promise<void>> = {
  de: async () => {
    const de = await import("dayjs/locale/de-ch.js");
    dayjs.locale(de.default);
  },
  en: async () => {
    dayjs.locale("en");
  },
  fr: async () => {
    const fr = await import("dayjs/locale/fr-ch.js");
    dayjs.locale(fr.default);
  },
  sr: async () => {
    const sr = await import("dayjs/locale/sr.js");
    dayjs.locale(sr.default);
  },
  "sr-ije": async () => {
    const srIje = await import("./sr-ijekavian");
    dayjs.locale(srIje.default, undefined, true);
    dayjs.locale("sr-ije");
  },
};

async function loadLocale(lang: AppDateLanguage) {
  await (localeLoaders[lang] ?? localeLoaders.en)();
}

const DEFAULT_WORKING_DAYS: readonly number[] = [1, 2, 3, 4, 5];

let localTimezone: string | undefined;
let workingDays: readonly number[] = DEFAULT_WORKING_DAYS;

function currentTimezone(): string {
  return (localTimezone ??= resolveSystemTimezone());
}

function validateWorkingDays(value: unknown): readonly number[] {
  if (value === undefined) {
    return DEFAULT_WORKING_DAYS;
  }

  const isValid =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    new Set(value).size === value.length;

  if (!isValid) {
    throw new Error(`Invalid workingDays: ${String(value)}`);
  }

  return value;
}

export async function initializeAppDate(config: AppDateConfig): Promise<void> {
  try {
    dayjs().tz(config.timeZone);
  } catch {
    throw new Error(`Invalid timezone: ${config.timeZone}`);
  }

  const nextWorkingDays = validateWorkingDays(config.workingDays);

  await loadLocale(config.language);
  localTimezone = config.timeZone;
  workingDays = [...nextWorkingDays];
}

type DateString = `${string}-${string}-${string}`; // YYYY-MM-DD

const LOCAL_TIME_FORMAT = "HH:mm";
const UTC_TIME_FORMAT = "HH:mm:ssZ";
const FOREIGN_FORMAT_SEGMENT = /\[[^\]]*]|E+|y+/g;

function assertSupportedFormatTemplate(template: string): void {
  for (const [token] of template.matchAll(FOREIGN_FORMAT_SEGMENT)) {
    if (!token.startsWith("[")) {
      const isWeekdayToken = token.startsWith("E");
      const replacement = isWeekdayToken ? "dddd" : "YYYY";
      const meaning = isWeekdayToken ? "day of week" : "year";

      throw new Error(
        `Unsupported format token "${token}". AppDate uses Day.js tokens — use "${replacement}" for the ${meaning}. Wrap literal text in square brackets, e.g. "[${token}]".`
      );
    }
  }
}

function inTimezone(date: Dayjs | string, timezone: string): Dayjs {
  if (typeof globalThis.Intl === "undefined") {
    const parsedDate = typeof date === "string" ? dayjs.utc(date) : date;
    return parsedDate.tz(timezone, typeof date === "string");
  }

  return dayjs.tz(date, timezone);
}

/**
 * AppDate: A timezone-aware date and time abstraction.
 *
 * IMPORTANT: Always use this wrapped abstraction instead of moment or
 * new Date directly. You should not polute the application with randomly used
 * date methods.
 *
 * This class wraps the dayjs library to provide a consistent interface for
 * working with dates and times in a specific timezone. It offers methods for
 * date manipulation, comparison, and formatting, while maintaining timezone
 * context.
 *
 * Key features:
 * - Timezone awareness: All operations respect the specified timezone.
 * - Immutability:       Operations return new instances, preserving the original.
 * - Consistent API:     Provides a uniform interface for date operations.
 * - Error handling:     Gracefully handles invalid dates and parsing errors.
 *
 * Use AppDate to ensure consistent date handling across your application,
 * especially when dealing with different timezones or complex date logic.
 *
 * @example
 * const today = AppDate.now();
 * const futureDate = today.add(5, 'days');
 * console.log(futureDate.toLocalizedDateString());
 */
export class AppDate {
  readonly timezone: string;
  readonly dayjsDate: Dayjs;
  private static readonly INVALID_DATE = dayjs("");

  /**
   * constructor is private, so new LocalString("something")
   * outside class is not posible
   */
  private constructor(timezone: string, date: Dayjs | string, { invalid } = { invalid: false }) {
    this.timezone = timezone;
    if (invalid) {
      this.dayjsDate = AppDate.INVALID_DATE;
      return;
    }

    // try/catch due to bug in dayjs.tz that crashes the app:
    // https://github.com/iamkun/dayjs/issues/1637
    try {
      if (typeof date === "string" && !isDateString(date)) {
        throw new Error("Invalid Date string, we expect YYYY-DD-MM");
      }
      this.dayjsDate = inTimezone(date, timezone);
    } catch {
      this.dayjsDate = AppDate.INVALID_DATE;
    }
  }

  /**
   * Creates an invalid AppDate instance.
   * Usiful for: Error handeling, default values, avoids
   * null object pattern and plays nicely with validation
   */
  static invalid() {
    return new AppDate(currentTimezone(), "", { invalid: true });
  }

  static now() {
    return new AppDate(currentTimezone(), dayjs());
  }

  /**
   * Creates a AppDate instance from a date string.
   *
   * @param date - A string representing a date in "YYYY-MM-DD" format.
   * @returns A new AppDate instance set to the given date.
   *
   * If the date string is invalid or cannot be parsed, it returns an invalid AppDate instance.
   * The time part of the created AppDate will be set to midnight in the local timezone.
   *
   * @example
   * const date = AppDate.fromDateString("2023-05-21");
   */
  static fromDateString(date: string) {
    return new AppDate(currentTimezone(), date);
  }

  /**
   * Creates a AppDate instance from a epoch seconds.
   *
   * @param seconds - A number representing a epoch seconds.
   * @returns A new AppDate instance set to the given epoch seconds.
   *
   * @example
   * ```typescript
   * const date = AppDate.fromEpochSeconds(1714732800);
   * console.log(date.toLocalizedDateString()); // "03.05.2024"
   * ```
   */
  static fromEpochSeconds(seconds: number): AppDate {
    const date = dayjs.unix(seconds);
    return new AppDate(currentTimezone(), date);
  }

  /**
   * Creates a AppDate instance from a epoch milliseconds.
   *
   * @param ms - A number representing a epoch milliseconds.
   * @returns A new AppDate instance set to the given epoch milliseconds.
   *
   * @example
   * ```typescript
   * const date = AppDate.fromEpochMillis(1714732800000);
   * console.log(date.toLocalizedDateString()); // "03.05.2024"
   * ```
  }
  */
  static fromEpochMillis(ms: number): AppDate {
    const date = dayjs(ms);
    return new AppDate(currentTimezone(), date);
  }
  /**
   * Creates a AppDate instance from a local time string.
   *
   * @param time - A local time parsed by Day.js against the non-strict "HH:mm" template.
   * @returns A new AppDate instance set to the given time on the todays date.
   *
   * If the time string is invalid, it returns an invalid AppDate instance.
   * The date part defaults to the current date in the local timezone.
   *
   * @example
   * const date = AppDate.fromLocalTime("14:30"); Today's date, 14:30 or (02:30 PM)
   */
  static fromLocalTime(time: string) {
    const timezone = currentTimezone();

    try {
      const date = dayjs.tz(time, LOCAL_TIME_FORMAT, timezone);
      return new AppDate(timezone, date);
    } catch {
      return AppDate.invalid();
    }
  }

  /**
   * Creates an AppDate from a UTC date or datetime string.
   *
   * @param date - A "YYYY-MM-DD" date or full ISO 8601 datetime, parsed as UTC.
   * @returns A new AppDate instance set to the given UTC date or datetime.
   *
   * @example
   * const date = AppDate.fromUtcString("2026-01-04");
   * console.log(date.toLocalizedDateString()); // "04.01.2026"
   * ```
   */
  static fromUtcString(date?: string) {
    const utcdate = dayjs.utc(date);
    return new AppDate(currentTimezone(), utcdate);
  }

  /**
   * Creates a AppDate instance from a UTC time string.
   *
   * @param time - A string representing a UTC time in "HH:mm:ssZ" format.
   * @returns A new AppDate instance set to the given UTC time.
   *
   * @example
   * const time = AppDate.fromUtcTime("14:30:00+00:00");
   * console.log(time.toLocalizedDateString()); // "04.01.2026"
   * ```
   */
  static fromUtcTime(time: string) {
    const date = dayjs.utc(time, UTC_TIME_FORMAT);
    return new AppDate(currentTimezone(), date);
  }
  /**
   *
   * @returns A new AppDate instance set to the minimum supported date (1900-01-01).
   *
   * @example
   * const minDate = AppDate.minDate();
   * console.log(minDate.toLocalizedDateString()); // "01.01.1900"
   * ```
   */
  static minDate() {
    return AppDate.fromDateString("1900-01-01");
  }

  /**
   * Returns the maximum supported date (2200-12-31).
   *
   * @returns A new AppDate instance set to the maximum supported date.
   *
   * @example
   * const maxDate = AppDate.maxDate();
   * console.log(maxDate.toLocalizedDateString()); // "31.12.2200"
   * ```
   */
  static maxDate() {
    return AppDate.fromDateString("2200-12-31");
  }

  add(value: number, unit?: ManipulateType) {
    const date = this.dayjsDate.add(value, unit);
    return new AppDate(this.timezone, date);
  }

  subtract(value: number, unit?: ManipulateType) {
    const date = this.dayjsDate.subtract(value, unit);
    return new AppDate(this.timezone, date);
  }

  startOf(unit: OpUnitType) {
    const date = this.dayjsDate.startOf(unit);
    return new AppDate(this.timezone, date);
  }

  endOf(unit: OpUnitType) {
    const date = this.dayjsDate.endOf(unit);
    return new AppDate(this.timezone, date);
  }

  tomorrow() {
    return this.add(1, "day");
  }

  isValid() {
    return this.dayjsDate.isValid();
  }

  isBefore(other: AppDate, unit?: OpUnitType) {
    return this.dayjsDate.isBefore(other.dayjsDate, unit);
  }

  isSame(other: AppDate, unit?: OpUnitType) {
    return this.dayjsDate.isSame(other.dayjsDate, unit);
  }

  /**
   * returns true if date is current day
   */
  isToday() {
    const today = dayjs.tz(dayjs(), this.timezone);
    return this.dayjsDate.isSame(today, "day");
  }

  isAfter(other: AppDate, unit?: OpUnitType) {
    return this.dayjsDate.isAfter(other.dayjsDate, unit);
  }

  diff(other: AppDate, unit: QUnitType | OpUnitType = "millisecond", float = false) {
    return this.dayjsDate.diff(other.dayjsDate, unit, float);
  }

  isBetween(
    from: AppDate = AppDate.minDate(),
    to: AppDate = AppDate.maxDate(),
    unit?: OpUnitType,
    // '[' means inclusive, '(' exclusive
    // '()' excludes start and end date (default)
    // '[]' includes start and end date
    // '[)' includes the start date but excludes the stop
    inclusivity?: `${"(" | "["}${")" | "]"}`
  ) {
    return this.dayjsDate.isBetween(from.dayjsDate, to.dayjsDate, unit, inclusivity ?? "[)");
  }

  isFirstDayOfWeek() {
    return this.dayjsDate.isSame(this.dayjsDate.startOf("week"), "day");
  }

  isWorkingDay() {
    return workingDays.includes(this.dayjsDate.day());
  }

  nextWorkingDay(): AppDate {
    let date = this.dayjsDate.add(1, "day");

    for (let step = 0; step < 7; step += 1) {
      if (workingDays.includes(date.day())) {
        return new AppDate(this.timezone, date);
      }
      date = date.add(1, "day");
    }

    throw new Error("No working days configured");
  }

  previousWorkingDay(): AppDate {
    let date = this.subtract(1, "day");

    for (let step = 0; step < 7; step += 1) {
      if (date.isWorkingDay()) {
        return date;
      }
      date = date.subtract(1, "day");
    }

    throw new Error("No working days configured");
  }

  addWorkingDays(days: number): AppDate {
    if (days <= 0 || !Number.isInteger(days)) {
      return this;
    }

    let date = this.nextWorkingDay();
    const remaining = days - 1;
    const weeks = Math.floor(remaining / workingDays.length);

    if (weeks > 0) {
      date = date.add(weeks * 7, "day");
    }

    for (let remainder = remaining % workingDays.length; remainder > 0; remainder -= 1) {
      date = date.nextWorkingDay();
    }

    return date;
  }

  /*** Formatters ***/

  /**
   * Converts Date in following string format: HH:mm (20:10)
   */
  toLocalTime() {
    return this.format(LOCAL_TIME_FORMAT);
  }
  /**
   * Returns time in UTC format: HH:mm:ssZ
   */
  toUtcTime() {
    return this.dayjsDate.utc().format(UTC_TIME_FORMAT);
  }

  /**
   * Converts the current date to a string: YYYY-MM-DD
   *
   * @returns A string representing the current date in "YYYY-MM-DD" format.
   *
   * @example
   * const date = AppDate.now();
   * console.log(date.toDateString()); // "2026-01-04"
   * ```
   */
  toDateString(): DateString {
    return this.format("YYYY-MM-DD") as DateString;
  }
  /**
   * Locale friendly format: 
   * ```
   * de, ch = 20.10.1985
   * us     = 10/20/1985
   * {includeDayOfWeek: true}
   * de, ch = Son, 20.10.1985
   * us     = Sun, 10/20/1985

   * ```
   */
  toLocalizedDateString({ includeDayOfWeek = false }: LocalizedFormatOptions = {}) {
    const localized = this.dayjsDate.format("L");

    return includeDayOfWeek ? this.dayjsDate.format("dd, ") + localized : localized;
  }

  toUtcDateString(): DateString {
    return this.dayjsDate.utc().format("YYYY-MM-DD") as DateString;
  }

  toUtcString() {
    return this.dayjsDate.utc().format();
  }

  /**
   * Converts the current date to a epoch seconds (unix timestamp).
   *
   * @returns The epoch seconds.
   *
   * @example
   * const date = AppDate.now();
   * console.log(date.toEpochSeconds()); // 1714732800
   * ```
   */
  toEpochSeconds(): number {
    return this.dayjsDate.unix();
  }
  /**
   * Converts the current date to a epoch milliseconds (timestamp in milliseconds).
   *
   * @returns The epoch milliseconds.
   *
   * @example
   * const date = AppDate.now();
   * console.log(date.toEpochMillis()); // 1714732800000
   * ```
   */
  toEpochMillis(): number {
    return this.dayjsDate.valueOf();
  }
  /**
   * Get the formatted date according to the string of tokens passed in.
   *
   * To escape characters, wrap them in square brackets (e.g. [MM]).
   *
   * @see {@link https://day.js.org/docs/en/display/format|Day.js format documentation}
   *
   * The template uses Day.js format tokens, such as dddd for the day of the week.
   * @throws {Error} If the template contains an unescaped foreign E or y token.
   */
  format(template: FormatTemplate = "YYYY-MM-DDTHH:mm:ssZ[Z]") {
    assertSupportedFormatTemplate(template);
    return this.dayjsDate.format(template);
  }

  /**
   *
   * @param options - Optional settings for short formatting.
   * @returns The short formatted date string.
   *
   * @example
   * const date = AppDate.now();
   * console.log(date.formatShort({ includeDayOfWeek: true })); // "Su, 04.01."
   * console.log(date.formatShort({ includeDayOfWeek: false })); // "04.01."
   * ```
   */
  formatShort({ includeDayOfWeek = true }: LocalizedFormatOptions = {}) {
    return includeDayOfWeek ? this.format("dd, DD.MM.") : this.format("DD.MM.");
  }

  formatDateTime({ includeDayOfWeek = true }: LocalizedFormatOptions = {}) {
    const date = this.toLocalizedDateString({ includeDayOfWeek });
    const time = this.toLocalTime();
    return `${date}, ${time}`;
  }

  /**
   * Returns a localized string representing the relative time from now.
   * Automatically handles past and future dates.
   *
   * @param options - Optional settings for capping and fallback behavior
   * @param options.cap - Cap the relative time at this many days (e.g., 9 shows "9+ days ago")
   * @param options.fallbackAfterDays - After this many days, use the fallback formatter
   * @param options.fallback - Custom formatter function when fallbackAfterDays is exceeded
   *
   * @returns A localized string like "2 days ago" or "in 3 hours"
   *
   * @example
   * ```typescript
   * await initializeAppDate({ language: 'sr', timeZone: 'Europe/Zurich' });
   * AppDate.now().subtract(2, 'day').toRelative(); // "pre 2 dana"
   * AppDate.now().add(3, 'hour').toRelative();     // "za 3 sata"
   *
   * // With cap at 9 days
   * AppDate.now().subtract(15, 'day').toRelative({ cap: 9 }); // "pre 9+ dana"
   *
   * // With fallback to date after 14 days
   * AppDate.now().subtract(20, 'day').toRelative({
   *   cap: 9,
   *   fallbackAfterDays: 14,
   *   fallback: (d) => d.toLocalizedDateString()
   * }); // "20.12.2025"
   * ```
   */
  toRelative(options?: RelativeTimeOptions): string {
    const now = dayjs();
    const diffDays = Math.abs(this.dayjsDate.diff(now, "day"));

    // If fallback threshold is reached, use fallback formatter
    if (options?.fallbackAfterDays && diffDays >= options.fallbackAfterDays) {
      const fallbackFn = options.fallback ?? ((d: AppDate) => d.toLocalizedDateString());
      return fallbackFn(this);
    }

    // If cap threshold is reached, show capped version
    if (options?.cap && diffDays >= options.cap) {
      const isPast = this.dayjsDate.isBefore(now);
      const refDate = isPast ? now.subtract(options.cap, "day") : now.add(options.cap, "day");
      const refString = refDate.fromNow();

      const relativeTime = dayjs.Ls[dayjs.locale()]?.relativeTime;
      const dayTemplate = relativeTime?.dd;
      const wrapperTemplate = isPast ? relativeTime?.past : relativeTime?.future;

      if (typeof dayTemplate === "string" && typeof wrapperTemplate === "string") {
        const cappedDays = dayTemplate.replace("%d", `${options.cap}+`);
        return wrapperTemplate.replace("%s", cappedDays);
      }

      return refString.replace(String(options.cap), `${options.cap}+`);
    }

    return this.dayjsDate.fromNow();
  }
}

export interface RelativeTimeOptions {
  /** Cap the relative time at this many days. Shows "X+" format after this threshold. */
  cap?: number;
  /** After this many days, use the fallback formatter instead of relative time. */
  fallbackAfterDays?: number;
  /** Custom formatter function called when fallbackAfterDays is exceeded. Defaults to toLocalizedDateString(). */
  fallback?: (date: AppDate) => string;
}

export interface LocalizedFormatOptions {
  includeDayOfWeek?: boolean;
}

export function getLocalizedDateString(date: string, options?: LocalizedFormatOptions) {
  return AppDate.fromDateString(date).toLocalizedDateString(options);
}

export function formatLocalTime(time: string) {
  return AppDate.fromLocalTime(time).toLocalTime();
}

/**
 * returns true if given argument is in YYYY-MM-DD format
 * otherwise false
 */
export function isDateString(date: string | undefined | null | Dayjs): date is DateString {
  if (!date) {
    return false;
  }

  const parsedDate = dayjs(date, "YYYY-MM-DD", true);
  return parsedDate.isValid();
}

/**
 * Extend AppDate prototype with custom methods.
 * Use TypeScript module augmentation to add type definitions.
 *
 * @example
 * ```typescript
 * // In your app
 * import { AppDate, extendAppDate } from "@ma.vu/appdate";
 *
 * extendAppDate({
 *   formatLong(this: AppDate) {
 *     return this.format("dddd, DD. MMMM");
 *   },
 * });
 *
 * // Augment types
 * declare module "@ma.vu/appdate" {
 *   interface AppDate {
 *     formatLong(): string;
 *   }
 * }
 *
 * // Now you can use it
 * AppDate.now().formatLong(); // "ponedjeljak, 06. januar"
 * ```
 */
export function extendAppDate<T extends Record<string, unknown>>(methods: T): void {
  Object.assign(AppDate.prototype, methods);
}

type FormatTemplate =
  | "YY"
  | "YYYY"
  | "M"
  | "MM"
  | "MMM"
  | "MMMM"
  | "D"
  | "DD"
  | "d"
  | "dd"
  | "ddd"
  | "dddd"
  | "H"
  | "HH"
  | "h"
  | "hh"
  | "m"
  | "mm"
  | "s"
  | "ss"
  | "SSS"
  | "Z"
  | "ZZ"
  | "A"
  | "a"
  /*  List of localized formats*/
  | "LT"
  | "LTS"
  | /* en: 10/10/2020, de: 10.10.2020 */ "L"
  | "LL"
  | "LLL"
  | "LLLL"
  | "l"
  | "ll"
  | "lll"
  | "llll"
  | (string & {});
