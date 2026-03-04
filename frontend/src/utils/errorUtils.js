export function formatUiError(raw, fallback = "Ошибка") {
  if (!raw) return fallback;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return (
      raw
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const msg = item.msg || item.message || "";
            const loc = Array.isArray(item.loc) ? item.loc.filter(Boolean).join(" → ") : "";
            if (loc && msg) return `${loc}: ${msg}`;
            return msg;
          }
          return "";
        })
        .filter(Boolean)
        .join("; ") || fallback
    );
  }
  if (typeof raw === "object") {
    return raw.detail || raw.message || raw.msg || JSON.stringify(raw);
  }
  return fallback;
}

export function sanitizeUiErrorMessage(msg) {
  if (!msg || typeof msg !== "string") return "Произошла ошибка";
  return msg.length > 300 ? msg.slice(0, 300) + "…" : msg;
}
