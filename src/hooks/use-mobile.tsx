import * as React from "react"

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(() => window.matchMedia(query).matches)

  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    if (mql.addEventListener) mql.addEventListener("change", onChange)
    else mql.addListener(onChange)
    onChange()
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange)
      else mql.removeListener(onChange)
    }
  }, [query])

  return matches
}

export function useIsMobile() {
  return useMediaQuery("not all and (min-width: 768px)")
}

export function useIsTablet() {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023.98px)")
}
