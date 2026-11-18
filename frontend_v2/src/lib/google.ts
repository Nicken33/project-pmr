// Вход через Google: получаем access token через Google Identity Services
// и отдаём его бэку (POST /api/auth/google, поле credential).
import { GOOGLE_CLIENT_ID } from '../config'

interface TokenResponse {
  access_token?: string
  error?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: unknown) => void }): {
            requestAccessToken(): void
          }
        }
      }
    }
  }
}

let loading: Promise<void> | null = null
function loadScript() {
  if (window.google?.accounts) return Promise.resolve()
  if (!loading)
    loading = new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => res()
      s.onerror = () => {
        loading = null
        rej(new Error('Не удалось загрузить Google'))
      }
      document.head.appendChild(s)
    })
  return loading
}

export const googleEnabled = () => !!GOOGLE_CLIENT_ID

export async function getGoogleAccessToken(): Promise<string> {
  await loadScript()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error || 'Google отклонил вход'))),
      error_callback: () => reject(new Error('Окно Google закрыто')),
    })
    client.requestAccessToken()
  })
}
