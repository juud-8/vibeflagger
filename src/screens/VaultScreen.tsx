import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { getAllLogs, deleteLog, type LogEntry } from "../database/db";
import { generateAndShareReport } from "../utils/pdfExport";

function LogCard({
  item,
  onDelete,
}: {
  item: LogEntry;
  onDelete: (id: number) => void;
}) {
  const translateX = useSharedValue(0);
  const deleteThreshold = -100;

  const triggerDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete(item.id);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -150);
      }
    })
    .onEnd((event) => {
      if (event.translationX < deleteThreshold) {
        translateX.value = withSpring(-300);
        runOnJS(triggerDelete)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const getTypeColor = () => {
    switch (item.type) {
      case "GREEN":
        return "#00ff88";
      case "YELLOW":
        return "#ffaa00";
      case "RED":
        return "#ff4444";
    }
  };

  const getTypeEmoji = () => {
    switch (item.type) {
      case "GREEN":
        return "✨";
      case "YELLOW":
        return "⚠️";
      case "RED":
        return "🚩";
    }
  };

  return (
    <View className="mb-3 mx-6">
      {/* Delete background */}
      <View className="absolute inset-0 bg-red-600 rounded-2xl items-end justify-center pr-6">
        <Ionicons name="trash-outline" size={24} color="white" />
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={animatedStyle}
          className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800"
        >
          <View className="flex-row items-start gap-3">
            <View
              className="w-12 h-12 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${getTypeColor()}20` }}
            >
              <Text className="text-2xl">{getTypeEmoji()}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-white font-semibold text-base">
                  {item.person}
                </Text>
                <Text className="text-neutral-500 text-xs">
                  {format(new Date(item.timestamp), "MMM d, h:mm a")}
                </Text>
              </View>
              <View className="flex-row items-center gap-2 mt-1">
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${getTypeColor()}20` }}
                >
                  <Text style={{ color: getTypeColor() }} className="text-xs font-medium">
                    {item.category}
                  </Text>
                </View>
                <Text className="text-neutral-500 text-xs">
                  Severity: {item.severity}/10
                </Text>
              </View>
              {item.notes && (
                <Text
                  className="text-neutral-400 text-sm mt-2"
                  numberOfLines={2}
                >
                  {item.notes}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export function VaultScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const loadLogs = useCallback(async () => {
    const allLogs = await getAllLogs();
    setLogs(allLogs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  const handleDelete = async (id: number) => {
    await deleteLog(id);
    setLogs((prev) => prev.filter((log) => log.id !== id));
  };

  const handleExportReport = async () => {
    if (logs.length === 0) {
      Alert.alert("No Data", "There are no logs to export.");
      return;
    }

    setIsExporting(true);
    try {
      await generateAndShareReport(logs);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Export Failed", "Could not generate the report. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View
      className="flex-1 bg-[#0a0a0a]"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-neutral-800">
        <Pressable
          onPress={() => navigation.goBack()}
          className="flex-row items-center gap-2"
        >
          <Ionicons name="chevron-back" size={24} color="#00ff88" />
          <Text className="text-[#00ff88] text-base">Back</Text>
        </Pressable>
        <Text className="text-white text-lg font-semibold">The Vault</Text>
        <Pressable
          onPress={handleExportReport}
          disabled={isExporting || logs.length === 0}
          className={`w-10 h-10 rounded-full items-center justify-center ${
            logs.length === 0 ? "bg-neutral-800" : "bg-[#00ff88]/10"
          }`}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#00ff88" />
          ) : (
            <Ionicons
              name="share-outline"
              size={20}
              color={logs.length === 0 ? "#444" : "#00ff88"}
            />
          )}
        </Pressable>
      </View>

      {/* Log count */}
      <View className="px-6 py-4">
        <Text className="text-neutral-500 text-sm">
          {logs.length} {logs.length === 1 ? "entry" : "entries"} logged
        </Text>
      </View>

      {/* Logs list */}
      {logs.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="folder-open-outline" size={64} color="#333" />
          <Text className="text-neutral-500 text-lg mt-4">No logs yet</Text>
          <Text className="text-neutral-600 text-sm text-center mt-2">
            Start logging behaviors from the Dashboard
          </Text>
        </View>
      ) : (
        <FlashList
          data={logs}
          renderItem={({ item }) => (
            <LogCard item={item} onDelete={handleDelete} />
          )}
          estimatedItemSize={120}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        />
      )}
    </View>
  );
}
