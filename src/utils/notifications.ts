import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getRestNotificationsEnabled } from '../db/queries/settings';

// Local notifications only -- nothing leaves the device. The rest timer is a
// fixed countdown, so iOS can be handed "fire in N seconds" up front and will
// deliver it even if the app is backgrounded or killed. No server, no push
// token, no account, which keeps the app's no-backend promise intact.

// Foreground behaviour: the timer already shows "Done" and fires a haptic on
// screen, so a banner over the screen you are looking at is just noise.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let androidChannelReady = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) return;
  await Notifications.setNotificationChannelAsync('rest-timer', {
    name: 'Rest timer',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
  androidChannelReady = true;
}

/**
 * Ask for notification permission, if it has not been decided already.
 *
 * Called lazily from the first rest-timer start rather than at launch: a
 * permission prompt on first open, before the user has seen what it is for,
 * gets declined. Returns whether notifications can actually be posted.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    // Asking again after an explicit denial does nothing -- iOS only shows the
    // system prompt once. Respect it instead of pretending it might work.
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  } catch {
    return false;
  }
}

/**
 * Schedule the "rest is over" notification `seconds` from now.
 *
 * Returns the identifier needed to cancel it, or null when nothing was
 * scheduled -- the setting is off, permission was refused, or the platform
 * rejected it. Callers treat null as "no notification pending".
 */
export async function scheduleRestComplete(seconds: number): Promise<string | null> {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  try {
    if (!(await getRestNotificationsEnabled())) return null;
    if (!(await ensureNotificationPermission())) return null;
    await ensureAndroidChannel();
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest complete',
        body: 'Time for your next set.',
        sound: 'default',
        interruptionLevel: 'timeSensitive',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: 'rest-timer',
      },
    });
  } catch {
    // A failed notification must never break the timer itself.
    return null;
  }
}

export async function cancelRestNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or already cancelled -- nothing to undo.
  }
}

/**
 * Drop any rest notification still scheduled. Used when the setting is turned
 * off mid-rest, so an already-queued one does not fire after the user opts out.
 */
export async function cancelAllRestNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing scheduled.
  }
}
