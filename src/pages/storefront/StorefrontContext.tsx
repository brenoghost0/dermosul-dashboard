import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { StoreSettings } from "../Store/api";
import type { StorefrontMenu } from "./api";
import { storefrontApi } from "./api";
import {
  FALLBACK_STORE_SETTINGS,
  FALLBACK_HEADER_MENU,
  FALLBACK_FOOTER_MENU,
} from "./fallbackData";

interface StorefrontContextValue {
  settings: StoreSettings | null;
  headerMenu: StorefrontMenu | null;
  footerMenu: StorefrontMenu | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const StorefrontContext = createContext<StorefrontContextValue | undefined>(undefined);

export function StorefrontProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [headerMenu, setHeaderMenu] = useState<StorefrontMenu | null>(null);
  const [footerMenu, setFooterMenu] = useState<StorefrontMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useMemo(
    () =>
      async function () {
        setLoading(true);
        setError(null);
        try {
          const [settingsResponse, header, footer] = await Promise.all([
            storefrontApi.getSettings(),
            storefrontApi.getMenu("HEADER"),
            storefrontApi.getMenu("FOOTER"),
          ]);
          setSettings(settingsResponse);
          setHeaderMenu(header);
          setFooterMenu(footer);
        } catch (err: any) {
          setError(err?.message || "Falha ao carregar dados da store.");
          setSettings(FALLBACK_STORE_SETTINGS);
          setHeaderMenu(FALLBACK_HEADER_MENU);
          setFooterMenu(FALLBACK_FOOTER_MENU);
        } finally {
          setLoading(false);
        }
      },
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const value: StorefrontContextValue = {
    settings,
    headerMenu,
    footerMenu,
    loading,
    error,
    reload: load,
  };

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefrontContext() {
  const context = useContext(StorefrontContext);
  if (!context) {
    throw new Error("useStorefrontContext deve ser utilizado dentro de StorefrontProvider");
  }
  return context;
}
