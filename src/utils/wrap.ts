/**
 * Toggle-wrapping of a text selection with a delimiter (e.g. ** for bold).
 * Ported verbatim from `utils/wrap.js`.
 */
export function isInner (
  str: string,
  start: number,
  end: number,
  wherewith: string
): boolean {
  const innerBefore = str.substr(start, wherewith.length)
  const innerAfter = str.substr(end - wherewith.length, wherewith.length)
  return innerBefore === wherewith && innerAfter === wherewith
}

export function isOuter (
  str: string,
  start: number,
  end: number,
  wherewith: string
): boolean {
  return isInner(str, start - wherewith.length, end + wherewith.length, wherewith)
}

function remove (
  str: string,
  start: number,
  end: number,
  wherewith: string
): string {
  return (
    str.slice(0, start - wherewith.length) +
    str.slice(start, end) +
    str.slice(end + wherewith.length, str.length)
  )
}

function add (
  str: string,
  start: number,
  end: number,
  wherewith: string
): string {
  return (
    str.slice(0, start) +
    `${wherewith}${str.substr(start, end - start)}${wherewith}` +
    str.slice(end, str.length)
  )
}

export interface WrapResult {
  str: string
  start: number
  end: number
}

export function wrap (
  str: string,
  start: number,
  end: number,
  wherewith = '**'
): WrapResult {
  const outerStart = start - wherewith.length
  const outerEnd = end + wherewith.length

  if (isInner(str, start, end, wherewith)) {
    return {
      str: remove(str, start + wherewith.length, end - wherewith.length, wherewith),
      start,
      end: end - wherewith.length - wherewith.length
    }
  }

  if (isInner(str, outerStart, outerEnd, wherewith)) {
    return {
      str: remove(str, start, end, wherewith),
      start: start - wherewith.length,
      end: end - wherewith.length
    }
  }

  return {
    str: add(str, start, end, wherewith),
    start: start + wherewith.length,
    end: end + wherewith.length
  }
}
