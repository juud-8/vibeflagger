import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LockScreen } from "../screens/LockScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { VaultScreen } from "../screens/VaultScreen";
import { LoggerModal } from "../screens/LoggerModal";
import { SetupPinScreen } from "../screens/SetupPinScreen";
import { ProfilesScreen } from "../screens/ProfilesScreen";
import { ProfileDetailScreen } from "../screens/ProfileDetailScreen";
import { PaywallScreen } from "../screens/PaywallScreen";
import AIInsightsScreen from "../screens/AIInsightsScreen";
import AIChatScreen from "../screens/AIChatScreen";
import { useAuthStore } from "../state/authStore";
import type { LogType } from "../database/db";

export type RootStackParamList = {
  Lock: undefined;
  SetupPin: undefined;
  Dashboard: undefined;
  Vault: undefined;
  Profiles: undefined;
  ProfileDetail: { profileId: number };
  Logger: { flagType: LogType };
  Paywall: undefined;
  AIInsights: { profileId: number; profileName: string };
  AIChat: { profileId: number; profileName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
        animation: "fade",
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Lock" component={LockScreen} />
          <Stack.Screen name="SetupPin" component={SetupPinScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Vault" component={VaultScreen} />
          <Stack.Screen name="Profiles" component={ProfilesScreen} />
          <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
          <Stack.Screen
            name="Logger"
            component={LoggerModal}
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.85],
              sheetCornerRadius: 24,
            }}
          />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="AIInsights"
            component={AIInsightsScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="AIChat"
            component={AIChatScreen}
            options={{
              animation: "slide_from_right",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
