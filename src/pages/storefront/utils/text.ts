export function replaceProtocolTerms(text: string): string {
  return text.replace(/protocolos?/gi, (match) => {
    const plural = match.toLowerCase().endsWith("s");
    const replacement = plural ? "cuidados" : "cuidado";
    const isUpper = match[0] === match[0].toUpperCase();
    if (isUpper) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}
