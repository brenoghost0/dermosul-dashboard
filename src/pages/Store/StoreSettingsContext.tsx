import { createContext, useContext } from "react";
import type { StoreSettings } from "./api";
import { useStoreSettings } from "./useStoreSettings";

export interface StoreSettingsContextValue {
  settings: StoreSettings | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  reload: () => Promise<void> | void;
  update: (patch: Partial<StoreSettings>) => Promise<StoreSettings>;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings | null>>;
}

const StoreSettingsContext = createContext<StoreSettingsContextValue | undefined>(undefined);

export function StoreSettingsProvider({ children }: { children: React.ReactNode }) {
  const store = useStoreSettings();
  return <StoreSettingsContext.Provider value={store}>{children}</StoreSettingsContext.Provider>;
}

export function useStoreSettingsContext() {
  const context = useContext(StoreSettingsContext);
  if (!context) {
    throw new Error("useStoreSettingsContext deve ser utilizado dentro de StoreSettingsProvider");
  }
  return context;
}

