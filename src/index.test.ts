import { expect, test, describe, beforeAll } from "bun:test";
// import { expect, describe, test } from 'vitest';
import { AppDate, setAppDateLanguage } from './index';

beforeAll(async () => {
  await setAppDateLanguage('de');
});

/**
 * @description this is just helper to test date
 */
const getFixedDate = () => AppDate.fromDateString('1985-10-24');

test('default time zone is Europe/Zurich', () => {
  const d = AppDate.fromDateString('2024-10-10');
  expect(d.timezone).toBe('Europe/Zurich');
});

test('successfully create invalid date', () => {
  const d = AppDate.invalid();
  expect(d.isValid()).toBe(false);
});

test('localizedDate String', () => {
  const d = AppDate.fromDateString('2010-10-10');
  expect(d.toLocalizedDateString()).toBe('10.10.2010');
});

test('fromLocalTime', () => {
  const d = AppDate.fromLocalTime('11:12');
  //expect(d.toLocalizedDateString()).toBe('22');
});

describe('fromDateString', () => {
  test('success on valid pattern', () => {
    const k = AppDate.fromDateString('2020-10-24');
    expect(k.isValid()).toBe(true);
  });

  test('handles empty by giving back invalid date', () => {
    const k = AppDate.fromDateString('');
    expect(k.isValid()).toBe(false);
  });

  test('Invalid date on out of bounds', () => {
    expect(AppDate.fromDateString('2020-88-24').isValid()).toBe(false);
    expect(AppDate.fromDateString('2020-88-44').isValid()).toBe(false);
    expect(AppDate.fromDateString('2020-88-500').isValid()).toBe(false);
  });
});

test('format', () => {
  expect(AppDate.fromDateString('2020-10-24').format('[++] YYYY')).toBe(
    '++ 2020'
  );
  expect(AppDate.fromDateString('2020-10-24').format('MMM')).toBe('Okt.');
});

/**
 *
 *
 *
 *
 */

test('formatShort', () => {
  // code
  const d = AppDate.fromDateString('2020-10-24').formatShort();
  expect(d).toBe('Sa, 24.10.');
});

test('formatDateTime', () => {
  const result = getFixedDate().toLocalizedDateString({
    includeDayOfWeek: false,
  });
  expect(result).toBe('24.10.1985');
});

describe('fromEpochSeconds', () => {
  test('creates date from unix timestamp', async () => {
    await setAppDateLanguage('de');
    const date = AppDate.fromEpochSeconds(1704067200); // 2024-01-01 00:00:00 UTC
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe('2024-01-01');
  });

  test('handles zero timestamp (unix epoch)', () => {
    const date = AppDate.fromEpochSeconds(0);
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe('1970-01-01');
  });
});

describe('fromUtcString', () => {
  test('creates date from UTC date string', () => {
    const date = AppDate.fromUtcString('2024-06-15');
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe('2024-06-15');
  });

  test('creates current date when no argument passed', () => {
    const date = AppDate.fromUtcString();
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe(AppDate.now().toDateString());
  });
});

describe('fromUtcTime', () => {
  test('creates date from UTC time string', () => {
    const date = AppDate.fromUtcTime('14:30:00+00:00');
    expect(date.isValid()).toBe(true);
    expect(date.toLocalTime()).toBe('15:30'); // UTC+1 (Europe/Zurich winter)
  });

  test('handles midnight UTC', () => {
    const date = AppDate.fromUtcTime('00:00:00+00:00');
    expect(date.isValid()).toBe(true);
  });
});

describe('fromEpochMillis', () => {
  test('creates date from milliseconds timestamp', () => {
    const date = AppDate.fromEpochMillis(1704067200000); // 2024-01-01 00:00:00 UTC
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe('2024-01-01');
  });

  test('handles zero timestamp (unix epoch)', () => {
    const date = AppDate.fromEpochMillis(0);
    expect(date.isValid()).toBe(true);
    expect(date.toDateString()).toBe('1970-01-01');
  });

  test('roundtrips with toEpochMillis', () => {
    const now = AppDate.now();
    const millis = now.toEpochMillis();
    const restored = AppDate.fromEpochMillis(millis);
    expect(restored.toDateString()).toBe(now.toDateString());
  });
});

describe('serbian locales', () => {
  test('sr (ekavian) formats days correctly', async () => {
    await setAppDateLanguage('sr');
    const monday = AppDate.fromDateString('2024-01-08');
    expect(monday.format('dddd')).toBe('Ponedeljak');
    expect(monday.format('dd')).toBe('po');
  });

  test('sr-ije (ijekavian) formats days correctly', async () => {
    await setAppDateLanguage('sr-ije');
    const monday = AppDate.fromDateString('2024-01-08');
    const wednesday = AppDate.fromDateString('2024-01-10');
    const sunday = AppDate.fromDateString('2024-01-07');

    expect(monday.format('dddd')).toBe('Ponedjeljak');
    expect(wednesday.format('dddd')).toBe('Srijeda');
    expect(sunday.format('dddd')).toBe('Nedjelja');
  });

  test('sr-ije localized date format', async () => {
    await setAppDateLanguage('sr-ije');
    const date = AppDate.fromDateString('2024-01-11');
    expect(date.toLocalizedDateString()).toBe('11.01.2024');
    expect(date.toLocalizedDateString({ includeDayOfWeek: true })).toBe('če, 11.01.2024');
  });
});
