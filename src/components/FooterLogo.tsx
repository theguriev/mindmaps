export function FooterLogo () {
  return (
    <div className="absolute right-3 bottom-2 z-10 text-xs text-muted-foreground select-none">
      Mind maps by{' '}
      <a
        href="https://beagl.in"
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-foreground/70 no-underline hover:underline"
      >
        Beagl
      </a>
    </div>
  )
}
