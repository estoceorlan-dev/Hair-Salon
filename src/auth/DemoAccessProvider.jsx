import { useState } from 'react'
import { DemoAccessContext } from './DemoAccessContext'

const storageKey = 'romel.ui-preview-mode'
const validModes = ['employee', 'customer']

function readMode() {
  try {
    const saved = sessionStorage.getItem(storageKey)
    return validModes.includes(saved) ? saved : null
  } catch {
    return null
  }
}

// UI preview selection only. Replace with verified sessions in Phase 3.
export default function DemoAccessProvider({ children }) {
  const [mode, setMode] = useState(readMode)
  const enterPreview = (nextMode) => {
    if (!validModes.includes(nextMode)) return
    setMode(nextMode)
    try {
      sessionStorage.setItem(storageKey, nextMode)
    } catch {
      /* Storage can be blocked. */
    }
  }
  const leavePreview = () => {
    setMode(null)
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      /* In-memory state still clears. */
    }
  }
  return (
    <DemoAccessContext.Provider value={{ mode, enterPreview, leavePreview }}>
      {children}
    </DemoAccessContext.Provider>
  )
}
