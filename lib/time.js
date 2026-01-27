export const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatUtcToPktLocalString(utcDate) {
  if (!utcDate) return "";
  const date = new Date(utcDate);
  const pkt = new Date(date.getTime() + PKT_OFFSET_MS);
  const y = pkt.getUTCFullYear();
  const m = pad2(pkt.getUTCMonth() + 1);
  const d = pad2(pkt.getUTCDate());
  const h = pad2(pkt.getUTCHours());
  const min = pad2(pkt.getUTCMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function pktLocalStringToUtcDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value !== "string") return new Date(value);

  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(value);
  if (hasTimezone) {
    return new Date(value);
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
  );
  if (!match) return new Date(value);
  const [, y, m, d, h, min] = match.map(Number);
  const utcMillis = Date.UTC(y, m - 1, d, h, min) - PKT_OFFSET_MS;
  return new Date(utcMillis);
}

/**
 * Calculate next occurrence for recurring reminders from a base scheduled time (UTC).
 */
export function calculateNextOccurrence(reminder, baseTimeUtc) {
  const baseUTC = new Date(baseTimeUtc);
  const basePKTTimestamp = baseUTC.getTime() + PKT_OFFSET_MS;

  if (reminder.frequency === "daily") {
    let nextOccurrence = new Date(basePKTTimestamp);
    nextOccurrence.setDate(nextOccurrence.getDate() + 1);

    if (reminder.time) {
      const [hours, minutes] = reminder.time.split(":").map(Number);
      nextOccurrence.setHours(hours, minutes, 0, 0);
    }

    let dayOfWeek = nextOccurrence.getDay();
    if (dayOfWeek === 6) {
      nextOccurrence.setDate(nextOccurrence.getDate() + 2);
    } else if (dayOfWeek === 0) {
      nextOccurrence.setDate(nextOccurrence.getDate() + 1);
    }

    return new Date(nextOccurrence.getTime() - PKT_OFFSET_MS);
  }

  if (reminder.frequency === "weekly") {
    let nextOccurrence = new Date(basePKTTimestamp);
    nextOccurrence.setDate(nextOccurrence.getDate() + 7);

    if (reminder.time) {
      const [hours, minutes] = reminder.time.split(":").map(Number);
      nextOccurrence.setHours(hours, minutes, 0, 0);
    }

    return new Date(nextOccurrence.getTime() - PKT_OFFSET_MS);
  }

  return baseUTC;
}

/**
 * Calculate the first upcoming occurrence from "now" in PKT.
 */
export function calculateFirstOccurrence(reminder, nowUtc = new Date()) {
  const nowPKT = new Date(nowUtc.getTime() + PKT_OFFSET_MS);
  let nextOccurrence = new Date(nowPKT);

  if (reminder.time) {
    const [hours, minutes] = reminder.time.split(":").map(Number);
    nextOccurrence.setHours(hours, minutes, 0, 0);
  }

  if (reminder.frequency === "daily") {
    if (nextOccurrence <= nowPKT) {
      nextOccurrence.setDate(nextOccurrence.getDate() + 1);
    }

    let dayOfWeek = nextOccurrence.getDay();
    if (dayOfWeek === 6) {
      nextOccurrence.setDate(nextOccurrence.getDate() + 2);
    } else if (dayOfWeek === 0) {
      nextOccurrence.setDate(nextOccurrence.getDate() + 1);
    }
  } else if (reminder.frequency === "weekly") {
    const targetDay = Number(reminder.dayOfWeek);
    if (!Number.isNaN(targetDay)) {
      let dayDifference = targetDay - nextOccurrence.getDay();
      if (dayDifference < 0 || (dayDifference === 0 && nextOccurrence <= nowPKT)) {
        dayDifference += 7;
      }
      nextOccurrence.setDate(nextOccurrence.getDate() + dayDifference);
    } else {
      nextOccurrence.setDate(nextOccurrence.getDate() + 7);
    }
  }

  return new Date(nextOccurrence.getTime() - PKT_OFFSET_MS);
}
