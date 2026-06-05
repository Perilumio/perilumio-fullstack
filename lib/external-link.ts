import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

export async function openExternalLink(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url })
      return
    } catch {}
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
