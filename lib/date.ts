// Date helpers that respect Bangkok time. `new Date().toISOString().split('T')[0]`
// returns the UTC date, which differs from the local date during 00:00–07:00
// Bangkok (UTC+7) and produces wrong-day attendance rows / wrong-day queries.

/**
 * Today's date in Asia/Bangkok timezone as YYYY-MM-DD.
 * `en-CA` formats as ISO-style YYYY-MM-DD, which matches our DB `date` columns.
 */
export function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
