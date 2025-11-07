import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProductUrl, stripBaseUrlCache } from "../src/lib/url-builder";

function resetEnv() {
  delete process.env.BASE_URL;
  delete process.env.STAGING_BASE_URL;
  delete process.env.DEV_BASE_URL;
}

describe("buildProductUrl", () => {
  afterEach(() => {
    resetEnv();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    stripBaseUrlCache();
  });

  it("prefers window origin when disponível", () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:5174" } } as any);

    const url = buildProductUrl({ slug: "mascara-noite-repair" });

    expect(url).toBe(
      "http://localhost:5174/p/mascara-noite-repair?utm_source=chat&utm_medium=assistente&utm_campaign=recomendacao"
    );
  });

  it("usa BASE_URL quando window não está disponível", () => {
    process.env.BASE_URL = "https://www.minhaloja.com/";

    const url = buildProductUrl({ slug: "serum-controle" });

    expect(url).toBe(
      "https://www.minhaloja.com/p/serum-controle?utm_source=chat&utm_medium=assistente&utm_campaign=recomendacao"
    );
  });

  it("cai para STAGING_BASE_URL quando BASE_URL não existe", () => {
    process.env.STAGING_BASE_URL = "https://staging.minhaloja.com";

    const url = buildProductUrl({ slug: "kit-viagem" });

    expect(url).toBe(
      "https://staging.minhaloja.com/p/kit-viagem?utm_source=chat&utm_medium=assistente&utm_campaign=recomendacao"
    );
  });

  it("retorna caminho relativo e faz log quando nenhuma origem está definida", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const url = buildProductUrl({ slug: "mascara noturna" });

    expect(url).toBe("/p/mascara%20noturna?utm_source=chat&utm_medium=assistente&utm_campaign=recomendacao");
    expect(warnSpy).toHaveBeenCalledWith(
      "[url-builder] BASE_URL/STAGING_BASE_URL/DEV_BASE_URL não configuradas. Retornando caminho relativo."
    );
  });

  it("aceita id quando slug não está disponível", () => {
    process.env.DEV_BASE_URL = "http://127.0.0.1:3000";

    const url = buildProductUrl({ id: "12345" });

    expect(url).toBe(
      "http://127.0.0.1:3000/p/12345?utm_source=chat&utm_medium=assistente&utm_campaign=recomendacao"
    );
  });
});
