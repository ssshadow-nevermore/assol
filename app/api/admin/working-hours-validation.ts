export class WorkingHoursValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkingHoursValidationError";
  }
}

function timeToMinutes(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Same-day schedule intervals must run forward; closed days have no interval. */
export function validateWorkingHoursInput(record: Record<string, unknown>): void {
  if (record.is_closed === 1 || record.is_closed === true) return;
  const opens = timeToMinutes(record.opens_at);
  const closes = timeToMinutes(record.closes_at);
  if (opens === null || closes === null) throw new WorkingHoursValidationError("Укажите корректное время открытия и закрытия");
  if (opens >= closes) throw new WorkingHoursValidationError("Время открытия должно быть раньше времени закрытия");
}
