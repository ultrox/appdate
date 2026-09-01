import dayjs from "dayjs";

export function resolveSystemTimezone(): string {
  return dayjs.tz.guess() || "UTC";
}
