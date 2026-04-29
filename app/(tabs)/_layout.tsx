import { Tabs } from "expo-router";
import { Apple, Dumbbell, House, Ruler } from "lucide-react-native";
import { StyleSheet } from "react-native";
import { colors } from "../../src/theme/colors";

const ICON_SIZE = 22;
const STROKE = 1.75;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          height: 74,
          paddingTop: 8,
          paddingBottom: 18,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }: { color: string }) => (
            <House color={color} size={ICON_SIZE} strokeWidth={STROKE} />
          ),
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          title: "Today",
          tabBarIcon: ({ color }: { color: string }) => (
            <Dumbbell color={color} size={ICON_SIZE} strokeWidth={STROKE} />
          ),
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: "Food",
          tabBarIcon: ({ color }: { color: string }) => (
            <Apple color={color} size={ICON_SIZE} strokeWidth={STROKE} />
          ),
        }}
      />
      <Tabs.Screen
        name="measure"
        options={{
          title: "Measure",
          tabBarIcon: ({ color }: { color: string }) => (
            <Ruler color={color} size={ICON_SIZE} strokeWidth={STROKE} />
          ),
        }}
      />
    </Tabs>
  );
}
