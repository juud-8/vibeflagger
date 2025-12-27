import React, { useEffect } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

interface ProfileOptionsBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  profileName?: string;
}

const COLORS = {
  red: "#ff0055",
  text: "#ffffff",
  textSecondary: "#999",
  background: "#1a1a1f",
  surface: "#0d0d12",
  border: "#222",
};

export function ProfileOptionsBottomSheet({
  visible,
  onClose,
  onEdit,
  onDelete,
  profileName,
}: ProfileOptionsBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(500);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(500, { duration: 250 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleEdit = () => {
    onClose();
    setTimeout(onEdit, 100);
  };

  const handleDelete = () => {
    onClose();
    setTimeout(onDelete, 100);
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

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: COLORS.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: insets.bottom || 20,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.5,
              shadowRadius: 10,
              elevation: 10,
            },
            sheetStyle,
          ]}
        >
          {/* Handle Bar */}
          <View
            style={{
              alignItems: "center",
              paddingVertical: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: COLORS.border,
                borderRadius: 2,
              }}
            />
          </View>

          {/* Title */}
          {profileName && (
            <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>
              <Text
                style={{
                  color: COLORS.text,
                  fontSize: 18,
                  fontWeight: "600",
                }}
              >
                {profileName}
              </Text>
              <Text
                style={{
                  color: COLORS.textSecondary,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                Profile Options
              </Text>
            </View>
          )}

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: COLORS.border,
              marginVertical: 12,
            }}
          />

          {/* Options */}
          <View style={{ paddingHorizontal: 12 }}>
            {/* Edit Profile */}
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: pressed ? "rgba(255, 255, 255, 0.05)" : "transparent",
              })}
            >
              <Ionicons name="pencil-outline" size={22} color={COLORS.text} />
              <Text
                style={{
                  color: COLORS.text,
                  fontSize: 16,
                  fontWeight: "500",
                  marginLeft: 16,
                }}
              >
                Edit Profile
              </Text>
            </Pressable>

            {/* Delete Profile */}
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: pressed ? "rgba(255, 0, 85, 0.1)" : "transparent",
              })}
            >
              <Ionicons name="trash-outline" size={22} color={COLORS.red} />
              <Text
                style={{
                  color: COLORS.red,
                  fontSize: 16,
                  fontWeight: "500",
                  marginLeft: 16,
                }}
              >
                Delete Profile
              </Text>
            </Pressable>
          </View>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: COLORS.border,
              marginVertical: 12,
            }}
          />

          {/* Cancel Button */}
          <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: pressed ? "rgba(255, 255, 255, 0.05)" : "transparent",
              })}
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              <Text
                style={{
                  color: COLORS.text,
                  fontSize: 16,
                  fontWeight: "700",
                  marginLeft: 8,
                }}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
