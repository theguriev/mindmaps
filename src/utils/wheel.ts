/**
 * Wheel direction helpers. The original used the non-standard `wheelDeltaX/Y`;
 * here we use the standard `deltaX/Y` (opposite sign) and normalise back to the
 * same semantics: up = 1, down = -1, right = 1, left = -1, none = 0.
 */
export function isWheelUp (event: WheelEvent): number {
  if (event.deltaY === 0) return 0
  return event.deltaY < 0 ? 1 : -1
}

export function isWheelRight (event: WheelEvent): number {
  if (event.deltaX === 0) return 0
  return event.deltaX > 0 ? 1 : -1
}
