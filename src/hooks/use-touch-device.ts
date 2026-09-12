import { useSyncExternalStore } from 'react'

const query = '(any-pointer: coarse)'

function hasTouchScreen() {
  return navigator.maxTouchPoints > 0 || window.matchMedia(query).matches
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

// Track touch capability, not screen width or a browser/device-name guess.
// An iPad still has a touchscreen when a keyboard or trackpad is attached.
export function useTouchDevice() {
  return useSyncExternalStore(subscribe, hasTouchScreen, () => false)
}
