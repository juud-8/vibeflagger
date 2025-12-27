import React, { useState, useCallback } from "react";
import { View, Text, Pressable, TextInput, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { getDatabase, type Profile, type RelationshipType } from "../database/db";
import { useSubscriptionStore } from "../state/subscriptionStore";
import type { RootStackParamList } from "../navigation/RootNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Profiles">;

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

const RELATIONSHIP_TYPES: RelationshipType[] = [
  "Partner",
  "Ex",
  "Family",
  "Friend",
  "Boss",
  "Coworker",
  "Other",
];

// STYLED PROFILE CARD - Cyber Cyan Border
function ProfileCard({ profile, onPress }: { profile: Profile; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-5 mb-3 rounded-xl overflow-hidden active:opacity-80"
      style={{
        backgroundColor: COLORS.surface,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.cyan,
        borderWidth: 1,
        borderColor: COLORS.border,
        minHeight: 76,
      }}
    >
      <View className="p-4">
        <Text className="text-white text-lg font-semibold">
          {profile.name}
        </Text>
        <Text className="text-sm mt-1" style={{ color: "#666" }}>
          {profile.relationship}
        </Text>
      </View>
    </Pressable>
  );
}

export function ProfilesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { tier, limits, checkLimit } = useSubscriptionStore();

  // SIMPLE STATE - just raw profiles from DB
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState<RelationshipType>("Partner");

  // DIRECT DATABASE QUERY - NO MIDDLEWARE
  const fetchProfiles = useCallback(async () => {
    try {
      // Get database directly
      const db = await getDatabase();

      // Run raw SELECT query
      const results = await db.getAllAsync<Profile>(
        "SELECT * FROM profiles ORDER BY name ASC"
      );

      // Update state
      setProfiles(results);

    } catch (error: any) {
      Alert.alert("Error", "Failed to load profiles. Please try again.");
    }
  }, []);

  // TRIGGER ON SCREEN FOCUS
  useFocusEffect(
    useCallback(() => {
      fetchProfiles();
    }, [fetchProfiles])
  );

  const handleAddProfile = async () => {
    if (!newName.trim()) {
      Alert.alert("Name Required", "Please enter a name.");
      return;
    }

    try {
      const db = await getDatabase();
      const timestamp = new Date().toISOString();

      await db.runAsync(
        "INSERT INTO profiles (name, relationship, created_at) VALUES (?, ?, ?)",
        [newName.trim(), newRelationship, timestamp]
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setNewName("");
      setNewRelationship("Partner");
      setShowAddModal(false);
      fetchProfiles(); // Refresh list

    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes("UNIQUE constraint")) {
        Alert.alert("Duplicate Name", `"${newName.trim()}" already exists. Try a different name.`);
      } else {
        Alert.alert("Error", "Failed to create profile. Please try again.");
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleProfilePress = (profileId: number) => {
    navigation.navigate("ProfileDetail", { profileId });
  };

  const handleAddProfilePress = async () => {
    // Check profile limit before showing modal
    const limitCheck = await checkLimit("addProfile", profiles.length);

    if (!limitCheck.allowed) {
      Alert.alert(
        "Upgrade Required",
        limitCheck.reason || "You have reached the free tier profile limit.",
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

    setShowAddModal(true);
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: COLORS.dark, paddingTop: insets.top, paddingBottom: insets.bottom }}
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
          <Ionicons name="arrow-back" size={22} color={COLORS.green} />
          <Text style={{ color: COLORS.green }} className="text-sm">Back</Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Ionicons name="book" size={20} color={COLORS.cyan} />
          <Text className="text-white text-lg font-semibold">The Black Book</Text>
        </View>
        <View className="w-16" />
      </View>

      {/* Profile count */}
      <View className="px-5 py-4">
        <Text className="text-xs font-mono" style={{ color: "#555" }}>
          {profiles.length} {profiles.length === 1 ? "profile" : "profiles"} tracked
        </Text>
      </View>

      {/* MAIN CONTENT */}
      {profiles.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="people-outline" size={56} color="#333" />
          <Text className="text-lg mt-4" style={{ color: "#666" }}>No profiles yet</Text>
          <Text className="text-xs text-center mt-2" style={{ color: "#444" }}>
            Add someone to start tracking
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 100 }}
        >
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onPress={() => handleProfilePress(profile.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* Floating Add Button - Square with rounded corners */}
      <Pressable
        onPress={handleAddProfilePress}
        className="absolute bottom-8 right-5 w-14 h-14 rounded-xl items-center justify-center active:opacity-80"
        style={{ backgroundColor: COLORS.green, elevation: 8 }}
      >
        <Ionicons name="add" size={28} color={COLORS.dark} />
      </Pressable>

      {/* Add Profile Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
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
              <Pressable onPress={() => setShowAddModal(false)}>
                <Text className="text-base" style={{ color: "#888" }}>Cancel</Text>
              </Pressable>
              <Text className="text-white text-lg font-semibold">Add Profile</Text>
              <Pressable
                onPress={handleAddProfile}
                disabled={!newName.trim()}
                className="px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: newName.trim() ? COLORS.green : COLORS.border,
                }}
              >
                <Text
                  className="font-semibold"
                  style={{ color: newName.trim() ? COLORS.dark : "#555" }}
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
                  value={newName}
                  onChangeText={setNewName}
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
                        setNewRelationship(type);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: newRelationship === type ? COLORS.cyan : COLORS.border,
                        backgroundColor: newRelationship === type ? "rgba(0, 240, 255, 0.1)" : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: newRelationship === type ? COLORS.cyan : "#666",
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
    </View>
  );
}
