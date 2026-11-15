const MESSAGE_KEY = 'user-management-message';

export function rememberMessage(message) {
  try {
    sessionStorage.setItem(MESSAGE_KEY, JSON.stringify(message));
  } catch (error) {}
}

export function takeRememberedMessage() {
  try {
    const stored = sessionStorage.getItem(MESSAGE_KEY);
    sessionStorage.removeItem(MESSAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}
