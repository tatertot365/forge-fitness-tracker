// Notifications are stubbed out — requires a paid Apple Developer account.
// Re-enable by installing expo-notifications and adding the plugin to app.json.

export async function scheduleRestComplete(_seconds: number): Promise<string | null> {
  return null;
}

export async function cancelRestNotification(_id: string): Promise<void> {}
