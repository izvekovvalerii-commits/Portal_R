import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { API_ROOT, apiRequest } from "./api";
import { useAuth } from "./hooks/useAuth";
import {
  TOKEN_KEY,
  THEME_KEY_PREFIX,
  SIDEBAR_WIDTH_KEY,
  WIDGET_LAYOUT_KEY_PREFIX,
  COLUMN_WIDTHS_KEY_PREFIX,
  VISIBLE_WIDGETS_KEY_PREFIX,
  SHOW_PORTALS_SLIDER_KEY_PREFIX,
  PORTALS_VIEW_MODE_KEY_PREFIX,
  PORTALS_FAVORITES_KEY_PREFIX,
  PORTALS_HIDDEN_KEY_PREFIX,
  WIDGET_MIN_SPAN,
  WIDGET_MAX_SPAN,
  WIDGET_SPAN_STEPS,
  DESKTOP_COLUMNS,
  DEFAULT_COLUMN_WIDTHS,
  DROP_POSITION_STICKINESS_PX,
} from "./constants";
import { toDateKey, fromDateKey, buildMonthDays, slotToMinutes, minutesToLabel } from "./utils/dateUtils";
import {
  snapWidgetSpan,
  getWidgetSizeUnits,
  getWidgetSizeLabel,
  getWidgetSizeIcon,
  getNextWidgetSpan,
  normalizeColumnWidths,
  getDefaultWidgetRowSpan,
  normalizeWidget,
  buildWidgetBlocks,
  applyWidgetDrop,
  parseDropZoneId,
  detectDropPositionByPoint,
} from "./utils/widgetUtils";
import { getAvatarFocusLimits, cropImageToAvatarBlob } from "./utils/imageUtils";
import { formatUiError, sanitizeUiErrorMessage } from "./utils/errorUtils";
import { readStoredWidth, readStoredJson, writeStoredJson } from "./utils/storageUtils";
import MapWidget from "./components/MapWidget";
import OrionLogo from "./components/OrionLogo";
import { PYATEROCHKA_STORES } from "./data/pyaterochkaStores";

const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 21;
const ACTIVITY_TARGET_HOURS = 6;

const PORTAL_ICON_META = {
  "Платформа развития ТСЧ": { image: "/portal-tsch-logo.png", displayTitle: "Портал развития ТСЧ", color: "transparent", accent: "#003366" },
  "Портал по взаимодействию с Росреестром": { icon: "📜", color: "linear-gradient(135deg,#2f73ff,#1f67f1)", accent: "#2f73ff" },
  "Портал ИК ТСБ": { image: "/portal-ik-ts5.png", displayTitle: "Портал ИК ТС5", color: "transparent", accent: "#c27700" },
  "Портал ИК ТС5": { image: "/portal-ik-ts5.png", displayTitle: "Портал ИК ТС5", color: "transparent", accent: "#c27700" },
  "X5 Nova Partner": { icon: "🤝", color: "linear-gradient(135deg,#af5bff,#9640f0)", accent: "#8b5cf6" },
  "ДизайнТ": { icon: "🎨", color: "linear-gradient(135deg,#e91e63,#c2185b)", accent: "#b91c4a" },
  "База Знаний": { icon: "📚", color: "linear-gradient(135deg,#00bcd4,#0097a7)", accent: "#0891a2" },
  "IT Поддержка": { icon: "🖥", color: "linear-gradient(135deg,#607d8b,#455a64)", accent: "#546e7a" },
  "Аренда в Пятёрочке": { icon: "🏪", color: "linear-gradient(135deg,#f44336,#d32f2f)", accent: "#b71c1c" },
  "Франчайзинг Пятёрочка": { icon: "🏬", color: "linear-gradient(135deg,#ff5722,#e64a19)", accent: "#e64a19" },
  "Портал аренды Чижик": { image: "/chizhik-logo.png", color: "transparent", accent: "#d4970f" },
  "Поиск и оценка": { icon: "🔍", color: "linear-gradient(135deg,#4caf50,#388e3c)", accent: "#2e7d32" },
  "Проектирование": { icon: "📐", color: "linear-gradient(135deg,#9c27b0,#7b1fa2)", accent: "#7b1fa2" },
  "Управление проектами": { icon: "📅", color: "linear-gradient(135deg,#3f51b5,#303f9f)", accent: "#3949ab" },
  "Партнеры": { icon: "🏭", color: "linear-gradient(135deg,#795548,#5d4037)", accent: "#5d4037" },
  "Лицензирование": { icon: "📄", color: "linear-gradient(135deg,#009688,#00796b)", accent: "#00695c" },
  "Взаимодействие с Росреестром": { icon: "🏛️", color: "linear-gradient(135deg,#1976d2,#1565c0)", accent: "#1565c0" },
  "Портал ИК ТСХ": { image: "/portal-gis-ik-tsh-icon.png", color: "transparent", accent: "#3949ab" },
  "АСКО ТС5": { icon: "🏗️", color: "linear-gradient(135deg,#43a047,#2e7d32)", accent: "#2e7d32" },
  "АСКО ТСХ": { icon: "🏗️", color: "linear-gradient(135deg,#2e7d32,#1b5e20)", accent: "#2e7d32" },
  "СЭД ТС5": { icon: "📄", color: "linear-gradient(135deg,#1565c0,#0d47a1)", accent: "#1565c0" },
  "СЭД ТСЧ": { icon: "📄", color: "linear-gradient(135deg,#1565c0,#0d47a1)", accent: "#1565c0" },
  "СЭД ТСХ": { icon: "📄", color: "linear-gradient(135deg,#1565c0,#0d47a1)", accent: "#1565c0" },
  "Сфера": { icon: "🔮", color: "linear-gradient(135deg,#6a1b9a,#4a148c)", accent: "#6a1b9a" },
  "ГИС ТС5": { icon: "🗺️", color: "linear-gradient(135deg,#0d47a1,#1565c0)", accent: "#1565c0" },
  "ГИС ТСХ": { image: "/portal-gis-ik-tsh-icon.png", color: "transparent", accent: "#1565c0" },
  "ГИС ТСЧ": { icon: "🗺️", color: "linear-gradient(135deg,#0d47a1,#1565c0)", accent: "#1565c0" },
};

const PORTAL_LINK_META = {};

const LICENSING_PORTAL_TITLE = "Лицензирование";
const LICENSING_IFRAME_URL = "https://lc.x5.ru/#/references";
const LICENSING_PORTAL_ID = "licensing";

const LICENSING_CANONICAL_ENTRY = {
  id: LICENSING_PORTAL_ID,
  title: LICENSING_PORTAL_TITLE,
  url: LICENSING_IFRAME_URL,
  category: "Сервисы",
  description: "Портал лицензирования",
  status: "Доступен",
};

const ROSREESTR_PORTAL_TITLE = "Взаимодействие с Росреестром";
const ROSREESTR_IFRAME_URL = "https://rosreestr.x5.ru/";
const ROSREESTR_PORTAL_ID = "rosreestr";

const ROSREESTR_CANONICAL_ENTRY = {
  id: ROSREESTR_PORTAL_ID,
  title: ROSREESTR_PORTAL_TITLE,
  url: ROSREESTR_IFRAME_URL,
  category: "Сервисы",
  description: "Портал взаимодействия с Росреестром",
  status: "Доступен",
};

function isLicensingCatalogItem(item) {
  if (!item) return false;
  const t = (item.title || "").trim().toLowerCase();
  const u = (item.url || "").toLowerCase();
  return (
    t.includes("лицензирование") ||
    t === "licensing" ||
    u.includes("lc.x5.ru") ||
    u.includes("localhost:5190")
  );
}

function isRosreestrCatalogItem(item) {
  if (!item) return false;
  const t = (item.title || "").trim().toLowerCase();
  const u = (item.url || "").toLowerCase();
  return (
    t.includes("росреестр") ||
    t.includes("rosreestr") ||
    u.includes("rosreestr.x5.ru")
  );
}

const PORTAL_IK_TSH_TITLE = "Портал ИК ТСХ";
const PORTAL_IK_TSH_IFRAME_URL = "https://mikx.x5.ru/";
const PORTAL_IK_TSH_ID = "portal-ik-tsh";

const PORTAL_IK_TSH_CANONICAL_ENTRY = {
  id: PORTAL_IK_TSH_ID,
  title: PORTAL_IK_TSH_TITLE,
  url: PORTAL_IK_TSH_IFRAME_URL,
  category: "Сервисы",
  description: "Портал ИК ТСХ",
  status: "Доступен",
};

function isPortalIKTSHCatalogItem(item) {
  if (!item) return false;
  const t = (item.title || "").trim().toLowerCase();
  const u = (item.url || "").toLowerCase();
  return (
    t.includes("ик тсх") ||
    u.includes("mikx.x5.ru")
  );
}

const ASKO_TS5_PORTAL_TITLE = "АСКО ТС5";
const ASKO_TS5_IFRAME_URL = "https://ko1.x5.ru/";
const ASKO_TS5_PORTAL_ID = "asko-ts5";

const ASKO_TS5_CANONICAL_ENTRY = {
  id: ASKO_TS5_PORTAL_ID,
  title: ASKO_TS5_PORTAL_TITLE,
  url: ASKO_TS5_IFRAME_URL,
  category: "Сервисы",
  description: "Портал АСКО ТС5",
  status: "Доступен",
};

function isAskoTS5CatalogItem(item) {
  if (!item) return false;
  const t = (item.title || "").trim().toLowerCase();
  const u = (item.url || "").toLowerCase();
  return (
    t.includes("аско тс5") ||
    t.includes("asko ts5") ||
    u.includes("ko1.x5.ru")
  );
}

const ASKO_TSH_TITLE = "АСКО ТСХ";
const ASKO_TSH_IFRAME_URL = "https://ko1.x5.ru/";
const ASKO_TSH_ID = "asko-tsh";

const ASKO_TSH_CANONICAL_ENTRY = {
  id: ASKO_TSH_ID,
  title: ASKO_TSH_TITLE,
  url: ASKO_TSH_IFRAME_URL,
  category: "Сервисы",
  description: "Портал АСКО ТСХ",
  status: "Доступен",
};

function isAskoTSHCatalogItem(item) {
  if (!item) return false;
  const t = (item.title || "").trim().toLowerCase();
  const u = (item.url || "").toLowerCase();
  return t.includes("аско тсх") || u.includes("ko1-tsh.x5.ru");
}

const SED_IFRAME_URL = "https://sed.x5.ru";
const SED_TS5_TITLE = "СЭД ТС5";
const SED_TS5_ID = "sed-ts5";
const SED_TSCH_TITLE = "СЭД ТСЧ";
const SED_TSCH_ID = "sed-tsch";
const SED_TSH_TITLE = "СЭД ТСХ";
const SED_TSH_ID = "sed-tsh";

const SED_TS5_CANONICAL_ENTRY = {
  id: SED_TS5_ID,
  title: SED_TS5_TITLE,
  url: SED_IFRAME_URL,
  category: "Сервисы",
  description: "Система электронного документооборота ТС5",
  status: "Доступен",
};

const SED_TSCH_CANONICAL_ENTRY = {
  id: SED_TSCH_ID,
  title: SED_TSCH_TITLE,
  url: SED_IFRAME_URL,
  category: "Сервисы",
  description: "Система электронного документооборота ТСЧ",
  status: "Доступен",
};

const SED_TSH_CANONICAL_ENTRY = {
  id: SED_TSH_ID,
  title: SED_TSH_TITLE,
  url: SED_IFRAME_URL,
  category: "Сервисы",
  description: "Система электронного документооборота ТСХ",
  status: "Доступен",
};

function isSedCatalogItem(item) {
  if (!item) return false;
  const t = (item.title || "").trim().toLowerCase();
  const u = (item.url || "").toLowerCase();
  return (
    t.includes("сэд тс5") ||
    t.includes("сэд тсч") ||
    t.includes("сэд тсх") ||
    u.includes("sed.x5.ru")
  );
}

function normalizeCatalogWithSingleLicensing(catalog) {
  if (!Array.isArray(catalog)) return [LICENSING_CANONICAL_ENTRY, ROSREESTR_CANONICAL_ENTRY, PORTAL_IK_TSH_CANONICAL_ENTRY, ASKO_TS5_CANONICAL_ENTRY, ASKO_TSH_CANONICAL_ENTRY, SED_TS5_CANONICAL_ENTRY, SED_TSCH_CANONICAL_ENTRY, SED_TSH_CANONICAL_ENTRY, SFERA_CANONICAL_ENTRY, GIS_TS5_CANONICAL_ENTRY, GIS_TSH_CANONICAL_ENTRY, GIS_TSCH_CANONICAL_ENTRY];
  const licensingFromCatalog = catalog.find(isLicensingCatalogItem);
  const singleLicensing = {
    ...LICENSING_CANONICAL_ENTRY,
    id: licensingFromCatalog ? String(licensingFromCatalog.id) : LICENSING_PORTAL_ID,
  };
  const rosreestrFromCatalog = catalog.find(isRosreestrCatalogItem);
  const singleRosreestr = {
    ...ROSREESTR_CANONICAL_ENTRY,
    id: rosreestrFromCatalog ? String(rosreestrFromCatalog.id) : ROSREESTR_PORTAL_ID,
  };
  const ikTshFromCatalog = catalog.find(isPortalIKTSHCatalogItem);
  const singleIKTSH = {
    ...PORTAL_IK_TSH_CANONICAL_ENTRY,
    id: ikTshFromCatalog ? String(ikTshFromCatalog.id) : PORTAL_IK_TSH_ID,
  };
  const askoTS5FromCatalog = catalog.find(isAskoTS5CatalogItem);
  const singleAskoTS5 = {
    ...ASKO_TS5_CANONICAL_ENTRY,
    id: askoTS5FromCatalog ? String(askoTS5FromCatalog.id) : ASKO_TS5_PORTAL_ID,
  };
  const withoutLicensing = catalog.filter((item) => !isLicensingCatalogItem(item));
  const withoutBoth = withoutLicensing.filter((item) => !isRosreestrCatalogItem(item));
  const withoutThree = withoutBoth.filter((item) => !isPortalIKTSHCatalogItem(item));
  const withoutFour = withoutThree.filter((item) => !isAskoTS5CatalogItem(item));
  const withoutAskoTsh = withoutFour.filter((item) => !isAskoTSHCatalogItem(item));
  const withoutSed = withoutAskoTsh.filter((item) => !isSedCatalogItem(item));
  const withoutSfera = withoutSed.filter((item) => !isSferaCatalogItem(item));
  const withoutGis = withoutSfera.filter((item) => !isGisCatalogItem(item));
  return [...withoutGis, singleLicensing, singleRosreestr, singleIKTSH, singleAskoTS5, ASKO_TSH_CANONICAL_ENTRY, SED_TS5_CANONICAL_ENTRY, SED_TSCH_CANONICAL_ENTRY, SED_TSH_CANONICAL_ENTRY, SFERA_CANONICAL_ENTRY, GIS_TS5_CANONICAL_ENTRY, GIS_TSH_CANONICAL_ENTRY, GIS_TSCH_CANONICAL_ENTRY];
}

const PLATFORM_TSCH_PORTAL_TITLE = "Портал развития ТСЧ";
const PLATFORM_TSCH_IFRAME_URL = "https://proto1.pr4.x5.ru/";

const PORTAL_IK_TSB_TITLE = "Портал ИК ТСБ";
const PORTAL_IK_TSB_IFRAME_URL = "https://mik5.x5.ru/";

const ARENDA_PYATEROCHKA_TITLE = "Аренда в Пятёрочке";
const ARENDA_PYATEROCHKA_IFRAME_URL = "https://backofficefrontend9d3ee-rentplamform8b3f8.dev.dev.x5.ru/";

const IT_SUPPORT_TITLE = "IT Поддержка";
const IT_SUPPORT_IFRAME_URL = "https://support.x5.ru/";

const SFERA_TITLE = "Сфера";
const SFERA_IFRAME_URL = "https://sfera.x5.ru";
const SFERA_ID = "sfera";

const SFERA_CANONICAL_ENTRY = {
  id: SFERA_ID,
  title: SFERA_TITLE,
  url: SFERA_IFRAME_URL,
  category: "Сервисы",
  description: "Портал Сфера",
  status: "Доступен",
};

function isSferaCatalogItem(item) {
  if (!item) return false;
  const t = (item.title || "").trim().toLowerCase();
  const u = (item.url || "").toLowerCase();
  return t.includes("сфера") || u.includes("sfera.x5.ru");
}

const GIS_IFRAME_URL = "https://gis.x5.ru";
const GIS_TS5_TITLE = "ГИС ТС5";
const GIS_TS5_ID = "gis-ts5";
const GIS_TSH_TITLE = "ГИС ТСХ";
const GIS_TSH_ID = "gis-tsh";
const GIS_TSCH_TITLE = "ГИС ТСЧ";
const GIS_TSCH_ID = "gis-tsch";

const GIS_TS5_CANONICAL_ENTRY = {
  id: GIS_TS5_ID,
  title: GIS_TS5_TITLE,
  url: GIS_IFRAME_URL,
  category: "Сервисы",
  description: "Геоинформационная система ТС5",
  status: "Доступен",
};

const GIS_TSH_CANONICAL_ENTRY = {
  id: GIS_TSH_ID,
  title: GIS_TSH_TITLE,
  url: GIS_IFRAME_URL,
  category: "Сервисы",
  description: "Геоинформационная система ТСХ",
  status: "Доступен",
};

const GIS_TSCH_CANONICAL_ENTRY = {
  id: GIS_TSCH_ID,
  title: GIS_TSCH_TITLE,
  url: GIS_IFRAME_URL,
  category: "Сервисы",
  description: "Геоинформационная система ТСЧ",
  status: "Доступен",
};

function isGisCatalogItem(item) {
  if (!item) return false;
  const t = (item.title || "").trim().toLowerCase();
  const u = (item.url || "").toLowerCase();
  return (
    t.includes("гис тс5") ||
    t.includes("гис тсх") ||
    t.includes("гис тсч") ||
    u.includes("gis.x5.ru")
  );
}

const PORTAL_IFRAME_TILES = {
  [LICENSING_PORTAL_TITLE]: { url: LICENSING_IFRAME_URL, title: LICENSING_PORTAL_TITLE },
  [ROSREESTR_PORTAL_TITLE]: { url: ROSREESTR_IFRAME_URL, title: ROSREESTR_PORTAL_TITLE },
  [PLATFORM_TSCH_PORTAL_TITLE]: { url: PLATFORM_TSCH_IFRAME_URL, title: PLATFORM_TSCH_PORTAL_TITLE },
  "Платформа развития ТСЧ": { url: PLATFORM_TSCH_IFRAME_URL, title: PLATFORM_TSCH_PORTAL_TITLE },
  [PORTAL_IK_TSB_TITLE]: { url: PORTAL_IK_TSB_IFRAME_URL, title: "Портал ИК ТС5" },
  "Портал ИК ТС5": { url: PORTAL_IK_TSB_IFRAME_URL, title: "Портал ИК ТС5" },
  [PORTAL_IK_TSH_TITLE]: { url: PORTAL_IK_TSH_IFRAME_URL, title: PORTAL_IK_TSH_TITLE },
  [ASKO_TS5_PORTAL_TITLE]: { url: ASKO_TS5_IFRAME_URL, title: ASKO_TS5_PORTAL_TITLE },
  [ASKO_TSH_TITLE]: { url: ASKO_TSH_IFRAME_URL, title: ASKO_TSH_TITLE },
  [SED_TS5_TITLE]: { url: SED_IFRAME_URL, title: SED_TS5_TITLE },
  [SED_TSCH_TITLE]: { url: SED_IFRAME_URL, title: SED_TSCH_TITLE },
  [SED_TSH_TITLE]: { url: SED_IFRAME_URL, title: SED_TSH_TITLE },
  [ARENDA_PYATEROCHKA_TITLE]: { url: ARENDA_PYATEROCHKA_IFRAME_URL, title: ARENDA_PYATEROCHKA_TITLE },
  [IT_SUPPORT_TITLE]: { url: IT_SUPPORT_IFRAME_URL, title: IT_SUPPORT_TITLE },
  [SFERA_TITLE]: { url: SFERA_IFRAME_URL, title: SFERA_TITLE },
  [GIS_TS5_TITLE]: { url: GIS_IFRAME_URL, title: GIS_TS5_TITLE },
  [GIS_TSH_TITLE]: { url: GIS_IFRAME_URL, title: GIS_TSH_TITLE },
  [GIS_TSCH_TITLE]: { url: GIS_IFRAME_URL, title: GIS_TSCH_TITLE },
};

function getIframeTileForSystem(system) {
  if (!system) return undefined;
  const byTitle = PORTAL_IFRAME_TILES[system.title];
  if (byTitle) return byTitle;
  const title = (system.title || "").trim().toLowerCase();
  if (title === "лицензирование" || title.includes("лицензирование") || title === "licensing")
    return { url: LICENSING_IFRAME_URL, title: LICENSING_PORTAL_TITLE };
  if (title.includes("росреестр") || title.includes("rosreestr"))
    return { url: ROSREESTR_IFRAME_URL, title: ROSREESTR_PORTAL_TITLE };
  if (title.includes("платформа развития тсч") || title.includes("портал развития тсч"))
    return { url: PLATFORM_TSCH_IFRAME_URL, title: PLATFORM_TSCH_PORTAL_TITLE };
  if (title.includes("ик тсх"))
    return { url: PORTAL_IK_TSH_IFRAME_URL, title: PORTAL_IK_TSH_TITLE };
  if (title.includes("ик тсб") || title.includes("ик тс5"))
    return { url: PORTAL_IK_TSB_IFRAME_URL, title: "Портал ИК ТС5" };
  if (title.includes("аско тс5") || title.includes("asko ts5"))
    return { url: ASKO_TS5_IFRAME_URL, title: ASKO_TS5_PORTAL_TITLE };
  if (title.includes("аско тсх")) return { url: ASKO_TSH_IFRAME_URL, title: ASKO_TSH_TITLE };
  if (title.includes("сэд тс5")) return { url: SED_IFRAME_URL, title: SED_TS5_TITLE };
  if (title.includes("сэд тсч")) return { url: SED_IFRAME_URL, title: SED_TSCH_TITLE };
  if (title.includes("сэд тсх")) return { url: SED_IFRAME_URL, title: SED_TSH_TITLE };
  if (title.includes("аренда") && title.includes("пят")) return { url: ARENDA_PYATEROCHKA_IFRAME_URL, title: ARENDA_PYATEROCHKA_TITLE };
  if (title.includes("it поддержка") || title.includes("it-поддержка")) return { url: IT_SUPPORT_IFRAME_URL, title: IT_SUPPORT_TITLE };
  if (title.includes("сфера")) return { url: SFERA_IFRAME_URL, title: SFERA_TITLE };
  if (title.includes("гис тс5")) return { url: GIS_IFRAME_URL, title: GIS_TS5_TITLE };
  if (title.includes("гис тсх")) return { url: GIS_IFRAME_URL, title: GIS_TSH_TITLE };
  if (title.includes("гис тсч")) return { url: GIS_IFRAME_URL, title: GIS_TSCH_TITLE };
  const url = (system.url || "").toLowerCase();
  if (url.includes("lc.x5.ru")) return { url: LICENSING_IFRAME_URL, title: LICENSING_PORTAL_TITLE };
  if (url.includes("rosreestr.x5.ru")) return { url: ROSREESTR_IFRAME_URL, title: ROSREESTR_PORTAL_TITLE };
  if (url.includes("mikx.x5.ru")) return { url: PORTAL_IK_TSH_IFRAME_URL, title: PORTAL_IK_TSH_TITLE };
  if (url.includes("ko1.x5.ru")) return { url: (system.title || "").toLowerCase().includes("тсх") ? ASKO_TSH_IFRAME_URL : ASKO_TS5_IFRAME_URL, title: (system.title || "").toLowerCase().includes("тсх") ? ASKO_TSH_TITLE : ASKO_TS5_PORTAL_TITLE };
  if (url.includes("ko1-tsh.x5.ru")) return { url: ASKO_TSH_IFRAME_URL, title: ASKO_TSH_TITLE };
  if (url.includes("sed.x5.ru")) return { url: SED_IFRAME_URL, title: (system.title || SED_TS5_TITLE).trim() || SED_TS5_TITLE };
  if (url.includes("tc5-arenda.x5.ru") || url.includes("rentplamform") || url.includes("rentplatform")) return { url: ARENDA_PYATEROCHKA_IFRAME_URL, title: ARENDA_PYATEROCHKA_TITLE };
  if (url.includes("support.x5.ru")) return { url: IT_SUPPORT_IFRAME_URL, title: IT_SUPPORT_TITLE };
  if (url.includes("sfera.x5.ru")) return { url: SFERA_IFRAME_URL, title: SFERA_TITLE };
  if (url.includes("gis.x5.ru")) return { url: GIS_IFRAME_URL, title: (system.title || GIS_TS5_TITLE).trim() || GIS_TS5_TITLE };
  if (url.includes("localhost:5190") || url.includes(":5190")) return { url: LICENSING_IFRAME_URL, title: LICENSING_PORTAL_TITLE };
  return undefined;
}

