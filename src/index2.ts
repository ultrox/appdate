/**
 * date/index.ts
 */
import type { Dayjs, ManipulateType, OpUnitType } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/de';

// https://github.com/iamkun/dayjs/issues/1167
import customParseFormatPlugin from 'dayjs/plugin/customParseFormat.js';
import isBetweenPlugin from 'dayjs/plugin/isBetween.js';
import localizedFormat from 'dayjs/plugin/localizedFormat.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import utcPlugin from 'dayjs/plugin/utc.js';

dayjs.extend(utcPlugin);
dayjs.extend(timezonePlugin);
dayjs.extend(customParseFormatPlugin);
dayjs.extend(isBetweenPlugin);
// https://day.js.org/docs/en/display/format#list-of-localized-formats
dayjs.extend(localizedFormat);

// Types

/**
 * Type alias for date strings in the format YYYY-MM-DD.
 */
type DateString = `${string}-${string}-${string}`; // YYYY-MM-DD

/**
 * Options for localized date formatting.
 */
interface LocalizedFormatOptions {
  includeDayOfWeek?: boolean;
}

/**
 * Format template type for date formatting.
 */
type FormatTemplate =
  | 'YY'
  | 'YYYY'
  | 'M'
  | 'MM'
  | 'MMM'
  | 'MMMM'
  | 'D'
  | 'DD'
  | 'd'
  | 'dd'
  | 'ddd'
  | 'dddd'
  | 'H'
  | 'HH'
  | 'h'
  | 'hh'
  | 'm'
  | 'mm'
  | 's'
  | 'ss'
  | 'SSS'
  | 'Z'
  | 'ZZ'
  | 'A'
  | 'a'
  | 'LT'
  | 'LTS'
  | 'L'
  | 'LL'
  | 'LLL'
  | 'LLLL'
  | 'l'
  | 'll'
  | 'lll'
  | 'llll'
  | (string & {});

// Constants
const LOCAL_TIME_FORMAT = 'HH:mm';
const UTC_TIME_FORMAT = 'HH:mm:ssZ';
const INVALID_DATE = dayjs('');
const WORKING_DAYS = [1, 2, 3, 4, 5];

/**
 * Returns a localized version of the "Invalid Date" string based on the current dayjs locale.
 *
 * Supported locales:
 * - German (de, de-ch, de-at): "Ungültiges Datum"
 * - French (fr, fr-ch): "Date invalide"
 * - English (default): "Invalid Date"
 *
 * @returns The localized invalid date string.
 */
function getLocalizedInvalidDate(): string {
  const locale = dayjs.locale();
  switch (locale) {
    case 'de':
    case 'de-ch':
    case 'de-at':
      return 'Ungültiges Datum';
    case 'fr':
    case 'fr-ch':
      return 'Date invalide';
    default:
      return 'Invalid Date';
  }
}

/**
 * Sets the application date language by dynamically importing and setting the locale.
 * 
 * Given a language string, the formatters, months, and weeks will be localized accordingly.
 * For example:
 * - de: 10.10.2010
 * - en: 10/10/2010
 *
 * @param lang - The language code ('de', 'en', or 'fr').
 */
export async function setAppDateLanguage(lang: 'de' | 'en' | 'fr') {
  switch (lang) {
    case 'de': {
      const de = await import('dayjs/locale/de-ch');
      dayjs.locale(de.default);
      break;
    }
    case 'fr': {
      const fr = await import('dayjs/locale/fr-ch');
      dayjs.locale(fr.default);
      break;
    }
    case 'en':
    default: {
      const en = await import('dayjs/locale/en');
      dayjs.locale(en.default);
      break;
    }
  }
}

/**
 * Class to manage timezone configuration and validation.
 */
class TimezoneManager {
  private static timezone = 'Europe/Zurich';

  /**
   * Sets the timezone to the provided value if it is valid.
   *
   * @param newTimezone - The IANA timezone string to set.
   * @throws {Error} If the provided timezone is invalid.
   */
  static setTimezone(newTimezone: string) {
    if (!this.isValidTimezone(newTimezone)) {
      throw new Error(`Invalid timezone: ${newTimezone}`);
    }
    this.timezone = newTimezone;
  }

