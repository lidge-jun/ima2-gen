export type DateBucketKey = "earlier" | "today" | "yesterday" | "thisWeek" | string;

export function dateBucket(createdAt: number | undefined, locale = "en"): DateBucketKey {
  if (!createdAt) return "earlier";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "earlier";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "thisWeek";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}
