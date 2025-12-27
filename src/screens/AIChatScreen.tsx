import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  chatAboutPerson,
  canUseAIAnalysis,
  MIN_LOGS_FOR_AI,
  type ChatMessage,
} from "../services/AIInsightsService";
import { getLogsByProfileId, type LogEntry } from "../database/db";
import type { RootStackParamList } from "../navigation/RootNavigator";

type AIChatRouteProp = RouteProp<RootStackParamList, "AIChat">;

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

interface DisplayMessage extends ChatMessage {
  timestamp: Date;
}

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<AIChatRouteProp>();
  const { profileId, profileName } = route.params;

  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    loadData();
  }, [profileId]);

  const loadData = async () => {
    try {
      const profileLogs = await getLogsByProfileId(profileId);
      setLogs(profileLogs);

      if (canUseAIAnalysis(profileLogs.length)) {
        // Add welcome message
        setMessages([
          {
            role: "assistant",
            content: `Ready to analyze ${profileName}. I have access to ${profileLogs.length} behavioral log${profileLogs.length === 1 ? "" : "s"}. Ask me anything about behavior patterns, specific incidents, or relationship dynamics.`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
      Alert.alert("Error", "Failed to load behavioral data. Please try again.");
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    // Check minimum logs
    if (!canUseAIAnalysis(logs.length)) {
      Alert.alert(
        "Not Enough Data",
        `Need at least ${MIN_LOGS_FOR_AI} logs for AI chat. Currently have ${logs.length}.`
      );
      return;
    }

    const userMessage: DisplayMessage = {
      role: "user",
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setLoading(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Build conversation history (exclude timestamps for API)
      const conversationHistory: ChatMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await chatAboutPerson(
        logs,
        profileName,
        userMessage.content,
        conversationHistory
      );

      const aiMessage: DisplayMessage = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Scroll to bottom after AI response
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: any) {
      console.error("Chat error:", err);
      const errorMessage: DisplayMessage = {
        role: "assistant",
        content: err.message || "Failed to process your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    Alert.alert("Clear Chat", "Are you sure you want to clear the chat history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setMessages([
            {
              role: "assistant",
              content: `Chat cleared. Ask me anything about ${profileName}'s behavior patterns.`,
              timestamp: new Date(),
            },
          ]);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  const suggestedQuestions = [
    "What are the main red flags I should be concerned about?",
    "Is this relationship improving or getting worse over time?",
    "What patterns do you see in their communication behavior?",
    "Should I be concerned about this person's behavior?",
    "What does the timeline of incidents tell you?",
  ];

  const handleSuggestedQuestion = (question: string) => {
    setInputText(question);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.dark }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => navigation.goBack()}
            className="mr-4"
            onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <Ionicons name="arrow-back" size={24} style={{ color: COLORS.purple }} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs font-mono" style={{ color: "#666", letterSpacing: 2 }}>
              AI CHAT
            </Text>
            <Text className="text-lg font-mono font-bold" style={{ color: COLORS.purple }}>
              {profileName}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            {messages.length > 1 && (
              <Pressable onPress={handleClearChat}>
                <Ionicons name="trash-outline" size={20} color="#888" />
              </Pressable>
            )}
            <View className="flex-row items-center gap-1">
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.green }} />
              <Text className="text-xs font-mono" style={{ color: "#666" }}>
                ONLINE
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {!canUseAIAnalysis(logs.length) ? (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="chatbubbles-outline" size={64} color="#444" />
            <Text
              className="text-center text-base mt-4 px-6"
              style={{ color: "#666" }}
            >
              Need at least {MIN_LOGS_FOR_AI} logs for AI chat
            </Text>
            <Text className="text-center text-sm mt-2 px-6" style={{ color: "#444" }}>
              Currently have {logs.length} log{logs.length === 1 ? "" : "s"}
            </Text>
          </View>
        ) : (
          <>
            {messages.map((message, index) => (
              <Animated.View
                key={index}
                entering={FadeInDown.delay(index * 50)}
                className={`mb-3 ${message.role === "user" ? "items-end" : "items-start"}`}
              >
                <View
                  className="max-w-[85%] p-3 rounded-lg"
                  style={{
                    backgroundColor:
                      message.role === "user" ? `${COLORS.cyan}20` : COLORS.surface,
                    borderWidth: 2,
                    borderColor: message.role === "user" ? COLORS.cyan : COLORS.border,
                  }}
                >
                  {message.role === "assistant" && (
                    <View className="flex-row items-center gap-2 mb-2">
                      <Ionicons name="sparkles" size={14} style={{ color: COLORS.purple }} />
                      <Text className="text-xs font-mono" style={{ color: COLORS.purple }}>
                        AI ANALYST
                      </Text>
                    </View>
                  )}
                  <Text
                    className="font-mono text-sm leading-5"
                    style={{ color: message.role === "user" ? COLORS.cyan : "#DDD" }}
                  >
                    {message.content}
                  </Text>
                  <Text
                    className="text-xs font-mono mt-2"
                    style={{
                      color: message.role === "user" ? `${COLORS.cyan}80` : "#666",
                    }}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </Animated.View>
            ))}

            {loading && (
              <Animated.View entering={FadeIn} className="items-start mb-3">
                <View
                  className="p-3 rounded-lg flex-row items-center gap-2"
                  style={{
                    backgroundColor: COLORS.surface,
                    borderWidth: 2,
                    borderColor: COLORS.border,
                  }}
                >
                  <ActivityIndicator size="small" color={COLORS.purple} />
                  <Text className="font-mono text-sm" style={{ color: "#888" }}>
                    Analyzing patterns...
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Suggested Questions (show only if few messages) */}
            {messages.length <= 2 && !loading && (
              <View className="mt-4">
                <Text
                  className="text-xs font-mono mb-3"
                  style={{ color: "#666", letterSpacing: 2 }}
                >
                  SUGGESTED QUESTIONS
                </Text>
                {suggestedQuestions.map((question, index) => (
                  <Pressable
                    key={index}
                    onPress={() => handleSuggestedQuestion(question)}
                    className="mb-2"
                    onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                  >
                    <View
                      className="p-3 rounded-lg flex-row items-center gap-2"
                      style={{
                        backgroundColor: `${COLORS.purple}10`,
                        borderWidth: 1,
                        borderColor: `${COLORS.purple}40`,
                      }}
                    >
                      <Ionicons
                        name="help-circle-outline"
                        size={16}
                        style={{ color: COLORS.purple }}
                      />
                      <Text
                        className="font-mono text-xs flex-1"
                        style={{ color: COLORS.purple }}
                      >
                        {question}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        style={{ color: COLORS.purple }}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View
          style={{
            paddingBottom: insets.bottom + 12,
            paddingTop: 12,
            paddingHorizontal: 16,
            backgroundColor: COLORS.surface,
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
          }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="flex-1 flex-row items-center px-4 py-3 rounded-lg"
              style={{
                backgroundColor: COLORS.dark,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={`Ask me anything about ${profileName}...`}
                placeholderTextColor="#555"
                className="flex-1 font-mono text-sm"
                style={{ color: "#FFF" }}
                multiline
                maxLength={500}
                onSubmitEditing={handleSend}
                editable={!loading && canUseAIAnalysis(logs.length)}
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || loading || !canUseAIAnalysis(logs.length)}
              className="w-12 h-12 rounded-lg items-center justify-center"
              style={{
                backgroundColor:
                  inputText.trim() && !loading && canUseAIAnalysis(logs.length)
                    ? COLORS.purple
                    : COLORS.border,
              }}
              onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.dark} />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={
                    inputText.trim() && canUseAIAnalysis(logs.length)
                      ? COLORS.dark
                      : "#555"
                  }
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
