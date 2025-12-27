import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import { Platform } from "react-native";

// RevenueCat API keys - stored in environment
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_VIBECODE_REVENUECAT_IOS_KEY || "";
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_VIBECODE_REVENUECAT_ANDROID_KEY || "";

// Product IDs configured in RevenueCat dashboard
export const PRODUCT_IDS = {
  PRO_MONTHLY: "vibeflagger_pro_monthly",
  PRO_ANNUAL: "vibeflagger_pro_annual",
  PREMIUM_MONTHLY: "vibeflagger_premium_monthly",
  PREMIUM_ANNUAL: "vibeflagger_premium_annual",
} as const;

// Entitlement identifiers from RevenueCat
export const ENTITLEMENTS = {
  PRO: "pro",
  PREMIUM: "premium",
} as const;

export type SubscriptionTier = "free" | "pro" | "premium";

export interface SubscriptionLimits {
  maxProfiles: number;
  maxLogs: number;
  canExportPDF: boolean;
  hasAIFeatures: boolean;
}

// Free tier limits
export const FREE_LIMITS: SubscriptionLimits = {
  maxProfiles: 2,
  maxLogs: 25,
  canExportPDF: false,
  hasAIFeatures: false,
};

// Pro tier limits
export const PRO_LIMITS: SubscriptionLimits = {
  maxProfiles: Infinity,
  maxLogs: Infinity,
  canExportPDF: true,
  hasAIFeatures: false,
};

// Premium tier limits
export const PREMIUM_LIMITS: SubscriptionLimits = {
  maxProfiles: Infinity,
  maxLogs: Infinity,
  canExportPDF: true,
  hasAIFeatures: true,
};

class RevenueCatService {
  private isConfigured = false;

  /**
   * Initialize RevenueCat SDK
   * Must be called before any other operations
   */
  async configure(userId?: string): Promise<void> {
    if (this.isConfigured) return;

    try {
      const apiKey = Platform.OS === "ios" ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

      if (!apiKey) {
        throw new Error("RevenueCat API key not found in environment variables");
      }

      Purchases.configure({
        apiKey,
        appUserID: userId,
      });

      this.isConfigured = true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current customer info and subscription status
   */
  async getCustomerInfo(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current subscription tier
   */
  async getCurrentTier(): Promise<SubscriptionTier> {
    try {
      const customerInfo = await this.getCustomerInfo();

      // Check for premium entitlement first
      if (
        customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined
      ) {
        return "premium";
      }

      // Check for pro entitlement
      if (customerInfo.entitlements.active[ENTITLEMENTS.PRO] !== undefined) {
        return "pro";
      }

      // Default to free
      return "free";
    } catch (error) {
      // If there's an error, default to free tier
      return "free";
    }
  }

  /**
   * Get subscription limits based on current tier
   */
  async getLimits(): Promise<SubscriptionLimits> {
    const tier = await this.getCurrentTier();

    switch (tier) {
      case "premium":
        return PREMIUM_LIMITS;
      case "pro":
        return PRO_LIMITS;
      default:
        return FREE_LIMITS;
    }
  }

  /**
   * Get available offerings from RevenueCat
   */
  async getOfferings(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      return null;
    }
  }

  /**
   * Purchase a package
   */
  async purchasePackage(pkg: PurchasesPackage): Promise<{
    customerInfo: CustomerInfo;
    tier: SubscriptionTier;
  }> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const tier = await this.getCurrentTier();

      return {
        customerInfo,
        tier,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<{
    customerInfo: CustomerInfo;
    tier: SubscriptionTier;
  }> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const tier = await this.getCurrentTier();

      return {
        customerInfo,
        tier,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if user can perform action based on limits
   */
  async canPerformAction(
    action: "addProfile" | "addLog" | "exportPDF" | "useAI",
    currentCount?: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const limits = await this.getLimits();

    switch (action) {
      case "addProfile":
        if (currentCount === undefined) {
          return { allowed: false, reason: "Current profile count required" };
        }
        if (currentCount >= limits.maxProfiles) {
          return {
            allowed: false,
            reason: `Free tier limited to ${limits.maxProfiles} profiles. Upgrade to Pro for unlimited.`,
          };
        }
        return { allowed: true };

      case "addLog":
        if (currentCount === undefined) {
          return { allowed: false, reason: "Current log count required" };
        }
        if (currentCount >= limits.maxLogs) {
          return {
            allowed: false,
            reason: `Free tier limited to ${limits.maxLogs} logs. Upgrade to Pro for unlimited.`,
          };
        }
        return { allowed: true };

      case "exportPDF":
        if (!limits.canExportPDF) {
          return {
            allowed: false,
            reason: "PDF export requires Pro subscription",
          };
        }
        return { allowed: true };

      case "useAI":
        if (!limits.hasAIFeatures) {
          return {
            allowed: false,
            reason: "AI features require Premium subscription",
          };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: "Unknown action" };
    }
  }

  /**
   * Get user-friendly tier name
   */
  getTierName(tier: SubscriptionTier): string {
    switch (tier) {
      case "premium":
        return "Premium";
      case "pro":
        return "Pro";
      default:
        return "Free";
    }
  }
}

// Export singleton instance
export const revenueCatService = new RevenueCatService();
