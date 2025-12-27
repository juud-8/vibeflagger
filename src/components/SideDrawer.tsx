import React, { useEffect } from "react";
import { View, Text, Pressable, Modal, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  appVersion?: string;
}

const COLORS = {
  text: "#ffffff",
  textSecondary: "#999",
  background: "#1a1a1f",
  surface: "#0d0d12",
  border: "#222",
  cyan: "#00F0FF",
};

export function SideDrawer({
  visible,
  onClose,
  menuItems,
  appVersion = "v1.0.0",
}: SideDrawerProps) {
  const insets = useSafeAreaInsets();
  const translateX = useSharedValue(-DRAWER_WIDTH);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateX.value = withTiming(-DRAWER_WIDTH, { duration: 250 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleMenuItemPress = (onPress: () => void) => {
    onClose();
    setTimeout(onPress, 100);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        {/* Overlay */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
            },
            overlayStyle,
          ]}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={onClose}
          />
        </Animated.View>

        {/* Drawer */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: DRAWER_WIDTH,
              backgroundColor: COLORS.background,
              shadowColor: "#000",
              shadowOffset: { width: 2, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 10,
              elevation: 10,
            },
            drawerStyle,
          ]}
        >
          {/* Header */}
          <View
            style={{
              paddingTop: insets.top + 20,
              paddingHorizontal: 24,
              paddingBottom: 24,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View>
                <Text
                  style={{
                    color: COLORS.cyan,
                    fontSize: 24,
                    fontWeight: "700",
                    fontFamily: "monospace",
                  }}
                >
                  VibeFlagger
                </Text>
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontSize: 12,
                    marginTop: 4,
                    fontFamily: "monospace",
                  }}
                >
                  SECURE VAULT ACCESS
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: COLORS.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Menu Items */}
          <View style={{ flex: 1, paddingTop: 12 }}>
            {menuItems.map((item, index) => (
              <Pressable
                key={index}
                onPress={() => handleMenuItemPress(item.onPress)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  backgroundColor: pressed ? "rgba(255, 255, 255, 0.05)" : "transparent",
                })}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: COLORS.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 16,
                  }}
                >
                  <Ionicons name={item.icon} size={20} color={COLORS.cyan} />
                </View>
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: 16,
                    fontWeight: "500",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Footer */}
          <View
            style={{
              paddingHorizontal: 24,
              paddingBottom: insets.bottom + 20,
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              paddingTop: 16,
            }}
          >
            <Text
              style={{
                color: COLORS.textSecondary,
                fontSize: 11,
                fontFamily: "monospace",
              }}
            >
              {appVersion}
            </Text>
            <Text
              style={{
                color: COLORS.textSecondary,
                fontSize: 10,
                marginTop: 4,
                fontFamily: "monospace",
              }}
            >
              VIBE-FLAGGER SECURE SYSTEM
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
