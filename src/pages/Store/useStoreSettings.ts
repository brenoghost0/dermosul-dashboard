import { useCallback, useEffect, useState } from "react";
import { storeAdminApi, StoreSettings } from "./api";

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await storeAdminApi.getSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar configurações da loja.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(async (patch: Partial<StoreSettings>) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await storeAdminApi.updateSettings(patch);
      setSettings(updated);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dermosul:store-settings-updated"));
      }
      return updated;
    } catch (err: any) {
      const message = err?.message || "Falha ao salvar configurações.";
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    settings,
    loading,
    error,
    saving,
    reload: load,
    update,
    setSettings,
  };
}
