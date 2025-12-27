import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  revenueCatService,
  type SubscriptionTier,
  type SubscriptionLimits,
  FREE_LIMITS,
} from "../services/RevenueCatService";

interface SubscriptionState {
  tier: SubscriptionTier;
  limits: SubscriptionLimits;
  isLoading: boolean;
  lastUpdated: number | null;

  // Actions
  initialize: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  setTier: (tier: SubscriptionTier, limits: SubscriptionLimits) => void;
  checkLimit: (
    action: "addProfile" | "addLog" | "exportPDF" | "useAI",
    currentCount?: number
  ) => Promise<{ allowed: boolean; reason?: string }>;
}

const STORAGE_KEY = "vibeflagger_subscription_tier";

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: "free",
  limits: FREE_LIMITS,
  isLoading: false,
  lastUpdated: null,

  initialize: async () => {
    set({ isLoading: true });

    try {
      // Try to load cached tier from storage first (for offline support)
      const cachedTier = await AsyncStorage.getItem(STORAGE_KEY);
      if (cachedTier) {
        const tier = cachedTier as SubscriptionTier;
        const limits = await revenueCatService.getLimits();
        set({ tier, limits });
      }

      // Configure RevenueCat
      await revenueCatService.configure();

      // Fetch actual tier from RevenueCat
      const actualTier = await revenueCatService.getCurrentTier();
      const actualLimits = await revenueCatService.getLimits();

      // Update state and cache
      set({
        tier: actualTier,
        limits: actualLimits,
        lastUpdated: Date.now(),
      });

      await AsyncStorage.setItem(STORAGE_KEY, actualTier);
    } catch (error) {
      // On error, default to free tier
      set({
        tier: "free",
        limits: FREE_LIMITS,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshSubscription: async () => {
    set({ isLoading: true });

    try {
      const tier = await revenueCatService.getCurrentTier();
      const limits = await revenueCatService.getLimits();

      set({
        tier,
        limits,
        lastUpdated: Date.now(),
      });

      await AsyncStorage.setItem(STORAGE_KEY, tier);
    } catch (error) {
      // Keep existing state on error
    } finally {
      set({ isLoading: false });
    }
  },

  setTier: (tier: SubscriptionTier, limits: SubscriptionLimits) => {
    set({ tier, limits, lastUpdated: Date.now() });
    AsyncStorage.setItem(STORAGE_KEY, tier);
  },

  checkLimit: async (
    action: "addProfile" | "addLog" | "exportPDF" | "useAI",
    currentCount?: number
  ) => {
    return await revenueCatService.canPerformAction(action, currentCount);
  },
}));