function getLicensingIframeByHref(href) {
  if (!href || typeof href !== "string") return undefined;
  const u = href.toLowerCase();
  if (u.includes("localhost:5190") || u.includes(":5190")) return { url: LICENSING_IFRAME_URL, title: LICENSING_PORTAL_TITLE };
  return undefined;
}

const MOCK_NEWS = [
  {
    id: "mock-1",
    title: "Обновление регламента работы с партнёрами",
    content: "С 1 декабря вступает в силу обновлённый регламент взаимодействия с франчайзи. Основные изменения касаются сроков согласования документов и порядка отчётности. Ознакомиться с документом можно в разделе «Нормативные документы».",
    author_name: "Отдел развития",
    published_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    kind: "event",
    likes_count: 24,
    comments_count: 5,
    image_placement: "top",
    text_layout: "default",
  },
  {
    id: "mock-2",
    title: "Запуск нового модуля в Лицензировании",
    content: "На портале «Лицензирование» доступен новый модуль для подачи заявок на продление. Ускорен процесс проверки и уведомлений. Рекомендуем обновить закладки и ознакомиться с инструкцией.",
    author_name: "Сервисная команда",
    published_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    kind: "event",
    likes_count: 18,
    comments_count: 3,
    image_placement: "top",
    text_layout: "default",
  },
  {
    id: "mock-3",
    title: "Вебинар: цифровые сервисы для ТСЧ",
    content: "Приглашаем на вебинар 15 декабря в 14:00 (МСК). Темы: единый кабинет партнёра, интеграция с Росреестром, типовые вопросы от участников. Регистрация по ссылке в календаре событий.",
    author_name: "Платформа развития ТСЧ",
    published_at: new Date(Date.now() - 86400000).toISOString(),
    kind: "event",
    likes_count: 42,
    comments_count: 12,
    image_placement: "top",
    text_layout: "default",
  },
  {
    id: "mock-4",
    title: "Изменения в графике приёма отчётности",
    content: "Обратите внимание: приём ежемесячной отчётности в декабре переносится. Крайний срок подачи — 28 декабря. Вопросы направляйте в службу поддержки партнёров.",
    author_name: "Операционный отдел",
    published_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    kind: "event",
    likes_count: 11,
    comments_count: 0,
    image_placement: "top",
    text_layout: "default",
  },
  {
    id: "mock-5",
    title: "Новые шаблоны договоров в разделе «Документы»",
    content: "В каталоге документов добавлены актуальные шаблоны договоров аренды и франчайзинга. Используйте только версии с датой не ранее ноября 2024 года.",
    author_name: "Юридический отдел",
    published_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    kind: "event",
    likes_count: 31,
    comments_count: 7,
    image_placement: "top",
    text_layout: "default",
  },
  {
    id: "mock-6",
    title: "Технические работы на портале ИК ТСБ",
    content: "Запланированы технические работы 10 декабря с 02:00 до 06:00 (МСК). В этот период возможны кратковременные перерывы в доступе. Рекомендуем сохранить несохранённые данные заранее.",
    author_name: "IT Поддержка",
    published_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    kind: "event",
    likes_count: 8,
    comments_count: 2,
    image_placement: "top",
    text_layout: "default",
  },
];

async function cropImageToAvatarBlobLegacy(imageSource, focusX, focusY, scale, outputSize = 256, domMetrics = null, previewRect = null) {
  let objectUrl = null;
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    if (typeof imageSource === "string") {
      el.crossOrigin = "anonymous";
    }
    el.onload = () => resolve(el);
    el.onerror = (e) => reject(new Error("Не удалось загрузить изображение"));
    if (typeof imageSource === "string") {
      el.src = imageSource;
    } else {
      objectUrl = URL.createObjectURL(imageSource);
      el.src = objectUrl;
    }
  });
  try {
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    let srcX = 0;
    let srcY = 0;
    let cropSize = Math.min(imgW, imgH);
    let domDraw = null;

    // Точный путь: считаем кроп из фактических экранных rect'ов
    if (domMetrics?.imageRect && domMetrics?.selectorRect) {
      const imageRect = domMetrics.imageRect;
      const selectorRect = domMetrics.selectorRect;
      const selectorClientWidth = domMetrics.selectorClientWidth || selectorRect.width;
      const selectorClientHeight = domMetrics.selectorClientHeight || selectorRect.height;

      // Внутренний круг селектора без border
      const borderX = Math.max(0, (selectorRect.width - selectorClientWidth) / 2);
      const borderY = Math.max(0, (selectorRect.height - selectorClientHeight) / 2);
      const selectionLeft = selectorRect.left + borderX;
      const selectionTop = selectorRect.top + borderY;
      const selectionSize = Math.min(selectorClientWidth, selectorClientHeight);

      // Реальный bitmap внутри <img> с object-fit: contain
      const fitInElement = Math.min(imageRect.width / imgW, imageRect.height / imgH);
      if (fitInElement > 0) {
        const bitmapW = imgW * fitInElement;
        const bitmapH = imgH * fitInElement;
        const bitmapLeft = imageRect.left + (imageRect.width - bitmapW) / 2;
        const bitmapTop = imageRect.top + (imageRect.height - bitmapH) / 2;

        // Рисуем в итоговый canvas ровно по экранной геометрии селектора (без обратной инверсии кропа)
        const outScale = outputSize / Math.max(selectionSize, 1);
        domDraw = {
          dx: (bitmapLeft - selectionLeft) * outScale,
          dy: (bitmapTop - selectionTop) * outScale,
          dw: bitmapW * outScale,
          dh: bitmapH * outScale,
        };
      }
    } else {
      // Fallback: расчёт по transform-параметрам
      const s = Math.max(0.5, Math.min(2, scale / 100));
      const previewW = previewRect?.width || 400;
      const previewH = previewRect?.height || 225;
      const innerW = 2 * previewW;
      const innerH = 2 * previewH;
      const fit = Math.min(innerW / imgW, innerH / imgH);

      const drawnW = imgW * fit;
      const drawnH = imgH * fit;
      const imgOffsetX = (innerW - drawnW) / 2;
      const imgOffsetY = (innerH - drawnH) / 2;
      const txPct = -50 + (focusX - 50) * 1.5;
      const tyPct = -50 + (focusY - 50) * 1.5;
      const tx = (txPct / 100) * innerW;
      const ty = (tyPct / 100) * innerH;
      const previewCenterX = previewW / 2;
      const previewCenterY = previewH / 2;
      const positionedLeft = previewW / 2;
      const positionedTop = previewH / 2;
      const originX = innerW / 2;
      const originY = innerH / 2;

      const innerCenterX = originX + (previewCenterX - positionedLeft - originX - tx) / s;
      const innerCenterY = originY + (previewCenterY - positionedTop - originY - ty) / s;
      const imageCenterX = (innerCenterX - imgOffsetX) / fit;
      const imageCenterY = (innerCenterY - imgOffsetY) / fit;
      const circleD = 0.52 * previewW;
      cropSize = circleD / (s * fit);
      srcX = imageCenterX - cropSize / 2;
      srcY = imageCenterY - cropSize / 2;
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outputSize;
    outCanvas.height = outputSize;
    const oCtx = outCanvas.getContext("2d");
    // Фон внутри круга такой же, как у превью, если пользователь сдвинул изображение за границы
    oCtx.fillStyle = "#f4f8f5";
    oCtx.fillRect(0, 0, outputSize, outputSize);
    oCtx.beginPath();
    oCtx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    oCtx.closePath();
    oCtx.clip();
    if (domDraw) {
      oCtx.drawImage(img, domDraw.dx, domDraw.dy, domDraw.dw, domDraw.dh);
    } else {
      oCtx.drawImage(img, srcX, srcY, cropSize, cropSize, 0, 0, outputSize, outputSize);
    }

    return new Promise((resolve) => outCanvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92));
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function _toDateKeyLegacy(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function _fromDateKeyLegacy(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function _buildMonthDaysLegacy(dateKey) {
  const selected = fromDateKey(dateKey);
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const shiftToMonday = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - shiftToMonday);
  return Array.from({ length: 42 }, (_, idx) => {
    const dayDate = new Date(gridStart);
    dayDate.setDate(gridStart.getDate() + idx);
    return {
      date: dayDate,
      dateKey: toDateKey(dayDate),
      isCurrentMonth: dayDate.getMonth() === selected.getMonth(),
    };
  });
}

function _slotToMinutesLegacy(slot) {
  const [hours, minutes] = slot.split(":").map(Number);
  return hours * 60 + minutes;
}

function _minutesToLabelLegacy(totalMinutes) {
  const safe = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function _readStoredWidthLegacy(storageKey, fallback, min, max) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  } catch {
    return fallback;
  }
}

function _applyWidgetDropLegacy(baseWidgets, draggedId, targetId, position, desiredColumn = null) {
  if (!draggedId || !targetId || draggedId === targetId) return baseWidgets;
  const next = baseWidgets.map((item) => ({ ...item }));
  const dragged = next.find((item) => item.id === draggedId);
  const target = next.find((item) => item.id === targetId);
  if (!dragged || !target) return baseWidgets;
  const activeColumns = new Set(
    next
      .filter((item) => item.id !== draggedId && (item.span || 6) < 10 && DESKTOP_COLUMNS.includes(item.column))
      .map((item) => item.column)
  );
  const targetColumn = DESKTOP_COLUMNS.includes(target.column) ? target.column : "left";
  const targetColIndex = DESKTOP_COLUMNS.indexOf(targetColumn);
  const resolveSideColumn = (direction) => {
    if (direction === "left") {
      const candidates = DESKTOP_COLUMNS.slice(0, targetColIndex).reverse();
      for (const candidate of candidates) {
        if (activeColumns.has(candidate)) return candidate;
      }
      return candidates[0] || targetColumn;
    }
    const candidates = DESKTOP_COLUMNS.slice(targetColIndex + 1);
    for (const candidate of candidates) {
      if (activeColumns.has(candidate)) return candidate;
    }
    return candidates[0] || targetColumn;
  };

  const isCrossColumnDrop = !!desiredColumn && desiredColumn !== targetColumn;
  if (position === "left" || position === "right" || isCrossColumnDrop) {
    // Side/cross-column drop is always a "1-column" placement.
    dragged.span = 4;
    dragged.column = desiredColumn || resolveSideColumn(position);
    dragged.rowSpan = Math.max(1, dragged.rowSpan || getDefaultWidgetRowSpan(dragged.id));
    if ((target.span || 8) >= 10) {
      target.span = 4;
    }
    target.rowSpan = Math.max(1, target.rowSpan || getDefaultWidgetRowSpan(target.id));
  } else {
    const draggedSpan = snapWidgetSpan(dragged.span || 8);
    const targetSpan = snapWidgetSpan(target.span || 8);
    dragged.span = targetSpan >= 10 ? draggedSpan : Math.min(8, draggedSpan);
    dragged.column = desiredColumn || targetColumn;
  }

  const withoutDragged = next.filter((item) => item.id !== draggedId);
  const targetIdx = withoutDragged.findIndex((item) => item.id === targetId);
  if (targetIdx < 0) return baseWidgets;
  const effectivePosition = position === "left" ? "top" : position === "right" ? "bottom" : position;
  const insertIdx = effectivePosition === "top" ? targetIdx : targetIdx + 1;
  withoutDragged.splice(insertIdx, 0, dragged);
  return withoutDragged;
}

const DEFAULT_DESKTOP_WIDGETS = [
  { id: "asko", title: "АСКО: стройка", span: 12, rowSpan: 2 },
  { id: "news", title: "Лента новостей", span: 12, rowSpan: 2 },
  { id: "tasks", title: "Задачи", span: 6, rowSpan: 1 },
  { id: "calendar", title: "Календарь", span: 6, rowSpan: 1 },
  { id: "activity", title: "Моя активность", span: 6, rowSpan: 1 },
  { id: "activity_feed", title: "Лента активностей", span: 12, rowSpan: 2 },
  { id: "map", title: "ГИС", span: 6, rowSpan: 1 },
];
const WIDGET_SETTINGS_META = {
  asko: { icon: "▦", desc: "Стадии стройки и риски по объектам" },
  news: { icon: "📰", desc: "Лента новостей и опросов команды" },
  tasks: { icon: "✓", desc: "Ключевые задачи и прогресс" },
  calendar: { icon: "🗓", desc: "План на день и события по слотам" },
  activity: { icon: "▮", desc: "Динамика загрузки по дням" },
  activity_feed: { icon: "☰", desc: "Сводная лента активности по всем блокам" },
  map: { icon: "🗺", desc: "ГИС, интерактивная карта OpenStreetMap" },
};
const DEFAULT_VISIBLE_WIDGET_IDS = DEFAULT_DESKTOP_WIDGETS.map((item) => item.id);
const DEFAULT_CONSTRUCTION_WIDGET = {
  system_name: "АСКО",
  card_title: "Карточка объекта",
  total_projects: 0,
  active_projects: 0,
  on_schedule: 0,
  at_risk: 0,
  needs_attention: 0,
  stages: [],
  projects_by_stage: {},
  action_url: "#",
  action_label: "Открыть",
};
const ONBOARDING_STORAGE_KEY = "terra-onboarding-seen";
const SEARCH_PLACEHOLDER_PHRASES = [
  "Найти сотрудника, сервис, документ...",
  "Поиск по порталам и виджетам",
  "Поиск по новостям и событиям",
  "Поиск по задачам и календарю",
];
const STORES_SEARCH_PLACEHOLDER_PHRASES = [
  "Поиск по коду, адресу, городу, региону...",
  "Код магазина (MSK-001, SPB-002...)",
  "Город: Москва, Санкт-Петербург...",
  "Регион или формат магазина",
];

function _getDefaultWidgetRowSpanLegacy(widgetId) {
  return widgetId === "news" || widgetId === "asko" || widgetId === "activity_feed" || widgetId === "map" ? 2 : 1;
}

function _normalizeWidgetLegacy(baseWidget, persistedWidget) {
  const rawSpan = Number(persistedWidget?.span);
  const rawRowSpan = Number(persistedWidget?.rowSpan);
  const persistedColumn = DESKTOP_COLUMNS.includes(persistedWidget?.column) ? persistedWidget.column : null;
  const persistedSize = persistedWidget?.size;
  const fallbackSpan = baseWidget.span || 6;
  const spanFromSize = persistedSize === "lg" ? 12 : persistedSize === "md" ? 6 : fallbackSpan;
  const normalizedSpan = snapWidgetSpan(Number.isFinite(rawSpan) ? rawSpan : spanFromSize);
  const normalizedRowSpan = Number.isFinite(rawRowSpan) ? rawRowSpan : getDefaultWidgetRowSpan(baseWidget.id);
  return {
    id: baseWidget.id,
    title: baseWidget.title,
    span: normalizedSpan,
    rowSpan: Math.max(1, Math.min(3, normalizedRowSpan)),
    column: normalizedSpan >= 10 ? null : persistedColumn || "left",
  };
}

function sanitizeDesktopWidgets(rawWidgets) {
  const used = new Set();
  const normalized = [];
  (Array.isArray(rawWidgets) ? rawWidgets : []).forEach((item) => {
    const base = DEFAULT_DESKTOP_WIDGETS.find((candidate) => candidate.id === item.id);
    if (!base || used.has(base.id)) return;
    used.add(base.id);
    normalized.push(normalizeWidget(base, item));
  });
  DEFAULT_DESKTOP_WIDGETS.forEach((base) => {
    if (!used.has(base.id)) {
      normalized.push(normalizeWidget(base));
    }
  });
  return normalized;
}

function _buildWidgetBlocksLegacy(widgets) {
  const blocks = [];
  let columns = {
    left: [],
    middle: [],
    right: [],
  };
  let weights = {
    left: 0,
    middle: 0,
    right: 0,
  };

  const flushColumns = () => {
    const nonEmptyColumns = DESKTOP_COLUMNS.filter((column) => columns[column].length > 0);
    if (!nonEmptyColumns.length) return;
    const visibleColumns = nonEmptyColumns.includes("middle")
      ? DESKTOP_COLUMNS.filter((column) => columns[column].length > 0 || column === "middle")
      : nonEmptyColumns.length >= 2
      ? nonEmptyColumns
      : ["left", "right"];
    blocks.push({ type: "columns", columns, visibleColumns });
    columns = { left: [], middle: [], right: [] };
    weights = { left: 0, middle: 0, right: 0 };
  };

  widgets.forEach((widget) => {
    const span = snapWidgetSpan(widget.span || 8);
    if (span >= 10) {
      flushColumns();
      blocks.push({ type: "full", widget });
      return;
    }
    if (span >= 8) {
      flushColumns();
      const startColumn = widget.column === "middle" ? "middle" : "left";
      blocks.push({ type: "wide", widget, startColumn });
      return;
    }
    const weight = Math.max(1, widget.rowSpan || 1);
    if (DESKTOP_COLUMNS.includes(widget.column)) {
      columns[widget.column].push(widget);
      weights[widget.column] += weight;
      return;
    }
    const candidateColumns =
      columns.middle.length > 0 || weights.middle > 0 ? DESKTOP_COLUMNS : ["left", "right"];
    const targetColumn = candidateColumns
      .slice()
      .sort((a, b) => weights[a] - weights[b])[0];
    columns[targetColumn].push(widget);
    weights[targetColumn] += weight;
  });

  flushColumns();
  return blocks;
}

function _parseDropZoneIdLegacy(rawId) {
  if (typeof rawId !== "string") return null;
  if (rawId.startsWith("drop:")) {
    const [, targetId, position] = rawId.split(":");
    if (!targetId || !position) return null;
    return { type: "widget", targetId, position };
  }
  if (rawId.startsWith("dropcol:")) {
    const [, blockIndexRaw, column, position] = rawId.split(":");
    const blockIndex = Number(blockIndexRaw);
    if (!Number.isFinite(blockIndex) || !DESKTOP_COLUMNS.includes(column) || position !== "end") return null;
    return { type: "column", blockIndex, column, position };
  }
  return null;
}

function _detectDropPositionByPointLegacy(targetElement, clientX, clientY) {
  const rect = targetElement.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
  const leftDistance = x;
  const rightDistance = rect.width - x;
  const topDistance = y;
  const bottomDistance = rect.height - y;

  const ranked = [
    { position: "left", distance: leftDistance },
    { position: "right", distance: rightDistance },
    { position: "top", distance: topDistance },
    { position: "bottom", distance: bottomDistance },
  ].sort((a, b) => a.distance - b.distance);

  const nearest = ranked[0];
  const second = ranked[1];
  const previousPosition = targetElement?.dataset?.dropPosition || null;
  if (
    previousPosition &&
    second &&
    ranked.slice(0, 2).some((item) => item.position === previousPosition) &&
    Math.abs(second.distance - nearest.distance) <= DROP_POSITION_STICKINESS_PX
  ) {
    return previousPosition;
  }

  return nearest?.position || "right";
}

function _snapWidgetSpanLegacy(rawSpan) {
  const safe = Number.isFinite(Number(rawSpan)) ? Number(rawSpan) : 8;
  let nearest = WIDGET_SPAN_STEPS[0];
  let minDistance = Number.POSITIVE_INFINITY;
  WIDGET_SPAN_STEPS.forEach((step) => {
    const distance = Math.abs(step - safe);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = step;
    }
  });
  return Math.max(WIDGET_MIN_SPAN, Math.min(WIDGET_MAX_SPAN, nearest));
}

function _getWidgetSizeUnitsLegacy(span) {
  const snapped = snapWidgetSpan(span);
  return snapped >= 12 ? 3 : snapped >= 8 ? 2 : 1;
}

function _getWidgetSizeLabelLegacy(span) {
  const units = getWidgetSizeUnits(span);
  return `${units}/3`;
}

function _getWidgetSizeIconLegacy(span) {
  const units = getWidgetSizeUnits(span);
  return units === 1 ? "◱" : units === 2 ? "◧" : "◼";
}

function _getNextWidgetSpanLegacy(span) {
  const snapped = snapWidgetSpan(span);
  const index = WIDGET_SPAN_STEPS.indexOf(snapped);
  const nextIndex = index < 0 ? 0 : (index + 1) % WIDGET_SPAN_STEPS.length;
  return WIDGET_SPAN_STEPS[nextIndex];
}

function _normalizeColumnWidthsLegacy(columns, widths) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const sum = safeColumns.reduce((acc, column) => acc + (Number(widths?.[column]) || 0), 0);
  if (!sum) {
    const equal = safeColumns.length ? 100 / safeColumns.length : 0;
    return Object.fromEntries(safeColumns.map((column) => [column, equal]));
  }
  return Object.fromEntries(safeColumns.map((column) => [column, ((Number(widths?.[column]) || 0) / sum) * 100]));
}

