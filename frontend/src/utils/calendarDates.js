export function formatLocalDate(date) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatCalendarDate(date, options) {
  // ISO date-only strings are parsed at midnight UTC. Display them in UTC too.
  return new Date(date).toLocaleDateString("pl-PL", { ...options, timeZone: "UTC" });
}
