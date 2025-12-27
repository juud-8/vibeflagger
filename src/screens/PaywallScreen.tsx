import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { revenueCatService } from "../services/RevenueCatService";
import { useSubscriptionStore } from "../state/subscriptionStore";

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

interface TierCardProps {
  title: string;
  price: string;
  period: string;
  features: string[];
  isPopular?: boolean;
  onSelect: () => void;
  isSelected: boolean;
  accentColor: string;
}

function TierCard({
  title,
  price,
  period,
  features,
  isPopular,
  onSelect,
  isSelected,
  accentColor,
}: TierCardProps) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect();
      }}
      className="mb-4 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: COLORS.surface,
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? accentColor : COLORS.border,
      }}
    >
      {isPopular && (
        <View
          className="py-1 items-center"
          style={{ backgroundColor: accentColor }}
        >
          <Text
            className="text-xs font-mono font-bold uppercase tracking-wider"
            style={{ color: COLORS.dark }}
          >
            MOST POPULAR
          </Text>
        </View>
      )}

      <View className="p-5">
        <View className="flex-row items-center justify-between mb-3">
          <Text
            className="text-2xl font-mono font-bold"
            style={{ color: accentColor }}
          >
            {title}
          </Text>
          {isSelected && (
            <View
              className="w-6 h-6 rounded-full items-center justify-center"
              style={{ backgroundColor: accentColor }}
            >
              <Ionicons name="checkmark" size={16} color={COLORS.dark} />
            </View>
          )}
        </View>

        <View className="flex-row items-baseline mb-4">
          <Text
            className="text-4xl font-mono font-bold"
            style={{ color: "#fff" }}
          >
            {price}
          </Text>
          <Text className="text-base ml-2 font-mono" style={{ color: "#666" }}>
            /{period}
          </Text>
        </View>

        <View className="space-y-2">
          {features.map((feature, index) => (
            <View key={index} className="flex-row items-start gap-2 mb-2">
              <Ionicons name="checkmark-circle" size={18} color={accentColor} />
              <Text className="flex-1 text-sm" style={{ color: "#ccc" }}>
                {feature}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

export function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const refreshSubscription = useSubscriptionStore((s) => s.refreshSubscription);

  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    setIsLoading(true);
    try {
      const currentOfferings = await revenueCatService.getOfferings();
      setOfferings(currentOfferings);

      // Auto-select the monthly pro package (most common choice)
      if (currentOfferings?.availablePackages) {
        const proMonthly = currentOfferings.availablePackages.find(
          (pkg) => pkg.identifier === "vibeflagger_pro_monthly" || pkg.identifier.includes("monthly")
        );
        if (proMonthly) {
          setSelectedPackage(proMonthly);
        }
      }
    } catch (error) {
      Alert.alert("Error", "Could not load subscription options. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert("Error", "Please select a subscription plan");
      return;
    }

    setIsPurchasing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { tier } = await revenueCatService.purchasePackage(selectedPackage);
      await refreshSubscription();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Success!",
        `You are now subscribed to ${revenueCatService.getTierName(tier)}. Enjoy unlimited access!`,
        [
          {
            text: "Continue",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Handle user cancellation gracefully
      if (error.userCancelled) {
        return;
      }

      Alert.alert(
        "Purchase Failed",
        error.message || "Could not complete purchase. Please try again."
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { tier } = await revenueCatService.restorePurchases();
      await refreshSubscription();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (tier === "free") {
        Alert.alert("No Purchases Found", "No active subscriptions found for this account.");
      } else {
        Alert.alert(
          "Restored!",
          `Your ${revenueCatService.getTierName(tier)} subscription has been restored.`,
          [
            {
              text: "Continue",
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Restore Failed", "Could not restore purchases. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  };

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: COLORS.dark }}
      >
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text className="mt-4" style={{ color: "#555" }}>
          Loading subscriptions...
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: COLORS.dark,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-5 py-4"
        style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border }}
      >
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#888" />
        </Pressable>
        <Text className="text-white text-lg font-mono font-semibold">
          Upgrade
        </Text>
        <View className="w-7" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero Section */}
        <View className="px-5 py-6">
          <View className="items-center mb-6">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{
                backgroundColor: "rgba(0, 255, 156, 0.1)",
                borderWidth: 2,
                borderColor: COLORS.green,
              }}
            >
              <Ionicons name="shield-checkmark" size={40} color={COLORS.green} />
            </View>
            <Text
              className="text-3xl font-mono font-bold text-center mb-2"
              style={{ color: "#fff" }}
            >
              Unlock Full Access
            </Text>
            <Text className="text-center text-base" style={{ color: "#888" }}>
              Track unlimited people, export PDFs, and get AI-powered insights
            </Text>
          </View>

          {/* AI Features Highlight */}
          <View
            className="mx-5 mb-4 rounded-xl p-4"
            style={{
              backgroundColor: "#B026FF20",
              borderWidth: 2,
              borderColor: "#B026FF",
            }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="sparkles" size={24} color="#B026FF" />
                <Text
                  className="text-lg font-mono font-bold"
                  style={{ color: "#B026FF" }}
                >
                  AI-POWERED
                </Text>
              </View>
              <View
                className="px-2 py-1 rounded"
                style={{ backgroundColor: COLORS.green, borderRadius: 4 }}
              >
                <Text
                  className="text-xs font-mono font-bold"
                  style={{ color: COLORS.dark }}
                >
                  NEW
                </Text>
              </View>
            </View>
            <Text className="text-base font-bold mb-2" style={{ color: "#FFF" }}>
              Claude AI Relationship Analysis
            </Text>
            <Text className="text-sm leading-5 mb-3" style={{ color: "#AAA" }}>
              Premium subscribers get access to Claude 3.5 Sonnet AI for deep behavioral analysis. Detect patterns, assess risks, and chat with AI about relationship dynamics.
            </Text>
            <View className="space-y-1">
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={16} color="#B026FF" />
                <Text className="text-xs" style={{ color: "#888" }}>
                  Automated behavioral pattern detection
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={16} color="#B026FF" />
                <Text className="text-xs" style={{ color: "#888" }}>
                  Risk assessment & relationship health scoring
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={16} color="#B026FF" />
                <Text className="text-xs" style={{ color: "#888" }}>
                  Interactive AI chat about any person
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tier Cards */}
        <View className="px-5">
          {/* FREE TIER */}
          <View className="mb-6">
            <View
              className="rounded-2xl p-5"
              style={{
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text
                className="text-xl font-mono font-bold mb-3"
                style={{ color: "#666" }}
              >
                Free
              </Text>
              <Text className="text-3xl font-mono font-bold mb-4" style={{ color: "#fff" }}>
                $0
              </Text>
              <View className="space-y-2">
                <View className="flex-row items-start gap-2 mb-2">
                  <Ionicons name="checkmark-circle" size={18} color="#666" />
                  <Text className="flex-1 text-sm" style={{ color: "#888" }}>
                    Track up to 2 people
                  </Text>
                </View>
                <View className="flex-row items-start gap-2 mb-2">
                  <Ionicons name="checkmark-circle" size={18} color="#666" />
                  <Text className="flex-1 text-sm" style={{ color: "#888" }}>
                    Maximum 25 logs
                  </Text>
                </View>
                <View className="flex-row items-start gap-2 mb-2">
                  <Ionicons name="close-circle" size={18} color={COLORS.red} />
                  <Text className="flex-1 text-sm" style={{ color: "#888" }}>
                    No PDF export
                  </Text>
                </View>
                <View className="flex-row items-start gap-2 mb-2">
                  <Ionicons name="close-circle" size={18} color={COLORS.red} />
                  <Text className="flex-1 text-sm" style={{ color: "#888" }}>
                    No AI insights
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* PRO TIER */}
          <TierCard
            title="Pro"
            price="$4.99"
            period="month"
            isPopular
            accentColor={COLORS.green}
            isSelected={selectedPackage?.identifier.includes("pro") ?? false}
            onSelect={() => {
              const proPackage = offerings?.availablePackages.find((pkg) =>
                pkg.identifier.includes("pro")
              );
              if (proPackage) setSelectedPackage(proPackage);
            }}
            features={[
              "Unlimited people tracking",
              "Unlimited logs",
              "Professional PDF export",
              "All flag types & categories",
              "Advanced analytics",
            ]}
          />

          {/* PREMIUM TIER */}
          <TierCard
            title="Premium"
            price="$11.99"
            period="month"
            accentColor={COLORS.cyan}
            isSelected={selectedPackage?.identifier.includes("premium") ?? false}
            onSelect={() => {
              const premiumPackage = offerings?.availablePackages.find((pkg) =>
                pkg.identifier.includes("premium")
              );
              if (premiumPackage) setSelectedPackage(premiumPackage);
            }}
            features={[
              "Everything in Pro",
              "AI-powered behavioral analysis (Claude AI)",
              "Chat with AI about relationship patterns",
              "Automated risk assessment",
              "Pattern detection & recommendations",
              "Priority support",
            ]}
          />

          {/* Annual Savings Note */}
          <View
            className="mt-4 p-4 rounded-xl"
            style={{
              backgroundColor: "rgba(255, 214, 0, 0.05)",
              borderWidth: 1,
              borderColor: COLORS.yellow,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="information-circle" size={20} color={COLORS.yellow} />
              <Text className="flex-1 text-sm" style={{ color: "#ccc" }}>
                Annual Pro: $49.99/year - Save 17% vs monthly billing
              </Text>
            </View>
          </View>
        </View>

        {/* Purchase Button */}
        <View className="px-5 mt-8">
          <Pressable
            onPress={handlePurchase}
            disabled={!selectedPackage || isPurchasing}
            className="rounded-xl p-5 items-center active:opacity-80"
            style={{
              backgroundColor: selectedPackage ? COLORS.green : COLORS.border,
            }}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color={COLORS.dark} />
            ) : (
              <Text
                className="text-lg font-mono font-bold"
                style={{
                  color: selectedPackage ? COLORS.dark : "#555",
                }}
              >
                {selectedPackage
                  ? `Subscribe for ${selectedPackage.product.priceString}`
                  : "Select a Plan"}
              </Text>
            )}
          </Pressable>

          {/* Restore Purchases */}
          <Pressable
            onPress={handleRestore}
            disabled={isRestoring}
            className="mt-4 p-4 items-center"
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color="#888" />
            ) : (
              <Text className="text-sm font-mono" style={{ color: "#888" }}>
                Restore Purchases
              </Text>
            )}
          </Pressable>

          {/* Legal */}
          <Text
            className="text-xs text-center mt-6 px-4"
            style={{ color: "#444" }}
          >
            Subscriptions auto-renew unless canceled 24 hours before the end of the current
            period. Manage in App Store settings.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
