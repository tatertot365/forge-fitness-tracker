import { Alert } from "react-native";

/**
 * A two-button alert as a promise: resolves true for `confirmText`, false for
 * `cancelText`. Lets callers show alerts one after another without them
 * colliding, since each waits until the previous one is answered.
 */
export function confirm(
  title: string,
  message: string,
  cancelText: string,
  confirmText: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: "cancel", onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ],
      // Android can dismiss by tapping outside; treat that as cancel.
      { onDismiss: () => resolve(false) },
    );
  });
}
