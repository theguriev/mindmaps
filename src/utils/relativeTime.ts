/** Minimal "x ago" formatter (replaces moment.fromNow for the maps list). */
export function fromNow (iso?: string): string {
  if (!iso) return 'just now'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'just now'
  const seconds = Math.max(0, (Date.now() - then) / 1000)
  const units: Array<[number, string]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year']
  ]
  let value = seconds
  let unit = 'second'
  for (const [factor, name] of units) {
    if (value < factor) {
      unit = name
      break
    }
    value = value / factor
    unit = name
  }
  const rounded = Math.floor(value)
  if (unit === 'second' && rounded < 45) return 'a few seconds ago'
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'} ago`
}
