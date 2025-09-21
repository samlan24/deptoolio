'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function DynamicCanonical() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Remove any existing canonical link
    const existingCanonical = document.querySelector('link[rel="canonical"]')
    if (existingCanonical) {
      existingCanonical.remove()
    }

    // Create new canonical link with clean URL (no parameters)
    const canonical = document.createElement('link')
    canonical.rel = 'canonical'
    canonical.href = `https://www.pacgie.com${pathname}`

    document.head.appendChild(canonical)
  }, [pathname, searchParams])

  return null
}