import { useEffect, useRef } from 'react'

/**
 * Attach a DOM event listener to a target (defaults to window) for the lifetime
 * of the component. The handler is kept in a ref so it can change without
 * re-subscribing.
 */
export function useEvent<E extends Event = Event> (
  type: string,
  handler: (event: E) => void,
  target: EventTarget | null = typeof window !== 'undefined' ? window : null,
  options?: AddEventListenerOptions | boolean
): void {
  const saved = useRef(handler)
  saved.current = handler

  useEffect(() => {
    if (!target) return
    const listener = (e: Event) => saved.current(e as E)
    target.addEventListener(type, listener, options)
    return () => target.removeEventListener(type, listener, options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, target])
}
