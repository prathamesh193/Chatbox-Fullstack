// src/utils/time.ts
export function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

export function isYesterday(date: Date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

// Format createdAt for list (Today -> time, Yesterday -> 'Yesterday', else date)
export function formatMessageTime(createdAt: string | Date) {
  if (!createdAt) return "";
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const now = new Date();

  if (isSameDay(d, now)) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (isYesterday(d)) return "Yesterday";

  // Show locale date for older messages - gives Day/Month or full depending on device locale
  return d.toLocaleDateString();
}
