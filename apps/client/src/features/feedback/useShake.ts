import {useEffect} from 'react'
import {Accelerometer} from 'expo-sensors'

/* About 2.5 g of total acceleration is a deliberate shake; walking stays under 2 g. */
const SHAKE_G = 2.5
const COOLDOWN_MS = 2000

/**
 * Phones: calls `onShake` when the phone is shaken. The sensor only runs
 * while `isEnabled` (the "Shake to send feedback" preference).
 */
export function useShake(onShake: () => void, isEnabled: boolean) {
  useEffect(() => {
    if (!isEnabled) return
    let last = 0
    Accelerometer.setUpdateInterval(120)
    const sub = Accelerometer.addListener(({x, y, z}) => {
      const now = Date.now()
      if (Math.sqrt(x * x + y * y + z * z) < SHAKE_G) return
      if (now - last < COOLDOWN_MS) return
      last = now
      onShake()
    })
    return () => sub.remove()
  }, [isEnabled, onShake])
}
