// Utility module for browser cookie storage (7-day default retention with consent)

export const COOKIE_NAMES = {
  CONSENT: 'mm_cookie_consent',
  AUTH_TOKEN: 'mm_auth_token',
  USER_DATA: 'mm_user_data',
  USER_PREFS: 'mm_user_prefs',
} as const;

/**
 * Set a browser cookie with explicit max-age (default 7 days)
 */
export function setCookie(name: string, value: string, days = 7): void {
  try {
    if (typeof document === 'undefined') return;
    const maxAge = Math.floor(days * 24 * 60 * 60);
    const encodedValue = encodeURIComponent(value);
    document.cookie = `${name}=${encodedValue}; Max-Age=${maxAge}; path=/; SameSite=Lax`;
  } catch (err) {
    console.warn(`[CookieUtils] Failed to set cookie '${name}':`, err);
  }
}

/**
 * Get a browser cookie by name
 */
export function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const cookie of cookies) {
      const parts = cookie.split('=');
      const key = parts[0]?.trim();
      if (key === name) {
        return decodeURIComponent(parts.slice(1).join('=').trim());
      }
    }
  } catch (err) {
    console.warn(`[CookieUtils] Failed to read cookie '${name}':`, err);
  }
  return null;
}

/**
 * Delete a browser cookie
 */
export function deleteCookie(name: string): void {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  } catch (err) {
    console.warn(`[CookieUtils] Failed to delete cookie '${name}':`, err);
  }
}

/**
 * Cookie storage consent (automatically granted under terms of service)
 */
export function getCookieConsent(): boolean {
  return true;
}

/**
 * Set user cookie consent choice
 */
export function setCookieConsent(granted: boolean, days = 30): void {
  const val = granted ? 'granted' : 'denied';
  setCookie(COOKIE_NAMES.CONSENT, val, days);
}

/**
 * Store login session token in cookie for 7 days
 */
export function saveLoginCookie(token: string, days = 7): void {
  setCookie(COOKIE_NAMES.AUTH_TOKEN, token, days);
}

/**
 * Retrieve login session token from cookie
 */
export function getLoginCookie(): string | null {
  return getCookie(COOKIE_NAMES.AUTH_TOKEN);
}

/**
 * Remove login session cookie
 */
export function clearLoginCookie(): void {
  deleteCookie(COOKIE_NAMES.AUTH_TOKEN);
  deleteCookie(COOKIE_NAMES.USER_DATA);
}

/**
 * Save user data/preferences in a 7-day cookie for fast restoration
 */
export function saveUserDataCookie(data: Record<string, any>, days = 7): void {
  try {
    const jsonString = JSON.stringify(data);
    setCookie(COOKIE_NAMES.USER_DATA, jsonString, days);
  } catch (e) {
    console.warn('[CookieUtils] Failed to save user data cookie:', e);
  }
}

/**
 * Retrieve user data/preferences from cookie
 */
export function getUserDataCookie(): Record<string, any> | null {
  try {
    const raw = getCookie(COOKIE_NAMES.USER_DATA);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
