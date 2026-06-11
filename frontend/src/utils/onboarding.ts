// Tracks first-run actions we can't cheaply derive from the server.
// Dog ownership and follows come straight from their queries; "has swiped"
// has no dedicated endpoint, so we record it client-side per user.

const swipedKey = (userId: string) => `fetch.onboarding.swiped.${userId}`;
const dismissedKey = (userId: string) => `fetch.onboarding.dismissed.${userId}`;

export const onboarding = {
  hasSwiped(userId: string): boolean {
    try {
      return localStorage.getItem(swipedKey(userId)) === '1';
    } catch {
      return false;
    }
  },
  markSwiped(userId: string) {
    try {
      localStorage.setItem(swipedKey(userId), '1');
    } catch {
      // localStorage unavailable; fail silent
    }
  },
  isDismissed(userId: string): boolean {
    try {
      return localStorage.getItem(dismissedKey(userId)) === '1';
    } catch {
      return false;
    }
  },
  dismiss(userId: string) {
    try {
      localStorage.setItem(dismissedKey(userId), '1');
    } catch {
      // localStorage unavailable; fail silent
    }
  },
};
