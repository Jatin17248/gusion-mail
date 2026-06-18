import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Hook to detect if the device is mobile.
 * Returns undefined during SSR/hydration, then true/false after mount.
 * This prevents hydration mismatch flicker.
 */
export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(() => {
    // During SSR, return undefined (will be resolved on client)
    if (typeof window === 'undefined') return undefined
    // On client initial render, check immediately
    return window.innerWidth < MOBILE_BREAKPOINT
  })

  React.useEffect(() => {
    // Ensure we have the correct value after hydration
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    checkMobile()

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", checkMobile)
    return () => mql.removeEventListener("change", checkMobile)
  }, [])

  return isMobile
}

/**
 * Same as useIsMobile but returns false instead of undefined during SSR.
 * Use this when you need a boolean value and can't handle undefined.
 */
export function useIsMobileSafe(): boolean {
  const isMobile = useIsMobile()
  return isMobile ?? false
}
