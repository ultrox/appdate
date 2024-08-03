import { expect, test, describe } from "bun:test";
// import { expect, describe, test } from 'vitest';
import { AppDate } from './index';

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
