import React, { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
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
import { getDatabase, updateProfile, deleteProfile, type Profile, type LogEntry, type RelationshipType } from "../database/db";
import { useSubscriptionStore } from "../state/subscriptionStore";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { generateReceiptsPDF } from "../utils/pdf-generator";
import { ProfileOptionsBottomSheet } from "../components/ProfileOptionsBottomSheet";
import { canUseAIAnalysis, MIN_LOGS_FOR_AI } from "../services/AIInsightsService";

type ProfileDetailRouteProp = RouteProp<RootStackParamList, "ProfileDetail">;

// Cyber color constants
const COLORS = {
  green: "#00FF9C",
  red: "#FF0055",
  cyan: "#00F0FF",
  yellow: "#FFD600",
  purple: "#B026FF",
  dark: "#050508",
  surface: "#0D0D12",
  border: "#1A1A24",
};

const RELATIONSHIP_TYPES: RelationshipType[] = [
  "Partner",
  "Ex",
  "Family",
  "Friend",
  "Boss",
  "Coworker",
  "Other",
];

function LogCard({
  item,
  onDelete,
  onEdit,
}: {
  item: LogEntry;
  onDelete: (id: number) => void;
  onEdit: (log: LogEntry) => void;
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
        return COLORS.green;
      case "YELLOW":
        return COLORS.yellow;
      case "RED":
        return COLORS.red;
    }
  };

  return (
    <View className="mb-2 mx-5">
      <View
        className="absolute inset-0 rounded-lg items-end justify-center pr-6"
        style={{ backgroundColor: COLORS.red }}
      >
        <Ionicons name="trash-outline" size={22} color="white" />
      </View>

      <GestureDetector gesture={panGesture}>
        <Pressable
          onPress={() => onEdit(item)}
        >
          <Animated.View
            style={[
              animatedStyle,
              {
                borderLeftWidth: 3,
                borderLeftColor: getTypeColor(),
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 10,
                padding: 12,
              }
            ]}
          >
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs font-mono" style={{ color: COLORS.cyan }}>
                    {format(new Date(item.timestamp), "yyyy-MM-dd HH:mm:ss")}
                  </Text>
                  <View
                    className="px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${getTypeColor()}20`, borderWidth: 1, borderColor: getTypeColor() }}
                  >
                    <Text style={{ color: getTypeColor() }} className="text-xs font-mono font-bold">
                      {item.type}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-xs font-mono" style={{ color: "#555" }}>
                    [{item.category}]
                  </Text>
                  <Text style={{ color: getTypeColor() }} className="text-xs font-mono font-bold">
                    SEV:{item.severity}
                  </Text>
                </View>
                {item.notes && (
                  <Text
                    className="text-xs font-mono mt-1"
                    style={{ color: "#888" }}
                    numberOfLines={3}
                  >
                    &gt; {item.notes}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </GestureDetector>
    </View>
  );
}

export function ProfileDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<ProfileDetailRouteProp>();
  const { profileId } = route.params;
  const checkLimit = useSubscriptionStore((s) => s.checkLimit);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Bottom sheet state
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);

  // Edit profile modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRelationship, setEditRelationship] = useState<RelationshipType>("Partner");

  // Edit log modal state
  const [showEditLogModal, setShowEditLogModal] = useState(false);
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [editLogNotes, setEditLogNotes] = useState("");


  // ROBUST DATA FETCH - Direct database queries
  const fetchProfileData = useCallback(async () => {
    setIsLoading(true);

    try {
      const db = await getDatabase();

      // Query 1: Get profile data
      const profileResults = await db.getAllAsync<Profile>(
        "SELECT * FROM profiles WHERE id = ?",
        [profileId]
      );

      if (profileResults.length === 0) {
        Alert.alert("Error", "Profile not found");
        setProfile(null);
        setLogs([]);
        return;
      }

      const loadedProfile = profileResults[0];
      setProfile(loadedProfile);

      // Query 2: Get logs for this profile - try profile_id first, fallback to person name
      let logResults: LogEntry[] = [];
      try {
        // Try querying by profile_id first
        logResults = await db.getAllAsync<LogEntry>(
          "SELECT * FROM logs WHERE profile_id = ? ORDER BY timestamp DESC",
          [profileId]
        );
      } catch (e) {
        // Fallback to person name if needed
      }

      // If no logs found by profile_id, try by person name
      if (logResults.length === 0) {
        logResults = await db.getAllAsync<LogEntry>(
          "SELECT * FROM logs WHERE person = ? ORDER BY timestamp DESC",
          [loadedProfile.name]
        );
      }

      setLogs(logResults);

    } catch (error: any) {
      Alert.alert("Error", "Failed to load profile data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  // Trigger fetch on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
    }, [fetchProfileData])
  );

  const handleDelete = async (id: number) => {
    try {
      const db = await getDatabase();
      await db.runAsync("DELETE FROM logs WHERE id = ?", [id]);
      setLogs((prev) => prev.filter((log) => log.id !== id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Error", "Failed to delete log. Please try again.");
    }
  };

  const handleOptionsMenu = () => {
    setShowOptionsSheet(true);
  };

  const handleEditProfile = () => {
    if (profile) {
      setEditName(profile.name);
      setEditRelationship(profile.relationship as RelationshipType);
      setShowEditModal(true);
    }
  };

  const handleDeleteProfile = () => {
    Alert.alert(
      "Delete Profile",
      "Are you sure you want to delete this profile? This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProfile(profileId);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              navigation.goBack();
            } catch (error) {
              Alert.alert("Error", "Failed to delete profile. Please try again.");
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    try {
      await updateProfile(profileId, {
        name: editName.trim(),
        relationship: editRelationship,
      });

      // Refresh profile data
      await fetchProfileData();
      setShowEditModal(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      if (error?.message?.includes("UNIQUE constraint")) {
        Alert.alert("Error", `A profile with the name "${editName}" already exists.`);
      } else {
        Alert.alert("Error", "Failed to update profile. Please try again.");
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleEditLog = (log: LogEntry) => {
    setEditingLog(log);
    setEditLogNotes(log.notes || "");
    setShowEditLogModal(true);
  };

  const handleSaveLogEdit = async () => {
    if (!editingLog) return;

    try {
      const db = await getDatabase();
      await db.runAsync(
        "UPDATE logs SET notes = ? WHERE id = ?",
        [editLogNotes || null, editingLog.id]
      );

      // Update local state
      setLogs((prev) =>
        prev.map((log) =>
          log.id === editingLog.id ? { ...log, notes: editLogNotes || null } : log
        )
      );

      setShowEditLogModal(false);
      setEditingLog(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Error", "Failed to update log. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDeleteLog = (logToDelete: LogEntry) => {
    Alert.alert(
      "Delete Log",
      "Delete this log? This will adjust the Vibe Score.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.runAsync("DELETE FROM logs WHERE id = ?", [logToDelete.id]);
              setLogs((prev) => prev.filter((log) => log.id !== logToDelete.id));
              setShowEditLogModal(false);
              setEditingLog(null);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Alert.alert("Error", "Failed to delete log. Please try again.");
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ]
    );
  };

  const handleGenerateReport = async () => {
    if (!profile) return;

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

    setIsGeneratingPDF(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Build stats object for PDF generator
      const stats = {
        profile,
        vibeScore: calculateVibeScore(logs),
        healthStatus: getHealthStatus(calculateVibeScore(logs)),
        totalLogs: logs.length,
        redCount: logs.filter(l => l.type === "RED").length,
        yellowCount: logs.filter(l => l.type === "YELLOW").length,
        greenCount: logs.filter(l => l.type === "GREEN").length,
        lastFlagDate: logs.length > 0 ? logs[0].timestamp : null,
      };

      await generateReceiptsPDF(stats, logs);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Calculate vibe score from logs
  const calculateVibeScore = (logsList: LogEntry[]): number => {
    if (logsList.length === 0) return 0;

    let toxicitySum = 0;
    for (const log of logsList) {
      switch (log.type) {
        case "RED":
          toxicitySum += log.severity;
          break;
        case "YELLOW":
          toxicitySum += log.severity / 2;
          break;
        case "GREEN":
          toxicitySum -= log.severity;
          break;
      }
    }

    const maxPossibleToxicity = logsList.length * 10;
    const toxicityPercentage = (toxicitySum / maxPossibleToxicity) * 100;
    return Math.max(0, Math.min(100, Math.round(toxicityPercentage)));
  };

  const getHealthStatus = (score: number): string => {
    if (score > 75) return "Critical";
    if (score >= 50) return "Toxic";
    if (score >= 25) return "Concerning";
    if (score > 0) return "Stable";
    return "Thriving";
  };

  const vibeScore = calculateVibeScore(logs);
  const healthStatus = getHealthStatus(vibeScore);
  const trustScore = 100 - vibeScore;

  const getHealthColor = () => {
    switch (healthStatus) {
      case "Thriving":
      case "Stable":
        return COLORS.green;
      case "Concerning":
        return COLORS.yellow;
      case "Toxic":
      case "Critical":
        return COLORS.red;
      default:
        return "#888";
    }
  };

  const getTrustScoreColor = () => {
    if (trustScore >= 75) return COLORS.green;
    if (trustScore >= 50) return COLORS.yellow;
    return COLORS.red;
  };

  // LOADING STATE
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: COLORS.dark }}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text className="mt-4" style={{ color: "#555" }}>Loading profile...</Text>
      </View>
    );
  }

  // ERROR STATE - Profile not found
  if (!profile) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: COLORS.dark, paddingTop: insets.top }}
      >
        <View
          className="flex-row items-center px-5 py-4"
          style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            className="flex-row items-center gap-2"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.green} />
            <Text style={{ color: COLORS.green }} className="text-sm">Back</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.red} />
          <Text className="text-xl font-bold mt-4" style={{ color: COLORS.red }}>Profile Not Found</Text>
          <Text className="text-center mt-2" style={{ color: "#555" }}>
            The profile with ID {profileId} could not be loaded.
          </Text>
        </View>
      </View>
    );
  }

  const redCount = logs.filter(l => l.type === "RED").length;
  const yellowCount = logs.filter(l => l.type === "YELLOW").length;
  const greenCount = logs.filter(l => l.type === "GREEN").length;

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: COLORS.dark, paddingTop: insets.top }}
    >
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-5 py-4"
        style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          className="flex-row items-center gap-2"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.green} />
          <Text style={{ color: COLORS.green }} className="text-sm">Back</Text>
        </Pressable>
        <Text className="text-white text-sm font-mono uppercase tracking-wider">Case File</Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={handleGenerateReport}
            disabled={isGeneratingPDF}
            className="rounded-lg px-3 py-2"
            style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.green }}
          >
            {isGeneratingPDF ? (
              <ActivityIndicator size="small" color={COLORS.green} />
            ) : (
              <Ionicons name="document-text" size={18} color={COLORS.green} />
            )}
          </Pressable>
          <Pressable
            onPress={handleOptionsMenu}
            className="rounded-lg px-3 py-2"
            style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#888" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Profile Header - Case File Style */}
        <View className="px-5 py-5" style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface }}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-mono uppercase tracking-wider" style={{ color: "#555" }}>Subject ID</Text>
            <Text className="text-xs font-mono" style={{ color: "#555" }}>#{profile.id.toString().padStart(4, "0")}</Text>
          </View>
          <Text className="text-white text-2xl font-mono font-bold mb-1 tracking-wide">
            {profile.name}
          </Text>
          <Text className="text-xs font-mono uppercase tracking-wider mb-4" style={{ color: "#666" }}>
            Rel: {profile.relationship}
          </Text>

          {/* 2-Column Grid: Trust Score + Flag Counts */}
          <View className="flex-row gap-3">
            {/* Trust Score - Left Column */}
            <View
              className="flex-1 rounded-xl p-4"
              style={{ backgroundColor: COLORS.dark, borderWidth: 1, borderColor: getTrustScoreColor() }}
            >
              <Text className="text-xs font-mono uppercase tracking-wider text-center mb-2" style={{ color: "#555" }}>
                Trust Score
              </Text>
              <Text
                className="text-4xl font-mono font-bold text-center"
                style={{ color: getTrustScoreColor() }}
              >
                {trustScore}%
              </Text>
              <Text className="text-xs font-mono text-center mt-1" style={{ color: "#444" }}>
                {trustScore >= 75 ? "HIGH" : trustScore >= 50 ? "MODERATE" : "LOW"}
              </Text>
            </View>

            {/* Flag Counts - Right Column */}
            <View
              className="flex-1 rounded-xl p-4"
              style={{ backgroundColor: COLORS.dark, borderWidth: 1, borderColor: COLORS.border }}
            >
              <Text className="text-xs font-mono uppercase tracking-wider text-center mb-2" style={{ color: "#555" }}>
                Flag Count
              </Text>
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text className="text-xl font-mono font-bold" style={{ color: COLORS.red }}>
                    {redCount}
                  </Text>
                  <Text className="text-xs font-mono" style={{ color: "#444" }}>RED</Text>
                </View>
                <View className="items-center">
                  <Text className="text-xl font-mono font-bold" style={{ color: COLORS.yellow }}>
                    {yellowCount}
                  </Text>
                  <Text className="text-xs font-mono" style={{ color: "#444" }}>YLW</Text>
                </View>
                <View className="items-center">
                  <Text className="text-xl font-mono font-bold" style={{ color: COLORS.green }}>
                    {greenCount}
                  </Text>
                  <Text className="text-xs font-mono" style={{ color: "#444" }}>GRN</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Status Badge */}
          <View className="mt-4 flex-row items-center justify-between">
            <View
              className="px-3 py-2 rounded-lg"
              style={{ backgroundColor: `${getHealthColor()}15`, borderWidth: 1, borderColor: getHealthColor() }}
            >
              <Text style={{ color: getHealthColor() }} className="text-xs font-mono font-bold uppercase tracking-wider">
                Status: {healthStatus}
              </Text>
            </View>
            <Text className="text-xs font-mono" style={{ color: "#444" }}>
              {logs.length} TOTAL FLAGS
            </Text>
          </View>
        </View>

        {/* AI Premium Features */}
        <View className="px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="sparkles" size={16} style={{ color: COLORS.purple }} />
            <Text className="text-xs font-mono uppercase tracking-widest" style={{ color: "#555" }}>
              AI Analysis (Premium)
            </Text>
          </View>
          <View className="flex-row gap-3">
            <Pressable
              onPress={async () => {
                const limitCheck = await checkLimit("useAI");
                if (!limitCheck.allowed) {
                  Alert.alert(
                    "Upgrade to Premium",
                    "AI-powered insights require a Premium subscription. Get deep behavioral analysis powered by Claude AI.",
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
                if (!canUseAIAnalysis(logs.length)) {
                  Alert.alert(
                    "Need More Data",
                    `AI analysis requires at least ${MIN_LOGS_FOR_AI} logs. You currently have ${logs.length}. Add more behavioral data to unlock AI insights.`
                  );
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("AIInsights", { profileId: profile.id, profileName: profile.name });
              }}
              className="flex-1 rounded-lg p-3"
              style={{
                backgroundColor: `${COLORS.purple}15`,
                borderWidth: 2,
                borderColor: COLORS.purple,
              }}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="analytics" size={20} color={COLORS.purple} />
                <View className="flex-1">
                  <Text className="text-sm font-mono font-bold" style={{ color: COLORS.purple }}>
                    Insights
                  </Text>
                  <Text className="text-xs font-mono" style={{ color: "#666" }}>
                    AI Analysis
                  </Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              onPress={async () => {
                const limitCheck = await checkLimit("useAI");
                if (!limitCheck.allowed) {
                  Alert.alert(
                    "Upgrade to Premium",
                    "AI chat requires a Premium subscription. Ask Claude AI anything about this person's behavior patterns.",
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
                if (!canUseAIAnalysis(logs.length)) {
                  Alert.alert(
                    "Need More Data",
                    `AI chat requires at least ${MIN_LOGS_FOR_AI} logs. You currently have ${logs.length}. Add more behavioral data first.`
                  );
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("AIChat", { profileId: profile.id, profileName: profile.name });
              }}
              className="flex-1 rounded-lg p-3"
              style={{
                backgroundColor: `${COLORS.purple}15`,
                borderWidth: 2,
                borderColor: COLORS.purple,
              }}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="chatbubbles" size={20} color={COLORS.purple} />
                <View className="flex-1">
                  <Text className="text-sm font-mono font-bold" style={{ color: COLORS.purple }}>
                    AI Chat
                  </Text>
                  <Text className="text-xs font-mono" style={{ color: "#666" }}>
                    Ask Questions
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Log History */}
        <View className="px-5 py-4">
          <Text className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "#555" }}>
            &gt;&gt; Incident Log
          </Text>
        </View>

        {logs.length === 0 ? (
          <View className="items-center py-8">
            <Ionicons name="document-text-outline" size={44} color="#333" />
            <Text className="text-base mt-4" style={{ color: "#555" }}>No Flags Logged Yet</Text>
            <Text className="text-xs text-center mt-2 px-6" style={{ color: "#444" }}>
              Start logging flags from the Dashboard to build this profile.
            </Text>
          </View>
        ) : (
          <View style={{ minHeight: logs.length * 100, paddingBottom: insets.bottom + 20 }}>
            {logs.map(log => (
              <LogCard key={log.id} item={log} onDelete={handleDelete} onEdit={handleEditLog} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          style={{ backgroundColor: COLORS.surface }}
        >
          <View
            className="flex-1"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
          >
            {/* Modal Header */}
            <View
              className="flex-row items-center justify-between px-5 py-4"
              style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border }}
            >
              <Pressable onPress={() => setShowEditModal(false)}>
                <Text className="text-base" style={{ color: "#888" }}>Cancel</Text>
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Profile</Text>
              <Pressable
                onPress={handleSaveEdit}
                disabled={!editName.trim()}
                className="px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: editName.trim() ? COLORS.green : COLORS.border,
                }}
              >
                <Text
                  className="font-semibold"
                  style={{ color: editName.trim() ? COLORS.dark : "#555" }}
                >
                  Save
                </Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled">
              {/* Name Input */}
              <View className="mb-6">
                <Text className="text-xs mb-2 uppercase tracking-wider font-mono" style={{ color: "#666" }}>
                  Name
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter name"
                  placeholderTextColor="#444"
                  style={{
                    backgroundColor: COLORS.dark,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: "#ffffff",
                    fontSize: 16,
                  }}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              {/* Relationship Type */}
              <View className="mb-6">
                <Text className="text-xs mb-3 uppercase tracking-wider font-mono" style={{ color: "#666" }}>
                  Relationship Type
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {RELATIONSHIP_TYPES.map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => {
                        setEditRelationship(type);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: editRelationship === type ? COLORS.cyan : COLORS.border,
                        backgroundColor: editRelationship === type ? "rgba(0, 240, 255, 0.1)" : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: editRelationship === type ? COLORS.cyan : "#666",
                        }}
                      >
                        {type}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Log Modal */}
      <Modal
        visible={showEditLogModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditLogModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          style={{ backgroundColor: COLORS.surface }}
        >
          <View
            className="flex-1"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
          >
            {/* Modal Header */}
            <View
              className="flex-row items-center justify-between px-5 py-4"
              style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border }}
            >
              <Pressable onPress={() => setShowEditLogModal(false)}>
                <Text className="text-base" style={{ color: "#888" }}>Cancel</Text>
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Log</Text>
              <Pressable
                onPress={handleSaveLogEdit}
                className="px-4 py-2 rounded-lg"
                style={{ backgroundColor: COLORS.green }}
              >
                <Text className="font-semibold" style={{ color: COLORS.dark }}>
                  Save
                </Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled">
              {editingLog && (
                <>
                  {/* Log Info Display */}
                  <View className="mb-6">
                    <Text className="text-xs mb-2 uppercase tracking-wider font-mono" style={{ color: "#666" }}>
                      Log Details
                    </Text>
                    <View
                      className="p-4 rounded-xl"
                      style={{
                        backgroundColor: COLORS.dark,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                      }}
                    >
                      <View className="flex-row items-center gap-2 mb-2">
                        <Text className="text-xs font-mono" style={{ color: "#666" }}>
                          Type:
                        </Text>
                        <Text
                          className="text-xs font-bold"
                          style={{
                            color:
                              editingLog.type === "GREEN"
                                ? COLORS.green
                                : editingLog.type === "YELLOW"
                                ? COLORS.yellow
                                : COLORS.red,
                          }}
                        >
                          {editingLog.type} FLAG
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2 mb-2">
                        <Text className="text-xs font-mono" style={{ color: "#666" }}>
                          Severity:
                        </Text>
                        <Text className="text-xs" style={{ color: "#999" }}>
                          {editingLog.severity}/10
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2 mb-2">
                        <Text className="text-xs font-mono" style={{ color: "#666" }}>
                          Category:
                        </Text>
                        <Text className="text-xs" style={{ color: "#999" }}>
                          {editingLog.category}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-xs font-mono" style={{ color: "#666" }}>
                          Date:
                        </Text>
                        <Text className="text-xs" style={{ color: "#999" }}>
                          {new Date(editingLog.timestamp).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Notes Input */}
                  <View className="mb-6">
                    <Text className="text-xs mb-2 uppercase tracking-wider font-mono" style={{ color: "#666" }}>
                      Notes
                    </Text>
                    <TextInput
                      value={editLogNotes}
                      onChangeText={setEditLogNotes}
                      placeholder="Add or edit notes..."
                      placeholderTextColor="#444"
                      multiline
                      numberOfLines={6}
                      style={{
                        backgroundColor: COLORS.dark,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        color: "#ffffff",
                        fontSize: 15,
                        minHeight: 120,
                        textAlignVertical: "top",
                      }}
                      autoFocus
                    />
                  </View>

                  {/* Delete Button */}
                  <Pressable
                    onPress={() => handleDeleteLog(editingLog)}
                    className="rounded-xl p-4 items-center mt-4"
                    style={{
                      backgroundColor: "rgba(255, 0, 85, 0.1)",
                      borderWidth: 1,
                      borderColor: COLORS.red,
                    }}
                  >
                    <Text className="font-semibold" style={{ color: COLORS.red }}>
                      Delete Log
                    </Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Profile Options Bottom Sheet */}
      <ProfileOptionsBottomSheet
        visible={showOptionsSheet}
        onClose={() => setShowOptionsSheet(false)}
        onEdit={handleEditProfile}
        onDelete={handleDeleteProfile}
        profileName={profile?.name}
      />
    </View>
  );
}
