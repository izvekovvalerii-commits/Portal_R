export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function buildMonthDays(dateKey) {
  const ref = fromDateKey(dateKey);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(start.getDate() - startOffset);
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    days.push({
      date,
      dateKey: toDateKey(date),
      isCurrentMonth: date.getMonth() === month,
    });
  }
  return days;
}

export function slotToMinutes(slot) {
  const [h, m] = slot.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToLabel(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
