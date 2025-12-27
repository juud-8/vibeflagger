import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  SlideInRight,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

const STORAGE_KEY = "hasSeenTutorial";

interface WalkthroughSlide {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}

const SLIDES: WalkthroughSlide[] = [
  {
    id: "1",
    title: "Welcome to Vibe-Flagger",
    description: "Track the health of your relationships with data. Your private vault for relationship intelligence.",
    icon: "shield-checkmark",
    iconColor: COLORS.green,
  },
  {
    id: "2",
    title: "Spot Red Flags",
    description: "Log red flags instantly to track patterns over time. Document toxic behaviors before they escalate.",
    icon: "flag",
    iconColor: COLORS.red,
  },
  {
    id: "3",
    title: "Celebrate Green Flags",
    description: "Don't forget the good times. Log green flags to keep the score balanced and fair.",
    icon: "sparkles",
    iconColor: COLORS.green,
  },
  {
    id: "4",
    title: "The Vibe Score",
    description: "Get a real-time toxicity score based on your history. Data-driven clarity for your relationships.",
    icon: "analytics",
    iconColor: COLORS.cyan,
  },
];

interface WalkthroughModalProps {
  visible: boolean;
  onClose: () => void;
  isManualTrigger?: boolean;
}

function AnimatedDot({ active }: { active: boolean }) {
  const scale = useSharedValue(active ? 1.2 : 1);
  const opacity = useSharedValue(active ? 1 : 0.4);

  useEffect(() => {
    scale.value = withSpring(active ? 1.2 : 1);
    opacity.value = withTiming(active ? 1 : 0.4, { duration: 200 });
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    backgroundColor: active ? COLORS.green : COLORS.border,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 8,
          height: 8,
          borderRadius: 4,
          marginHorizontal: 4,
        },
        animatedStyle,
      ]}
    />
  );
}

function SlideCard({ item, index }: { item: WalkthroughSlide; index: number }) {
  return (
    <Animated.View
      entering={FadeIn.delay(index * 100).duration(400)}
      style={{
        width: SCREEN_WIDTH - 48,
        marginHorizontal: 24,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
      }}
    >
      {/* Icon Container */}
      <View
        style={{
          width: 100,
          height: 100,
          borderRadius: 24,
          backgroundColor: `${item.iconColor}15`,
          borderWidth: 2,
          borderColor: item.iconColor,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
        }}
      >
        <Ionicons name={item.icon} size={48} color={item.iconColor} />
      </View>

      {/* Title */}
      <Text
        style={{
          color: "#fff",
          fontSize: 24,
          fontWeight: "700",
          textAlign: "center",
          marginBottom: 16,
          letterSpacing: 0.5,
        }}
      >
        {item.title}
      </Text>

      {/* Description */}
      <Text
        style={{
          color: "#888",
          fontSize: 16,
          textAlign: "center",
          lineHeight: 24,
          paddingHorizontal: 16,
        }}
      >
        {item.description}
      </Text>
    </Animated.View>
  );
}

export function WalkthroughModal({ visible, onClose, isManualTrigger = false }: WalkthroughModalProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (index >= 0 && index < SLIDES.length) {
      setCurrentIndex(index);
    }
  };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < SLIDES.length) {
      // Update state first, then scroll
      setCurrentIndex(nextIndex);
      // Use scrollToOffset for more reliable scrolling
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    // Only save to AsyncStorage if not manually triggered
    if (!isManualTrigger) {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, "true");
      } catch (error) {
        // Silently fail - tutorial will show again on next launch
      }
    }
    setCurrentIndex(0);
    onClose();
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleSkip}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.dark,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {/* Header with Skip Button */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <Pressable
            onPress={handleSkip}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#666", fontSize: 14 }}>Skip</Text>
          </Pressable>
        </View>

        {/* Carousel */}
        <View style={{ flex: 1, justifyContent: "center" }}>
          <FlatList
            ref={flatListRef}
            data={SLIDES}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <SlideCard item={item} index={index} />
            )}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              // Fallback: scroll to offset if scrollToIndex fails
              const wait = new Promise((resolve) => setTimeout(resolve, 500));
              wait.then(() => {
                flatListRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
              });
            }}
          />
        </View>

        {/* Bottom Controls */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingBottom: 24,
          }}
        >
          {/* Animated Dots */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            {SLIDES.map((_, index) => (
              <AnimatedDot key={index} active={index === currentIndex} />
            ))}
          </View>

          {/* Next/Start Button */}
          <Pressable
            onPress={handleNext}
            disabled={false}
            style={({ pressed }) => ({
              backgroundColor: isLastSlide ? COLORS.green : COLORS.surface,
              borderWidth: isLastSlide ? 0 : 1,
              borderColor: COLORS.green,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: isLastSlide ? COLORS.dark : COLORS.green,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {isLastSlide ? "Start Tracking" : "Next"}
            </Text>
            {!isLastSlide && (
              <Ionicons name="chevron-forward" size={18} color={COLORS.green} />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Hook to manage walkthrough state
export function useWalkthrough() {
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isManualTrigger, setIsManualTrigger] = useState(false);

  useEffect(() => {
    checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const hasSeenTutorial = await AsyncStorage.getItem(STORAGE_KEY);
      if (hasSeenTutorial === null) {
        // First launch - show tutorial
        setShowWalkthrough(true);
        setIsManualTrigger(false);
      }
    } catch (error) {
      // Silently fail - will default to showing tutorial
    } finally {
      setIsLoading(false);
    }
  };

  const openWalkthrough = () => {
    setIsManualTrigger(true);
    setShowWalkthrough(true);
  };

  const closeWalkthrough = () => {
    setShowWalkthrough(false);
    setIsManualTrigger(false);
  };

  return {
    showWalkthrough,
    isLoading,
    isManualTrigger,
    openWalkthrough,
    closeWalkthrough,
  };
}
