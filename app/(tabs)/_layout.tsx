import { NativeTabs } from "expo-router/unstable-native-tabs";
import { colors } from "../../src/theme/colors";

// Native UITabBarController rather than the JS tab bar, so the bar picks up
// the system Liquid Glass material on iOS 26. Icons must be SF Symbols —
// a native tab item takes a symbol or an image, not a React component, so
// the Lucide icons used elsewhere in the app can't be reused here.
//
// `systemChromeMaterialDark` matches the app's fixed dark theme; without an
// explicit dark variant the bar would follow the system appearance and go
// light on a light-mode device.
export default function TabsLayout() {
  return (
    <NativeTabs
      blurEffect="systemChromeMaterialDark"
      tintColor={colors.primary}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="session">
        <NativeTabs.Trigger.Icon sf="dumbbell.fill" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="food">
        <NativeTabs.Trigger.Icon sf="fork.knife" />
        <NativeTabs.Trigger.Label>Food</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="measure">
        <NativeTabs.Trigger.Icon sf="ruler.fill" />
        <NativeTabs.Trigger.Label>Measure</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
