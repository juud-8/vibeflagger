import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const COLORS = {
  green: "#00FF9C",
  red: "#FF0055",
  cyan: "#00F0FF",
  yellow: "#FFD600",
  dark: "#050508",
  surface: "#0D0D12",
  border: "#1A1A24",
};

interface AIInsightCardProps {
  title: string;
  content: string | string[];
  borderColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  delay?: number;
  collapsible?: boolean;
}

export function AIInsightCard({
  title,
  content,
  borderColor,
  icon,
  delay = 0,
  collapsible = false,
}: AIInsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsible);

  const contentArray = Array.isArray(content) ? content : [content];
  const shouldShowToggle = collapsible && contentArray.length > 2;

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay)} className="mb-4">
      <View
        className="rounded-lg overflow-hidden"
        style={{
          backgroundColor: COLORS.surface,
          borderWidth: 2,
          borderLeftWidth: 4,
          borderColor: COLORS.border,
          borderLeftColor: borderColor,
        }}
      >
        {/* Header */}
        <View className="p-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            <View
              className="w-10 h-10 rounded-lg items-center justify-center"
              style={{
                backgroundColor: `${borderColor}20`,
                borderWidth: 1,
                borderColor: borderColor,
              }}
            >
              <Ionicons name={icon} size={20} color={borderColor} />
            </View>
            <Text
              className="text-base font-mono font-bold uppercase flex-1"
              style={{ color: borderColor, letterSpacing: 1 }}
            >
              {title}
            </Text>
          </View>
          {shouldShowToggle && (
            <Pressable onPress={handleToggle} className="p-2">
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color="#888"
              />
            </Pressable>
          )}
        </View>

        {/* Content */}
        {isExpanded && (
          <View className="px-4 pb-4">
            {contentArray.map((item, index) => (
              <View key={index} className="mb-3 flex-row items-start gap-2">
                <Text
                  className="font-mono text-xs mt-1"
                  style={{ color: borderColor }}
                >
                  {contentArray.length > 1 ? `[${index + 1}]` : "►"}
                </Text>
                <Text
                  className="font-mono text-sm flex-1 leading-5"
                  style={{ color: "#CCC" }}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}
