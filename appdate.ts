import type { Dayjs, ManipulateType, OpUnitType } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
await setAppDateLanguage('de');

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

/**
 * Given language string, formaters, months, weeks
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

let localTimezone = 'Europe/Zurich';
/**
 * Change zone in runtime
 */
export function setTimezone(timezone: string) {
  localTimezone = timezone;
}

type DateString = `${string}-${string}-${string}`; // YYYY-MM-DD

const LOCAL_TIME_FORMAT = 'HH:mm';
const UTC_TIME_FORMAT = 'HH:mm:ssZ';

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
  private static readonly INVALID_DATE = dayjs('');

  /**
   * constructor is private, so new LocalString("something")
   * outside class is not posible
   */
  private constructor(
    timezone: string,
    date: Dayjs | string,
    { invalid } = { invalid: false }
  ) {
    this.timezone = timezone;
    if (invalid) {
      this.dayjsDate = AppDate.INVALID_DATE;
      return;
    }

    // try/catch due to bug in dayjs.tz that crashes the app:
    // https://github.com/iamkun/dayjs/issues/1637
    try {
      if (typeof date === 'string' && !isDateString(date)) {
        throw new Error('Invalid Date string, we expect YYYY-DD-MM');
      }
      this.dayjsDate = dayjs.tz(date, timezone);
    } catch (e) {
      console.warn('Could not parse date:', date);
      this.dayjsDate = AppDate.INVALID_DATE;
    }
  }

  /**
   * Creates an invalid AppDate instance.
   * Usiful for: Error handeling, default values, avoids
   * null object pattern and plays nicely with validation
   */
  static invalid() {
    return new AppDate(localTimezone, '', { invalid: true });
  }

  static now() {
    return new AppDate(localTimezone, dayjs());
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
    return new AppDate(localTimezone, date);
  }

  /**
   * Creates a AppDate instance from a local time string.
   *
   * @param time - A string representing a local time in any valid (24h) time format.
   * @returns A new AppDate instance set to the given time on the todays date.
   *
   * If the time string is invalid, it returns an invalid AppDate instance.
   * The date part defaults to the current date in the local timezone.
   *
   * @example
   * const date = AppDate.fromLocalTime("14:30"); Today's date, 14:30 or (02:30 PM)
   */
  static fromLocalTime(time: string) {
    try {
      const date = dayjs.tz(time, LOCAL_TIME_FORMAT, localTimezone);
      return new AppDate(localTimezone, date);
    } catch (err) {
      if (err instanceof Error) {
        console.warn(`fromLocalTime(): ${err.message}`);
      }
      return AppDate.invalid();
    }
  }

  static fromUtcString(date?: string) {
    const utcdate = dayjs.utc(date);
    return new AppDate(localTimezone, utcdate);
  }

  static fromUtcTime(time: string) {
    const date = dayjs.utc(time, UTC_TIME_FORMAT);
    return new AppDate(localTimezone, date);
  }

  static minDate() {
    return AppDate.fromDateString('1900-01-01');
  }

  static maxDate() {
    return AppDate.fromDateString('2200-12-31');
  }

  add(value: number, unit?: ManipulateType) {
    const date = this.dayjsDate.add(value, unit);
    return new AppDate(localTimezone, date);
  }

  subtract(value: number, unit?: ManipulateType) {
    const date = this.dayjsDate.subtract(value, unit);
    return new AppDate(localTimezone, date);
  }

  startOf(unit: OpUnitType) {
    const date = this.dayjsDate.startOf(unit);
    return new AppDate(localTimezone, date);
  }

  endOf(unit: OpUnitType) {
    const date = this.dayjsDate.endOf(unit);
    return new AppDate(localTimezone, date);
  }

  tomorrow() {
    return this.add(1, 'day');
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
    return this.dayjsDate.endOf('d').isSame(dayjs().endOf('d'));
  }

  isAfter(other: AppDate, unit?: OpUnitType) {
    return this.dayjsDate.isAfter(other.dayjsDate, unit);
  }

  isBetween(
    from: AppDate = AppDate.minDate(),
    to: AppDate = AppDate.maxDate(),
    unit?: OpUnitType,
    // '[' means inclusive, '(' exclusive
    // '()' excludes start and end date (default)
    // '[]' includes start and end date
    // '[)' includes the start date but excludes the stop
    inclusivity?: `${'(' | '['}${')' | ']'}`
  ) {
    return this.dayjsDate.isBetween(
      from.dayjsDate,
      to.dayjsDate,
      unit,
      inclusivity ?? '[)'
    );
  }

  isFirstDayOfWeek() {
    // sunday is day 0
    return this.dayjsDate.day() === 1;
  }

  isWorkingDay() {
    return workingDays.includes(this.dayjsDate.day());
  }

  nextWorkingDay(): AppDate {
    const tomorrow = this.add(1, 'day');
    return tomorrow.isWorkingDay() ? tomorrow : tomorrow.nextWorkingDay();
  }

  previousWorkingDay(): AppDate {
    const yesterday = this.subtract(1, 'day');
    return yesterday.isWorkingDay()
      ? yesterday
      : yesterday.previousWorkingDay();
  }

  addWorkingDays(days: number): AppDate {
    if (days <= 0 || !Number.isInteger(days)) {
      return this;
    }

    return this.nextWorkingDay().addWorkingDays(days - 1);
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
   */
  toDateString(): DateString {
    return this.format('YYYY-MM-DD') as DateString;
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
  toLocalizedDateString({
    includeDayOfWeek = false,
  }: LocalizedFormatOptions = {}) {
    const localized = this.dayjsDate.format('L');

    return includeDayOfWeek
      ? this.dayjsDate.format('dd, ') + localized
      : localized;
  }

  toUtcDateString(): DateString {
    return this.dayjsDate.utc().format('YYYY-MM-DD') as DateString;
  }

  toUtcString() {
    return this.dayjsDate.utc().format();
  }
  /**
   * Get the formatted date according to the string of tokens passed in.
   *
   * To escape characters, wrap them in square brackets (e.g. [MM]).
   *
   * @see {@link https://day.js.org/docs/en/display/format|Day.js format documentation}
   *
   */
  format(template: FormatTemplate = 'YYYY-MM-DDTHH:mm:ssZ[Z]') {
    return this.dayjsDate.format(template);
  }

  formatShort({ includeDayOfWeek = true }: LocalizedFormatOptions = {}) {
    const short = this.format('DD.MM.');
    return includeDayOfWeek ? this.format('dd, ') + short : short;
  }

  formatDateTime({ includeDayOfWeek = true }: LocalizedFormatOptions = {}) {
    const date = this.toLocalizedDateString({ includeDayOfWeek });
    const time = this.toLocalTime();
    return `${date}, ${time}`;
  }
}

export interface LocalizedFormatOptions {
  includeDayOfWeek?: boolean;
}

export interface GetNDaysOptions {
  startDate?: AppDate;
  excludeStartDate?: boolean;
}

// for more information see here: https://day.js.org/docs/en/get-set/day
// when we go international this needs to be configurable
const workingDays = [1, 2, 3, 4, 5];

export function getLocalizedDateString(
  date: string,
  options?: LocalizedFormatOptions
) {
  return AppDate.fromDateString(date).toLocalizedDateString(options);
}

export function formatLocalTime(time: string) {
  return AppDate.fromLocalTime(time).toLocalTime();
}

/**
 * returns true if given argument is in YYYY-MM-DD format
 * otherwise false
 */
export function isDateString(
  date: string | undefined | null | Dayjs
): date is DateString {
  if (!date) {
    return false;
  }

  const parsedDate = dayjs(date, 'YYYY-MM-DD', true);
  return parsedDate.isValid();
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
  /*  List of localized formats*/
  | 'LT'
  | 'LTS'
  | /* en: 10/10/2020, de: 10.10.2020 */ 'L'
  | 'LL'
  | 'LLL'
  | 'LLLL'
  | 'l'
  | 'll'
  | 'lll'
  | 'llll'
  | (string & {});
