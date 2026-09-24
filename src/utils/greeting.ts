/**
 * Time-based greeting generator adhering strictly to user guidelines:
 * - 5:00 AM–11:59 AM → "Good morning"
 * - 12:00 PM–5:59 PM → "Good afternoon"
 * - 6:00 PM–4:59 AM → "Good night"
 * 
 * CRITICAL RULE: NEVER display the user's name anywhere.
 * MUST display exactly "Good morning", "Good afternoon", or "Good night".
 */

export function getGreeting(date = new Date()): 'Good morning' | 'Good afternoon' | 'Good night' {
  const hours = date.getHours();
  // 5:00 AM (5) to 11:59 AM (11)
  if (hours >= 5 && hours < 12) {
    return 'Good morning';
  }
  // 12:00 PM (12) to 5:59 PM (17)
  if (hours >= 12 && hours < 18) {
    return 'Good afternoon';
  }
  // 6:00 PM (18) to 4:59 AM (4)
  return 'Good night';
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
