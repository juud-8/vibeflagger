import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuthStore } from "../state/authStore";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Lock">;

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

export function LockScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const [enteredPin, setEnteredPin] = useState("");
  const [error, setError] = useState("");

  const pin = useAuthStore((s) => s.pin);
  const loadPin = useAuthStore((s) => s.loadPin);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  useEffect(() => {
    loadPin();
  }, [loadPin]);

  const handleNumberPress = async (num: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError("");

    if (enteredPin.length < 4) {
      const newPin = enteredPin + num;
      setEnteredPin(newPin);

      if (newPin.length === 4) {
        if (!pin) {
          // No PIN set, go to setup
          navigation.navigate("SetupPin");
          setEnteredPin("");
        } else if (newPin === pin) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setAuthenticated(true);
          setEnteredPin("");
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError("Wrong PIN");
          setEnteredPin("");
        }
      }
    }
  };

  const handleDelete = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const renderDots = () => {
    return (
      <View className="flex-row justify-center gap-4 mb-10">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor: i < enteredPin.length ? COLORS.green : "transparent",
              borderWidth: 2,
              borderColor: i < enteredPin.length ? COLORS.green : COLORS.border,
            }}
          />
        ))}
      </View>
    );
  };

  const numberPad = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "delete"],
  ];

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: COLORS.dark, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-1 justify-center items-center px-8">
        <View className="mb-8">
          <Ionicons name="shield-checkmark" size={44} color={COLORS.green} />
        </View>

        <Text className="text-white text-2xl font-semibold mb-2">
          Vibe-Flagger
        </Text>
        <Text className="text-sm mb-12" style={{ color: "#555" }}>
          {pin ? "Enter PIN to unlock" : "Enter any 4 digits to set up"}
        </Text>

        {error ? (
          <Text className="text-sm mb-4" style={{ color: COLORS.red }}>{error}</Text>
        ) : null}

        {renderDots()}

        <View className="w-full max-w-[280px]">
          {numberPad.map((row, rowIndex) => (
            <View key={rowIndex} className="flex-row justify-center gap-6 mb-4">
              {row.map((item, itemIndex) => {
                if (item === "") {
                  return <View key={itemIndex} className="w-[72px] h-[72px]" />;
                }
                if (item === "delete") {
                  return (
                    <Pressable
                      key={itemIndex}
                      onPress={handleDelete}
                      className="w-[72px] h-[72px] rounded-xl items-center justify-center"
                    >
                      <Ionicons name="backspace-outline" size={26} color="#555" />
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={itemIndex}
                    onPress={() => handleNumberPress(item)}
                    className="w-[72px] h-[72px] rounded-xl items-center justify-center active:opacity-70"
                    style={{
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text className="text-white text-2xl font-medium">{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
