/**
 * If the given date string falls on a Sunday (day === 0),
 * return the next day (Monday). Otherwise return the same date.
 */
export function adjustForSunday(dateStr: string): string {
  if (!dateStr) return dateStr;
  // Parse as local date to avoid timezone shifts
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

export function isSunday(dateStr: string): boolean {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getDay() === 0;
}
