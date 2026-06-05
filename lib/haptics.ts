import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export async function successHaptic(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    try {
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch {}
  }
}

export async function errorHaptic(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.notification({ type: NotificationType.Error })
  } catch {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy })
    } catch {}
  }
}
