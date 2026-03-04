export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8005/api";
export const API_ROOT = API_BASE.replace(/\/api$/, "");

function formatApiErrorDetail(detail) {
  if (!detail) return "Ошибка запроса";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const msg = item.msg || item.message || "";
          const loc = Array.isArray(item.loc) ? item.loc.filter(Boolean).join(".") : "";
          return loc && msg ? `${loc}: ${msg}` : msg || "";
        }
        return "";
      })
      .filter(Boolean);
    return messages.length ? messages.join("; ") : "Ошибка запроса";
  }
  if (typeof detail === "object") {
    return detail.message || detail.msg || JSON.stringify(detail);
  }
  return "Ошибка запроса";
}

export async function apiRequest(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(formatApiErrorDetail(payload.detail));
  }

  return response.json();
}
