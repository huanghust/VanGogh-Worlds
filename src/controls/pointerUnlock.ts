type LockDocument = Pick<Document, 'pointerLockElement' | 'addEventListener' | 'removeEventListener'>

// Browser-consumed Escape still produces an unlock event. A failed lock request
// does not: only a transition out of an acquired lock should open the menu.
export function watchPointerUnlock(doc: LockDocument, onUnlock: () => void) {
  let wasLocked = !!doc.pointerLockElement
  const onChange = () => {
    const locked = !!doc.pointerLockElement
    if (wasLocked && !locked) onUnlock()
    wasLocked = locked
  }
  doc.addEventListener('pointerlockchange', onChange)
  return () => doc.removeEventListener('pointerlockchange', onChange)
}
