/** Календарная дата для ?date= на backend (YYYY-MM-DD). */
export function isValidUtcYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** День, который пользователь выбрал в нативном календаре (локальная календарная дата). */
export function ymdFromPickerDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Полдень UTC для строки YYYY-MM-DD — стабильное значение для value у DateTimePicker. */
/** Сегодня по UTC в формате YYYY-MM-DD. */
export function ymdUtcToday(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${pad2(n.getUTCMonth() + 1)}-${pad2(n.getUTCDate())}`;
}

/** Сдвиг календарного дня UTC от строки YYYY-MM-DD (deltaDays может быть отрицательным). */
export function ymdUtcShift(ymd: string, deltaDays: number): string {
  if (!isValidUtcYmd(ymd)) return ymdUtcToday();
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function dateFromYmdString(s: string | null): Date {
  if (s && isValidUtcYmd(s)) {
    const [y, m, day] = s.split('-').map(Number);
    return new Date(y, m - 1, day, 12, 0, 0, 0);
  }
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0);
}