function _formatUiErrorLegacy(detail, fallback = "Ошибка запроса") {
  if (!detail) return fallback;
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
    return messages.length ? messages.join("; ") : fallback;
  }
  if (typeof detail === "object") {
    return detail.message || detail.msg || fallback;
  }
  return fallback;
}

function _sanitizeUiErrorMessageLegacy(message) {
  if (!message) return "";
  const text = String(message);
  return text.includes("[object Object]") ? "Ошибка запроса. Проверьте введенные данные." : text;
}

function WidgetDropZone({ widgetId, position, active, visible }) {
  const { setNodeRef } = useDroppable({
    id: `drop:${widgetId}:${position}`,
    disabled: !visible,
  });
  return <div ref={setNodeRef} className={`drop-zone ${position} ${active ? "active" : ""}`} />;
}

function ColumnEndDropZone({ blockIndex, column, active, visible }) {
  const { setNodeRef } = useDroppable({
    id: `dropcol:${blockIndex}:${column}:end`,
    disabled: !visible,
  });
  return <div ref={setNodeRef} className={`column-drop-end ${active ? "active" : ""}`} />;
}

function ColumnBodyDropZone({ blockIndex, column, visible }) {
  const { setNodeRef } = useDroppable({
    id: `dropcol:${blockIndex}:${column}:body`,
    disabled: !visible,
  });
  return <div ref={setNodeRef} className="column-drop-body" />;
}

function DesktopWidgetShell({ widget, isDraggingWidget, activeWidgetId, dropHint, onToggleSize, children, shellClassName = "", headerExtra }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: widget.id });
  const showDropZones = isDraggingWidget && activeWidgetId !== widget.id;

  return (
    <div ref={setNodeRef} className={`widget-shell ${shellClassName}`}>
      <article
        data-widget-id={widget.id}
        data-drop-position={isDraggingWidget && dropHint?.targetId === widget.id ? dropHint.position : ""}
        className={`dashboard-widget ${isDragging ? "dragging" : ""} ${isDraggingWidget && activeWidgetId === widget.id ? "parking-preview" : ""} widget-size-${getWidgetSizeUnits(widget.span)}`}
      >
        {showDropZones && (
          <div className="widget-dropzones">
            <WidgetDropZone
              widgetId={widget.id}
              position="top"
              visible={showDropZones}
              active={dropHint?.targetId === widget.id && dropHint?.position === "top"}
            />
            <WidgetDropZone
              widgetId={widget.id}
              position="left"
              visible={showDropZones}
              active={dropHint?.targetId === widget.id && dropHint?.position === "left"}
            />
            <WidgetDropZone
              widgetId={widget.id}
              position="right"
              visible={showDropZones}
              active={dropHint?.targetId === widget.id && dropHint?.position === "right"}
            />
            <WidgetDropZone
              widgetId={widget.id}
              position="bottom"
              visible={showDropZones}
              active={dropHint?.targetId === widget.id && dropHint?.position === "bottom"}
            />
          </div>
        )}
        <header className="widget-header">
          <div className="widget-header-title-row">
            <h3>{widget.title}</h3>
            {headerExtra}
          </div>
          <div className="widget-controls">
            <button
              type="button"
              className="widget-size-toggle"
              onClick={() => onToggleSize(widget.id)}
              title={`Размер: ${getWidgetSizeLabel(widget.span)}`}
              aria-label={`Размер виджета: ${getWidgetSizeLabel(widget.span)}`}
            >
              {getWidgetSizeIcon(widget.span)}
            </button>
            <button type="button" className="widget-drag-hint" {...listeners} {...attributes} aria-label={`Переместить виджет ${widget.title}`}>
              ⋮⋮
            </button>
          </div>
        </header>
        {children}
      </article>
    </div>
  );
}

/* useAuth — imported from hooks/useAuth */

const FALLBACK_QUICK_ROLES = [
  {
    role_code: "admin",
    role_name: "Администратор",
    users: [
      {
        id: null,
        full_name: "Андрей",
        role_code: "admin",
        role_name: "Администратор",
        email: "admin@platform.local",
        password: "admin123",
      },
    ],
  },
  {
    role_code: "expansion_manager",
    role_name: "Менеджер развития",
    users: [
      {
        id: null,
        full_name: "Анна Блинова",
        role_code: "expansion_manager",
        role_name: "Менеджер развития",
        email: "expansion@platform.local",
        password: "expansion123",
      },
    ],
  },
  {
    role_code: "construction_manager",
    role_name: "Руководитель стройки",
    users: [
      {
        id: null,
        full_name: "Иван Демидов",
        role_code: "construction_manager",
        role_name: "Руководитель стройки",
        email: "construction@platform.local",
        password: "construction123",
      },
    ],
  },
  {
    role_code: "property_manager",
    role_name: "Управляющий недвижимостью",
    users: [
      {
        id: null,
        full_name: "Мария Трошина",
        role_code: "property_manager",
        role_name: "Управляющий недвижимостью",
        email: "property@platform.local",
        password: "property123",
      },
    ],
  },
];

const HERO_TITLE_PREFIX = "Орион:";
const HERO_TITLE_TYPED = " единая платформа для развития бизнеса";

