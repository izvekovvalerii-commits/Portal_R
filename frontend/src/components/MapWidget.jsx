import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap, CircleMarker, Popup } from "react-leaflet";
import { PYATEROCHKA_STORES } from "../data/pyaterochkaStores";

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const DEFAULT_CENTER = [55.7558, 37.6173];
const DEFAULT_ZOOM = 5;

function MapResizeSync() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function MapBounds({ stores }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !stores.length) return;
    if (stores.length === 1) {
      map.setView([stores[0].lat, stores[0].lon], 14);
      return;
    }
    const bounds = stores.reduce(
      (acc, s) => {
        acc[0] = Math.min(acc[0], s.lat);
        acc[1] = Math.min(acc[1], s.lon);
        acc[2] = Math.max(acc[2], s.lat);
        acc[3] = Math.max(acc[3], s.lon);
        return acc;
      },
      [Infinity, Infinity, -Infinity, -Infinity]
    );
    map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: [24, 24], maxZoom: 12 });
  }, [map, stores]);
  return null;
}

export default function MapWidget() {
  const [selectedRegion, setSelectedRegion] = useState("all");

  const regions = useMemo(() => {
    const set = new Set(PYATEROCHKA_STORES.map((s) => s.region));
    return ["all", ...Array.from(set).sort()];
  }, []);

  const filteredStores = useMemo(() => {
    if (selectedRegion === "all") return PYATEROCHKA_STORES;
    return PYATEROCHKA_STORES.filter((s) => s.region === selectedRegion);
  }, [selectedRegion]);

  const regionLabel = selectedRegion === "all" ? "Все регионы" : selectedRegion;

  return (
    <div className="map-widget" aria-label="Интерактивная карта магазинов Пятёрочка">
      <div className="map-widget-controls">
        <label className="map-widget-filter-label">
          <span className="map-widget-filter-text">Регион:</span>
          <select
            className="map-widget-region-select"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            aria-label="Фильтр по региону"
          >
            <option value="all">Все регионы</option>
            {regions.filter((r) => r !== "all").map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <span className="map-widget-count">
          {filteredStores.length} {filteredStores.length === 1 ? "магазин" : filteredStores.length < 5 ? "магазина" : "магазинов"}
        </span>
      </div>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        attributionControl={false}
        className="map-widget-container"
        style={{ height: "100%", minHeight: 340 }}
      >
        <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapResizeSync />
        {filteredStores.length > 0 && <MapBounds stores={filteredStores} />}
        {filteredStores.map((store) => (
          <CircleMarker
            key={store.id}
            center={[store.lat, store.lon]}
            radius={8}
            pathOptions={{
              fillColor: "#19a35b",
              color: "#0f8a4a",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.85,
            }}
            eventHandlers={{
              mouseover: (e) => e.target.setStyle({ fillOpacity: 1, weight: 3 }),
              mouseout: (e) => e.target.setStyle({ fillOpacity: 0.85, weight: 2 }),
            }}
          >
            <Popup>
              <div className="map-widget-popup">
                <strong className="map-widget-popup-title">Пятёрочка {store.code}</strong>
                <p className="map-widget-popup-address">{store.address}</p>
                <p className="map-widget-popup-city">{store.city}, {store.region}</p>
                <p className="map-widget-popup-meta">{store.format} · {store.hours}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
