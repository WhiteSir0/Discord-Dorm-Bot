const KST_OFFSET = 9 * 60 * 60 * 1000;

export function todayKst() {
  return new Date(Date.now() + KST_OFFSET).toISOString().slice(0, 10);
}

export function currentMonthKst() {
  return todayKst().slice(0, 7);
}

export function currentWeekStartKst() {
  const date = new Date(`${todayKst()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

export function isCurrentWeekKst(dateStr) {
  const start = currentWeekStartKst();
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return dateStr >= start && dateStr <= end.toISOString().slice(0, 10);
}

export function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

export function isValidDateString(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function normalizeDateInput(s) {
  return /^\d{2}-\d{2}$/.test(s) ? `${todayKst().slice(0, 4)}-${s}` : s;
}

export function nextDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
