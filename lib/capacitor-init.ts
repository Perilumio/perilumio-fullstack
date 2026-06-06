import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'

let initialized = false

export async function initCapacitor(): Promise<void> {
  if (initialized) return
  if (!Capacitor.isNativePlatform()) return
  initialized = true

  try {
    await StatusBar.setStyle({ style: Style.Dark })
  } catch {}

  try {
    await SplashScreen.hide()
  } catch {}
}
