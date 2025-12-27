import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthState {
  isAuthenticated: boolean;
  pin: string | null;
  hasBiometrics: boolean;
  setAuthenticated: (value: boolean) => void;
  setPin: (pin: string) => Promise<void>;
  loadPin: () => Promise<void>;
  setHasBiometrics: (value: boolean) => void;
  logout: () => void;
}

const PIN_STORAGE_KEY = "vibeflagger_pin";

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  pin: null,
  hasBiometrics: false,

  setAuthenticated: (value: boolean) => set({ isAuthenticated: value }),

  setPin: async (pin: string) => {
    await AsyncStorage.setItem(PIN_STORAGE_KEY, pin);
    set({ pin });
  },

  loadPin: async () => {
    const storedPin = await AsyncStorage.getItem(PIN_STORAGE_KEY);
    set({ pin: storedPin });
  },

  setHasBiometrics: (value: boolean) => set({ hasBiometrics: value }),

  logout: () => set({ isAuthenticated: false }),
}));
