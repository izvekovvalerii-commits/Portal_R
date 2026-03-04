import { WIDGET_SPAN_STEPS, WIDGET_MIN_SPAN, WIDGET_MAX_SPAN, DESKTOP_COLUMNS } from "../constants";

export function snapWidgetSpan(rawSpan) {
  const span = Number(rawSpan) || WIDGET_MIN_SPAN;
  if (span <= WIDGET_MIN_SPAN) return WIDGET_MIN_SPAN;
  if (span >= WIDGET_MAX_SPAN) return WIDGET_MAX_SPAN;
  let best = WIDGET_SPAN_STEPS[0];
  for (const step of WIDGET_SPAN_STEPS) {
    if (Math.abs(step - span) < Math.abs(best - span)) best = step;
  }
  return best;
}

export function getWidgetSizeUnits(span) {
  const snapped = snapWidgetSpan(span);
  return snapped >= 10 ? 3 : snapped >= 8 ? 2 : 1;
}

export function getWidgetSizeLabel(span) {
  return `${getWidgetSizeUnits(span)}/3`;
}

export function getWidgetSizeIcon(span) {
  const u = getWidgetSizeUnits(span);
  return u === 3 ? "▣" : u === 2 ? "◧" : "▢";
}

export function getNextWidgetSpan(span) {
  const current = snapWidgetSpan(span);
  const idx = WIDGET_SPAN_STEPS.indexOf(current);
  return WIDGET_SPAN_STEPS[(idx + 1) % WIDGET_SPAN_STEPS.length];
}

export function normalizeColumnWidths(visibleColumns, storedWidths) {
  if (!visibleColumns.length) return {};
  const total = visibleColumns.reduce((sum, col) => sum + (storedWidths[col] || 33), 0);
  const result = {};
  for (const col of visibleColumns) {
    result[col] = Number((((storedWidths[col] || 33) / total) * 100).toFixed(2));
  }
  return result;
}

export function getDefaultWidgetRowSpan(widgetId) {
  return widgetId === "news" || widgetId === "calendar" || widgetId === "map" ? 2 : 1;
}

export function normalizeWidget(baseWidget, persisted = {}) {
  const persistedSpan = persisted?.span || baseWidget.span || baseWidget.default_span || 4;
  const normalizedSpan = snapWidgetSpan(persistedSpan);
  const persistedColumn = persisted?.column || persisted?.column_key || baseWidget.column_key || null;
  return {
    id: baseWidget.id || baseWidget.widget_key,
    title: baseWidget.id === "map" ? baseWidget.title : (persisted?.title || baseWidget.title),
    span: normalizedSpan,
    rowSpan: Math.max(1, Math.min(3, persisted?.rowSpan || 1)),
    column: normalizedSpan >= 10 ? null : persistedColumn || "left",
  };
}

export function buildWidgetBlocks(widgets) {
  const blocks = [];
  let columns = { left: [], middle: [], right: [] };
  let weights = { left: 0, middle: 0, right: 0 };

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

export function applyWidgetDrop(widgets, draggedId, targetId, position, columnHint) {
  const idx = widgets.findIndex((w) => w.id === draggedId);
  if (idx < 0) return widgets;
  const dragged = { ...widgets[idx] };
  const rest = widgets.filter((w) => w.id !== draggedId);
  const targetIdx = rest.findIndex((w) => w.id === targetId);
  if (targetIdx < 0) return widgets;

  const isSide = position === "left" || position === "right";
  const target = rest[targetIdx];

  if (isSide) {
    dragged.span = 4;
    dragged.column = columnHint || (position === "left" ? "left" : "right");
    if (target.column === dragged.column) {
      const cols = ["left", "middle", "right"];
      const targetCurrentIdx = cols.indexOf(target.column);
      target.column = position === "left" ? cols[Math.min(targetCurrentIdx + 1, 2)] : cols[Math.max(targetCurrentIdx - 1, 0)];
    }
    target.span = 4;
  } else {
    dragged.column = columnHint || target.column || dragged.column || "left";
    dragged.rowSpan = Math.max(1, dragged.rowSpan || getDefaultWidgetRowSpan(dragged.id));
  }

  const insertIdx = position === "bottom" || position === "right" ? targetIdx + 1 : targetIdx;
  const result = [...rest];
  result.splice(insertIdx, 0, dragged);
  return result;
}

export function parseDropZoneId(rawId) {
  if (typeof rawId !== "string") return null;
  if (rawId.startsWith("drop:")) {
    const [, targetId, position] = rawId.split(":");
    if (!targetId || !position) return null;
    return { type: "widget", targetId, position };
  }
  if (rawId.startsWith("dropcol:")) {
    const [, blockIndexRaw, column, position] = rawId.split(":");
    const blockIndex = Number(blockIndexRaw);
    if (!Number.isFinite(blockIndex) || !DESKTOP_COLUMNS.includes(column) || (position !== "end" && position !== "body")) return null;
    return { type: "column", blockIndex, column, position };
  }
  return null;
}

export function detectDropPositionByPoint(targetElement, clientX, clientY) {
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
    Math.abs(nearest.distance - second.distance) < 14
  ) {
    return previousPosition;
  }
  return nearest.position;
}
