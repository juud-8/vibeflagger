import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  getRecentLogs,
  getAllLogs,
  calculateVibeScore,
  getTopProfilesByLogCount,
  type LogEntry,
  type LogType,
  type TopProfile,
} from "../database/db";
import { useAuthStore } from "../state/authStore";
import { useSubscriptionStore } from "../state/subscriptionStore";
import { generateAndShareReport } from "../utils/pdfExport";
import { WalkthroughModal, useWalkthrough } from "../components/WalkthroughModal";
import { SideDrawer } from "../components/SideDrawer";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Dashboard">;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Cyber color constants
const COLORS = {
  green: "#00FF9C",
  red: "#FF0055",
  cyan: "#00F0FF",
  yellow: "#FFD600",
  dark: "#050508",
  surface: "#0D0D12",
  border: "#1A1A24",
};

function VibeMeter({ score, isCritical }: { score: number; isCritical: boolean }) {
  const isToxic = score >= 50;
  const color = isToxic ? COLORS.red : COLORS.green;
  const rotation = -90 + (score / 100) * 180;

  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (isCritical) {
      pulseOpacity.value = withRepeat(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [isCritical]);

  const animatedGlowProps = useAnimatedProps(() => ({
    opacity: pulseOpacity.value,
  }));

  const cx = 120 + 100 * Math.cos((rotation * Math.PI) / 180);
  const cy = 120 + 100 * Math.sin((rotation * Math.PI) / 180);

  return (
    <View className="items-center mb-4">
      <Svg width={240} height={130} viewBox="0 0 240 130">
        <Defs>
          <LinearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={COLORS.green} />
            <Stop offset="50%" stopColor={COLORS.yellow} />
            <Stop offset="100%" stopColor={COLORS.red} />
          </LinearGradient>
        </Defs>
        {/* Background arc - thinner */}
        <Path
          d="M 20 120 A 100 100 0 0 1 220 120"
          fill="none"
          stroke={COLORS.border}
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* Gradient arc */}
        <Path
          d="M 20 120 A 100 100 0 0 1 220 120"
          fill="none"
          stroke="url(#meterGradient)"
          strokeWidth={8}
          strokeLinecap="round"
          opacity={0.4}
        />
        {/* Indicator dot */}
        <Circle cx={cx} cy={cy} r={8} fill={color} />
        {/* Glow effect (pulsing for critical) */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={16}
          fill={color}
          animatedProps={animatedGlowProps}
        />
      </Svg>
      <Text className="text-4xl font-bold mt-1" style={{ color }}>
        {score}%
      </Text>
    </View>
  );
}

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const logout = useAuthStore((s) => s.logout);
  const { tier, limits, checkLimit } = useSubscriptionStore();

  // Drawer state
  const [showDrawer, setShowDrawer] = useState(false);

  // Walkthrough state
  const {
    showWalkthrough,
    isManualTrigger,
    openWalkthrough,
    closeWalkthrough,
  } = useWalkthrough();

  const [vibeScore, setVibeScore] = useState(0);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [topProfiles, setTopProfiles] = useState<TopProfile[]>([]);
  const [climate, setClimate] = useState<
    "Angelic" | "Healthy" | "Concerning" | "Toxic" | "CRITICAL: TOXIC"
  >("Angelic");
  const [isExporting, setIsExporting] = useState(false);

  const loadData = useCallback(async () => {
    const logs = await getRecentLogs(10);
    setRecentLogs(logs);
    const score = calculateVibeScore(logs);
    setVibeScore(score);

    // Load top profiles for watchlist
    const top = await getTopProfilesByLogCount(3);
    setTopProfiles(top);

    if (logs.length === 0) {
      setClimate("Angelic");
    } else if (score > 75) {
      setClimate("CRITICAL: TOXIC");
    } else if (score >= 50) {
      setClimate("Toxic");
    } else if (score >= 25) {
      setClimate("Concerning");
    } else if (score > 0) {
      setClimate("Healthy");
    } else {
      setClimate("Angelic");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleFlagPress = async (type: LogType) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Check log limit before allowing new log
    const allLogs = await getAllLogs();
    const limitCheck = await checkLimit("addLog", allLogs.length);

    if (!limitCheck.allowed) {
      Alert.alert(
        "Upgrade Required",
        limitCheck.reason || "You have reached the free tier limit.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Upgrade",
            onPress: () => navigation.navigate("Paywall"),
          },
        ]
      );
      return;
    }

    navigation.navigate("Logger", { flagType: type });
  };

  const handleExportReport = async () => {
    // Check if user has PDF export permission
    const limitCheck = await checkLimit("exportPDF");
    if (!limitCheck.allowed) {
      Alert.alert(
        "Upgrade to Pro",
        limitCheck.reason || "PDF export requires a Pro subscription.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Upgrade",
            onPress: () => navigation.navigate("Paywall"),
          },
        ]
      );
      return;
    }

    const allLogs = await getAllLogs();
    if (allLogs.length === 0) {
      Alert.alert("No Data", "There are no logs to export.");
      return;
    }

    setIsExporting(true);
    try {
      await generateAndShareReport(allLogs);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Export Failed", "Could not generate the report. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsExporting(false);
    }
  };

  const getClimateColor = () => {
    switch (climate) {
      case "Angelic":
        return COLORS.green;
      case "Healthy":
        return COLORS.green;
      case "Concerning":
        return COLORS.yellow;
      case "Toxic":
        return COLORS.red;
      case "CRITICAL: TOXIC":
        return COLORS.red;
      default:
        return COLORS.yellow;
    }
  };

  const isCritical = vibeScore > 75;

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: COLORS.dark, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header - Simplified with Menu */}
        <View className="flex-row justify-between items-center px-5 py-4">
          <View className="flex-row items-center gap-3">
            <Ionicons name="shield-checkmark" size={22} color={COLORS.green} />
            <Text className="text-white text-lg font-semibold tracking-wide">Vibe-Flagger</Text>
          </View>
          <Pressable
            onPress={() => setShowDrawer(true)}
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }}
          >
            <Ionicons name="menu" size={22} color="#888" />
          </Pressable>
        </View>

        {/* Vibe Meter Section - Compact */}
        <View className="px-5 pt-4">
          <View
            className="rounded-2xl p-5"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: isCritical ? 2 : 1,
              borderColor: isCritical ? COLORS.red : COLORS.border,
            }}
          >
            <Text
              className="text-xs text-center mb-3 uppercase tracking-widest font-mono"
              style={{ color: "#666" }}
            >
              The Vibe Meter
            </Text>
            <VibeMeter score={vibeScore} isCritical={isCritical} />
            <View className="items-center mt-1">
              <Text className="text-xs" style={{ color: "#555" }}>
                {vibeScore === 0 ? "Toxicity Level:" : "Current Climate:"}
              </Text>
              <Text
                className={`${isCritical ? "text-lg" : "text-xl"} font-bold mt-1 ${isCritical ? "uppercase tracking-wider" : ""}`}
                style={{ color: getClimateColor() }}
              >
                {climate}
              </Text>
            </View>
            {recentLogs.length === 0 && (
              <Text className="text-xs text-center mt-3" style={{ color: "#444" }}>
                No logs yet. Start tracking!
              </Text>
            )}
          </View>
        </View>

        {/* Watchlist - Top Targets */}
        {topProfiles.length > 0 && (
          <View className="px-5 pt-5">
            <View
              className="rounded-2xl p-4"
              style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="eye" size={16} color={COLORS.red} />
                  <Text className="text-xs font-mono uppercase tracking-widest" style={{ color: "#666" }}>
                    Watchlist
                  </Text>
                </View>
                <Text className="text-xs font-mono" style={{ color: "#444" }}>TOP TARGETS</Text>
              </View>

              {topProfiles.map((profile, index) => (
                <Pressable
                  key={profile.id}
                  onPress={() => navigation.navigate("ProfileDetail", { profileId: profile.id })}
                  className={`flex-row items-center justify-between py-3 ${
                    index < topProfiles.length - 1 ? "border-b" : ""
                  }`}
                  style={[
                    index < topProfiles.length - 1 ? { borderBottomColor: COLORS.border } : {},
                    index === 0 ? { borderLeftWidth: 3, borderLeftColor: COLORS.red, paddingLeft: 12, marginLeft: -4 } : {},
                  ]}
                >
                  <View className="flex-row items-center gap-3">
                    <Text
                      className="text-lg font-mono font-bold"
                      style={{ color: index === 0 ? COLORS.red : "#555" }}
                    >
                      #{index + 1}
                    </Text>
                    <Text
                      className={`text-base font-mono ${index === 0 ? "font-bold" : ""}`}
                      style={{ color: index === 0 ? "#fff" : "#999" }}
                    >
                      {profile.name}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text
                      className="text-sm font-mono font-bold"
                      style={{ color: index === 0 ? COLORS.red : "#666" }}
                    >
                      {profile.flagCount}
                    </Text>
                    <Text className="text-xs font-mono" style={{ color: COLORS.red }}>FLAGS</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Flag Buttons - Sci-Fi Style */}
        <View className="px-5 pt-6">
          <Text className="text-xs uppercase tracking-widest mb-4 font-mono" style={{ color: "#555" }}>
            Quick Log
          </Text>
          <View className="gap-3">
            {/* Green Flag */}
            <Pressable
              onPress={() => handleFlagPress("GREEN")}
              className="rounded-xl p-4 flex-row items-center justify-between active:opacity-80"
              style={{
                backgroundColor: "rgba(0, 255, 156, 0.08)",
                borderWidth: 1,
                borderColor: COLORS.green,
              }}
            >
              <View className="flex-row items-center gap-4">
                <View
                  className="w-12 h-12 rounded-lg items-center justify-center"
                  style={{ backgroundColor: "rgba(0, 255, 156, 0.15)" }}
                >
                  <Ionicons name="sparkles" size={24} color={COLORS.green} />
                </View>
                <View>
                  <Text className="text-lg font-semibold" style={{ color: COLORS.green }}>
                    Green Flag
                  </Text>
                  <Text className="text-xs" style={{ color: "#666" }}>
                    Positive behavior
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.green} />
            </Pressable>

            {/* Yellow Alert */}
            <Pressable
              onPress={() => handleFlagPress("YELLOW")}
              className="rounded-xl p-4 flex-row items-center justify-between active:opacity-80"
              style={{
                backgroundColor: "rgba(255, 214, 0, 0.08)",
                borderWidth: 1,
                borderColor: COLORS.yellow,
              }}
            >
              <View className="flex-row items-center gap-4">
                <View
                  className="w-12 h-12 rounded-lg items-center justify-center"
                  style={{ backgroundColor: "rgba(255, 214, 0, 0.15)" }}
                >
                  <Ionicons name="warning" size={24} color={COLORS.yellow} />
                </View>
                <View>
                  <Text className="text-lg font-semibold" style={{ color: COLORS.yellow }}>
                    Yellow Alert
                  </Text>
                  <Text className="text-xs" style={{ color: "#666" }}>
                    Concerning behavior
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.yellow} />
            </Pressable>

            {/* Red Flag */}
            <Pressable
              onPress={() => handleFlagPress("RED")}
              className="rounded-xl p-4 flex-row items-center justify-between active:opacity-80"
              style={{
                backgroundColor: "rgba(255, 0, 85, 0.08)",
                borderWidth: 1,
                borderColor: COLORS.red,
              }}
            >
              <View className="flex-row items-center gap-4">
                <View
                  className="w-12 h-12 rounded-lg items-center justify-center"
                  style={{ backgroundColor: "rgba(255, 0, 85, 0.15)" }}
                >
                  <Ionicons name="flag" size={24} color={COLORS.red} />
                </View>
                <View>
                  <Text className="text-lg font-semibold" style={{ color: COLORS.red }}>
                    Red Flag
                  </Text>
                  <Text className="text-xs" style={{ color: "#666" }}>
                    Negative behavior
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.red} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* First-time User Walkthrough */}
      <WalkthroughModal
        visible={showWalkthrough}
        onClose={closeWalkthrough}
        isManualTrigger={isManualTrigger}
      />

      {/* Side Drawer */}
      <SideDrawer
        visible={showDrawer}
        onClose={() => setShowDrawer(false)}
        menuItems={[
          {
            icon: "information-circle-outline",
            label: "How it Works",
            onPress: openWalkthrough,
          },
          {
            icon: "book-outline",
            label: "Black Book",
            onPress: () => navigation.navigate("Profiles"),
          },
          {
            icon: "lock-closed-outline",
            label: "The Vault",
            onPress: () => navigation.navigate("Vault"),
          },
          {
            icon: "share-outline",
            label: "Export Report",
            onPress: handleExportReport,
          },
        ]}
        appVersion="v1.0.0"
      />
    </View>
  );
}
