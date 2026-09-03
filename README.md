# appdate

[![npm version](https://img.shields.io/npm/v/%40ma.vu%2Fappdate?logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/@ma.vu/appdate)
[![API documentation](https://img.shields.io/badge/docs-TypeDoc-3178c6?logo=typescript&logoColor=white)](https://ultrox.github.io/appdate/)

A timezone-aware date and time abstraction built on Day.js.

## Installation

```bash
npm install @ma.vu/appdate
```

## Development

```bash
bun install
bun run demo.ts
```

## Initialize and compare dates

Use `initializeAppDate` as the entry point for language, timezone, and working-day configuration. `workingDays` uses `0` for Sunday through `6` for Saturday and defaults to Monday through Friday.

```ts
import { AppDate, initializeAppDate } from "@ma.vu/appdate";

await initializeAppDate({
  language: "en",
  timeZone: "Europe/Zurich",
  workingDays: [0, 1, 2, 3, 4], // Sunday through Thursday
});

const start = AppDate.fromUtcString("2026-01-13T10:30:00Z");
const end = AppDate.fromUtcString("2026-01-15T09:30:00Z");

end.diff(start, "day"); // 1 (truncated)
end.diff(start, "day", true); // 1.9583...
```

## Formatting

AppDate uses [Day.js format tokens](https://day.js.org/docs/en/display/format); foreign tokens such as `EEEE` and `yyyy` throw, and literal text must be wrapped in square brackets, such as `[EEEE]`.

Calling `format()` without a template returns an ISO-compatible timestamp with second precision, such as `2026-07-15T17:00:00+02:00`.

## Migrating from 0.x

`setTimezone` and `setAppDateLanguage` were removed in favor of `initializeAppDate`. Before initialization, AppDate now uses the system timezone instead of `Europe/Zurich`, falling back to `UTC` when the runtime cannot report a system zone.

## How?

The pattern follows the Builder/Factory pattern where:

Static methods are the "builders" that create new instances

```ts
// These create NEW instances of AppDate
static now(): AppDate
static fromDateString(date: string): AppDate
static fromLocalTime(time: string): AppDate
static invalid(): AppDate
```

Instance methods are the "operators" that work with existing instances

```ts
// These operate on an EXISTING AppDate instance
add(value: number, unit?: ManipulateType): AppDate
subtract(value: number, unit?: ManipulateType): AppDate
isValid(): boolean
toLocalTime(): string
```

## Why Constructor is private?

The constructor is marked as private for several important reasons:

It ensures all date creation goes through the static factory methods where proper validation happens
It prevents creating AppDate with invalid/unexpected formats
It maintains a single way to create dates, making the code more predictable
It encapsulates the internal dayjs implementation

If we allowed direct construction:

```ts
// If constructor was public:
const date1 = new AppDate("2024-02-11"); // Is this YYYY-MM-DD?
const date2 = new AppDate("02/11/2024"); // What about this format?
const date3 = new AppDate("11.02.2024"); // Or this European format?
```

Instead, with factory methods:

```ts
// Clear intention, validated format
const date = AppDate.fromDateString("2024-02-11"); // Must be YYYY-MM-DD
```
