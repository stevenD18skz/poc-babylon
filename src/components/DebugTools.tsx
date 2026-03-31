'use client'

import { useEffect } from 'react'

export default function DebugTools() {
  useEffect(() => {
    // In Babylon, we could toggle the inspector here if needed.
    // However, the original R3F DebugTools might have been for something else.
    // For now, we'll keep it as a placeholder to avoid import errors.
    console.log('DebugTools mounted')
  }, [])

  return null
}