function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [accessForm, setAccessForm] = useState({ name: "", email: "", company: "", message: "" });
  const [accessRequestSent, setAccessRequestSent] = useState(false);
  const [quickRoles, setQuickRoles] = useState(FALLBACK_QUICK_ROLES);
  const [error, setError] = useState("");
  const [heroTyped, setHeroTyped] = useState("");
  const [heroTypingDone, setHeroTypingDone] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAccessRequestModal, setShowAccessRequestModal] = useState(false);

  useEffect(() => {
    let i = 0;
    let intervalId = null;
    const full = HERO_TITLE_TYPED;
    const startDelay = setTimeout(() => {
      intervalId = setInterval(() => {
        if (i < full.length) {
          setHeroTyped(full.slice(0, i + 1));
          i += 1;
        } else {
          clearInterval(intervalId);
          intervalId = null;
          setHeroTypingDone(true);
        }
      }, 70);
    }, 500);
    return () => {
      clearTimeout(startDelay);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    apiRequest("/auth/quick-access-by-role")
      .then((groups) => {
        if (Array.isArray(groups) && groups.length > 0) {
          setQuickRoles(groups);
        } else {
          setQuickRoles(FALLBACK_QUICK_ROLES);
        }
      })
      .catch(() => setQuickRoles(FALLBACK_QUICK_ROLES));
  }, []);

  const headerRef = useRef(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const onScroll = () => {
      el.classList.toggle("scrolled", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openLoginModal = () => setShowLoginModal(true);
  const openAccessRequestModal = () => setShowAccessRequestModal(true);

  const submitAccessRequest = (e) => {
    e.preventDefault();
    setAccessRequestSent(true);
    setAccessForm({ name: "", email: "", company: "", message: "" });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const data = await apiRequest("/auth/login", { method: "POST", body: form });
      onLogin(data.access_token);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  const quickLogin = async (group) => {
    setError("");
    try {
      const firstUser = group?.users?.[0];
      if (!firstUser) return;
      if (firstUser.id) {
        const data = await apiRequest("/auth/quick-login", { method: "POST", body: { user_id: firstUser.id } });
        onLogin(data.access_token);
        navigate("/");
        return;
      }
      if (firstUser.email && firstUser.password) {
        const data = await apiRequest("/auth/login", {
          method: "POST",
          body: { email: firstUser.email, password: firstUser.password },
        });
        onLogin(data.access_token);
        navigate("/");
        return;
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="landing-page">
      <header ref={headerRef} className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-logo">
            <OrionLogo collapsed={false} />
          </div>
          <nav className="landing-nav">
            <button type="button" className="landing-nav-link" onClick={openAccessRequestModal}>Поддержка</button>
            <button type="button" className="landing-nav-link" onClick={() => document.getElementById("solutions")?.scrollIntoView({ behavior: "smooth" })}>О нас</button>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-twinkle" aria-hidden="true" />
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            <span className="landing-hero-title-brand">{HERO_TITLE_PREFIX}</span>
            <span className="landing-hero-title-typed">{heroTyped}</span>
            {!heroTypingDone && <span className="landing-hero-title-cursor" aria-hidden="true">|</span>}
          </h1>
          <p className={`landing-hero-subtitle ${heroTypingDone ? "landing-hero-subtitle--visible" : ""}`}>
            Платформа, которая объединяет сервисы и инструменты для вашей команды
          </p>
          <div className="landing-hero-buttons">
            <button type="button" className="landing-btn landing-btn--teal" onClick={openLoginModal}>
              Сотрудник Х5
            </button>
            <button type="button" className="landing-btn landing-btn--teal" onClick={openAccessRequestModal}>
              Партнер
            </button>
          </div>
        </div>
      </section>

      <section id="solutions" className="landing-section landing-solutions">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">Орион — это:</h2>
          <div className="landing-cards">
            <div className="landing-card">
              <span className="landing-card-icon" aria-hidden="true">🔗</span>
              <span className="landing-card-label">Единый доступ к сервисам и порталам</span>
              <p className="landing-card-desc">Один вход — все сервисы и порталы платформы в одном месте.</p>
            </div>
            <div className="landing-card landing-card--highlight">
              <span className="landing-card-icon" aria-hidden="true">⚙</span>
              <span className="landing-card-label">Автоматизация</span>
              <p className="landing-card-desc">Сокращение рутины: процессы, уведомления и согласования в одном месте.</p>
            </div>
            <div className="landing-card">
              <span className="landing-card-icon" aria-hidden="true">🔍</span>
              <span className="landing-card-label">Аналитика</span>
              <p className="landing-card-desc">Сводки, отчёты и визуализация для принятия решений на основе данных.</p>
            </div>
          </div>
        </div>
      </section>

      {showAccessRequestModal && (
        <div className="landing-modal-overlay" onClick={() => setShowAccessRequestModal(false)} role="dialog" aria-labelledby="landing-modal-access-title" aria-modal="true">
          <div className="landing-modal" onClick={(e) => e.stopPropagation()}>
            <div className="landing-modal-head">
              <h2 id="landing-modal-access-title" className="landing-modal-title">Заявка на доступ</h2>
              <button type="button" className="landing-modal-close" onClick={() => setShowAccessRequestModal(false)} aria-label="Закрыть">✕</button>
            </div>
            <div className="landing-modal-body">
              <p className="landing-access-request-intro">Оставьте заявку, и мы свяжемся с вами для предоставления доступа к платформе.</p>
              {accessRequestSent ? (
                <div className="landing-access-request-success">
                  Заявка отправлена. Мы свяжемся с вами в ближайшее время.
                </div>
              ) : (
                <form className="landing-access-request-form" onSubmit={submitAccessRequest}>
                  <label className="landing-auth-label">
                    ФИО
                    <input className="landing-auth-input" value={accessForm.name} onChange={(e) => setAccessForm({ ...accessForm, name: e.target.value })} placeholder="Иванов Иван Иванович" required />
                  </label>
                  <label className="landing-auth-label">
                    Email
                    <input className="landing-auth-input" type="email" value={accessForm.email} onChange={(e) => setAccessForm({ ...accessForm, email: e.target.value })} placeholder="email@company.ru" required />
                  </label>
                  <label className="landing-auth-label">
                    Организация
                    <input className="landing-auth-input" value={accessForm.company} onChange={(e) => setAccessForm({ ...accessForm, company: e.target.value })} placeholder="Название организации" />
                  </label>
                  <label className="landing-auth-label">
                    Комментарий
                    <textarea className="landing-auth-input landing-auth-input--textarea" value={accessForm.message} onChange={(e) => setAccessForm({ ...accessForm, message: e.target.value })} placeholder="Цель обращения (необязательно)" rows={3} />
                  </label>
                  <button type="submit" className="landing-btn landing-btn--teal landing-btn--sm">Отправить заявку</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {showLoginModal && (
        <div className="landing-modal-overlay" onClick={() => setShowLoginModal(false)} role="dialog" aria-labelledby="landing-modal-login-title" aria-modal="true">
          <div className="landing-modal" onClick={(e) => e.stopPropagation()}>
            <div className="landing-modal-head">
              <h2 id="landing-modal-login-title" className="landing-modal-title">Вход в платформу</h2>
              <button type="button" className="landing-modal-close" onClick={() => setShowLoginModal(false)} aria-label="Закрыть">✕</button>
            </div>
            <div className="landing-modal-body">
              <form className="landing-auth-form" onSubmit={submit}>
                <label className="landing-auth-label">
                  Email
                  <input className="landing-auth-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                </label>
                <label className="landing-auth-label">
                  Пароль
                  <input className="landing-auth-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
                </label>
                <button type="submit" className="landing-btn landing-btn--teal landing-btn--sm">Войти</button>
                {error && <div className="landing-auth-error">{error}</div>}
              </form>
              <div className="landing-quick">
                <p className="landing-quick-title">Быстрый вход по ролям</p>
                <div className="landing-quick-grid">
                  {quickRoles.map((group) => {
                    const firstUser = group.users[0];
                    if (!firstUser) return null;
                    return (
                      <button
                        key={group.role_code}
                        type="button"
                        className="landing-quick-btn"
                        onClick={() => quickLogin(group)}
                      >
                        <strong>{group.role_name}</strong>
                        <span>{firstUser.full_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function DashboardPage({ token, profile, onLogout, onProfileChange, refreshProfile }) {
  const [dashboard, setDashboard] = useState({});
  const [catalog, setCatalog] = useState([]);
  const [projects, setProjects] = useState([]);
  const [constructionWidget, setConstructionWidget] = useState(DEFAULT_CONSTRUCTION_WIDGET);
  const [newsFeed, setNewsFeed] = useState(MOCK_NEWS);
  const [newsError, setNewsError] = useState("");
  const [newsSaving, setNewsSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const toastTimeoutsRef = useRef({});
  const [newsDeleting, setNewsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newsForm, setNewsForm] = useState({
    id: null,
    title: "",
    content: "",
    kind: "event",
    options: ["", ""],
    publishNow: true,
    imagePlacement: "top",
    textLayout: "below",
    pollChartType: "bar",
    imageUrl: null,
  });
  const [newsImage, setNewsImage] = useState(null);
  const [newsImagePreview, setNewsImagePreview] = useState("");
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const [isNewsEditMode, setIsNewsEditMode] = useState(false);
  const [activeSection, setActiveSection] = useState("desktop");
  const [portalSearch, setPortalSearch] = useState("");
  const [selectedPortalCategory, setSelectedPortalCategory] = useState("Все");
  const [portalViewMode, setPortalViewMode] = useState("grid");
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [storeFilterCity, setStoreFilterCity] = useState(null);
  const [storeFilterRegion, setStoreFilterRegion] = useState(null);
  const [storeFilterFormat, setStoreFilterFormat] = useState(null);
  const [storeFilterHours, setStoreFilterHours] = useState(null);
  const [storeFilterModal, setStoreFilterModal] = useState(null); // 'city' | 'region' | 'format' | 'hours'
  const [selectedStoreModal, setSelectedStoreModal] = useState(null); // store object or null
  const [showPortalsSlider, setShowPortalsSlider] = useState(true);
  const [portalFavorites, setPortalFavorites] = useState([]);
  const [hiddenPortalIds, setHiddenPortalIds] = useState([]);
  const [selectedConstructionStage, setSelectedConstructionStage] = useState("all");
  const [selectedConstructionProjectCode, setSelectedConstructionProjectCode] = useState(null);
  const [isConstructionProjectModalOpen, setIsConstructionProjectModalOpen] = useState(false);
  const [portalIframeModal, setPortalIframeModal] = useState({ open: false, url: "", title: "" });
  const [addPortalModalOpen, setAddPortalModalOpen] = useState(false);
  const [lastAddedPortalId, setLastAddedPortalId] = useState(null);
  const [isFavoritesEditMode, setIsFavoritesEditMode] = useState(false);
  const [askoWidgetHasAnimated, setAskoWidgetHasAnimated] = useState(false);
  const [isMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredWidth(SIDEBAR_WIDTH_KEY, 260, 200, 420));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isDraggingPortals, setIsDraggingPortals] = useState(false);
  const [isDraggingActivity, setIsDraggingActivity] = useState(false);
  const [activityFeedFilter, setActivityFeedFilter] = useState("all");
  const [mapRegion, setMapRegion] = useState("all");
  const [desktopWidgets, setDesktopWidgets] = useState(DEFAULT_DESKTOP_WIDGETS);
  const [visibleWidgetIds, setVisibleWidgetIds] = useState(DEFAULT_VISIBLE_WIDGET_IDS);
  const [activeWidgetId, setActiveWidgetId] = useState(null);
  const [dropHint, setDropHint] = useState(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toDateKey(new Date()));
  const [isCalendarDayOpen, setIsCalendarDayOpen] = useState(false);
  const [calendarTasks, setCalendarTasks] = useState([]);
  const [calendarDraft, setCalendarDraft] = useState({ slot: null, title: "", durationSlots: 1 });
  const [theme, setTheme] = useState("light");
  const [desktopColumnWidths, setDesktopColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [columnResizeState, setColumnResizeState] = useState(null);
  const [dragOverlaySize, setDragOverlaySize] = useState(null);
  const [profileForm, setProfileForm] = useState({ full_name: "" });
  const [profileAvatarFile, setProfileAvatarFile] = useState(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState("");
  const [avatarAdjustments, setAvatarAdjustments] = useState({ focusX: 50, focusY: 50, scale: 100 });
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_STORAGE_KEY));
  const [searchPlaceholderIndex, setSearchPlaceholderIndex] = useState(0);
  const [searchPlaceholderText, setSearchPlaceholderText] = useState("");
  const [storesSearchPlaceholderIndex, setStoresSearchPlaceholderIndex] = useState(0);
  const [storesSearchPlaceholderText, setStoresSearchPlaceholderText] = useState("");
  const searchPlaceholderCharIndexRef = useRef(0);
  const searchPlaceholderPhaseRef = useRef("typing");
  const searchPlaceholderPauseUntilRef = useRef(0);
  const storesSearchPlaceholderCharIndexRef = useRef(0);
  const storesSearchPlaceholderPhaseRef = useRef("typing");
  const storesSearchPlaceholderPauseUntilRef = useRef(0);
  const avatarFrameRef = useRef(null);
  const avatarPreviewImageRef = useRef(null);
  const avatarSelectorRef = useRef(null);
  const portalsSliderRef = useRef(null);
  const activitySliderRef = useRef(null);
  const widgetDropHintRef = useRef(null);
  const widgetPointerRef = useRef({ x: 0, y: 0 });
  const lastPointerColumnRef = useRef(null);
  const lastPointerTargetRef = useRef(null);
  const activeWidgetIdRef = useRef(null);
  const avatarDragRef = useRef({
    startClientX: 0,
    startClientY: 0,
    startFocusX: 50,
    startFocusY: 50,
    frameWidth: 1,
    frameHeight: 1,
  });
  const portalsDragRef = useRef({
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const activityDragRef = useRef({
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const suppressPortalClickRef = useRef(false);
  const suppressActivityClickRef = useRef(false);
  const addPortalModalRef = useRef(null);
  const showToast = useCallback((message, type = "success") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      delete toastTimeoutsRef.current[id];
    }, 4000);
    toastTimeoutsRef.current[id] = t;
  }, []);
  const removeToast = useCallback((id) => {
    if (toastTimeoutsRef.current[id]) {
      clearTimeout(toastTimeoutsRef.current[id]);
      delete toastTimeoutsRef.current[id];
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      Object.values(toastTimeoutsRef.current).forEach(clearTimeout);
      toastTimeoutsRef.current = {};
    };
  }, []);

  const addPortalTriggerRef = useRef(null);
  const iframeModalRef = useRef(null);
  const iframeModalTriggerRef = useRef(null);

  const mapRegions = useMemo(() => {
    const set = new Set(PYATEROCHKA_STORES.map((s) => s.region));
    return ["all", ...Array.from(set).sort()];
  }, []);
  const mapFilteredCount = useMemo(() => {
    if (mapRegion === "all") return PYATEROCHKA_STORES.length;
    return PYATEROCHKA_STORES.filter((s) => s.region === mapRegion).length;
  }, [mapRegion]);

  const mapWidgetHeaderExtra = (
    <div className="map-widget-header-controls">
      <label className="map-widget-filter-label">
        <span className="map-widget-filter-text">Регион:</span>
        <select
          className="map-widget-region-select"
          value={mapRegion}
          onChange={(e) => setMapRegion(e.target.value)}
          aria-label="Фильтр по региону"
        >
          <option value="all">Все регионы</option>
          {mapRegions.filter((r) => r !== "all").map((region) => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>
      </label>
      <span className="map-widget-count">
        {mapFilteredCount} {mapFilteredCount === 1 ? "магазин" : mapFilteredCount < 5 ? "магазина" : "магазинов"}
      </span>
    </div>
  );

  const reloadCalendar = useCallback(async () => {
    if (!token) return;
    try {
      const events = await apiRequest("/calendar/events", { token });
      const normalized = Array.isArray(events)
        ? events.map((item) => ({
            id: item.id,
            date_key: item.date_key,
            start_slot: item.start_slot,
            duration_slots: Math.max(1, Number(item.duration_slots || 1)),
            title: item.title || "",
          }))
        : [];
      setCalendarTasks(normalized);
    } catch (err) {
      console.warn("Calendar fetch failed:", err?.message);
      setCalendarTasks([]);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiRequest("/dashboard", { token }),
      apiRequest("/catalog/systems", { token }),
      apiRequest("/processes/store-opening", { token }),
      apiRequest("/construction/asko", { token }),
      apiRequest("/news/feed", { token }),
      apiRequest("/calendar/events", { token }).catch((err) => {
        console.warn("Calendar fetch failed:", err?.message);
        return [];
      }),
    ]).then(([dashboardData, catalogData, projectData, constructionData, newsData, calendarData]) => {
      setDashboard(dashboardData);
      setCatalog(normalizeCatalogWithSingleLicensing(catalogData || []));
      setProjects(projectData);
      setConstructionWidget(constructionData);
      setNewsFeed(Array.isArray(newsData) && newsData.length > 0 ? newsData : MOCK_NEWS);
      const normalized = Array.isArray(calendarData)
        ? calendarData.map((item) => ({
            id: item.id,
            date_key: item.date_key,
            start_slot: item.start_slot,
            duration_slots: Math.max(1, Number(item.duration_slots || 1)),
            title: item.title || "",
          }))
        : [];
      setCalendarTasks(normalized);
      setNewsError("");
    }).catch((err) => {
      setDashboard({});
      setCatalog(normalizeCatalogWithSingleLicensing([]));
      setProjects([]);
      setConstructionWidget(DEFAULT_CONSTRUCTION_WIDGET);
      setNewsFeed(MOCK_NEWS);
      setCalendarTasks([]);
      setNewsError("");
      showToast("Ошибка загрузки", "error");
    });
  }, [token, showToast]);

  useEffect(() => {
    setProfileForm({ full_name: profile?.full_name || "" });
    setAvatarAdjustments({
      focusX: profile?.avatar_focus_x ?? 50,
      focusY: profile?.avatar_focus_y ?? 50,
      scale: profile?.avatar_scale ?? 100,
    });
    setProfileAvatarPreview("");
  }, [profile]);

  useEffect(() => {
    const phrases = SEARCH_PLACEHOLDER_PHRASES;
    const interval = setInterval(() => {
      const phrase = phrases[searchPlaceholderIndex];
      if (!phrase) return;
      const phase = searchPlaceholderPhaseRef.current;
      if (phase === "typing") {
        const idx = searchPlaceholderCharIndexRef.current;
        if (idx < phrase.length) {
          searchPlaceholderCharIndexRef.current = idx + 1;
          setSearchPlaceholderText(phrase.slice(0, idx + 1));
        } else {
          searchPlaceholderPhaseRef.current = "pause";
          searchPlaceholderPauseUntilRef.current = Date.now() + 2500;
        }
      } else if (phase === "pause") {
        if (Date.now() >= searchPlaceholderPauseUntilRef.current) {
          searchPlaceholderPhaseRef.current = "clearing";
        }
      } else if (phase === "clearing") {
        setSearchPlaceholderText((prev) => {
          if (prev.length <= 1) {
            searchPlaceholderPhaseRef.current = "typing";
            searchPlaceholderCharIndexRef.current = 0;
            setSearchPlaceholderIndex((i) => (i + 1) % phrases.length);
            return "";
          }
          return prev.slice(0, -1);
        });
      }
    }, 70);
    return () => clearInterval(interval);
  }, [searchPlaceholderIndex]);

  useEffect(() => {
    const phrases = STORES_SEARCH_PLACEHOLDER_PHRASES;
    const interval = setInterval(() => {
      const phrase = phrases[storesSearchPlaceholderIndex];
      if (!phrase) return;
      const phase = storesSearchPlaceholderPhaseRef.current;
      if (phase === "typing") {
        const idx = storesSearchPlaceholderCharIndexRef.current;
        if (idx < phrase.length) {
          storesSearchPlaceholderCharIndexRef.current = idx + 1;
          setStoresSearchPlaceholderText(phrase.slice(0, idx + 1));
        } else {
          storesSearchPlaceholderPhaseRef.current = "pause";
          storesSearchPlaceholderPauseUntilRef.current = Date.now() + 2500;
        }
      } else if (phase === "pause") {
        if (Date.now() >= storesSearchPlaceholderPauseUntilRef.current) {
          storesSearchPlaceholderPhaseRef.current = "clearing";
        }
      } else if (phase === "clearing") {
        setStoresSearchPlaceholderText((prev) => {
          if (prev.length <= 1) {
            storesSearchPlaceholderPhaseRef.current = "typing";
            storesSearchPlaceholderCharIndexRef.current = 0;
            setStoresSearchPlaceholderIndex((i) => (i + 1) % phrases.length);
            return "";
          }
          return prev.slice(0, -1);
        });
      }
    }, 70);
    return () => clearInterval(interval);
  }, [storesSearchPlaceholderIndex]);

  useEffect(() => {
    if (!profile?.id) return;
    const savedTheme = localStorage.getItem(`${THEME_KEY_PREFIX}_${profile.id}`);
    setTheme(savedTheme === "dark" ? "dark" : "light");
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    try {
      const viewModeRaw = localStorage.getItem(`${PORTALS_VIEW_MODE_KEY_PREFIX}_${profile.id}`);
      const favRaw = localStorage.getItem(`${PORTALS_FAVORITES_KEY_PREFIX}_${profile.id}`);
      const hiddenRaw = localStorage.getItem(`${PORTALS_HIDDEN_KEY_PREFIX}_${profile.id}`);
      const showSliderRaw = localStorage.getItem(`${SHOW_PORTALS_SLIDER_KEY_PREFIX}_${profile.id}`);

      const mode = viewModeRaw === "compact" || viewModeRaw === "list" ? viewModeRaw : "grid";
      setPortalViewMode(mode);

      const favoritesParsed = favRaw ? JSON.parse(favRaw) : [];
      setPortalFavorites(Array.isArray(favoritesParsed) ? favoritesParsed.map(String) : []);

      const hiddenParsed = hiddenRaw ? JSON.parse(hiddenRaw) : [];
      setHiddenPortalIds(Array.isArray(hiddenParsed) ? hiddenParsed.map(String) : []);
      setShowPortalsSlider(showSliderRaw !== "0");
    } catch {
      setPortalViewMode("grid");
      setPortalFavorites([]);
      setHiddenPortalIds([]);
      setShowPortalsSlider(true);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    localStorage.setItem(`${THEME_KEY_PREFIX}_${profile.id}`, theme);
  }, [theme, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    localStorage.setItem(`${PORTALS_VIEW_MODE_KEY_PREFIX}_${profile.id}`, portalViewMode);
  }, [portalViewMode, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    localStorage.setItem(`${PORTALS_FAVORITES_KEY_PREFIX}_${profile.id}`, JSON.stringify(portalFavorites));
  }, [portalFavorites, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    localStorage.setItem(`${PORTALS_HIDDEN_KEY_PREFIX}_${profile.id}`, JSON.stringify(hiddenPortalIds));
  }, [hiddenPortalIds, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    localStorage.setItem(`${SHOW_PORTALS_SLIDER_KEY_PREFIX}_${profile.id}`, showPortalsSlider ? "1" : "0");
  }, [showPortalsSlider, profile?.id]);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    return () => document.body.classList.remove("theme-dark");
  }, [theme]);

  const focusablesSelector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";
  const trapModalFocus = useCallback((container, e) => {
    if (e.key !== "Tab" || !container?.current) return;
    const focusable = Array.from(container.current.querySelectorAll(focusablesSelector)).filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!addPortalModalOpen || !addPortalModalRef.current) return;
    addPortalTriggerRef.current = document.activeElement;
    const first = addPortalModalRef.current.querySelector(focusablesSelector);
    if (first) first.focus();
    const onKeyDown = (e) => trapModalFocus(addPortalModalRef, e);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const t = addPortalTriggerRef.current;
      if (t && typeof t.focus === "function") setTimeout(() => t.focus(), 0);
    };
  }, [addPortalModalOpen, trapModalFocus]);

  /* Iframe открыт в основной области; фокус не ловим, чтобы сайдбар оставался доступным */

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (!profile?.id) return;
    const raw = localStorage.getItem(`${WIDGET_LAYOUT_KEY_PREFIX}_${profile.id}`);
    if (!raw) {
      setDesktopWidgets(DEFAULT_DESKTOP_WIDGETS);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setDesktopWidgets(DEFAULT_DESKTOP_WIDGETS);
        return;
      }
      setDesktopWidgets(sanitizeDesktopWidgets(parsed));
    } catch {
      setDesktopWidgets(DEFAULT_DESKTOP_WIDGETS);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const raw = localStorage.getItem(`${VISIBLE_WIDGETS_KEY_PREFIX}_${profile.id}`);
    if (!raw) {
      setVisibleWidgetIds(DEFAULT_VISIBLE_WIDGET_IDS);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const filtered = Array.isArray(parsed)
        ? parsed.filter((id) => DEFAULT_DESKTOP_WIDGETS.some((widget) => widget.id === id))
        : [];
      setVisibleWidgetIds(filtered.length ? filtered : DEFAULT_VISIBLE_WIDGET_IDS);
    } catch {
      setVisibleWidgetIds(DEFAULT_VISIBLE_WIDGET_IDS);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const raw = localStorage.getItem(`${COLUMN_WIDTHS_KEY_PREFIX}_${profile.id}`);
    if (!raw) {
      setDesktopColumnWidths(DEFAULT_COLUMN_WIDTHS);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const next = {
        left: Number.isFinite(Number(parsed?.left)) ? Number(parsed.left) : DEFAULT_COLUMN_WIDTHS.left,
        middle: Number.isFinite(Number(parsed?.middle)) ? Number(parsed.middle) : DEFAULT_COLUMN_WIDTHS.middle,
        right: Number.isFinite(Number(parsed?.right)) ? Number(parsed.right) : DEFAULT_COLUMN_WIDTHS.right,
      };
      setDesktopColumnWidths(next);
    } catch {
      setDesktopColumnWidths(DEFAULT_COLUMN_WIDTHS);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    localStorage.setItem(`${WIDGET_LAYOUT_KEY_PREFIX}_${profile.id}`, JSON.stringify(desktopWidgets));
  }, [desktopWidgets, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    localStorage.setItem(`${COLUMN_WIDTHS_KEY_PREFIX}_${profile.id}`, JSON.stringify(desktopColumnWidths));
  }, [desktopColumnWidths, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    localStorage.setItem(`${VISIBLE_WIDGETS_KEY_PREFIX}_${profile.id}`, JSON.stringify(visibleWidgetIds));
  }, [visibleWidgetIds, profile?.id]);

  useEffect(() => {
    const sanitized = sanitizeDesktopWidgets(desktopWidgets);
    const isSame =
      sanitized.length === desktopWidgets.length &&
      sanitized.every(
        (widget, index) =>
          widget.id === desktopWidgets[index]?.id &&
          widget.span === desktopWidgets[index]?.span &&
          widget.rowSpan === desktopWidgets[index]?.rowSpan &&
          widget.column === desktopWidgets[index]?.column
      );
    if (!isSame) {
      setDesktopWidgets(sanitized);
    }
  }, [desktopWidgets]);

  useEffect(() => {
    if (!profileAvatarFile) {
      setProfileAvatarPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(profileAvatarFile);
    setProfileAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [profileAvatarFile]);

  useEffect(() => {
    if (!newsImage) {
      setNewsImagePreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(newsImage);
    setNewsImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [newsImage]);

  useEffect(() => {
    if (!isDraggingAvatar) return;

    const handleMouseMove = (event) => {
      const drag = avatarDragRef.current;
      const deltaX = event.clientX - drag.startClientX;
      const deltaY = event.clientY - drag.startClientY;
      const { min: minCenter, max: maxCenter } = getAvatarFocusLimits();
      const nextFocusX = Math.max(minCenter, Math.min(maxCenter, drag.startFocusX + (deltaX / drag.frameWidth) * 100));
      const nextFocusY = Math.max(minCenter, Math.min(maxCenter, drag.startFocusY + (deltaY / drag.frameHeight) * 100));
      setAvatarAdjustments((prev) => ({
        ...prev,
        focusX: Number(nextFocusX.toFixed(1)),
        focusY: Number(nextFocusY.toFixed(1)),
      }));
    };

    const handleMouseUp = () => setIsDraggingAvatar(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingAvatar]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (event) => {
      const nextWidth = Math.max(180, Math.min(420, event.clientX));
      setSidebarWidth(nextWidth);
    };
    const handleMouseUp = () => setIsResizingSidebar(false);

    document.body.classList.add("is-resizing");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.classList.remove("is-resizing");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (!isDraggingPortals) return;

    const handleMouseMove = (event) => {
      const slider = portalsSliderRef.current;
      if (!slider) return;
      const drag = portalsDragRef.current;
      const deltaX = event.clientX - drag.startX;
      if (Math.abs(deltaX) > 4) {
        drag.moved = true;
        suppressPortalClickRef.current = true;
      }
      slider.scrollLeft = drag.startScrollLeft - deltaX;
    };
    const handleMouseUp = () => setIsDraggingPortals(false);

    document.body.classList.add("is-widget-dragging");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.classList.remove("is-widget-dragging");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPortals]);

  useEffect(() => {
    if (!isDraggingActivity) return;
    const handleMouseMove = (event) => {
      const slider = activitySliderRef.current;
      if (!slider) return;
      const drag = activityDragRef.current;
      const deltaX = event.clientX - drag.startX;
      if (Math.abs(deltaX) > 4) {
        drag.moved = true;
        suppressActivityClickRef.current = true;
      }
      slider.scrollLeft = drag.startScrollLeft - deltaX;
    };
    const handleMouseUp = () => setIsDraggingActivity(false);
    document.body.classList.add("is-widget-dragging");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.classList.remove("is-widget-dragging");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingActivity]);

  const taskMetrics = useMemo(() => {
    const total = projects.length;
    const launching = projects.filter((project) => project.stage === "Запуск объекта").length;
    const inProgress = projects.filter((project) => project.readiness_percent < 100).length;
    const done = projects.filter((project) => project.readiness_percent === 100).length;
    return { total, launching, inProgress, done };
  }, [projects]);
  const portalCategories = useMemo(() => {
    const cats = Array.from(new Set(catalog.map((item) => item.category).filter(Boolean)));
    return ["Все", ...cats];
  }, [catalog]);
  const portalCategoryCounts = useMemo(() => {
    const visible = catalog.filter((item) => !hiddenPortalIds.includes(String(item.id)));
    const counts = { Все: visible.length };
    visible.forEach((item) => {
      const c = item.category || "";
      if (c) counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [catalog, hiddenPortalIds]);
  const filteredCatalog = useMemo(() => {
    const search = portalSearch.trim().toLowerCase();
    return catalog
      .filter((item) => !hiddenPortalIds.includes(String(item.id)))
      .filter((item) => (selectedPortalCategory === "Все" ? true : item.category === selectedPortalCategory))
      .filter((item) => {
        if (!search) return true;
        return (
          String(item.title || "").toLowerCase().includes(search) ||
          String(item.description || "").toLowerCase().includes(search) ||
          String(item.category || "").toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        const aFav = portalFavorites.includes(String(a.id));
        const bFav = portalFavorites.includes(String(b.id));
        if (aFav !== bFav) return aFav ? -1 : 1;
        return String(a.title || "").localeCompare(String(b.title || ""), "ru");
      });
  }, [catalog, hiddenPortalIds, selectedPortalCategory, portalSearch, portalFavorites]);

  const storesUniqueValues = useMemo(() => {
    const cities = [...new Set(PYATEROCHKA_STORES.map((s) => s.city))].sort();
    const regions = [...new Set(PYATEROCHKA_STORES.map((s) => s.region))].sort();
    const formats = [...new Set(PYATEROCHKA_STORES.map((s) => s.format))].sort();
    const hours = [...new Set(PYATEROCHKA_STORES.map((s) => s.hours))].sort();
    return { cities, regions, formats, hours };
  }, []);

  const filteredStores = useMemo(() => {
    let list = PYATEROCHKA_STORES;
    const q = storeSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.code.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q) ||
          s.format.toLowerCase().includes(q) ||
          (s.hours && s.hours.toLowerCase().includes(q))
      );
    }
    if (storeFilterCity) list = list.filter((s) => s.city === storeFilterCity);
    if (storeFilterRegion) list = list.filter((s) => s.region === storeFilterRegion);
    if (storeFilterFormat) list = list.filter((s) => s.format === storeFilterFormat);
    if (storeFilterHours) list = list.filter((s) => s.hours === storeFilterHours);
    return list;
  }, [storeSearchQuery, storeFilterCity, storeFilterRegion, storeFilterFormat, storeFilterHours]);

  const activityFeedItems = useMemo(() => {
    const items = [];

    calendarTasks.forEach((task) => {
      const day = fromDateKey(task.date_key);
      const [hours, minutes] = String(task.start_slot || "00:00").split(":").map(Number);
      day.setHours(hours || 0, minutes || 0, 0, 0);
      const durationHours = (Math.max(1, Number(task.duration_slots || 1)) * 30) / 60;
      items.push({
        id: `cal-${task.id}`,
        source: "calendar",
        sourceLabel: "Календарь",
        title: task.title || "Событие календаря",
        context: `${task.date_key} · ${task.start_slot} · ${durationHours.toFixed(1)} ч`,
        ts: day.getTime(),
        priority: "normal",
        dateKey: task.date_key,
      });
    });

    projects.forEach((project) => {
      const plannedTs = project.planned_open_date ? new Date(project.planned_open_date).getTime() : Date.now();
      items.push({
        id: `proj-${project.id}`,
        source: "projects",
        sourceLabel: "Задачи",
        title: `${project.code}: ${project.stage}`,
        context: `${project.city} · готовность ${project.readiness_percent}% · план ${project.planned_open_date || "—"}`,
        ts: Number.isFinite(plannedTs) ? plannedTs : Date.now(),
        priority: project.readiness_percent < 60 ? "attention" : "normal",
      });
    });

    const allConstructionProjects = Object.values(constructionWidget?.projects_by_stage || {}).flat();
    const relatedConstructionProjects = allConstructionProjects.filter(
      (project) => profile?.role_code === "admin" || project.manager === profile?.full_name
    );
    relatedConstructionProjects.forEach((project) => {
      items.push({
        id: `con-${project.code}`,
        source: "construction",
        sourceLabel: "Стройка",
        title: `${project.code}: ${project.stage}`,
        context: `${project.city} · ${project.manager} · готовность ${project.readiness_percent}%`,
        ts: Date.now() - (100 - Number(project.readiness_percent || 0)) * 3_600_000,
        priority: project.risk ? "attention" : "normal",
      });
    });

    newsFeed.forEach((item) => {
      const dateTs = new Date(item.published_at || item.created_at || Date.now()).getTime();
      const pollContext = item.kind === "poll" ? ` · ${item.total_votes} голосов` : "";
      items.push({
        id: `news-${item.id}`,
        source: "news",
        sourceLabel: "Новости",
        title: item.title,
        context: `${item.author_name || "Автор"}${pollContext}`,
        ts: Number.isFinite(dateTs) ? dateTs : Date.now(),
        priority: "normal",
      });
    });

    return items.sort((a, b) => b.ts - a.ts).slice(0, 120);
  }, [calendarTasks, projects, constructionWidget, profile?.role_code, profile?.full_name, newsFeed]);
  const activityFeedVisibleItems = useMemo(() => {
    if (activityFeedFilter === "all") return activityFeedItems;
    return activityFeedItems.filter((item) => item.source === activityFeedFilter);
  }, [activityFeedItems, activityFeedFilter]);
  const constructionStages = useMemo(() => constructionWidget?.stages || [], [constructionWidget]);
  const constructionMaxStageCount = useMemo(
    () => Math.max(...constructionStages.map((item) => item.count), 1),
    [constructionStages]
  );
  const constructionAllProjects = useMemo(() => {
    if (!constructionWidget?.projects_by_stage) return [];
    return Object.values(constructionWidget.projects_by_stage).flat();
  }, [constructionWidget]);
  const constructionVisibleProjects = useMemo(() => {
    if (selectedConstructionStage === "all") return constructionAllProjects;
    return constructionWidget?.projects_by_stage?.[selectedConstructionStage] || [];
  }, [constructionAllProjects, constructionWidget, selectedConstructionStage]);
  const selectedConstructionProject = useMemo(() => {
    if (!selectedConstructionProjectCode) return null;
    return (
      constructionVisibleProjects.find((item) => item.code === selectedConstructionProjectCode) ||
      constructionAllProjects.find((item) => item.code === selectedConstructionProjectCode) ||
      null
    );
  }, [constructionAllProjects, constructionVisibleProjects, selectedConstructionProjectCode]);

  const calendarSlots = useMemo(() => {
    const slots = [];
    for (let hour = SLOT_START_HOUR; hour <= SLOT_END_HOUR; hour += 1) {
      slots.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour < SLOT_END_HOUR) {
        slots.push(`${String(hour).padStart(2, "0")}:30`);
      }
    }
    return slots;
  }, []);

  const calendarMonthDays = useMemo(() => buildMonthDays(selectedCalendarDate), [selectedCalendarDate]);
  const calendarMonthLabel = useMemo(
    () =>
      fromDateKey(selectedCalendarDate).toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric",
      }),
    [selectedCalendarDate]
  );
  const selectedCalendarLabel = useMemo(
    () =>
      fromDateKey(selectedCalendarDate).toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [selectedCalendarDate]
  );

  const selectedDayTasks = useMemo(
    () => calendarTasks.filter((item) => item.date_key === selectedCalendarDate),
    [calendarTasks, selectedCalendarDate]
  );
  const eventDateKeys = useMemo(() => new Set(calendarTasks.map((item) => item.date_key)), [calendarTasks]);

  const slotTaskMap = useMemo(() => {
    const map = {};
    selectedDayTasks
      .slice()
      .sort((a, b) => {
        const byStart = a.start_slot.localeCompare(b.start_slot);
        if (byStart !== 0) return byStart;
        return String(a.id).localeCompare(String(b.id));
      })
      .forEach((task) => {
        const startIdx = calendarSlots.indexOf(task.start_slot);
        if (startIdx < 0) return;
        const duration = Math.max(1, task.duration_slots || 1);
        for (let idx = startIdx; idx < Math.min(calendarSlots.length, startIdx + duration); idx += 1) {
          const slot = calendarSlots[idx];
          if (!map[slot]) map[slot] = [];
          map[slot].push({ task, isStart: idx === startIdx });
        }
      });
    return map;
  }, [selectedDayTasks, calendarSlots]);

  const activityDaysData = useMemo(() => {
    const selected = fromDateKey(selectedCalendarDate);
    const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);

    const hoursByDate = calendarTasks.reduce((acc, item) => {
      const key = item.date_key;
      const hours = Math.max(1, Number(item.duration_slots || 1)) * 0.5;
      acc[key] = (acc[key] || 0) + hours;
      return acc;
    }, {});

    const days = [];
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const dateKey = toDateKey(d);
      const hours = Number((hoursByDate[dateKey] || 0).toFixed(1));
      days.push({
        dateKey,
        dayLabel: d.toLocaleDateString("ru-RU", { day: "numeric" }),
        weekday: d.toLocaleDateString("ru-RU", { weekday: "short" }),
        hours,
        isSelected: dateKey === selectedCalendarDate,
      });
    }
    return days;
  }, [calendarTasks, selectedCalendarDate]);

  const activityMaxHours = useMemo(() => {
    return Math.max(...activityDaysData.map((day) => day.hours), 1);
  }, [activityDaysData]);
  const activityTargetPercent = useMemo(() => {
    return Math.max(0, Math.min(100, Math.round((ACTIVITY_TARGET_HOURS / activityMaxHours) * 100)));
  }, [activityMaxHours]);
  const activityOverloadCount = useMemo(() => {
    return activityDaysData.filter((day) => day.hours > ACTIVITY_TARGET_HOURS).length;
  }, [activityDaysData]);

  const reloadNews = async () => {
    const feed = await apiRequest("/news/feed", { token });
    setNewsFeed(feed);
    setNewsError("");
  };

  const resetNewsComposer = () => {
    setNewsForm({
      id: null,
      title: "",
      content: "",
      kind: "event",
      options: ["", ""],
      publishNow: true,
      imagePlacement: "top",
      textLayout: "below",
      pollChartType: "bar",
      imageUrl: null,
    });
    setNewsImage(null);
    setNewsImagePreview("");
    setIsNewsEditMode(false);
    setShowDeleteConfirm(false);
  };

  const openCreateNewsModal = () => {
    setNewsError("");
    resetNewsComposer();
    setIsNewsModalOpen(true);
  };

  const openEditNewsModal = (item) => {
    setNewsError("");
    setIsNewsEditMode(true);
    setNewsImage(null);
    setNewsImagePreview("");
    setNewsForm({
      id: item.id,
      title: item.title || "",
      content: item.content || "",
      kind: item.kind || "event",
      options: item.kind === "poll" ? item.options.map((option) => option.option_text) : ["", ""],
      publishNow: item.status === "published",
      imagePlacement: item.image_placement || "top",
      textLayout: item.text_layout || "below",
      pollChartType: item.poll_chart_type || "bar",
      imageUrl: item.image_url || null,
    });
    setIsNewsModalOpen(true);
  };

  const uploadNewsImage = async () => {
    if (!newsImage) return null;
    const formData = new FormData();
    formData.append("file", newsImage);
    const response = await fetch(`${API_ROOT}/api/news/upload-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(formatUiError(payload.detail, "Не удалось загрузить изображение"));
    }
    const payload = await response.json();
    return payload.image_url;
  };

  const publishNews = async () => {
    if (!newsForm.title.trim() || !newsForm.content.trim()) {
      setNewsError("Заполните заголовок и текст новости");
      return;
    }
    if (newsForm.kind === "poll" && newsForm.options.filter((item) => item.trim()).length < 2) {
      setNewsError("Для опроса нужно минимум 2 варианта ответа");
      return;
    }

    setNewsSaving(true);
    setNewsError("");
    try {
      const uploadedImageUrl = await uploadNewsImage();
      const body = {
        title: newsForm.title,
        content: newsForm.content,
        kind: newsForm.kind,
        image_url: uploadedImageUrl || newsForm.imageUrl,
        options: newsForm.options.filter((item) => item.trim()).map((option_text) => ({ option_text })),
        image_placement: newsForm.imagePlacement,
        text_layout: newsForm.textLayout,
        poll_chart_type: newsForm.pollChartType,
      };

      if (isNewsEditMode && newsForm.id) {
        await apiRequest(`/news/${newsForm.id}`, {
          method: "PUT",
          token,
          body,
        });
      } else {
        const created = await apiRequest("/news", {
          method: "POST",
          token,
          body,
        });
        if (newsForm.publishNow) {
          await apiRequest(`/news/${created.id}/publish`, { method: "POST", token });
        }
      }

      resetNewsComposer();
      setIsNewsModalOpen(false);
      await reloadNews();
    } catch (err) {
      setNewsError(sanitizeUiErrorMessage(err?.message || "Ошибка запроса"));
    } finally {
      setNewsSaving(false);
    }
  };

  const deleteNews = () => {
    if (!isNewsEditMode || !newsForm.id) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteNews = async () => {
    if (!isNewsEditMode || !newsForm.id) return;
    setNewsDeleting(true);
    setNewsError("");
    try {
      await apiRequest(`/news/${newsForm.id}`, {
        method: "DELETE",
        token,
      });
      resetNewsComposer();
      setIsNewsModalOpen(false);
      await reloadNews();
    } catch (err) {
      setNewsError(sanitizeUiErrorMessage(err?.message || "Ошибка запроса"));
    } finally {
      setNewsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const vote = async (newsId, optionId) => {
    try {
      await apiRequest(`/news/${newsId}/vote`, {
        method: "POST",
        token,
        body: { option_id: optionId },
      });
      await reloadNews();
    } catch (err) {
      setNewsError(sanitizeUiErrorMessage(err?.message || "Ошибка запроса"));
    }
  };

  const pollCards = newsFeed.filter((item) => item.kind === "poll");
  const initials = (profile?.full_name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  // Кроп-редактор работает только с новым выбранным файлом.
  // Подставлять сюда уже сохранённый avatar_url нельзя: это вызывает "повторный кроп" и визуальный зум.
  const avatarPreviewSrc = profileAvatarPreview || "";
  const avatarCommittedSrc = profile?.avatar_url || "";
  const avatarCommittedStyle = {};
  const avatarPreviewTransform = `translate(calc(-50% + ${(avatarAdjustments.focusX - 50) * 1.5}%), calc(-50% + ${(avatarAdjustments.focusY - 50) * 1.5}%)) scale(${avatarAdjustments.scale / 100})`;
  const avatarFocusLimits = getAvatarFocusLimits();
  const nudgeAvatarAdjustment = (key, delta, min, max) => {
    setAvatarAdjustments((prev) => ({
      ...prev,
      [key]: Math.max(min, Math.min(max, prev[key] + delta)),
    }));
  };

  const beginAvatarDrag = (event) => {
    if (!avatarPreviewSrc || !avatarFrameRef.current) return;
    event.preventDefault();
    const rect = avatarFrameRef.current.getBoundingClientRect();
    avatarDragRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFocusX: avatarAdjustments.focusX,
      startFocusY: avatarAdjustments.focusY,
      frameWidth: Math.max(rect.width, 1),
      frameHeight: Math.max(rect.height, 1),
    };
    setIsDraggingAvatar(true);
  };

  const beginSidebarResize = (event) => {
    if (isSidebarCollapsed) return;
    event.preventDefault();
    setIsResizingSidebar(true);
  };

  const moveCalendarMonth = (step) => {
    const current = fromDateKey(selectedCalendarDate);
    current.setMonth(current.getMonth() + step);
    setSelectedCalendarDate(toDateKey(current));
    setIsCalendarDayOpen(true);
    setCalendarDraft({ slot: null, title: "", durationSlots: 1 });
  };

  const moveCalendarYear = (step) => {
    const current = fromDateKey(selectedCalendarDate);
    current.setFullYear(current.getFullYear() + step);
    setSelectedCalendarDate(toDateKey(current));
    setIsCalendarDayOpen(true);
    setCalendarDraft({ slot: null, title: "", durationSlots: 1 });
  };

  const openCalendarSlotDraft = (slot) => {
    setCalendarDraft({ slot, title: "", durationSlots: 1 });
  };

  const isSlotRangeOutOfBounds = (startSlot, durationSlots) => {
    const startIdx = calendarSlots.indexOf(startSlot);
    if (startIdx < 0) return true;
    const untilIdx = startIdx + durationSlots - 1;
    if (untilIdx >= calendarSlots.length) return true;
    return false;
  };

  const saveCalendarTask = async () => {
    const title = calendarDraft.title.trim();
    if (!title || !calendarDraft.slot) return;
    const durationSlots = Math.max(1, Number(calendarDraft.durationSlots || 1));
    if (isSlotRangeOutOfBounds(calendarDraft.slot, durationSlots)) {
      setNewsError("Событие выходит за границы рабочего времени.");
      return;
    }
    try {
      const event = await apiRequest("/calendar/events", {
        method: "POST",
        token,
        body: {
          date_key: selectedCalendarDate,
          start_slot: calendarDraft.slot,
          duration_slots: durationSlots,
          title,
        },
      });
      setCalendarTasks((prev) => [
        ...prev,
        {
          id: event.id,
          date_key: event.date_key,
          start_slot: event.start_slot,
          duration_slots: event.duration_slots,
          title: event.title,
        },
      ]);
      setNewsError("");
      setCalendarDraft({ slot: null, title: "", durationSlots: 1 });
    } catch (err) {
      setNewsError(err?.message || "Не удалось сохранить событие.");
    }
  };

  const removeCalendarTask = async (taskId) => {
    try {
      await apiRequest(`/calendar/events/${taskId}`, { method: "DELETE", token });
      setCalendarTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch {
      setNewsError("Не удалось удалить событие.");
    }
  };

  const getTaskRangeLabel = (task) => {
    const startMinutes = slotToMinutes(task.start_slot);
    const endMinutes = startMinutes + Math.max(1, task.duration_slots || 1) * 30;
    return `${minutesToLabel(startMinutes)}-${minutesToLabel(endMinutes)}`;
  };

  const isDraggingWidget = activeWidgetId !== null;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );
  const collisionDetectionStrategy = (args) => {
    const pointerMatches = pointerWithin(args);
    if (pointerMatches.length > 0) return pointerMatches;
    return rectIntersection(args);
  };

  const visibleDesktopWidgets = useMemo(
    () => desktopWidgets.filter((item) => visibleWidgetIds.includes(item.id)),
    [desktopWidgets, visibleWidgetIds]
  );

  const previewWidgets = useMemo(() => {
    if (!dropHint || !activeWidgetId) return visibleDesktopWidgets;
    return applyWidgetDrop(visibleDesktopWidgets, activeWidgetId, dropHint.targetId, dropHint.position, dropHint.column || null);
  }, [visibleDesktopWidgets, activeWidgetId, dropHint]);

  const previewBlocks = useMemo(() => buildWidgetBlocks(previewWidgets), [previewWidgets]);
  const activeWidget = useMemo(
    () => (activeWidgetId ? desktopWidgets.find((item) => item.id === activeWidgetId) || null : null),
    [desktopWidgets, activeWidgetId]
  );

  const normalizeDropHint = (parsed, draggedId) => {
    if (!parsed) return null;
    const visibleWidgetMap = new Map(visibleDesktopWidgets.map((item) => [item.id, item]));
    if (parsed.type === "widget") {
      if (parsed.targetId === draggedId) return null;
      let position = parsed.position;
      const hintedColumn = DESKTOP_COLUMNS.includes(parsed.column) ? parsed.column : null;
      const targetWidget = visibleWidgetMap.get(parsed.targetId) || desktopWidgets.find((item) => item.id === parsed.targetId);
      const resolveSideColumnForTarget = (targetColumnName, sidePosition) => {
        const fallback = sidePosition === "left" ? "left" : "right";
        if (!DESKTOP_COLUMNS.includes(targetColumnName)) return fallback;
        const idx = DESKTOP_COLUMNS.indexOf(targetColumnName);
        if (sidePosition === "left") {
          return DESKTOP_COLUMNS[Math.max(0, idx - 1)];
        }
        return DESKTOP_COLUMNS[Math.min(DESKTOP_COLUMNS.length - 1, idx + 1)];
      };
      if (position === "left" || position === "right") {
        const targetNode = document.querySelector(`[data-widget-id="${parsed.targetId}"]`);
        const verticalPosition =
          targetNode && widgetPointerRef.current.y < targetNode.getBoundingClientRect().top + targetNode.getBoundingClientRect().height / 2
            ? "top"
            : "bottom";
        const sideColumn = hintedColumn || resolveSideColumnForTarget(targetWidget?.column || "left", position);
        return {
          targetId: parsed.targetId,
          position: verticalPosition,
          column: sideColumn,
        };
      }
      return {
        targetId: parsed.targetId,
        position,
        column: hintedColumn || (targetWidget && targetWidget.span < 10 ? targetWidget.column || null : null),
      };
    }
    if (parsed.type === "column") {
      // Use currently rendered preview blocks: dropcol block indexes come from DOM of preview layout.
      const block = previewBlocks[parsed.blockIndex];
      if (!block || block.type !== "columns") return null;
      const targetColumn = (block.columns[parsed.column] || []).filter((item) => item.id !== draggedId);
      if (targetColumn.length > 0) {
        const anchor = targetColumn[targetColumn.length - 1];
        return { targetId: anchor.id, position: "bottom", column: parsed.column };
      }
      const siblingColumn = DESKTOP_COLUMNS
        .map((column) => (block.columns[column] || []).filter((item) => item.id !== draggedId))
        .find((items) => items.length > 0);
      if (siblingColumn && siblingColumn.length > 0) {
        const anchor = siblingColumn[siblingColumn.length - 1];
        return { targetId: anchor.id, position: "bottom", column: parsed.column };
      }
      const baseWidgets = visibleDesktopWidgets.filter((item) => item.id !== draggedId);
      if (baseWidgets.length > 0) {
        const anchor = baseWidgets[baseWidgets.length - 1];
        return { targetId: anchor.id, position: "bottom", column: parsed.column };
      }
    }
    return null;
  };

  const resetWidgetDnd = () => {
    setActiveWidgetId(null);
    activeWidgetIdRef.current = null;
    setDropHint(null);
    widgetDropHintRef.current = null;
    lastPointerColumnRef.current = null;
    lastPointerTargetRef.current = null;
    setDragOverlaySize(null);
  };

  const commitWidgetDrop = (draggedId, targetId, position, column = null) => {
    if (!draggedId || !targetId || draggedId === targetId) {
      resetWidgetDnd();
      return;
    }
    setDesktopWidgets((prev) => applyWidgetDrop(prev, draggedId, targetId, position, column));
    resetWidgetDnd();
  };

  const handleWidgetDragStart = (event) => {
    const draggedId = String(event.active.id);
    const activatorEvent = event.activatorEvent;
    if (activatorEvent && "clientX" in activatorEvent && "clientY" in activatorEvent) {
      widgetPointerRef.current = { x: activatorEvent.clientX, y: activatorEvent.clientY };
    }
    const widgetNode = document.querySelector(`[data-widget-id="${draggedId}"]`);
    if (widgetNode) {
      const rect = widgetNode.getBoundingClientRect();
      setDragOverlaySize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    } else {
      setDragOverlaySize(null);
    }
    setActiveWidgetId(draggedId);
    activeWidgetIdRef.current = draggedId;
    setDropHint(null);
    widgetDropHintRef.current = null;
  };

  const resolveDropHintFromPointer = (draggedId) => {
    const pointerColumn = lastPointerColumnRef.current;
    const pointerTarget = lastPointerTargetRef.current;
    const safeColumn = DESKTOP_COLUMNS.includes(pointerColumn) ? pointerColumn : null;

    if (pointerTarget && pointerTarget.id !== draggedId && safeColumn) {
      return {
        targetId: pointerTarget.id,
        position: pointerTarget.position || "bottom",
        column: safeColumn,
      };
    }

    if (safeColumn) {
      const columnWidgets = visibleDesktopWidgets.filter(
        (w) => w.id !== draggedId && w.column === safeColumn && snapWidgetSpan(w.span) < 10
      );
      if (columnWidgets.length > 0) {
        return {
          targetId: columnWidgets[columnWidgets.length - 1].id,
          position: "bottom",
          column: safeColumn,
        };
      }
    }

    const fallbackWidgets = visibleDesktopWidgets.filter((item) => item.id !== draggedId);
    if (fallbackWidgets.length > 0) {
      const anchor = fallbackWidgets[fallbackWidgets.length - 1];
      return { targetId: anchor.id, position: "bottom", column: safeColumn || anchor.column || "left" };
    }
    return null;
  };

  const handleWidgetDragOver = (event) => {
    const draggedId = activeWidgetIdRef.current || activeWidgetId;
    if (!event.over) {
      setDropHint(null);
      return;
    }
    const overId = typeof event.over.id === "string" ? event.over.id : String(event.over.id);
    const parsed = parseDropZoneId(overId);
    const hint = normalizeDropHint(parsed, draggedId);
    setDropHint(hint ?? null);
  };

  useEffect(() => {
    if (!isDraggingWidget || !activeWidgetId) return;
    let animationFrame = 0;
    let lastPointerEvent = null;

    const processPointerMove = () => {
      if (!lastPointerEvent) return;
      const event = lastPointerEvent;
      lastPointerEvent = null;
      animationFrame = 0;
      const px = event.clientX;
      const py = event.clientY;
      widgetPointerRef.current = { x: px, y: py };

      const columnNodes = document.querySelectorAll("[data-desktop-column]");
      let hitColumn = null;
      for (const node of columnNodes) {
        const rect = node.getBoundingClientRect();
        if (px >= rect.left && px <= rect.right && py >= rect.top - 40 && py <= rect.bottom + 40) {
          hitColumn = node.dataset.desktopColumn;
          break;
        }
      }
      if (DESKTOP_COLUMNS.includes(hitColumn)) {
        lastPointerColumnRef.current = hitColumn;
      }

      const widgetNodes = document.querySelectorAll("[data-widget-id]");
      let closestWidget = null;
      let closestDistance = Infinity;
      for (const node of widgetNodes) {
        const wid = node.dataset.widgetId;
        if (wid === activeWidgetId) continue;
        const rect = node.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.abs(px - cx) + Math.abs(py - cy);
        if (dist < closestDistance) {
          closestDistance = dist;
          const pos = py < rect.top + rect.height / 2 ? "top" : "bottom";
          closestWidget = { id: wid, position: pos };
        }
      }
      if (closestWidget) {
        lastPointerTargetRef.current = closestWidget;
      }
      /* Подсказка дропа берётся из handleWidgetDragOver (event.over); refs — только для fallback при drop вне зоны */
    };

    const handlePointerMove = (event) => {
      lastPointerEvent = event;
      if (!animationFrame) {
        animationFrame = requestAnimationFrame(processPointerMove);
      }
    };
    window.addEventListener("mousemove", handlePointerMove);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      window.removeEventListener("mousemove", handlePointerMove);
    };
  }, [isDraggingWidget, activeWidgetId]);

  const handleWidgetDragEnd = (event) => {
    const draggedId = activeWidgetIdRef.current || activeWidgetId;
    if (!draggedId) {
      resetWidgetDnd();
      return;
    }
    let hint = null;
    if (event.over) {
      const parsed = parseDropZoneId(String(event.over.id));
      hint = normalizeDropHint(parsed, draggedId);
    }
    if (!hint) {
      hint = resolveDropHintFromPointer(draggedId);
    }
    if (hint) {
      commitWidgetDrop(draggedId, hint.targetId, hint.position, hint.column ?? null);
    } else {
      resetWidgetDnd();
    }
  };

  const handleWidgetDragCancel = () => {
    resetWidgetDnd();
  };

  useEffect(() => {
    document.body.classList.toggle("is-widget-dragging", isDraggingWidget);
    return () => document.body.classList.remove("is-widget-dragging");
  }, [isDraggingWidget]);

  useEffect(() => {
    if (!columnResizeState) return;
    const handleMouseMove = (event) => {
      const { startX, containerWidth, leftColumn, rightColumn, pairTotal, leftStart } = columnResizeState;
      const deltaPercent = ((event.clientX - startX) / Math.max(containerWidth, 1)) * 100;
      const min = 18;
      const nextLeft = Math.max(min, Math.min(pairTotal - min, leftStart + deltaPercent));
      const nextRight = pairTotal - nextLeft;
      setDesktopColumnWidths((prev) => ({
        ...prev,
        [leftColumn]: Number(nextLeft.toFixed(2)),
        [rightColumn]: Number(nextRight.toFixed(2)),
      }));
    };
    const handleMouseUp = () => setColumnResizeState(null);
    document.body.classList.add("is-resizing");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.classList.remove("is-resizing");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [columnResizeState]);

  const cycleWidgetSize = (widgetId) => {
    setDesktopWidgets((prev) =>
      prev.map((item) =>
        item.id === widgetId
          ? (() => {
              const nextSpan = getNextWidgetSpan(item.span);
              const baseColumn = item.column || "left";
              const nextColumn =
                nextSpan >= 10 ? null : nextSpan >= 8 ? (baseColumn === "right" ? "middle" : baseColumn) : baseColumn;
              return {
                ...item,
                span: nextSpan,
                rowSpan: Math.max(1, item.rowSpan || getDefaultWidgetRowSpan(item.id)),
                column: nextColumn,
              };
            })()
          : item
      )
    );
  };

  const sidebarItems = [
    { key: "desktop", label: "Рабочий стол", icon: "⌂" },
    { key: "portals", label: "Порталы", icon: "◫" },
    { key: "stores", label: "Торговые объекты", icon: "🏪" },
    { key: "construction", label: "Стройка", icon: "◧" },
    { key: "tasks", label: "Задачи", icon: "✓" },
    { key: "analytics", label: "Аналитика", icon: "◔" },
  ];

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      let avatarUrl = profile?.avatar_url || null;
      const focusX = Math.round(avatarAdjustments.focusX);
      const focusY = Math.round(avatarAdjustments.focusY);
      const scale = Math.round(avatarAdjustments.scale);

      const hasNewFile = !!profileAvatarFile;
      const imageSource = hasNewFile ? avatarPreviewSrc || profileAvatarFile : null;
      if (imageSource) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const frameEl = avatarFrameRef.current;
        const imageEl =
          avatarPreviewImageRef.current || frameEl?.querySelector?.(".profile-avatar-preview-image") || null;
        const selectorEl = avatarSelectorRef.current || frameEl?.querySelector?.(".profile-avatar-selector") || null;
        const rect = frameEl?.getBoundingClientRect?.();
        const imageRect = imageEl?.getBoundingClientRect?.();
        const selectorRect = selectorEl?.getBoundingClientRect?.();
        const domMetrics =
          imageRect && selectorRect
            ? {
                imageRect: {
                  left: imageRect.left,
                  top: imageRect.top,
                  width: imageRect.width,
                  height: imageRect.height,
                },
                selectorRect: {
                  left: selectorRect.left,
                  top: selectorRect.top,
                  width: selectorRect.width,
                  height: selectorRect.height,
                },
                selectorClientWidth: selectorEl?.clientWidth || selectorRect.width,
                selectorClientHeight: selectorEl?.clientHeight || selectorRect.height,
              }
            : null;
        const croppedBlob = await cropImageToAvatarBlob(imageSource, focusX, focusY, scale, 256, domMetrics, rect);
        if (croppedBlob) {
          const formData = new FormData();
          formData.append("file", croppedBlob, "avatar.jpg");
          const uploadResponse = await fetch(`${API_ROOT}/api/users/upload-avatar`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (!uploadResponse.ok) {
            const payload = await uploadResponse.json().catch(() => ({}));
            throw new Error(formatUiError(payload.detail, "Не удалось загрузить фото профиля"));
          }
          const uploadPayload = await uploadResponse.json();
          avatarUrl = uploadPayload.avatar_url;
        }
      }

      const updated = await apiRequest("/users/me", {
        method: "PUT",
        token,
        body: {
          full_name: profileForm.full_name,
          avatar_url: avatarUrl,
          avatar_focus_x: focusX,
          avatar_focus_y: focusY,
          avatar_scale: scale,
        },
      });
      onProfileChange(updated);
      setProfileAvatarFile(null);
      setNewsError("");
      if (refreshProfile) await refreshProfile(token);
      showToast("Настройки сохранены");
    } catch (err) {
      const msg = sanitizeUiErrorMessage(err?.message || "Ошибка запроса");
      setNewsError(msg);
      showToast(msg, "error");
    } finally {
      setProfileSaving(false);
    }
  };
  const renderPollStat = (item, option) => {
    if (item.poll_chart_type === "compact") {
      return <small>{option.votes} голосов</small>;
    }
    return (
      <>
        <div className="poll-analytics">
          <span style={{ width: `${option.share_percent}%` }} />
        </div>
        <small>
          {option.votes} · {option.share_percent}%
        </small>
      </>
    );
  };

  const renderNewsWidget = () => (
    <>
      {profile.role_code === "admin" && (
        <div className="news-toolbar">
          <button onClick={openCreateNewsModal}>Создать новость</button>
        </div>
      )}
      {newsError && <div className="error">{newsError}</div>}
      <div className="news-feed">
        {newsFeed.map((item) => {
          const authorInitials = (item.author_name || "U")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || "")
            .join("");
          const isChizhik = (item.title || "").toLowerCase().includes("чижик");
          return (
            <article className={`news-card image-${item.image_placement} text-${item.text_layout} ${isChizhik ? "news-card--chizhik" : ""}`} key={item.id}>
              <div className="news-card-header">
                <div className="news-author-block">
                  <span className="news-author-avatar">{authorInitials}</span>
                  <div className="news-author-meta">
                    <strong>{item.author_name}</strong>
                    <small>{new Date(item.published_at || item.created_at).toLocaleString("ru-RU")}</small>
                  </div>
                </div>
                <div className="news-card-controls">
                  {profile.role_code === "admin" && (
                    <button className="news-edit-btn" onClick={() => openEditNewsModal(item)}>
                      Редактировать
                    </button>
                  )}
                  <span className={`news-badge ${item.kind}`}>{item.kind === "poll" ? "Опрос" : "Событие"}</span>
                </div>
              </div>

              <div className="news-main">
                {item.image_url && item.image_placement === "top" && <img src={item.image_url} alt={item.title} className="news-image" />}
                <h3 className="news-title">{item.title}</h3>
                <p className="news-text">{item.content}</p>
                {item.image_url && item.image_placement !== "top" && <img src={item.image_url} alt={item.title} className="news-image" />}
              </div>

              {item.kind === "poll" && (
                <div className={`poll-block chart-${item.poll_chart_type}`}>
                  <div className="poll-layout">
                    <div className="poll-options-list">
                      {item.options.map((option) => (
                        <div key={option.option_id} className="poll-option-row">
                          <button
                            onClick={() => vote(item.id, option.option_id)}
                            disabled={item.user_vote_option_id !== null}
                            className={item.user_vote_option_id === option.option_id ? "poll-voted" : ""}
                          >
                            {option.option_text}
                          </button>
                          {renderPollStat(item, option)}
                        </div>
                      ))}
                    </div>

                    <aside className="poll-summary-card">
                      <div className="poll-summary-head">
                        <strong>Итоги опроса</strong>
                        <span>{item.total_votes} голосов</span>
                      </div>
                      {item.poll_chart_type === "donut" && (
                        <div
                          className="poll-donut"
                          style={{
                            background: `conic-gradient(#14bf6d 0 ${item.options[0]?.share_percent || 0}%, #2f73ff ${
                              item.options[0]?.share_percent || 0
                            }% ${(item.options[0]?.share_percent || 0) + (item.options[1]?.share_percent || 0)}%, #ff9f1c ${
                              (item.options[0]?.share_percent || 0) + (item.options[1]?.share_percent || 0)
                            }% 100%)`,
                          }}
                        >
                          <span>{item.total_votes}</span>
                        </div>
                      )}
                      <div className="poll-summary-list">
                        {item.options.map((option) => (
                          <div key={option.option_id} className="poll-summary-item">
                            <span>{option.option_text}</span>
                            <strong>{option.share_percent}%</strong>
                          </div>
                        ))}
                      </div>
                    </aside>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );

  const renderTasksWidget = () => (
    <div className="tasks-widget-content">
      <div className="tasks-widget-metrics">
        <div className="metric-card metrics-mini">
          <h3>Всего</h3>
          <strong>{taskMetrics.total}</strong>
        </div>
        <div className="metric-card metrics-mini">
          <h3>В работе</h3>
          <strong>{taskMetrics.inProgress}</strong>
        </div>
        <div className="metric-card metrics-mini">
          <h3>Запуск</h3>
          <strong>{taskMetrics.launching}</strong>
        </div>
        <div className="metric-card metrics-mini">
          <h3>Готово</h3>
          <strong>{taskMetrics.done}</strong>
        </div>
      </div>
      <div className="tasks-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Код</th>
              <th>Город</th>
              <th>Этап</th>
              <th>Готовность</th>
              <th>План открытия</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.code}</td>
                <td>{project.city}</td>
                <td>{project.stage}</td>
                <td>{project.readiness_percent}%</td>
                <td>{project.planned_open_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCalendarWidget = () => (
    <section className="day-calendar-card">
      <div className="calendar-head">
        <div className="calendar-nav-group">
          <button className="ghost-btn" onClick={() => moveCalendarYear(-1)}>
            «
          </button>
          <button className="ghost-btn" onClick={() => moveCalendarMonth(-1)}>
            ‹
          </button>
        </div>
        <div>
          <h3>Календарь</h3>
          <p>{calendarMonthLabel}</p>
          <button className="ghost-btn" type="button" onClick={reloadCalendar} style={{ fontSize: 12, marginTop: 4 }}>
            Обновить
          </button>
        </div>
        <div className="calendar-nav-group">
          <button className="ghost-btn" onClick={() => moveCalendarMonth(1)}>
            ›
          </button>
          <button className="ghost-btn" onClick={() => moveCalendarYear(1)}>
            »
          </button>
        </div>
      </div>

      <div className="calendar-month-grid">
        {calendarMonthDays.map((day) => {
          const dayKey = day.dateKey;
          const isActive = dayKey === selectedCalendarDate;
          const hasEvents = eventDateKeys.has(dayKey);
          return (
            <button
              key={dayKey}
              className={`calendar-day-pill ${isActive ? "active" : ""} ${day.isCurrentMonth ? "" : "outside"}`}
              onClick={() => {
                if (dayKey === selectedCalendarDate) {
                  setIsCalendarDayOpen((prev) => !prev);
                } else {
                  setSelectedCalendarDate(dayKey);
                  setIsCalendarDayOpen(true);
                }
                setCalendarDraft({ slot: null, title: "", durationSlots: 1 });
              }}
            >
              <strong>{day.date.getDate()}</strong>
              {hasEvents && <span className={`calendar-day-dot ${isActive ? "active" : ""}`} />}
            </button>
          );
        })}
      </div>
      <button className="calendar-selected-date-btn" onClick={() => setIsCalendarDayOpen((prev) => !prev)}>
        <span className="calendar-selected-date">{selectedCalendarLabel}</span>
        <span>{isCalendarDayOpen ? "▾" : "▸"}</span>
      </button>

      {isCalendarDayOpen && (
        <div className="calendar-timeline">
          {calendarSlots.map((slot) => {
            const slotTasks = slotTaskMap[slot] || [];
            const startedTasks = slotTasks.filter((item) => item.isStart);
            const continuedTasks = slotTasks.filter((item) => !item.isStart);
            return (
              <div className="calendar-slot-row" key={slot}>
                <div className="calendar-slot-time">{slot}</div>
                <div className="calendar-slot-content">
                  {startedTasks.map(({ task }) => (
                    <div className="calendar-task-chip" key={`start-${task.id}`}>
                      <span>
                        {task.title} <small>{getTaskRangeLabel(task)}</small>
                      </span>
                      <button onClick={() => removeCalendarTask(task.id)}>✕</button>
                    </div>
                  ))}
                  {continuedTasks.map(({ task }) => (
                    <div className="calendar-task-continue" key={`cont-${task.id}`}>
                      {task.title}: занято до {getTaskRangeLabel(task).split("-")[1]}
                    </div>
                  ))}

                  {calendarDraft.slot === slot ? (
                    <div className="calendar-draft-row">
                      <input
                        value={calendarDraft.title}
                        onChange={(e) => setCalendarDraft((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Новая задача"
                      />
                      <select
                        value={calendarDraft.durationSlots}
                        onChange={(e) => setCalendarDraft((prev) => ({ ...prev, durationSlots: Number(e.target.value) }))}
                      >
                        <option value={1}>30 мин</option>
                        <option value={2}>1 час</option>
                        <option value={3}>1.5 часа</option>
                        <option value={4}>2 часа</option>
                        <option value={6}>3 часа</option>
                      </select>
                      <button className="ghost-btn" onClick={() => setCalendarDraft({ slot: null, title: "", durationSlots: 1 })}>
                        Отмена
                      </button>
                      <button onClick={saveCalendarTask}>Сохранить</button>
                    </div>
                  ) : (
                    <button className="calendar-slot-add" onClick={() => openCalendarSlotDraft(slot)}>
                      + Добавить в слот
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderActivityWidget = () => (
    <section className="activity-widget-card">
      <div className="activity-widget-head">
        <h3>Моя активность</h3>
        <span className="activity-widget-hint">
          Норма: {ACTIVITY_TARGET_HOURS}ч/день · перегруз: {activityOverloadCount} дн.
        </span>
      </div>
      <div
        ref={activitySliderRef}
        className={`activity-bars-slider ${isDraggingActivity ? "dragging" : ""}`}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          const slider = activitySliderRef.current;
          if (!slider) return;
          activityDragRef.current = {
            startX: e.clientX,
            startScrollLeft: slider.scrollLeft,
            moved: false,
          };
          setIsDraggingActivity(true);
        }}
      >
        {activityDaysData.map((day) => (
          <button
            type="button"
            key={day.dateKey}
            className={`activity-bar-item ${day.isSelected ? "selected" : ""} ${day.hours > 0 ? "has-events" : ""} ${
              day.hours > ACTIVITY_TARGET_HOURS ? "overload" : ""
            }`}
            onClick={() => {
              if (suppressActivityClickRef.current) {
                suppressActivityClickRef.current = false;
                return;
              }
              setSelectedCalendarDate(day.dateKey);
              setIsCalendarDayOpen(true);
            }}
          >
            <span className="activity-bar-weekday">{day.weekday}</span>
            <div className="activity-bar-track">
              <span className="activity-bar-target-line" style={{ bottom: `${activityTargetPercent}%` }} />
              <div
                className="activity-bar-fill"
                style={{
                  height: day.hours > 0 ? `${Math.max(6, Math.round((day.hours / activityMaxHours) * 100))}%` : "0%",
                }}
              />
            </div>
            <strong className="activity-bar-day">{day.dayLabel}</strong>
            <span className="activity-bar-hours">
              {day.hours > 0 ? `${day.hours.toFixed(1)} ч` : "—"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  const formatActivityFeedTime = (timestamp) => {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return "без даты";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    if (diffDays === 0) return `сегодня, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
    if (diffDays === -1) return `вчера, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
    return date.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const renderActivityFeedWidget = () => (
    <section className="activity-feed-card">
      <div className="activity-feed-head">
        <div>
          <p>Сводный контекст по календарю, проектам, стройке и новостям</p>
        </div>
        <span className="activity-feed-count">{activityFeedVisibleItems.length}</span>
      </div>

      <div className="activity-feed-filters">
        {[
          { id: "all", label: "Все" },
          { id: "calendar", label: "Календарь" },
          { id: "projects", label: "Задачи" },
          { id: "construction", label: "Стройка" },
          { id: "news", label: "Новости" },
        ].map((filter) => (
          <button
            type="button"
            key={filter.id}
            className={activityFeedFilter === filter.id ? "active" : ""}
            onClick={() => setActivityFeedFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="activity-feed-list">
        {activityFeedVisibleItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`activity-feed-item ${item.priority === "attention" ? "attention" : ""}`}
            onClick={() => {
              if (item.source === "calendar" && item.dateKey) {
                setSelectedCalendarDate(item.dateKey);
                setIsCalendarDayOpen(true);
              }
              if (item.source === "construction") {
                setActiveSection("construction");
              }
            }}
          >
            <span className={`activity-feed-source source-${item.source}`}>{item.sourceLabel}</span>
            <div className="activity-feed-content">
              <strong>{item.title}</strong>
              <span>{item.context}</span>
            </div>
            <time>{formatActivityFeedTime(item.ts)}</time>
          </button>
        ))}
      </div>
    </section>
  );

  const openConstructionFromWidget = (stage) => {
    setSelectedConstructionStage(stage || "all");
    setSelectedConstructionProjectCode(null);
    setIsConstructionProjectModalOpen(false);
    setActiveSection("construction");
  };

  const renderAskoWidget = ({ compact = false } = {}) => {
    const runInitialAnimation = !askoWidgetHasAnimated;
    return (
      <article
        className={`asko-widget-card ${compact ? "compact" : ""} ${runInitialAnimation ? "asko-widget-animate" : ""}`}
        onAnimationEnd={(e) => { if (e.target.classList.contains("asko-widget-animate-sentinel")) setAskoWidgetHasAnimated(true); }}
      >
        {runInitialAnimation && <div className="asko-widget-animate-sentinel" aria-hidden="true" />}
        <header className="asko-widget-head">
          <div className="asko-widget-brand">
            <span className="asko-widget-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            <div>
              <h2>{constructionWidget.system_name}</h2>
              <p>{constructionWidget.card_title}</p>
            </div>
          </div>
          <span className="asko-projects-badge">{constructionWidget.total_projects} проектов</span>
        </header>

        <div className="asko-kpi-row">
          <div className="asko-kpi-card neutral" title="Всего активных проектов стройки">
            <strong>{constructionWidget.active_projects}</strong>
            <span>Активных</span>
          </div>
          <div className="asko-kpi-card positive" title="Проекты, идущие по графику">
            <strong>{constructionWidget.on_schedule}</strong>
            <span>В графике</span>
          </div>
          <div className="asko-kpi-card warning" title="Проекты с рисками сроков или бюджета">
            <strong>{constructionWidget.at_risk}</strong>
            <span>Риски</span>
          </div>
        </div>

        <div className="asko-stage-block">
          <div className="asko-stage-head">
            <h3>Распределение по этапам</h3>
            <span className="asko-stage-attention">{constructionWidget.needs_attention} требуют внимания</span>
          </div>
          <div className="asko-stage-bars">
            {constructionStages.map((item, idx) => {
              const barHeight = Math.max(36, Math.round((item.count / constructionMaxStageCount) * 150));
              return (
                <button
                  key={item.stage}
                  className={`asko-stage-col asko-stage-col-btn ${selectedConstructionStage === item.stage ? "active" : ""}`}
                  onClick={() => openConstructionFromWidget(item.stage)}
                  title={`Открыть детализацию: ${item.stage}`}
                  aria-label={`Этап ${item.stage}, ${item.count} проектов. Открыть детализацию.`}
                  style={{ "--asko-bar-delay": `${idx * 0.06}s` }}
                >
                  <div className="asko-stage-bar" style={{ height: `${barHeight}px` }} />
                  <strong>{item.count}</strong>
                  <span>{item.stage}</span>
                </button>
              );
            })}
          </div>
        </div>

        <a className="asko-action-btn" href={constructionWidget.action_url} target="_blank" rel="noreferrer">
          <span>{constructionWidget.action_label}</span>
          <span className="asko-action-btn-arrow" aria-hidden="true">→</span>
        </a>
      </article>
    );
  };

  const renderWidgetContent = (widgetId) => {
    if (widgetId === "asko") return renderAskoWidget({ compact: true });
    if (widgetId === "news") return renderNewsWidget();
    if (widgetId === "tasks") return renderTasksWidget();
    if (widgetId === "calendar") return renderCalendarWidget();
    if (widgetId === "activity") return renderActivityWidget();
    if (widgetId === "activity_feed") return renderActivityFeedWidget();
    if (widgetId === "map") return <MapWidget selectedRegion={mapRegion} onRegionChange={setMapRegion} />;
    return null;
  };

  const renderWidgetGhost = (widgetId) => (
    <div className="widget-ghost-body">
      <div className="widget-ghost-row" />
      <div className="widget-ghost-row" />
      <div className="widget-ghost-row short" />
      {widgetId !== "news" && <div className="widget-ghost-grid" />}
    </div>
  );

  const beginColumnResize = (event, leftColumn, rightColumn) => {
    if (isDraggingWidget || event.button !== 0) return;
    event.preventDefault();
    const container = event.currentTarget.closest(".desktop-widget-columns");
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pairTotal = (desktopColumnWidths[leftColumn] || 0) + (desktopColumnWidths[rightColumn] || 0);
    setColumnResizeState({
      startX: event.clientX,
      containerWidth: rect.width,
      leftColumn,
      rightColumn,
      pairTotal: pairTotal || 66,
      leftStart: desktopColumnWidths[leftColumn] || 33,
    });
  };

  const toggleWidgetVisibility = (widgetId) => {
    setVisibleWidgetIds((prev) => {
      const exists = prev.includes(widgetId);
      if (exists) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== widgetId);
      }
      return [...prev, widgetId];
    });
  };

  const showAllWidgets = () => {
    setVisibleWidgetIds(DEFAULT_DESKTOP_WIDGETS.map((widget) => widget.id));
  };

  const resetDesktopLayout = () => {
    setDesktopWidgets(DEFAULT_DESKTOP_WIDGETS);
    setVisibleWidgetIds(DEFAULT_VISIBLE_WIDGET_IDS);
    setDesktopColumnWidths(DEFAULT_COLUMN_WIDTHS);
  };

  const togglePortalFavorite = (portalId, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const id = String(portalId);
    setPortalFavorites((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const hidePortal = (portalId, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const id = String(portalId);
    setHiddenPortalIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const restoreHiddenPortals = () => setHiddenPortalIds([]);

  const beginPortalsDrag = (event) => {
    if (event.button !== 0) return;
    const slider = portalsSliderRef.current;
    if (!slider) return;
    portalsDragRef.current = {
      startX: event.clientX,
      startScrollLeft: slider.scrollLeft,
      moved: false,
    };
    setIsDraggingPortals(true);
  };

  if (!profile) {
      return (
        <div className="global-loader" role="status" aria-label="Загрузка портала">
          <div className="global-loader-shell">
            <div className="global-loader-sidebar" />
            <div className="global-loader-gutter" />
            <div className="global-loader-main">
              <div className="global-loader-search" />
              <div className="global-loader-content">
                <div className="global-loader-block global-loader-block--wide" />
                <div className="global-loader-block" />
                <div className="global-loader-block" />
              </div>
              <div className="global-loader-spinner-wrap">
                <div className="global-loader-spinner" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      );
    }

  const dismissOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch (_) {}
    setShowOnboarding(false);
  };

  return (
    <div
      className={`app-shell ${theme === "dark" ? "theme-dark" : ""} ${isResizingSidebar ? "resizing" : ""}`}
      style={{ "--sidebar-slot-width": "72px" }}
    >
      {activeSection === "desktop" && showOnboarding && (
        <div className="onboarding-overlay" role="dialog" aria-labelledby="onboarding-title" aria-modal="true">
          <div className="onboarding-backdrop" onClick={dismissOnboarding} aria-hidden="true" />
          <div className="onboarding-card">
            <h2 id="onboarding-title" className="onboarding-title">Добро пожаловать</h2>
            <p className="onboarding-intro">Кратко о главной странице:</p>
            <ul className="onboarding-list">
              <li><strong>Избранные порталы</strong> — добавляйте нужные сервисы, они появятся здесь для быстрого доступа.</li>
              <li><strong>Виджеты</strong> — перетаскивайте за ручку ⋮⋮, размер меняйте кнопкой в шапке виджета (1/3, 2/3, 3/3).</li>
            </ul>
            <button type="button" className="onboarding-dismiss landing-btn landing-btn--teal" onClick={dismissOnboarding}>
              Понятно
            </button>
          </div>
        </div>
      )}
      <aside
        className={`sidebar ${isMenuOpen ? "open" : ""} ${isSidebarCollapsed ? "collapsed" : ""}`}
        style={{ width: isSidebarCollapsed ? 72 : Math.max(sidebarWidth, 260) }}
        onMouseEnter={() => setIsSidebarCollapsed(false)}
        onMouseLeave={() => setIsSidebarCollapsed(true)}
      >
        <OrionLogo collapsed={isSidebarCollapsed} />
        <div className="sidebar-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              className={activeSection === item.key ? "active" : ""}
              onClick={() => {
                setActiveSection(item.key);
                setPortalIframeModal({ open: false, url: "", title: "" });
              }}
              title={item.label}
              data-label={item.label}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-label">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-user">
          <button className="sidebar-profile-chip" onClick={() => { setActiveSection("profile"); setPortalIframeModal({ open: false, url: "", title: "" }); }} title="Профиль">
            {avatarCommittedSrc ? (
              <img
                key={`avatar-${avatarCommittedSrc}`}
                src={avatarCommittedSrc}
                alt={profile.full_name}
                className="sidebar-profile-avatar"
                style={avatarCommittedStyle}
              />
            ) : (
              <span className="sidebar-profile-initials">{initials}</span>
            )}
          </button>
          <div className="sidebar-user-meta">
            <strong>{profile.full_name}</strong>
            <span>{profile.role_name}</span>
          </div>
          <button className="sidebar-logout-btn" onClick={onLogout} aria-label="Выйти" title="Выйти из профиля">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-logout-icon">
              <path
                d="M10 5.75A2.75 2.75 0 0 1 12.75 3h6.5A2.75 2.75 0 0 1 22 5.75v12.5A2.75 2.75 0 0 1 19.25 21h-6.5A2.75 2.75 0 0 1 10 18.25V16a.75.75 0 0 1 1.5 0v2.25c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V5.75c0-.69-.56-1.25-1.25-1.25h-6.5c-.69 0-1.25.56-1.25 1.25V8a.75.75 0 0 1-1.5 0V5.75Zm3.53 5.72a.75.75 0 0 1 0 1.06l-2.5 2.5a.75.75 0 1 1-1.06-1.06l1.22-1.22H3.75a.75.75 0 0 1 0-1.5h7.44l-1.22-1.22a.75.75 0 0 1 1.06-1.06l2.5 2.5Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </aside>
      <div
        className={`sidebar-resizer ${isSidebarCollapsed ? "" : "active"}`}
        onMouseDown={beginSidebarResize}
        role="separator"
        aria-label="Изменение ширины меню"
      />

      <main className={`main-area ${portalIframeModal.open && portalIframeModal.url ? "main-area--iframe-open" : ""}`}>
        <div className="main-area-bg-deco" aria-hidden="true">
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--1" />
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--2" />
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--3" />
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--4" />
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--5" />
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--6" />
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--7" />
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--8" />
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--9" />
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--10" />
          <span className="main-area-bg-deco-blob main-area-bg-deco-blob--11" />
        </div>
        {portalIframeModal.open && portalIframeModal.url ? (
          <div ref={iframeModalRef} className="iframe-full-view">
            <iframe src={portalIframeModal.url} title={portalIframeModal.title} className="licensing-iframe iframe-full-view-frame" />
          </div>
        ) : (
          <>
        {activeSection === "desktop" && (
          <div className="dashboard-page-wrap">
            <div className="dashboard-layout">
              <div className="dashboard-main">
            <div className="dashboard-top-search">
              <span className="dashboard-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
              </span>
              <input
                type="search"
                className="dashboard-search-input"
                placeholder={searchPlaceholderText}
                aria-label="Поиск"
              />
            </div>
            <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleWidgetDragStart}
            onDragOver={handleWidgetDragOver}
            onDragEnd={handleWidgetDragEnd}
            onDragCancel={handleWidgetDragCancel}
            >
            <section className={`desktop-widgets-grid ${isDraggingWidget ? "drag-mode" : ""}`} aria-label="Рабочий стол">
              {showPortalsSlider && (
                <section className="desktop-portals-slider-block" aria-label="Избранные порталы">
                  <div className="desktop-portals-slider-head">
                    <div className="desktop-portals-slider-title-wrap">
                      <h2>Избранные порталы</h2>
                      <div className="desktop-portals-slider-head-actions">
                        <button
                          type="button"
                          className="desktop-portals-slider-head-btn desktop-portals-slider-add-btn"
                          onClick={() => setAddPortalModalOpen(true)}
                          title="Добавить портал"
                          aria-label="Добавить портал в избранное"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </button>
                        {catalog.filter((s) => portalFavorites.includes(String(s.id))).length > 0 && (
                          <button
                            type="button"
                            className={`desktop-portals-slider-head-btn desktop-portals-slider-edit-btn ${isFavoritesEditMode ? "active" : ""}`}
                            onClick={() => setIsFavoritesEditMode((prev) => !prev)}
                            title={isFavoritesEditMode ? "Готово" : "Редактировать избранное"}
                            aria-label={isFavoritesEditMode ? "Готово" : "Редактировать избранное"}
                          >
                            {isFavoritesEditMode ? (
                              <span className="desktop-portals-slider-edit-done">Готово</span>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    ref={portalsSliderRef}
                    className={`desktop-portals-slider ${isFavoritesEditMode ? "edit-mode" : ""}`}
                  >
                    {(() => {
                      const favorites = catalog.filter((system) => portalFavorites.includes(String(system.id)));
                      if (favorites.length === 0) {
                        return (
                          <div className="desktop-portals-slider-empty">
                            <span className="desktop-portals-slider-empty-icon" aria-hidden="true">
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            </span>
                            <div className="desktop-portals-slider-empty-copy">
                              <p className="desktop-portals-slider-empty-title">Пока здесь пусто</p>
                              <p className="desktop-portals-slider-empty-text">
                                Здесь будут ваши часто используемые сервисы и порталы — один клик и вы внутри нужной системы.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="desktop-portals-slider-empty-btn desktop-portals-slider-empty-btn--primary"
                              onClick={() => setAddPortalModalOpen(true)}
                            >
                              Добавить первый портал
                            </button>
                          </div>
                        );
                      }
                      return favorites.map((system) => {
                        const meta = PORTAL_ICON_META[system.title] || { icon: "🔗", color: "linear-gradient(135deg, #5E7EA6 0%, #3D5A80 100%)" };
                        const portalHref = PORTAL_LINK_META[system.title] || system.url;
                        const iframeTile = getIframeTileForSystem(system) || getLicensingIframeByHref(portalHref);
                        if (iframeTile) {
                          return (
                            <button
                              key={system.id}
                              type="button"
                              className="desktop-portal-slide desktop-portal-slide--iframe"
                              onClick={(event) => {
                                if (isFavoritesEditMode) {
                                  event.preventDefault();
                                  return;
                                }
                                if (suppressPortalClickRef.current) {
                                  suppressPortalClickRef.current = false;
                                  return;
                                }
                                event.preventDefault();
                                setPortalIframeModal({ open: true, url: iframeTile.url, title: iframeTile.title });
                              }}
                            >
                              {isFavoritesEditMode && (
                                <button
                                  type="button"
                                  className="desktop-portal-slide-remove"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setPortalFavorites((prev) => prev.filter((id) => id !== String(system.id)));
                                    showToast("Портал удалён из избранного");
                                  }}
                                  aria-label="Убрать из избранного"
                                >
                                  ✕
                                </button>
                              )}
                              <span className="desktop-portal-slide-icon" style={{ background: meta.color }}>
                                {meta.image ? <img src={meta.image} alt="" className="desktop-portal-slide-icon-img" /> : meta.icon}
                              </span>
                              <div className="desktop-portal-slide-text">
                                <strong>{meta.displayTitle || system.title}</strong>
                                <span>{system.category}</span>
                              </div>
                              <span className="desktop-portal-slide-modal-hint" title="Открыть в окне">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="15 3 21 3 21 9" />
                                  <polyline points="9 21 3 21 3 15" />
                                  <line x1="21" y1="3" x2="14" y2="10" />
                                  <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                              </span>
                            </button>
                          );
                        }
                        return (
                          <a
                            key={system.id}
                            className="desktop-portal-slide"
                            href={isFavoritesEditMode ? "#" : portalHref}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => {
                              if (isFavoritesEditMode) {
                                event.preventDefault();
                                return;
                              }
                              if (suppressPortalClickRef.current) {
                                event.preventDefault();
                                suppressPortalClickRef.current = false;
                              }
                            }}
                          >
                            {isFavoritesEditMode && (
                              <button
                                type="button"
                                className="desktop-portal-slide-remove"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setPortalFavorites((prev) => prev.filter((id) => id !== String(system.id)));
                                  showToast("Портал удалён из избранного");
                                }}
                                aria-label="Убрать из избранного"
                              >
                                ✕
                              </button>
                            )}
                            <span className="desktop-portal-slide-icon" style={{ background: meta.color }}>
                              {meta.image ? <img src={meta.image} alt="" className="desktop-portal-slide-icon-img" /> : meta.icon}
                            </span>
                            <div className="desktop-portal-slide-text">
                              <strong>{meta.displayTitle || system.title}</strong>
                              <span>{system.category}</span>
                            </div>
                          </a>
                        );
                      });
                    })()}
                  </div>
                </section>
              )}
              <section className="desktop-widgets-section" aria-label="Виджеты">
              {previewBlocks.map((block, blockIdx) => {
                if (block.type === "full") {
                  const widget = block.widget;
                  return (
                    <DesktopWidgetShell
                      key={widget.id}
                      widget={widget}
                      isDraggingWidget={isDraggingWidget}
                      activeWidgetId={activeWidgetId}
                      dropHint={dropHint}
                      onToggleSize={cycleWidgetSize}
                      shellClassName="widget-shell-full"
                      headerExtra={widget.id === "map" ? mapWidgetHeaderExtra : undefined}
                    >
                      {renderWidgetContent(widget.id)}
                    </DesktopWidgetShell>
                  );
                }
                if (block.type === "wide") {
                  const widget = block.widget;
                  const startColumn = block.startColumn === "middle" ? "middle" : "left";
                  return (
                    <div className={`desktop-widget-wide-row start-${startColumn}`} key={widget.id}>
                      <DesktopWidgetShell
                        widget={widget}
                        isDraggingWidget={isDraggingWidget}
                        activeWidgetId={activeWidgetId}
                        dropHint={dropHint}
                        onToggleSize={cycleWidgetSize}
                        shellClassName="widget-shell-wide"
                        headerExtra={widget.id === "map" ? mapWidgetHeaderExtra : undefined}
                      >
                        {renderWidgetContent(widget.id)}
                      </DesktopWidgetShell>
                    </div>
                  );
                }
                return (
                  <div
                    className="desktop-widget-columns"
                    key={`cols-${blockIdx}`}
                    style={{ "--desktop-column-count": isDraggingWidget ? 3 : block.visibleColumns.length || 2 }}
                  >
                    {(() => {
                      const columnsToRender = isDraggingWidget ? DESKTOP_COLUMNS : block.visibleColumns;
                      const normalizedWidths = normalizeColumnWidths(columnsToRender, desktopColumnWidths);
                      const activeDropColumn = (() => {
                        if (!dropHint) return null;
                        if (dropHint.column && columnsToRender.includes(dropHint.column)) return dropHint.column;
                        if (!dropHint.targetId) return null;
                        return columnsToRender.find((candidate) =>
                          (block.columns[candidate] || []).some((item) => item.id === dropHint.targetId)
                        ) || null;
                      })();
                      return columnsToRender.map((column, columnIdx) => {
                      const columnWidgets = block.columns[column] || [];
                      const columnAnchor = columnWidgets[columnWidgets.length - 1];
                      return (
                        <div
                          className={`desktop-widget-column-wrap ${isDraggingWidget && activeDropColumn === column ? "drop-column-active" : ""}`}
                          data-desktop-column={column}
                          data-block-index={blockIdx}
                          key={`${column}-${blockIdx}`}
                        >
                          {isDraggingWidget && <ColumnBodyDropZone blockIndex={blockIdx} column={column} visible />}
                          <div className="desktop-widget-column">
                            {columnWidgets.map((widget) => (
                              <DesktopWidgetShell
                                key={widget.id}
                                widget={widget}
                                isDraggingWidget={isDraggingWidget}
                                activeWidgetId={activeWidgetId}
                                dropHint={dropHint}
                                onToggleSize={cycleWidgetSize}
                                headerExtra={widget.id === "map" ? mapWidgetHeaderExtra : undefined}
                              >
                                {isDraggingWidget && activeWidgetId === widget.id ? (
                                  <div
                                    className="widget-body-placeholder"
                                    style={{ minHeight: `${Math.max(160, (dragOverlaySize?.height || 260) - 64)}px` }}
                                  />
                                ) : (
                                  renderWidgetContent(widget.id)
                                )}
                              </DesktopWidgetShell>
                            ))}
                            {isDraggingWidget && (
                              <ColumnEndDropZone
                                blockIndex={blockIdx}
                                column={column}
                                visible
                                active={
                                  !!dropHint &&
                                  dropHint.position === "bottom" &&
                                  ((columnAnchor && dropHint.targetId === columnAnchor.id) || dropHint.column === column)
                                }
                              />
                            )}
                          </div>
                        </div>
                      );
                      });
                    })()}
                  </div>
                );
              })}
              <div className="widget-layout-hint">Перетащите виджеты за ручку ⋮⋮. Размер виджета: кнопка с иконкой в шапке (1/3, 2/3, 3/3).</div>
              </section>
            </section>
            <DragOverlay dropAnimation={null}>
              {activeWidget ? (
                <div
                  className="widget-drag-overlay"
                  style={{
                    width: dragOverlaySize?.width ? `${dragOverlaySize.width}px` : undefined,
                    maxHeight: dragOverlaySize?.height ? `${dragOverlaySize.height}px` : undefined,
                  }}
                >
                  <article className="dashboard-widget parking-preview">
                    <header className="widget-header">
                      <h3>{activeWidget.title}</h3>
                      <div className="widget-controls">
                        <span className="widget-drag-hint">⋮⋮</span>
                      </div>
                    </header>
                    {renderWidgetGhost(activeWidget.id)}
                  </article>
                </div>
              ) : null}
            </DragOverlay>
            </DndContext>
              </div>
              <section className="news-sidebar" aria-label="Новости">
                <div className="news-sidebar-head">
                  <h2>НОВОСТИ</h2>
                  <span className="news-sidebar-more" aria-hidden="true">→</span>
                </div>
                <div className="news-sidebar-list">
                  {newsFeed.slice(0, 6).map((item) => {
                    const d = item.published_at || item.created_at;
                    const dateStr = d ? new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "";
                    const likes = item.kind === "poll" ? (item.total_votes ?? 0) : (item.likes_count ?? 0);
                    const comments = item.comments_count ?? 0;
                    return (
                      <article className="news-sidebar-item" key={item.id}>
                        <time className="news-sidebar-date">{dateStr}</time>
                        <p className="news-sidebar-title">{item.title}</p>
                        <div className="news-sidebar-engagement">
                          <span className="news-sidebar-engagement-item" title="Нравится">
                            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                            {likes}
                          </span>
                          <span className="news-sidebar-engagement-item" title="Комментарии">
                            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" /></svg>
                            {comments}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="news-sidebar-promo">
                  {(() => {
                    const promoItem = newsFeed.find((n) => n.image_url);
                    if (promoItem) {
                      return (
                        <>
                          <div className="news-sidebar-promo-image-wrap">
                            <img src={promoItem.image_url} alt="" className="news-sidebar-promo-image" />
                            <div className="news-sidebar-promo-overlay">
                              <strong>{promoItem.title}</strong>
                              <p>{promoItem.content?.slice(0, 80)}{promoItem.content?.length > 80 ? "…" : ""}</p>
                              <button type="button" className="news-sidebar-promo-btn">Узнать подробнее</button>
                            </div>
                          </div>
                          <div className="news-sidebar-promo-dots"><span /><span className="active" /><span /></div>
                        </>
                      );
                    }
                    return (
                      <>
                        <div className="news-sidebar-promo-image-wrap news-sidebar-promo-placeholder">
                          <div className="news-sidebar-promo-overlay">
                            <strong>Портал развития ТСЧ</strong>
                            <p>Актуальные новости и сервисы в одном месте</p>
                            <button type="button" className="news-sidebar-promo-btn">Узнать подробнее</button>
                          </div>
                        </div>
                        <div className="news-sidebar-promo-dots"><span /><span className="active" /><span /></div>
                      </>
                    );
                  })()}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeSection === "portals" && (
          <section className="portals-section">
            <div className="portals-controls">
              <div className="portals-search-wrap">
                <input
                  className="portals-search-input"
                  placeholder="Поиск по названию, описанию, категории"
                  value={portalSearch}
                  onChange={(e) => setPortalSearch(e.target.value)}
                />
              </div>
              <div className="portals-view-toggle">
                <button className={portalViewMode === "grid" ? "active" : ""} onClick={() => setPortalViewMode("grid")}>
                  Сетка
                </button>
                <button className={portalViewMode === "compact" ? "active" : ""} onClick={() => setPortalViewMode("compact")}>
                  Компакт
                </button>
                <button className={portalViewMode === "list" ? "active" : ""} onClick={() => setPortalViewMode("list")}>
                  Список
                </button>
              </div>
            </div>

            <div className="portals-category-filters">
              {portalCategories.map((category) => (
                <button
                  key={category}
                  className={selectedPortalCategory === category ? "active" : ""}
                  onClick={() => setSelectedPortalCategory(category)}
                >
                  {category}
                  <span className="portals-category-count">({portalCategoryCounts[category] ?? 0})</span>
                </button>
              ))}
              {(portalSearch || selectedPortalCategory !== "Все") && (
                <button
                  className="ghost-btn"
                  onClick={() => {
                    setPortalSearch("");
                    setSelectedPortalCategory("Все");
                  }}
                >
                  Сбросить фильтры
                </button>
              )}
              {hiddenPortalIds.length > 0 && (
                <button className="ghost-btn" onClick={restoreHiddenPortals}>
                  Показать скрытые ({hiddenPortalIds.length})
                </button>
              )}
            </div>

            {filteredCatalog.length === 0 ? (
              <div className="portals-empty-state">
                <strong>Ничего не найдено</strong>
                <span>Измените фильтры или восстановите скрытые порталы.</span>
              </div>
            ) : (
              <div className={`catalog-grid view-${portalViewMode}`}>
                {filteredCatalog.map((system) => {
                  const isFavorite = portalFavorites.includes(String(system.id));
                  const meta = PORTAL_ICON_META[system.title] || {
                    icon: "🔗",
                    color: "linear-gradient(135deg, #5E7EA6 0%, #3D5A80 100%)",
                    accent: "#5E7EA6",
                  };
                  const portalHref = PORTAL_LINK_META[system.title] || system.url;
                  const iframeTile = getIframeTileForSystem(system) || getLicensingIframeByHref(portalHref);
                  const cardContent = (
                    <>
                      <div className="catalog-card-head">
                        <span className="catalog-card-icon" style={{ "--card-accent": meta.accent || "#003366" }}>
                          {meta.image ? <img src={meta.image} alt="" className="catalog-card-icon-img" /> : meta.icon}
                        </span>
                        <div className="catalog-card-actions">
                          <button
                            type="button"
                            className={`catalog-action-btn ${isFavorite ? "active" : ""}`}
                            onClick={(e) => togglePortalFavorite(system.id, e)}
                            title={isFavorite ? "Убрать из избранного" : "В избранное"}
                          >
                            ★
                          </button>
                        </div>
                      </div>
                      <h3>{meta.displayTitle || system.title}</h3>
                      <p>{system.description}</p>
                      <div className="catalog-footer">
                        <span>{system.category}</span>
                        <strong>{system.status}</strong>
                      </div>
                    </>
                  );
                  if (iframeTile) {
                    return (
                      <button
                        key={system.id}
                        type="button"
                        className={`catalog-card ${isFavorite ? "favorite" : ""}`}
                        onClick={() => setPortalIframeModal({ open: true, url: iframeTile.url, title: iframeTile.title })}
                      >
                        {cardContent}
                      </button>
                    );
                  }
                  return (
                    <a key={system.id} className={`catalog-card ${isFavorite ? "favorite" : ""}`} href={portalHref} target="_blank" rel="noreferrer">
                      {cardContent}
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeSection === "stores" && (
          <section className="stores-section" aria-label="Торговые объекты">
            <div className="stores-controls">
              <input
                type="search"
                className="stores-search-input"
                placeholder={storesSearchPlaceholderText}
                value={storeSearchQuery}
                onChange={(e) => setStoreSearchQuery(e.target.value)}
                aria-label="Поиск по торговым объектам"
              />
              <span className="stores-count">{filteredStores.length} из {PYATEROCHKA_STORES.length}</span>
              <div className="stores-filters">
              <button
                type="button"
                className={`stores-filter-trigger ${storeFilterCity !== null ? "has-value" : ""}`}
                onClick={() => setStoreFilterModal("city")}
                aria-haspopup="dialog"
                aria-expanded={storeFilterModal === "city"}
              >
                Город{storeFilterCity ? `: ${storeFilterCity}` : ""}
              </button>
              <button
                type="button"
                className={`stores-filter-trigger ${storeFilterRegion !== null ? "has-value" : ""}`}
                onClick={() => setStoreFilterModal("region")}
                aria-haspopup="dialog"
                aria-expanded={storeFilterModal === "region"}
              >
                Регион{storeFilterRegion ? `: ${storeFilterRegion}` : ""}
              </button>
              <button
                type="button"
                className={`stores-filter-trigger ${storeFilterFormat !== null ? "has-value" : ""}`}
                onClick={() => setStoreFilterModal("format")}
                aria-haspopup="dialog"
                aria-expanded={storeFilterModal === "format"}
              >
                Формат{storeFilterFormat ? `: ${storeFilterFormat}` : ""}
              </button>
              <button
                type="button"
                className={`stores-filter-trigger ${storeFilterHours !== null ? "has-value" : ""}`}
                onClick={() => setStoreFilterModal("hours")}
                aria-haspopup="dialog"
                aria-expanded={storeFilterModal === "hours"}
              >
                Режим работы{storeFilterHours ? `: ${storeFilterHours}` : ""}
              </button>
              {(storeFilterCity !== null || storeFilterRegion !== null || storeFilterFormat !== null || storeFilterHours !== null) && (
                <button
                  type="button"
                  className="stores-filter-clear"
                  onClick={() => {
                    setStoreFilterCity(null);
                    setStoreFilterRegion(null);
                    setStoreFilterFormat(null);
                    setStoreFilterHours(null);
                  }}
                  title="Сбросить все фильтры"
                  aria-label="Сбросить все фильтры"
                >
                  <span aria-hidden>✕</span>
                </button>
              )}
              </div>
            </div>
            {storeFilterModal && (
              <div
                className="stores-filter-modal-overlay"
                onClick={() => setStoreFilterModal(null)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="stores-filter-modal-title"
              >
                <div className="stores-filter-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="stores-filter-modal-head">
                    <h2 id="stores-filter-modal-title">
                      {storeFilterModal === "city" && "Фильтр: Город"}
                      {storeFilterModal === "region" && "Фильтр: Регион"}
                      {storeFilterModal === "format" && "Фильтр: Формат"}
                      {storeFilterModal === "hours" && "Фильтр: Режим работы"}
                    </h2>
                    <button type="button" className="stores-filter-modal-close" onClick={() => setStoreFilterModal(null)} aria-label="Закрыть">✕</button>
                  </div>
                  <div className="stores-filter-modal-body">
                    {storeFilterModal === "city" && (
                      <>
                        <button type="button" className={`stores-filter-option ${storeFilterCity === null ? "active" : ""}`} onClick={() => { setStoreFilterCity(null); setStoreFilterModal(null); }}>Все</button>
                        {storesUniqueValues.cities.map((city) => (
                          <button key={city} type="button" className={`stores-filter-option ${storeFilterCity === city ? "active" : ""}`} onClick={() => { setStoreFilterCity(city); setStoreFilterModal(null); }}>{city}</button>
                        ))}
                      </>
                    )}
                    {storeFilterModal === "region" && (
                      <>
                        <button type="button" className={`stores-filter-option ${storeFilterRegion === null ? "active" : ""}`} onClick={() => { setStoreFilterRegion(null); setStoreFilterModal(null); }}>Все</button>
                        {storesUniqueValues.regions.map((region) => (
                          <button key={region} type="button" className={`stores-filter-option ${storeFilterRegion === region ? "active" : ""}`} onClick={() => { setStoreFilterRegion(region); setStoreFilterModal(null); }}>{region}</button>
                        ))}
                      </>
                    )}
                    {storeFilterModal === "format" && (
                      <>
                        <button type="button" className={`stores-filter-option ${storeFilterFormat === null ? "active" : ""}`} onClick={() => { setStoreFilterFormat(null); setStoreFilterModal(null); }}>Все</button>
                        {storesUniqueValues.formats.map((format) => (
                          <button key={format} type="button" className={`stores-filter-option ${storeFilterFormat === format ? "active" : ""}`} onClick={() => { setStoreFilterFormat(format); setStoreFilterModal(null); }}>{format}</button>
                        ))}
                      </>
                    )}
                    {storeFilterModal === "hours" && (
                      <>
                        <button type="button" className={`stores-filter-option ${storeFilterHours === null ? "active" : ""}`} onClick={() => { setStoreFilterHours(null); setStoreFilterModal(null); }}>Все</button>
                        {storesUniqueValues.hours.map((hours) => (
                          <button key={hours} type="button" className={`stores-filter-option ${storeFilterHours === hours ? "active" : ""}`} onClick={() => { setStoreFilterHours(hours); setStoreFilterModal(null); }}>{hours}</button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            {selectedStoreModal && (
              <div
                className="stores-store-modal-overlay"
                onClick={() => setSelectedStoreModal(null)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="stores-store-modal-title"
              >
                <div className="stores-store-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="stores-store-modal-head">
                    <h2 id="stores-store-modal-title">Пятёрочка {selectedStoreModal.code}</h2>
                    <button type="button" className="stores-store-modal-close" onClick={() => setSelectedStoreModal(null)} aria-label="Закрыть">✕</button>
                  </div>
                  <div className="stores-store-modal-body">
                    <dl className="stores-store-details">
                      <dt>Код</dt>
                      <dd><code>{selectedStoreModal.code}</code></dd>
                      <dt>Адрес</dt>
                      <dd>{selectedStoreModal.address}</dd>
                      <dt>Город</dt>
                      <dd>{selectedStoreModal.city}</dd>
                      <dt>Регион</dt>
                      <dd>{selectedStoreModal.region}</dd>
                      <dt>Формат</dt>
                      <dd>{selectedStoreModal.format}</dd>
                      <dt>Режим работы</dt>
                      <dd>{selectedStoreModal.hours}</dd>
                      <dt>Телефон</dt>
                      <dd>8 800 555-35-35 <span className="stores-store-modal-hint">(единая справочная X5)</span></dd>
                      <dt>Координаты</dt>
                      <dd>{selectedStoreModal.lat != null && selectedStoreModal.lon != null ? `${selectedStoreModal.lat.toFixed(4)}, ${selectedStoreModal.lon.toFixed(4)}` : "—"}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            )}
            <div className="stores-table-wrap">
              <table className="stores-table">
                <thead>
                  <tr>
                    <th>Код</th>
                    <th>Адрес</th>
                    <th>Город</th>
                    <th>Регион</th>
                    <th>Формат</th>
                    <th>Режим работы</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map((store) => (
                    <tr
                      key={store.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedStoreModal(store)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedStoreModal(store);
                        }
                      }}
                      className="stores-table-row-clickable"
                    >
                      <td><code>{store.code}</code></td>
                      <td>{store.address}</td>
                      <td>{store.city}</td>
                      <td>{store.region}</td>
                      <td>{store.format}</td>
                      <td>{store.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === "tasks" && (
          <section className="tasks-section">
            <h2>Задачи</h2>
            <p className="tasks-hint">Потяните вертикальный разделитель слева, чтобы расширить область таблицы.</p>
            <table>
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Город</th>
                  <th>Этап</th>
                  <th>Готовность</th>
                  <th>План открытия</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td>{project.code}</td>
                    <td>{project.city}</td>
                    <td>{project.stage}</td>
                    <td>{project.readiness_percent}%</td>
                    <td>{project.planned_open_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeSection === "construction" && (
          <section className="construction-section">
            {renderAskoWidget()}
            <article className="construction-details-card">
              <div className="construction-details-head">
                <h3>Проекты стройки по стадиям</h3>
                <span>
                  {selectedConstructionStage === "all"
                    ? `Показаны все: ${constructionVisibleProjects.length}`
                    : `Стадия: ${selectedConstructionStage} (${constructionVisibleProjects.length})`}
                </span>
              </div>

              <div className="construction-stage-filters">
                <button
                  className={selectedConstructionStage === "all" ? "active" : ""}
                  onClick={() => {
                    setSelectedConstructionStage("all");
                    setSelectedConstructionProjectCode(null);
                  }}
                >
                  Все стадии
                </button>
                {constructionStages.map((item) => (
                  <button
                    key={item.stage}
                    className={selectedConstructionStage === item.stage ? "active" : ""}
                    onClick={() => {
                      setSelectedConstructionStage(item.stage);
                      setSelectedConstructionProjectCode(null);
                    }}
                  >
                    {item.stage} ({item.count})
                  </button>
                ))}
              </div>

              <div className="construction-project-grid">
                {constructionVisibleProjects.map((project) => (
                  <button
                    type="button"
                    className={`construction-project-card ${project.risk ? "risk" : ""} ${
                      selectedConstructionProject?.code === project.code ? "active" : ""
                    }`}
                    key={project.code}
                    onClick={() => {
                      setSelectedConstructionProjectCode(project.code);
                      setIsConstructionProjectModalOpen(true);
                    }}
                  >
                    <span className="construction-project-top">
                      <strong>{project.code}</strong>
                      <span>{project.stage}</span>
                    </span>
                    <span className="construction-project-meta">
                      {project.city} · {project.manager}
                    </span>
                    <span className="construction-progress">
                      <span style={{ width: `${Math.max(4, Math.min(100, project.readiness_percent))}%` }} />
                    </span>
                    <span className="construction-project-ready">Готовность: {project.readiness_percent}%</span>
                  </button>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeSection === "analytics" && (
          <section className="analytics-layout">
            <div className="metrics-row">
              {(dashboard?.metrics ?? []).map((metric) => (
                <div className="metric-card" key={metric.key}>
                  <h3>{metric.title}</h3>
                  <strong>{metric.value}</strong>
                  <span>{metric.trend}</span>
                </div>
              ))}
            </div>
            <div className="poll-analytics-list">
              <h3>Аналитика опросов</h3>
              {pollCards.map((poll) => (
                <div className="poll-analytics-card" key={poll.id}>
                  <strong>{poll.title}</strong>
                  <span>Всего ответов: {poll.total_votes}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeSection === "profile" && (
          <section className="profile-page">
            <div className="profile-card">
              <h2>Профиль пользователя</h2>
              <div className="profile-layout">
                <div className="profile-main-column">
                  <div className="profile-avatar-wrap">
                    <div className="profile-avatar-static">
                      <div className="profile-avatar-frame profile-avatar-frame-lg">
                        {avatarCommittedSrc ? (
                          <img
                            key={`profile-large-${avatarCommittedSrc}`}
                            src={avatarCommittedSrc}
                            alt={profile.full_name}
                            className="profile-avatar-large"
                            style={avatarCommittedStyle}
                          />
                        ) : (
                          <div className="profile-avatar-placeholder">{initials}</div>
                        )}
                      </div>
                    </div>
                    <div className="profile-avatar-controls">
                      <label className="avatar-upload-btn">
                        Загрузить фото
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            setProfileAvatarFile(e.target.files?.[0] || null);
                            setAvatarAdjustments({ focusX: 50, focusY: 50, scale: 100 });
                          }}
                        />
                      </label>
                      <div className="avatar-preview-block">
                        <strong>Превью кадрирования</strong>
                        <div
                          ref={avatarFrameRef}
                          className={`profile-avatar-preview ${isDraggingAvatar ? "dragging" : ""}`}
                          onMouseDown={beginAvatarDrag}
                        >
                          {avatarPreviewSrc ? (
                            <>
                              <div
                                className="profile-avatar-preview-inner"
                                style={{ transform: avatarPreviewTransform }}
                              >
                                <img
                                  ref={avatarPreviewImageRef}
                                  src={avatarPreviewSrc}
                                  alt={profile.full_name}
                                  className="profile-avatar-preview-image"
                                  draggable={false}
                                />
                              </div>
                              <div ref={avatarSelectorRef} className="profile-avatar-selector" />
                            </>
                          ) : (
                            <div className="profile-avatar-preview-placeholder">Загрузите фото для настройки</div>
                          )}
                        </div>
                      </div>
                      <label>
                        Сдвиг по горизонтали
                        <div className="profile-range-control">
                          <button
                            type="button"
                            className="profile-range-step-btn"
                            onClick={() => nudgeAvatarAdjustment("focusX", -1, avatarFocusLimits.min, avatarFocusLimits.max)}
                            aria-label="Уменьшить горизонтальный сдвиг"
                          >
                            −
                          </button>
                          <input
                            type="range"
                            min={avatarFocusLimits.min}
                            max={avatarFocusLimits.max}
                            value={avatarAdjustments.focusX}
                            onChange={(e) => setAvatarAdjustments((prev) => ({ ...prev, focusX: Number(e.target.value) }))}
                          />
                          <button
                            type="button"
                            className="profile-range-step-btn"
                            onClick={() => nudgeAvatarAdjustment("focusX", 1, avatarFocusLimits.min, avatarFocusLimits.max)}
                            aria-label="Увеличить горизонтальный сдвиг"
                          >
                            +
                          </button>
                        </div>
                      </label>
                      <label>
                        Сдвиг по вертикали
                        <div className="profile-range-control">
                          <button
                            type="button"
                            className="profile-range-step-btn"
                            onClick={() => nudgeAvatarAdjustment("focusY", -1, avatarFocusLimits.min, avatarFocusLimits.max)}
                            aria-label="Уменьшить вертикальный сдвиг"
                          >
                            −
                          </button>
                          <input
                            type="range"
                            min={avatarFocusLimits.min}
                            max={avatarFocusLimits.max}
                            value={avatarAdjustments.focusY}
                            onChange={(e) => setAvatarAdjustments((prev) => ({ ...prev, focusY: Number(e.target.value) }))}
                          />
                          <button
                            type="button"
                            className="profile-range-step-btn"
                            onClick={() => nudgeAvatarAdjustment("focusY", 1, avatarFocusLimits.min, avatarFocusLimits.max)}
                            aria-label="Увеличить вертикальный сдвиг"
                          >
                            +
                          </button>
                        </div>
                      </label>
                      <label>
                        Масштаб
                        <div className="profile-range-control">
                          <button
                            type="button"
                            className="profile-range-step-btn"
                            onClick={() => nudgeAvatarAdjustment("scale", -1, 50, 200)}
                            aria-label="Уменьшить масштаб"
                          >
                            −
                          </button>
                          <input
                            type="range"
                            min="50"
                            max="200"
                            value={avatarAdjustments.scale}
                            onChange={(e) => setAvatarAdjustments((prev) => ({ ...prev, scale: Number(e.target.value) }))}
                          />
                          <button
                            type="button"
                            className="profile-range-step-btn"
                            onClick={() => nudgeAvatarAdjustment("scale", 1, 50, 200)}
                            aria-label="Увеличить масштаб"
                          >
                            +
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>
                  <label>
                    ФИО
                    <input
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
                    />
                  </label>
                  <label>
                    Email
                    <input value={profile?.email || ""} disabled />
                  </label>
                  <label>
                    Роль
                    <input value={profile?.role_name || ""} disabled />
                  </label>
                  <button onClick={saveProfile} disabled={profileSaving}>
                    {profileSaving ? "Сохранение..." : "Сохранить профиль"}
                  </button>
                </div>
                <div className="profile-settings profile-settings-column">
                  <div className="profile-settings-head">
                    <h3>Настройки кабинета</h3>
                    <span>Персонализируйте видимость и поведение рабочего стола</span>
                  </div>
                  <div className="settings-card">
                    <div className="settings-card-head">
                      <h4>Тема интерфейса</h4>
                    </div>
                    <label className="theme-toggle-row">
                      <span className="theme-toggle-copy">
                        <strong>Тёмная тема</strong>
                        <small>Снижает нагрузку на глаза при длительной работе</small>
                      </span>
                      <span className="theme-toggle">
                        <input
                          type="checkbox"
                          checked={theme === "dark"}
                          onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
                        />
                        <span className="theme-toggle-slider" />
                      </span>
                    </label>
                  </div>
                  <div className="settings-card">
                    <div className="settings-card-head">
                      <h4>Верхний слайдер</h4>
                    </div>
                    <label className="theme-toggle-row">
                      <span className="theme-toggle-copy">
                        <strong>Показать слайдер</strong>
                        <small>Отображать панель порталов под топбаром на рабочем столе</small>
                      </span>
                      <span className="theme-toggle">
                        <input
                          type="checkbox"
                          checked={showPortalsSlider}
                          onChange={(e) => setShowPortalsSlider(e.target.checked)}
                        />
                        <span className="theme-toggle-slider" />
                      </span>
                    </label>
                  </div>
                  <div className="settings-card desktop-visibility-settings">
                    <div className="settings-card-head">
                      <h4>Виджеты рабочего стола</h4>
                      <div className="settings-card-actions">
                        <button type="button" className="ghost-btn" onClick={showAllWidgets}>
                          Показать все
                        </button>
                        <button type="button" className="ghost-btn" onClick={resetDesktopLayout}>
                          Сбросить макет
                        </button>
                      </div>
                    </div>
                    <div className="desktop-widget-list-hint">
                      Видимые виджеты: {visibleWidgetIds.length} из {DEFAULT_DESKTOP_WIDGETS.length}
                    </div>
                    {DEFAULT_DESKTOP_WIDGETS.map((widget) => {
                      const checked = visibleWidgetIds.includes(widget.id);
                      const isLastVisible = checked && visibleWidgetIds.length === 1;
                      const meta = WIDGET_SETTINGS_META[widget.id];
                      return (
                        <label key={widget.id} className="desktop-widget-checkbox">
                          <input type="checkbox" checked={checked} disabled={isLastVisible} onChange={() => toggleWidgetVisibility(widget.id)} />
                          <span className="desktop-widget-checkbox-meta">
                            <strong>
                              {meta?.icon ? `${meta.icon} ` : ""}
                              {widget.title}
                            </strong>
                            <small>{meta?.desc || "Виджет рабочего стола"}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="settings-card desktop-interaction-help">
                    <div className="settings-card-head">
                      <h4>Как настраивать виджеты</h4>
                    </div>
                    <p>Перемещайте карточки за ручку ⋮⋮, зоны привязки подсвечиваются автоматически.</p>
                    <p>Перетащите виджеты за ручку ⋮⋮ в шапке для изменения порядка.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
          </>
        )}
      </main>

      {profile.role_code === "admin" && isNewsModalOpen && (
        <div
          className="news-modal-overlay"
          onClick={() => {
            setIsNewsModalOpen(false);
            resetNewsComposer();
          }}
        >
          <div className="news-modal" onClick={(event) => event.stopPropagation()}>
            <div className="news-modal-head">
              <div>
                <h3>{isNewsEditMode ? "Редактировать публикацию" : "Создать публикацию"}</h3>
                <p>Конструктор: медиа, текст, параметры отображения и диаграмма опроса</p>
              </div>
              <button
                className="news-modal-close"
                onClick={() => {
                  setIsNewsModalOpen(false);
                  resetNewsComposer();
                }}
              >
                ✕
              </button>
            </div>
            {newsError && <div className="error">{newsError}</div>}
            <div className="news-composer">
              <section className="composer-media-panel">
                <div className="composer-media-frame">
                  {newsImagePreview || newsForm.imageUrl ? (
                    <img src={newsImagePreview || newsForm.imageUrl} alt="Превью публикации" className="composer-media-image" />
                  ) : (
                    <div className="composer-media-placeholder">
                      <strong>Добавьте фото</strong>
                      <span>Перетащите файл или выберите из устройства</span>
                    </div>
                  )}
                </div>
                <div className="composer-media-actions">
                  <label className="avatar-upload-btn">
                    {newsImagePreview || newsForm.imageUrl ? "Заменить фото" : "Выбрать фото"}
                    <input type="file" accept="image/*" onChange={(e) => setNewsImage(e.target.files?.[0] || null)} />
                  </label>
                  {!isNewsEditMode && (
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={newsForm.publishNow}
                        onChange={(e) => setNewsForm((prev) => ({ ...prev, publishNow: e.target.checked }))}
                      />
                      Опубликовать сразу
                    </label>
                  )}
                </div>
              </section>

              <section className="composer-form-panel">
                <div className="composer-type-switch">
                  <button
                    className={newsForm.kind === "event" ? "active" : ""}
                    onClick={() => setNewsForm((prev) => ({ ...prev, kind: "event" }))}
                  >
                    Событие
                  </button>
                  <button
                    className={newsForm.kind === "poll" ? "active" : ""}
                    onClick={() => setNewsForm((prev) => ({ ...prev, kind: "poll" }))}
                  >
                    Опрос
                  </button>
                </div>

                <label>
                  Заголовок
                  <input
                    value={newsForm.title}
                    onChange={(e) => setNewsForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Что нового?"
                  />
                </label>
                <label>
                  Текст
                  <textarea
                    value={newsForm.content}
                    onChange={(e) => setNewsForm((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="Опишите событие или вопрос для опроса"
                  />
                </label>

                <div className="news-admin-grid">
                  <label>
                    Картинка во фрейме
                    <select
                      value={newsForm.imagePlacement}
                      onChange={(e) => setNewsForm((prev) => ({ ...prev, imagePlacement: e.target.value }))}
                    >
                      <option value="top">Сверху</option>
                      <option value="left">Слева</option>
                      <option value="right">Справа</option>
                    </select>
                  </label>
                  <label>
                    Компоновка текста
                    <select
                      value={newsForm.textLayout}
                      onChange={(e) => setNewsForm((prev) => ({ ...prev, textLayout: e.target.value }))}
                    >
                      <option value="below">Стандартная</option>
                      <option value="overlay">Акцент на изображении</option>
                      <option value="compact">Компактная</option>
                    </select>
                  </label>
                  {newsForm.kind === "poll" && (
                    <label>
                      Диаграмма опроса
                      <select
                        value={newsForm.pollChartType}
                        onChange={(e) => setNewsForm((prev) => ({ ...prev, pollChartType: e.target.value }))}
                      >
                        <option value="bar">Горизонтальные бары</option>
                        <option value="donut">Donut</option>
                        <option value="compact">Компактные итоги</option>
                      </select>
                    </label>
                  )}
                </div>

                {newsForm.kind === "poll" && (
                  <div className="poll-options-editor">
                    {isNewsEditMode && <small className="poll-edit-note">При изменении вариантов предыдущие ответы по опросу будут сброшены.</small>}
                    {newsForm.options.map((option, idx) => (
                      <input
                        key={idx}
                        value={option}
                        onChange={(e) =>
                          setNewsForm((prev) => ({
                            ...prev,
                            options: prev.options.map((item, itemIdx) => (itemIdx === idx ? e.target.value : item)),
                          }))
                        }
                        placeholder={`Вариант ${idx + 1}`}
                      />
                    ))}
                    <button onClick={() => setNewsForm((prev) => ({ ...prev, options: [...prev.options, ""] }))}>
                      Добавить вариант
                    </button>
                  </div>
                )}
              </section>
            </div>
            <div className="news-modal-footer">
              {showDeleteConfirm && (
                <div className="delete-confirm-box">
                  <span>Удалить публикацию без возможности восстановления?</span>
                  <button className="ghost-btn" onClick={() => setShowDeleteConfirm(false)} disabled={newsDeleting}>
                    Отмена
                  </button>
                  <button className="danger-btn" onClick={confirmDeleteNews} disabled={newsDeleting}>
                    {newsDeleting ? "Удаление..." : "Да, удалить"}
                  </button>
                </div>
              )}
              {isNewsEditMode && (
                <button className="danger-btn" onClick={deleteNews} disabled={newsSaving || newsDeleting || showDeleteConfirm}>
                  Удалить
                </button>
              )}
              <button
                className="ghost-btn"
                onClick={() => {
                  setIsNewsModalOpen(false);
                  resetNewsComposer();
                }}
                disabled={newsSaving || newsDeleting}
              >
                Отмена
              </button>
              <button onClick={publishNews} disabled={newsSaving || newsDeleting}>
                {newsSaving ? (isNewsEditMode ? "Сохранение..." : "Публикация...") : isNewsEditMode ? "Сохранить" : "Опубликовать"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isConstructionProjectModalOpen && selectedConstructionProject && (
        <div
          className="construction-project-modal-overlay"
          onClick={() => {
            setIsConstructionProjectModalOpen(false);
          }}
        >
          <div className="construction-project-modal" onClick={(event) => event.stopPropagation()}>
            <div className="construction-project-detail-head">
              <h4>Карточка объекта {selectedConstructionProject.code}</h4>
              <button className="news-modal-close" onClick={() => setIsConstructionProjectModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="construction-detail-grid">
              <div>
                <strong>Город</strong>
                <p>{selectedConstructionProject.city}</p>
              </div>
              <div>
                <strong>Менеджер</strong>
                <p>{selectedConstructionProject.manager}</p>
              </div>
              <div>
                <strong>Стадия</strong>
                <p>{selectedConstructionProject.stage}</p>
              </div>
              <div>
                <strong>Готовность</strong>
                <p>{selectedConstructionProject.readiness_percent}%</p>
              </div>
            </div>
            <span className={`construction-project-state-badge ${selectedConstructionProject.risk ? "risk" : "ok"}`}>
              {selectedConstructionProject.risk ? "Требует внимания" : "В штатном контуре"}
            </span>
            <ul className="construction-detail-checklist">
              <li>Контрольная точка 1: проверка бюджета и лимитов</li>
              <li>Контрольная точка 2: статус подрядчика и графика работ</li>
              <li>Контрольная точка 3: готовность к следующему этапу</li>
            </ul>
          </div>
        </div>
      )}
      <div className="ai-assistant" role="img" aria-label="ИИ-ассистент">
        <div className="ai-assistant-orb">
          <span className="ai-assistant-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
            </svg>
          </span>
        </div>
        <span className="ai-assistant-label">Помощник</span>
      </div>
      {addPortalModalOpen && (
        <div
          className="add-portal-modal-overlay"
          onClick={() => setAddPortalModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-portal-modal-title"
          aria-describedby="add-portal-modal-desc"
        >
          <div ref={addPortalModalRef} className="add-portal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-portal-modal-head">
              <div className="add-portal-modal-title-wrap">
                <h2 id="add-portal-modal-title" className="add-portal-modal-title">Добавить портал в избранное</h2>
                <p id="add-portal-modal-desc" className="add-portal-modal-desc">Выберите порталы для быстрого доступа в сайдбаре</p>
              </div>
              <button type="button" className="add-portal-modal-close" onClick={() => setAddPortalModalOpen(false)} aria-label="Закрыть">
                <span aria-hidden>✕</span>
              </button>
            </div>
            <div className="add-portal-modal-body">
              <div className="add-portal-modal-grid">
                {catalog.filter((s) => !hiddenPortalIds.includes(String(s.id))).map((system) => {
                  const isFavorite = portalFavorites.includes(String(system.id));
                  const justAdded = lastAddedPortalId === system.id;
                  const meta = PORTAL_ICON_META[system.title] || { icon: "🔗", color: "linear-gradient(135deg, #5E7EA6 0%, #3D5A80 100%)", accent: "#5E7EA6" };
                  return (
                    <button
                      key={system.id}
                      type="button"
                      className={`add-portal-tile ${isFavorite ? "add-portal-tile-added" : ""} ${justAdded ? "add-portal-tile-just-added" : ""}`}
                      onClick={() => {
                        const id = String(system.id);
                        if (isFavorite) {
                          setPortalFavorites((prev) => prev.filter((item) => item !== id));
                          showToast("Портал удалён из избранного");
                        } else {
                          setPortalFavorites((prev) => [...prev, id]);
                          setLastAddedPortalId(system.id);
                          setTimeout(() => setLastAddedPortalId(null), 600);
                          showToast("Портал добавлен в избранное");
                        }
                      }}
                    >
                      <span className="add-portal-tile-icon" style={{ "--tile-accent": meta.accent || "#003366" }}>
                        {meta.image ? <img src={meta.image} alt="" className="add-portal-tile-icon-img" /> : meta.icon}
                      </span>
                      <div className="add-portal-tile-text">
                        <strong>{meta.displayTitle || system.title}</strong>
                        <span>{system.category}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="toast-container" role="region" aria-label="Уведомления">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}`}
            role="status"
          >
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const { token, profile, login, logout, setProfile, refreshProfile } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage onLogin={login} />} />
      <Route
        path="/"
        element={
          token ? (
            <DashboardPage token={token} profile={profile} onLogout={logout} onProfileChange={setProfile} refreshProfile={refreshProfile} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
