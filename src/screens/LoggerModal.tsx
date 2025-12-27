import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  insertLog,
  getAllProfiles,
  createProfile,
  type LogType,
  type LogCategory,
  type Profile,
  type RelationshipType,
} from "../database/db";

type LoggerRouteProp = RouteProp<RootStackParamList, "Logger">;

const CATEGORIES: LogCategory[] = [
  "Communication",
  "Money",
  "Intimacy",
  "Trust",
  "Other",
];

const RELATIONSHIP_TYPES: RelationshipType[] = [
  "Partner",
  "Ex",
  "Family",
  "Friend",
  "Boss",
  "Coworker",
  "Other",
];

function getDefaultSeverity(flagType: LogType): number {
  switch (flagType) {
    case "RED":
      return 1;
    case "YELLOW":
      return 5;
    case "GREEN":
      return 10;
  }
}

export function LoggerModal() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<LoggerRouteProp>();
  const { flagType } = route.params;

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [showNewProfileModal, setShowNewProfileModal] = useState(false);

  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileRelationship, setNewProfileRelationship] = useState<RelationshipType>("Partner");

  const [category, setCategory] = useState<LogCategory>("Communication");
  const [severity, setSeverity] = useState(getDefaultSeverity(flagType));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const notesInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    const allProfiles = await getAllProfiles();
    setProfiles(allProfiles);
  };

  const getTypeColor = () => {
    switch (flagType) {
      case "GREEN":
        return "#00ff88";
      case "YELLOW":
        return "#ffaa00";
      case "RED":
        return "#ff4444";
    }
  };

  const getTypeEmoji = () => {
    switch (flagType) {
      case "GREEN":
        return "✨";
      case "YELLOW":
        return "⚠️";
      case "RED":
        return "🚩";
    }
  };

  const getTypeLabel = () => {
    switch (flagType) {
      case "GREEN":
        return "Green Flag";
      case "YELLOW":
        return "Yellow Alert";
      case "RED":
        return "Red Flag";
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      Alert.alert("Name Required", "Please enter a name.");
      return;
    }

    try {
      const profileId = await createProfile({
        name: newProfileName.trim(),
        relationship: newProfileRelationship,
      });
      await loadProfiles();

      const newProfile = profiles.find(p => p.id === profileId) || {
        id: profileId,
        name: newProfileName.trim(),
        relationship: newProfileRelationship,
        created_at: new Date().toISOString(),
      };

      setSelectedProfile(newProfile);
      setNewProfileName("");
      setNewProfileRelationship("Partner");
      setShowNewProfileModal(false);
      setShowProfilePicker(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Error", "Failed to create profile. Name might already exist.");
    }
  };

  const handleSave = async () => {
    if (!selectedProfile) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Person Required", "Please select a person.");
      return;
    }

    setSaving(true);
    try {
      await insertLog({
        person: selectedProfile.name,
        profile_id: selectedProfile.id,
        type: flagType,
        severity,
        category,
        notes: notes.trim() || undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to save log. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleNotesFocus = () => {
    // Scroll to notes input when keyboard opens
    // Use a delay to ensure keyboard animation has started
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, Platform.OS === "ios" ? 300 : 100);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#1F2937" }}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 24,
              paddingTop: insets.top + 16,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#374151",
            }}
          >
            <Pressable onPress={() => navigation.goBack()}>
              <Text style={{ color: "#ffffff", fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 24 }}>{getTypeEmoji()}</Text>
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "600" }}>
                {getTypeLabel()}
              </Text>
            </View>
            <Pressable
              onPress={handleSave}
              disabled={saving || !selectedProfile}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: selectedProfile ? "#00ff88" : "#4B5563",
              }}
            >
              <Text
                style={{
                  fontWeight: "600",
                  color: selectedProfile ? "#000000" : "#9CA3AF",
                }}
              >
                {saving ? "..." : "Save"}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 200 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
              {/* Person Dropdown */}
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 12,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Person
                </Text>
                <Pressable
                  onPress={() => setShowProfilePicker(true)}
                  style={{
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: selectedProfile ? "#ffffff" : "#6B7280", fontSize: 16 }}>
                    {selectedProfile ? selectedProfile.name : "Select person"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </Pressable>
              </View>

              {/* Category */}
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 12,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Category
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        setCategory(cat);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor:
                          category === cat ? "#00ff88" : "rgba(255, 255, 255, 0.2)",
                        backgroundColor:
                          category === cat ? "rgba(0, 255, 136, 0.1)" : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: category === cat ? "#00ff88" : "#9CA3AF",
                        }}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Severity */}
              <View style={{ marginBottom: 24 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Severity
                  </Text>
                  <Text
                    style={{
                      color: getTypeColor(),
                      fontSize: 18,
                      fontWeight: "700",
                    }}
                  >
                    {severity}/10
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: "#374151",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <Slider
                    value={severity}
                    onValueChange={(val) => setSeverity(Math.round(val))}
                    minimumValue={1}
                    maximumValue={10}
                    step={1}
                    minimumTrackTintColor={getTypeColor()}
                    maximumTrackTintColor="#4B5563"
                    thumbTintColor={getTypeColor()}
                    style={{ width: "100%", height: 40 }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ color: "#6B7280", fontSize: 12 }}>Mild</Text>
                    <Text style={{ color: "#6B7280", fontSize: 12 }}>Severe</Text>
                  </View>
                </View>
              </View>

              {/* Notes */}
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 12,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Notes (Optional)
                </Text>
                <TextInput
                  ref={notesInputRef}
                  value={notes}
                  onChangeText={setNotes}
                  onFocus={handleNotesFocus}
                  placeholder="What happened?"
                  placeholderTextColor="#6B7280"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={{
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    color: "#ffffff",
                    fontSize: 16,
                    minHeight: 120,
                  }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* Profile Picker Modal */}
      <Modal
        visible={showProfilePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfilePicker(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#1F2937",
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 24,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#374151",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "600" }}>
              Select Person
            </Text>
            <Pressable onPress={() => setShowProfilePicker(false)}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
          </View>

          <ScrollView>
            <Pressable
              onPress={() => {
                setShowProfilePicker(false);
                setShowNewProfileModal(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#374151",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#00ff88",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="add" size={24} color="#000" />
              </View>
              <Text style={{ color: "#00ff88", fontSize: 16, fontWeight: "600" }}>
                Add New Person
              </Text>
            </Pressable>

            {profiles.map((profile) => (
              <Pressable
                key={profile.id}
                onPress={() => {
                  setSelectedProfile(profile);
                  setShowProfilePicker(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: "#374151",
                }}
              >
                <View>
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "500" }}>
                    {profile.name}
                  </Text>
                  <Text style={{ color: "#6B7280", fontSize: 14, marginTop: 2 }}>
                    {profile.relationship}
                  </Text>
                </View>
                {selectedProfile?.id === profile.id && (
                  <Ionicons name="checkmark-circle" size={24} color="#00ff88" />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* New Profile Modal */}
      <Modal
        visible={showNewProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewProfileModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            backgroundColor: "#1F2937",
          }}
        >
          <View
            style={{
              flex: 1,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#374151",
              }}
            >
              <Pressable onPress={() => setShowNewProfileModal(false)}>
                <Text style={{ color: "#ffffff", fontSize: 16 }}>Cancel</Text>
              </Pressable>
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "600" }}>
                Add Person
              </Text>
              <Pressable
                onPress={handleCreateProfile}
                disabled={!newProfileName.trim()}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: newProfileName.trim() ? "#00ff88" : "#4B5563",
                }}
              >
                <Text
                  style={{
                    fontWeight: "600",
                    color: newProfileName.trim() ? "#000000" : "#9CA3AF",
                  }}
                >
                  Save
                </Text>
              </Pressable>
            </View>

            <ScrollView style={{ paddingHorizontal: 24, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 12,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Name
                </Text>
                <TextInput
                  value={newProfileName}
                  onChangeText={setNewProfileName}
                  placeholder="Enter name"
                  placeholderTextColor="#6B7280"
                  style={{
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    color: "#ffffff",
                    fontSize: 16,
                  }}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 12,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Relationship Type
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {RELATIONSHIP_TYPES.map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => {
                        setNewProfileRelationship(type);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor:
                          newProfileRelationship === type ? "#00ff88" : "rgba(255, 255, 255, 0.2)",
                        backgroundColor:
                          newProfileRelationship === type ? "rgba(0, 255, 136, 0.1)" : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: newProfileRelationship === type ? "#00ff88" : "#9CA3AF",
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
    </KeyboardAvoidingView>
  );
}