  /**
   * Retrieves the currently set timezone.
   *
   * @returns The current IANA timezone string.
   */
  static getTimezone(): string {
    return this.timezone;
  }

  /**
   * Validates whether the given timezone string is a valid IANA timezone.
   *
   * @param timezone - The timezone string to validate.
   * @returns `true` if the timezone is valid; otherwise, `false`.
   */
  private static isValidTimezone(timezone: string): boolean {
    try {
      dayjs().tz(timezone);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Class to handle date parsing and validation.
 */
class DateParser {
  /**
   * Parses a date string in the format YYYY-MM-DD and returns a Dayjs object with the configured timezone.
   *
   * @param date - The date string to parse.
   * @returns A Dayjs object representing the parsed date, or an invalid date if parsing fails.
   */
  static fromDateString(date: string): Dayjs {
    if (!this.isValidDateString(date)) {
      return INVALID_DATE;
    }
    return dayjs.tz(date, TimezoneManager.getTimezone());
  }

  /**
   * Parses a local time string using the LOCAL_TIME_FORMAT and returns a Dayjs object set to the configured timezone.
   *
   * @param time - Time string in 24-hour format (HH:mm).
   * @returns A Dayjs object representing the parsed local time, or an invalid date if parsing fails.
   */
  static fromLocalTime(time: string): Dayjs {
    try {
      return dayjs.tz(time, LOCAL_TIME_FORMAT, TimezoneManager.getTimezone());
    } catch {
      return INVALID_DATE;
    }
  }

  /**
   * Parses an optional UTC date string and returns a Dayjs object in UTC.
   *
   * @param date - Optional UTC date string.
   * @returns A Dayjs object representing the parsed UTC date.
   */
  static fromUtcString(date?: string): Dayjs {
    return dayjs.utc(date);
  }

  /**
   * Parses a UTC time string using the UTC_TIME_FORMAT and returns a Dayjs object in UTC.
   *
   * @param time - Time string in UTC format (HH:mm:ssZ).
   * @returns A Dayjs object representing the parsed UTC time.
   */
  static fromUtcTime(time: string): Dayjs {
    return dayjs.utc(time, UTC_TIME_FORMAT);
  }

  /**
   * Checks if the provided date string (or Dayjs object) is a valid date in the YYYY-MM-DD format.
   *
   * @param date - The date value to validate.
   * @returns `true` if the date is valid and in the expected format, otherwise `false`.
   */
  static isValidDateString(date: string | undefined | null | Dayjs): date is DateString {
    if (!date) return false;
    return dayjs(date, 'YYYY-MM-DD', true).isValid();
  }
}

/**
 * Class to handle all date formatting operations.
 */
class DateFormatter {
  constructor(private date: Dayjs) {}

  /**
   * Safely formats the date using the provided template.
   * If the date is invalid, returns a localized "Invalid Date" string.
   *
   * @param template - The format template string.
   * @returns The formatted date string or the localized invalid date string.
   */
  private safeFormat(template: string): string {
    if (!this.date.isValid()) {
      return getLocalizedInvalidDate();
    }
    return this.date.format(template);
  }

  /**
   * Formats the date to a local time string using LOCAL_TIME_FORMAT.
   *
   * @returns The formatted local time string, or the localized invalid date string if the date is invalid.
   */
  toLocalTime(): string {
    return this.safeFormat(LOCAL_TIME_FORMAT);
  }

  /**
   * Formats the date to a UTC time string using UTC_TIME_FORMAT.
   *
   * @returns The formatted UTC time string, or the localized invalid date string if the date is invalid.
   */
  toUtcTime(): string {
    if (!this.date.isValid()) {
      return getLocalizedInvalidDate();
    }
    return this.date.utc().format(UTC_TIME_FORMAT);
  }

  /**
   * Formats the date to a string in the YYYY-MM-DD format.
   *
   * @returns The formatted date string as a DateString, or the localized invalid date string if the date is invalid.
   */
  toDateString(): DateString {
    if (!this.date.isValid()) {
      return getLocalizedInvalidDate() as DateString;
    }
    return this.date.format('YYYY-MM-DD') as DateString;
  }

  /**
   * Formats the date into a localized date string.
   *
   * @param options - Optional formatting options.
   * @returns The localized date string. If includeDayOfWeek is true, the day of the week is prefixed.
   */
  toLocalizedDateString(options: LocalizedFormatOptions = {}): string {
    const localized = this.date.format('L');
    return options.includeDayOfWeek
      ? this.date.format('dd, ') + localized
      : localized;
  }

  /**
   * Formats the date to a short date string (e.g., 'DD.MM.') with optional day of week.
   *
   * @param options - Optional formatting options.
   * @returns The formatted short date string.
   */
  formatShort(options: LocalizedFormatOptions = { includeDayOfWeek: true }): string {
    const short = this.date.format('DD.MM.');
    return options.includeDayOfWeek ? this.date.format('dd, ') + short : short;
  }

  /**
   * Combines localized date string and local time into a single formatted string.
   *
   * @param options - Optional formatting options for the date.
   * @returns A string combining the localized date and local time.
   */
  formatDateTime(options: LocalizedFormatOptions = { includeDayOfWeek: true }): string {
    const date = this.toLocalizedDateString(options);
    const time = this.toLocalTime();
    return `${date}, ${time}`;
  }

  /**
   * Formats the date using the provided format template.
   *
   * @param template - The format template to use.
   * @returns The formatted date string.
   */
  format(template: FormatTemplate = 'YYYY-MM-DDTHH:mm:ssZ[Z]'): string {
    return this.date.format(template);
  }
}

/**
 * Class to handle working day calculations.
 */
class WorkingDaysCalculator {
  constructor(private date: Dayjs) {}

  /**
   * Determines whether the current date is considered a working day.
   *
   * @returns `true` if the date is a working day, otherwise `false`.
   */
  isWorkingDay(): boolean {
    return WORKING_DAYS.includes(this.date.day());
  }

  /**
   * Calculates and returns the next working day.
   *
   * @returns A Dayjs object representing the next working day.
   */
  nextWorkingDay(): Dayjs {
    let nextDay = this.date.add(1, 'day');
    while (!new WorkingDaysCalculator(nextDay).isWorkingDay()) {
      nextDay = nextDay.add(1, 'day');
    }
    return nextDay;
  }

  /**
   * Calculates and returns the previous working day.
   *
   * @returns A Dayjs object representing the previous working day.
   */
  previousWorkingDay(): Dayjs {
    let prevDay = this.date.subtract(1, 'day');
    while (!new WorkingDaysCalculator(prevDay).isWorkingDay()) {
      prevDay = prevDay.subtract(1, 'day');
    }
    return prevDay;
  }

  /**
   * Adds a specified number of working days to the current date.
   *
   * @param days - The number of working days to add. Must be a positive integer.
   * @returns A Dayjs object representing the date after adding the working days.
   */
  addWorkingDays(days: number): Dayjs {
    if (days <= 0 || !Number.isInteger(days)) {
      return this.date;
    }
    return new WorkingDaysCalculator(this.nextWorkingDay()).addWorkingDays(days - 1);
  }
}

/**
 * AppDate: A timezone-aware date and time abstraction.
 *
 * IMPORTANT: Always use this wrapped abstraction instead of moment or
 * new Date directly. You should not pollute the application with randomly used
 * date methods.
 *
 * Key features:
 * - Timezone awareness: All operations respect the specified timezone.
 * - Immutability: Operations return new instances.
 * - Consistent API: Uniform interface for date operations.
 * - Error handling: Gracefully handles invalid dates by returning a localized error string.
 *
 * @example Basic Usage
 * ```typescript
 * // Creating dates
 * const today = AppDate.now();
 * const specificDate = AppDate.fromDateString('2024-02-11');
 * 
 * // Chaining operations
 * const nextWeek = AppDate.now()
 *   .add(7, 'days')
 *   .startOf('day')
 *   .toLocalizedDateString();
 * 
 * // Working with business days
 * const nextWorkingDay = AppDate.now()
 *   .nextWorkingDay()
 *   .toLocalizedDateString();
 * ```
 */
export class AppDate {
  private formatter: DateFormatter;
  private workingDaysCalc: WorkingDaysCalculator;

  private constructor(private readonly dayjsDate: Dayjs) {
    this.formatter = new DateFormatter(dayjsDate);
    this.workingDaysCalc = new WorkingDaysCalculator(dayjsDate);
  }

  /**
   * Creates an invalid AppDate instance.
   *
   * @returns An AppDate instance representing an invalid date.
   *
   * @example
   * ```typescript
   * // Error handling
   * const date = someCondition 
   *   ? AppDate.fromDateString(validDate)
   *   : AppDate.invalid();
   * 
   * if (!date.isValid()) {
   *   handleError();
   * }
   * ```
   */
  static invalid(): AppDate {
    return new AppDate(INVALID_DATE);
  }

  /**
   * Creates an AppDate instance representing the current date and time.
   *
   * @returns An AppDate instance set to the current date and time.
   *
   * @example
   * ```typescript
   * // Get current date
   * const now = AppDate.now();
   * 
   * // Check if another date is after now
   * const isFuture = someDate.isAfter(AppDate.now());
   * 
   * // Format current date
   * const formatted = AppDate.now().toLocalizedDateString();
   * ```
   */
  static now(): AppDate {
    return new AppDate(dayjs());
  }

  /**
   * Creates an AppDate instance from a date string.
   *
   * @param date - A date string in YYYY-MM-DD format.
   * @returns An AppDate instance representing the parsed date.
   *
   * @example
   * ```typescript
   * // Create from string
   * const date = AppDate.fromDateString('2024-02-11');
   * 
   * // Validate date
   * if (!date.isValid()) {
   *   throw new Error('Invalid date');
   * }
   * 
   * // Chain operations
   * const nextDay = AppDate.fromDateString('2024-02-11')
   *   .add(1, 'day')
   *   .toLocalizedDateString();
   * ```
   */
  static fromDateString(date: string): AppDate {
    return new AppDate(DateParser.fromDateString(date));
  }

  /**
   * Creates an AppDate instance from a local time string.
   * The date part will be set to today.
   *
   * @param time - A time string in 24-hour format (HH:mm).
   * @returns An AppDate instance representing the parsed time.
   *
   * @example
   * ```typescript
   * // Create from time
   * const time = AppDate.fromLocalTime('14:30');
   * console.log(time.toLocalTime()); // "14:30"
   * 
   * // Chain with date operations
   * const laterToday = AppDate.fromLocalTime('14:30')
   *   .add(2, 'hours')
   *   .toLocalTime(); // "16:30"
   * ```
   */
  static fromLocalTime(time: string): AppDate {
    return new AppDate(DateParser.fromLocalTime(time));
  }

  /**
   * Creates an AppDate instance from a UTC date string.
   *
   * @param date - Optional UTC date string.
   * @returns An AppDate instance representing the parsed UTC date.
   *
   * @example
   * ```typescript
   * // Create from UTC string
   * const date = AppDate.fromUtcString('2024-02-11T12:00:00Z');
   * 
   * // Convert to local time
   * console.log(date.toLocalTime());
   * ```
   */
  static fromUtcString(date?: string): AppDate {
    return new AppDate(DateParser.fromUtcString(date));
  }

  /**
   * Creates an AppDate instance from a UTC time string.
   *
   * @param time - A time string in UTC format (HH:mm:ssZ).
   * @returns An AppDate instance representing the parsed UTC time.
   *
   * @example
   * ```typescript
   * // Create from UTC time
   * const time = AppDate.fromUtcTime('14:30:00+00:00');
   * 
   * // Get local representation
   * console.log(time.toLocalTime());
   * ```
   */
  static fromUtcTime(time: string): AppDate {
    return new AppDate(DateParser.fromUtcTime(time));
  }

  /**
   * Returns an AppDate instance set to the minimum supported date (1900-01-01).
   *
   * @returns An AppDate instance representing the minimum supported date.
   *
   * @example
   * ```typescript
   * // Check if date is within supported range
   * const isValid = date.isBetween(
   *   AppDate.minDate(),
   *   AppDate.maxDate()
   * );
   * ```
   */
  static minDate(): AppDate {
    return AppDate.fromDateString('1900-01-01');
  }

  /**
   * Returns an AppDate instance set to the maximum supported date (2200-12-31).
   *
   * @returns An AppDate instance representing the maximum supported date.
   *
   * @example
   * ```typescript
   * // Set a far future expiry date
   * const expiry = someDate.isValid() 
   *   ? someDate 
   *   : AppDate.maxDate();
   * ```
   */
  static maxDate(): AppDate {
    return AppDate.fromDateString('2200-12-31');
  }

  /**
   * Adds a specified amount of time to the current date.
   *
   * @param value - The amount of time units to add.
   * @param unit - The unit of time (e.g., 'day', 'month', 'year').
   * @returns A new AppDate instance with the added time.
   *
   * @example
   * ```typescript
   * // Add days
   * const tomorrow = AppDate.now().add(1, 'day');
   * 
   * // Add multiple units
   * const future = AppDate.now()
   *   .add(1, 'month')
   *   .add(2, 'days')
   *   .add(3, 'hours');
   * ```
   */
  add(value: number, unit?: ManipulateType): AppDate {
    return new AppDate(this.dayjsDate.add(value, unit));
  }

  /**
   * Subtracts a specified amount of time from the current date.
   *
   * @param value - The amount of time units to subtract.
   * @param unit - The unit of time (e.g., 'day', 'month', 'year').
   * @returns A new AppDate instance with the subtracted time.
   *
   * @example
   * ```typescript
   * // Subtract days
   * const yesterday = AppDate.now().subtract(1, 'day');
   * 
   * // Calculate age
   * const birthDate = AppDate.fromDateString('1990-01-01');
   * const age = AppDate.now().subtract(birthDate.dayjsDate.year(), 'year');
   * ```
   */
  subtract(value: number, unit?: ManipulateType): AppDate {
    return new AppDate(this.dayjsDate.subtract(value, unit));
  }

  /**
   * Sets the date to the start of the specified unit of time.
   *
   * @param unit - The unit of time (e.g., 'day', 'month', 'year').
   * @returns A new AppDate instance representing the start of the specified time unit.
   *
   * @example
   * ```typescript
   * // Start of day (midnight)
   * const midnight = AppDate.now().startOf('day');
   * 
   * // Start of month
   * const monthStart = AppDate.now().startOf('month');
   * 
   * // Start of business week
   * const weekStart = AppDate.now()
   *   .startOf('week')
   *   .nextWorkingDay();
   * ```
   */
  startOf(unit: OpUnitType): AppDate {
    return new AppDate(this.dayjsDate.startOf(unit));
  }

  /**
   * Sets the date to the end of the specified unit of time.
   *
   * @param unit - The unit of time (e.g., 'day', 'month', 'year').
   * @returns A new AppDate instance representing the end of the specified time unit.
   *
   * @example
   * ```typescript
   * // End of day (23:59:59)
   * const endOfDay = AppDate.now().endOf('day');
   * 
   * // End of month
   * const monthEnd = AppDate.now().endOf('month');
   * 
   * // End of business week
   * const weekEnd = AppDate.now()
   *   .endOf('week')
   *   .previousWorkingDay();
   * ```
   */
  endOf(unit: OpUnitType): AppDate {
    return new AppDate(this.dayjsDate.endOf(unit));
  }

  /**
   * Checks whether the current AppDate instance represents a valid date.
   *
   * @returns `true` if the date is valid, otherwise `false`.
   *
   * @example
   * ```typescript
   * // Validate user input
   * const userDate = AppDate.fromDateString(userInput);
   * if (!userDate.isValid()) {
   *   throw new Error('Invalid date');
   * }
   * 
   * // Provide default for invalid date
   * const date = userDate.isValid() 
   *   ? userDate 
   *   : AppDate.now();
   * ```
   */
  isValid(): boolean {
    return this.dayjsDate.isValid();
  }

  /**
   * Checks if the current date is before another AppDate instance.
   *
   * @param other - The AppDate instance to compare against.
   * @param unit - Optional unit of time for granularity (e.g., 'day', 'month').
   * @returns `true` if the current date is before the other date, otherwise `false`.
   *
   * @example
   * ```typescript
   * const isBeforeDate = someDate.isBefore(otherDate, 'day');
   * ```
   */
  isBefore(other: AppDate, unit?: OpUnitType): boolean {
    return this.dayjsDate.isBefore(other.dayjsDate, unit);
  }

  // Formatting Methods

  /**
   * Formats the date as a local time string.
   *
   * @returns The local time formatted string.
   */
  toLocalTime(): string {
    return this.formatter.toLocalTime();
  }

  /**
   * Formats the date as a UTC time string.
   *
   * @returns The UTC time formatted string.
   */
  toUtcTime(): string {
    return this.formatter.toUtcTime();
  }

  /**
   * Formats the date as a string in YYYY-MM-DD format.
   *
   * @returns The formatted date string.
   */
  toDateString(): DateString {
    return this.formatter.toDateString();
  }

  /**
   * Formats the date as a localized date string.
   *
   * @param options - Optional settings for localized formatting.
   * @returns The localized date string.
   */
  toLocalizedDateString(options?: LocalizedFormatOptions): string {
    return this.formatter.toLocalizedDateString(options);
  }

  /**
   * Formats the date as a short date string.
   *
   * @param options - Optional settings for short formatting.
   * @returns The short formatted date string.
   */
  formatShort(options?: LocalizedFormatOptions): string {
    return this.formatter.formatShort(options);
  }

  /**
   * Formats the date as a combined localized date and local time string.
   *
   * @param options - Optional settings for localized formatting.
   * @returns The combined date and time formatted string.
   */
  formatDateTime(options?: LocalizedFormatOptions): string {
    return this.formatter.formatDateTime(options);
  }

  /**
   * Formats the date using the specified format template.
   *
   * @param template - The format template string.
   * @returns The formatted date string.
   */
  format(template?: FormatTemplate): string {
    return this.formatter.format(template);
  }

  /**
   * Retrieves the current timezone used by this AppDate instance.
   *
   * @returns The IANA timezone string.
   */
  get timezone(): string {
    return TimezoneManager.getTimezone();
  }
}

/**
 * Sets the timezone for all AppDate operations.
 *
 * @param timezone - The IANA timezone string to set (e.g., 'Europe/Zurich').
 * @throws {Error} If the provided timezone is invalid.
 *
 * @example
 * ```typescript
 * // Change timezone to New York
 * setTimezone('America/New_York');
 * 
 * // Will throw error
 * setTimezone('Invalid/Timezone');
 * ```
 */
export function setTimezone(timezone: string): void {
  TimezoneManager.setTimezone(timezone);
}

/**
 * Formats a date string into a localized date string without creating an AppDate instance.
 *
 * @param date - A date string in YYYY-MM-DD format.
 * @param options - Optional formatting options.
 * @returns The localized date string based on the current locale.
 *
 * @example
 * ```typescript
 * // Basic usage
 * getLocalizedDateString('2024-02-11');  // e.g., "11.02.2024"
 * 
 * // With weekday
 * getLocalizedDateString('2024-02-11', { includeDayOfWeek: true });  // e.g., "Sun, 11.02.2024"
 * 
 * // Different locales (after setAppDateLanguage)
 * // German: "11.02.2024"
 * // English: "02/11/2024"
 * ```
 */
export function getLocalizedDateString(
  date: string,
  options?: LocalizedFormatOptions
): string {
  return AppDate.fromDateString(date).toLocalizedDateString(options);
}

/**
 * Formats a local time string without creating an AppDate instance.
 *
 * @param time - A time string in 24-hour format (HH:mm).
 * @returns The formatted local time string.
 *
 * @example
 * ```typescript
 * formatLocalTime('14:30');  // "14:30"
 * formatLocalTime('9:05');   // "09:05"
 * ```
 */
export function formatLocalTime(time: string): string {
  return AppDate.fromLocalTime(time).toLocalTime();
}

/**
 * Usage Guide for One-Shot vs Instance Formatting:
 *
 * One-Shot Formatting (Helper Functions):
 * ```typescript
 * // Quick, one-off formatting
 * const localDate = getLocalizedDateString('2024-02-11');
 * const localTime = formatLocalTime('14:30');
 * ```
 *
 * Instance Formatting (AppDate Methods):
 * ```typescript
 * // When you need multiple operations
 * const date = AppDate.fromDateString('2024-02-11')
 *   .add(1, 'day')
 *   .startOf('day')
 *   .toLocalizedDateString();
 * 
 * // When you need to reuse the date
 * const appointmentDate = AppDate.fromDateString('2024-02-11');
 * const formatted = appointmentDate.toLocalizedDateString();
 * const nextWorking = appointmentDate.nextWorkingDay().toLocalizedDateString();
 * ```
 */
