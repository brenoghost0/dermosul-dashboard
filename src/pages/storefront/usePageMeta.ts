import { useEffect } from "react";

export type JsonLdInput = Record<string, unknown> | Array<Record<string, unknown>> | string | null | undefined;

export interface PageMetaOptions {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  url?: string | null;
  type?: string | null;
  siteName?: string | null;
  twitterCard?: string | null;
  jsonLd?: JsonLdInput;
}

const serialize = (value: JsonLdInput) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

export function usePageMeta(meta: PageMetaOptions) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const title = meta.title?.trim();
    const description = meta.description?.trim();
    const image = meta.image?.trim();
    const url = meta.url?.trim() || (typeof window !== "undefined" ? window.location.href : undefined);
    const type = meta.type?.trim() || (image ? "article" : "website");
    const siteName = meta.siteName?.trim() || "Dermosul";
    const twitterCard = meta.twitterCard?.trim() || (image ? "summary_large_image" : "summary");

    if (title) {
      document.title = title;
    }

    const ensureMeta = (attr: "name" | "property", name: string, value?: string | null) => {
      const selector = `meta[${attr}=\"${name}\"]`;
      const existing = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!value) {
        if (existing) {
          existing.parentElement?.removeChild(existing);
        }
        return;
      }
      if (existing) {
        existing.setAttribute("content", value);
      } else {
        const element = document.createElement("meta");
        element.setAttribute(attr, name);
        element.setAttribute("content", value);
        document.head.appendChild(element);
      }
    };

    ensureMeta("name", "description", description || null);
    ensureMeta("property", "og:title", title || null);
    ensureMeta("property", "og:description", description || null);
    ensureMeta("property", "og:image", image || null);
    ensureMeta("property", "og:url", url || null);
    ensureMeta("property", "og:type", type || null);
    ensureMeta("property", "og:site_name", siteName || null);
    ensureMeta("name", "twitter:card", twitterCard || null);
    ensureMeta("name", "twitter:title", title || null);
    ensureMeta("name", "twitter:description", description || null);
    ensureMeta("name", "twitter:image", image || null);

    if (url) {
      let canonical = document.head.querySelector("link[rel=\"canonical\"]") as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", url);
    }

    const scriptId = "dermosul-jsonld";
    const jsonLdContent = serialize(meta.jsonLd);
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (jsonLdContent) {
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = jsonLdContent;
    } else if (script) {
      script.parentElement?.removeChild(script);
    }
  }, [JSON.stringify({
    ...meta,
    url: meta.url || (typeof window !== "undefined" ? window.location.pathname : null),
    jsonLd: serialize(meta.jsonLd),
  })]);
}

