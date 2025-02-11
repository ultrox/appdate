// date/index.ts
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
type DateString = `${string}-${string}-${string}`; // YYYY-MM-DD
interface LocalizedFormatOptions {
  includeDayOfWeek?: boolean;
}
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
 * Given language string, formatters, months, weeks
 * will be localized to provided language
 * de: 10.10.2010
 * en: 10/10/2010
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
 * Class to manage timezone configuration and validation
 */
class TimezoneManager {
  private static timezone = 'Europe/Zurich';

  static setTimezone(newTimezone: string) {
    if (!this.isValidTimezone(newTimezone)) {
      throw new Error(`Invalid timezone: ${newTimezone}`);
    }
    this.timezone = newTimezone;
  }

  static getTimezone(): string {
    return this.timezone;
  }

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
 * Class to handle date parsing and validation
 */
class DateParser {
  static fromDateString(date: string): Dayjs {
    if (!this.isValidDateString(date)) {
      return INVALID_DATE;
    }
    return dayjs.tz(date, TimezoneManager.getTimezone());
  }

  static fromLocalTime(time: string): Dayjs {
    try {
      return dayjs.tz(time, LOCAL_TIME_FORMAT, TimezoneManager.getTimezone());
    } catch {
      return INVALID_DATE;
    }
  }

  static fromUtcString(date?: string): Dayjs {
    return dayjs.utc(date);
  }

  static fromUtcTime(time: string): Dayjs {
    return dayjs.utc(time, UTC_TIME_FORMAT);
  }

  static isValidDateString(date: string | undefined | null | Dayjs): date is DateString {
    if (!date) return false;
    return dayjs(date, 'YYYY-MM-DD', true).isValid();
  }
}

/**
 * Class to handle all date formatting operations
 */
/**
 * Handles date formatting operations with proper invalid date handling
 */
class DateFormatter {
  constructor(private date: Dayjs) {}

  /**
   * Safely formats a date using the given format template
   * Returns 'Invalid Date' if the date is invalid
   */
  private safeFormat(template: string): string {
    if (!this.date.isValid()) {
      return 'Invalid Date';
    }
    return this.date.format(template);
  }

  toLocalTime(): string {
    return this.safeFormat(LOCAL_TIME_FORMAT);
  }

  toUtcTime(): string {
    if (!this.date.isValid()) {
      return 'Invalid Date';
    }
    return this.date.utc().format(UTC_TIME_FORMAT);
  }

  toDateString(): DateString {
    const formatted = this.safeFormat('YYYY-MM-DD');
    if (formatted === 'Invalid Date') {
      return 'Invalid Date' as DateString;
    }
    return formatted as DateString;
  }

  toLocalizedDateString(options: LocalizedFormatOptions = {}): string {
    const localized = this.date.format('L');
    return options.includeDayOfWeek
      ? this.date.format('dd, ') + localized
      : localized;
  }

  formatShort(options: LocalizedFormatOptions = { includeDayOfWeek: true }): string {
    const short = this.date.format('DD.MM.');
    return options.includeDayOfWeek ? this.date.format('dd, ') + short : short;
  }

  formatDateTime(options: LocalizedFormatOptions = { includeDayOfWeek: true }): string {
    const date = this.toLocalizedDateString(options);
    const time = this.toLocalTime();
    return `${date}, ${time}`;
  }

  format(template: FormatTemplate = 'YYYY-MM-DDTHH:mm:ssZ[Z]'): string {
    return this.date.format(template);
  }
}

/**
 * Class to handle working day calculations
 */
class WorkingDaysCalculator {
  constructor(private date: Dayjs) {}

  isWorkingDay(): boolean {
    return WORKING_DAYS.includes(this.date.day());
  }

  nextWorkingDay(): Dayjs {
    let nextDay = this.date.add(1, 'day');
    while (!new WorkingDaysCalculator(nextDay).isWorkingDay()) {
      nextDay = nextDay.add(1, 'day');
    }
    return nextDay;
  }

