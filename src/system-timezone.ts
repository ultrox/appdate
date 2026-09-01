import dayjs from "dayjs";

export function resolveSystemTimezone(): string {
  try {
    return dayjs.tz.guess() || "UTC";
  } catch {
    return "UTC";
  }
}
