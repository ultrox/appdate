import { describe, expect, test, vi } from "vitest";

function setSystemTime(now?: string | number | Date): void {
  if (now === undefined) {
    vi.useRealTimers();
    return;
  }

  vi.useFakeTimers();
  vi.setSystemTime(now);
}

export { describe, expect, setSystemTime, test };
