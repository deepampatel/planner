/**
 * Resilient token storage — writes to multiple backends,
 * reads from whichever survives. Protects against:
 * - localStorage cleared (cookie + sessionStorage still there)
 * - Cookies cleared (localStorage + sessionStorage still there)
 * - sessionStorage lost on tab close (localStorage + cookie still there)
 */

const COOKIE_DAYS = 90

function setCookie(name: string, value: string) {
  const expires = new Date(Date.now() + COOKIE_DAYS * 86400000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`
}

/** Write token to all available storage backends */
export function setToken(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* quota exceeded or disabled */ }
  try { sessionStorage.setItem(key, value) } catch { /* same */ }
  try { setCookie(key, value) } catch { /* cookies disabled */ }
}

/** Read token — checks all backends, self-heals if any are missing */
export function getToken(key: string): string | null {
  const fromLocal = safeGet(() => localStorage.getItem(key))
  const fromSession = safeGet(() => sessionStorage.getItem(key))
  const fromCookie = safeGet(() => getCookie(key))

  const value = fromLocal || fromSession || fromCookie

  // Self-heal: if we found a token but some backends are missing it, restore them
  if (value) {
    if (!fromLocal) try { localStorage.setItem(key, value) } catch { /* */ }
    if (!fromSession) try { sessionStorage.setItem(key, value) } catch { /* */ }
    if (!fromCookie) try { setCookie(key, value) } catch { /* */ }
  }

  return value
}

/** Remove token from all backends */
export function removeToken(key: string): void {
  try { localStorage.removeItem(key) } catch { /* */ }
  try { sessionStorage.removeItem(key) } catch { /* */ }
  try { deleteCookie(key) } catch { /* */ }
}

function safeGet(fn: () => string | null): string | null {
  try { return fn() } catch { return null }
}