  previousWorkingDay(): Dayjs {
    let prevDay = this.date.subtract(1, 'day');
    while (!new WorkingDaysCalculator(prevDay).isWorkingDay()) {
      prevDay = prevDay.subtract(1, 'day');
    }
    return prevDay;
  }

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
 * - Timezone awareness: All operations respect the specified timezone
 * - Immutability: Operations return new instances
 * - Consistent API: Uniform interface for date operations
 * - Error handling: Gracefully handles invalid dates
 */
/**
 * AppDate: A timezone-aware date and time abstraction.
 * 
 * IMPORTANT: Always use this wrapped abstraction instead of moment or
 * new Date directly. You should not pollute the application with randomly used
 * date methods.
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
   * Useful for error handling, default values, and validation.
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
   * Creates an AppDate instance set to the current date and time.
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
   * @param date - Date string in YYYY-MM-DD format
   * @returns AppDate instance
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
   * @param time - Time string in 24-hour format (HH:mm)
   * @returns AppDate instance
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
   * @param date - Optional UTC date string
   * @returns AppDate instance
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
   * @param time - Time string in UTC format (HH:mm:ssZ)
   * @returns AppDate instance
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
   * Useful for range comparisons and validation.
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
   * Useful for range comparisons and validation.
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
   * Adds a specified amount of time to the date.
   * 
   * @param value - Number of units to add
   * @param unit - Unit of time (year, month, day, hour, minute, second)
   * @returns New AppDate instance
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
   * Subtracts a specified amount of time from the date.
   * 
   * @param value - Number of units to subtract
   * @param unit - Unit of time (year, month, day, hour, minute, second)
   * @returns New AppDate instance
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
   * Sets the date to the start of a specified unit of time.
   * 
   * @param unit - Unit of time (year, month, week, day, hour, minute)
   * @returns New AppDate instance
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
   * Sets the date to the end of a specified unit of time.
   * 
   * @param unit - Unit of time (year, month, week, day, hour, minute)
   * @returns New AppDate instance
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
   * Checks if the date is valid.
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
   * Checks if this date is before another date.
   * 
   * @param other - Date to compare against
   * @param unit - Optional unit for granularity (year, month, day, etc.)
   * 
   * @example
   * ```typescript
   * // Compare dates
   * const isPast = someDate.isBefore(AppDate.now());
   * 
   * // Compare just the dates, ignoring time
   * const isBeforeDate = someDate.isBefore(otherDate, 'day');
   * 
   * // Validate appointment
   * if (appoint

  // Formatting Methods
  toLocalTime(): string {
    return this.formatter.toLocalTime();
  }

  toUtcTime(): string {
    return this.formatter.toUtcTime();
  }

  toDateString(): DateString {
    return this.formatter.toDateString();
  }

  toLocalizedDateString(options?: LocalizedFormatOptions): string {
    return this.formatter.toLocalizedDateString(options);
  }

  formatShort(options?: LocalizedFormatOptions): string {
    return this.formatter.formatShort(options);
  }

  formatDateTime(options?: LocalizedFormatOptions): string {
    return this.formatter.formatDateTime(options);
  }

  format(template?: FormatTemplate): string {
    return this.formatter.format(template);
  }

  // Timezone access
  get timezone(): string {
    return TimezoneManager.getTimezone();
  }
}

/**
 * Helper Functions for One-Shot Formatting
 * 
 * These functions provide a convenient way to format dates and times without
 * creating and maintaining AppDate instances. They're useful for quick, one-off
 * formatting needs where you don't need the full capabilities of AppDate.
 * 
 * Note: If you need to perform multiple operations or chainable methods,
 * it's better to create an AppDate instance instead.
 */

/**
 * Sets the timezone for all AppDate operations
 * 
 * @param timezone - IANA timezone string (e.g., 'Europe/Zurich', 'America/New_York')
 * @throws {Error} If timezone is invalid
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
 * Quick format a date string to localized format without creating an AppDate instance
 * 
 * @param date - Date string in YYYY-MM-DD format
 * @param options - Formatting options
 * @returns Localized date string based on current locale
 * 
 * @example
 * ```typescript
 * // Basic usage
 * getLocalizedDateString('2024-02-11')  // "11.02.2024"
 * 
 * // With weekday
 * getLocalizedDateString('2024-02-11', { includeDayOfWeek: true })  // "Sun, 11.02.2024"
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
 * Quick format a time string without creating an AppDate instance
 * 
 * @param time - Time string in 24-hour format (HH:mm)
 * @returns Formatted time string
 * 
 * @example
 * ```typescript
 * formatLocalTime('14:30')  // "14:30"
 * formatLocalTime('9:05')   // "09:05"
 * ```
 */
export function formatLocalTime(time: string): string {
  return AppDate.fromLocalTime(time).toLocalTime();
}

/**
 * Usage Guide for One-Shot vs Instance Formatting
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
