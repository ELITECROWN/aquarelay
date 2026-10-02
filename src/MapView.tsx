import { useEffect, useRef, useState } from "react";
import type * as GeoJSON from "geojson";
import {
  Map,
  Marker,
  NavigationControl,
  LngLatBounds,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed, Maximize2, Layers, Info } from "lucide-react";
import type { WaterBody } from "./types";
setWorkerUrl(workerUrl);
const neutral: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "paper",
      type: "background",
      paint: { "background-color": "#EAEDE4" },
    },
  ],
};
export default function MapView({
  items,
  selected,
  onSelect,
  compact = false,
}: {
  items: WaterBody[];
  selected?: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<Map | null>(null),
    select = useRef(onSelect);
  select.current = onSelect;
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [locationMessage, setLocationMessage] = useState("");
  const current = useRef(items);
  current.current = items;
  const configuredStyle = import.meta.env.VITE_MAP_STYLE_URL;
  const demoContext =
    !configuredStyle && items.length > 0 && items.every((w) => w.synthetic);
  useEffect(() => {
    if (!container.current) return;
    try {
      const instance = new Map({
        container: container.current,
        style: import.meta.env.VITE_MAP_STYLE_URL || neutral,
        center: [77.59, 12.97],
        zoom: 13.4,
        attributionControl: { compact: true },
        renderWorldCopies: false,
      });
      map.current = instance;
      instance.addControl(
        new NavigationControl({ showCompass: false }),
        "bottom-right",
      );
      instance.on("load", () => {
        instance.addSource("water-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 46,
          attribution:
            "AquaRelay · water-body records; synthetic features individually labelled",
        });
        instance.addSource("water-shapes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        instance.addSource("district", {
          type: "geojson",
          data:
            !configuredStyle &&
            current.current.length > 0 &&
            current.current.every((w) => w.synthetic)
              ? district(current.current)
              : { type: "FeatureCollection", features: [] },
        });
        instance.addLayer({
          id: "parks",
          type: "fill",
          source: "district",
          filter: ["==", ["get", "kind"], "park"],
          paint: { "fill-color": "#DCE4D5", "fill-opacity": 0.8 },
        });
        instance.addLayer({
          id: "streets-edge",
          type: "line",
          source: "district",
          filter: ["==", ["get", "kind"], "street"],
          paint: { "line-color": "#DCE0D6", "line-width": 15 },
        });
        instance.addLayer({
          id: "streets",
          type: "line",
          source: "district",
          filter: ["==", ["get", "kind"], "street"],
          paint: { "line-color": "#FAFBF6", "line-width": 11 },
        });
        instance.addLayer({
          id: "waters",
          type: "fill",
          source: "water-shapes",
          paint: { "fill-color": "#BCD3DE", "fill-opacity": 0.9 },
        });
        instance.addLayer({
          id: "water-edge",
          type: "line",
          source: "water-shapes",
          paint: { "line-color": "#91B6C6", "line-width": 1.2 },
        });
        instance.addLayer({
          id: "clusters",
          type: "circle",
          source: "water-points",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#183B30",
            "circle-radius": 23,
            "circle-stroke-color": "white",
            "circle-stroke-width": 4,
          },
        });
        instance.addLayer({
          id: "points",
          type: "circle",
          source: "water-points",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "case",
              [">", ["get", "case_count"], 0],
              "#B66B39",
              "#385D50",
            ],
            "circle-radius": 10,
            "circle-stroke-color": "white",
            "circle-stroke-width": 4,
          },
        });
        instance.on("click", "points", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (id) select.current(String(id));
        });
        instance.on("click", "waters", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (id) select.current(String(id));
        });
        instance.on("click", "clusters", async (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const zoom = await (
            instance.getSource("water-points") as GeoJSONSource
          ).getClusterExpansionZoom(feature.properties?.cluster_id);
          instance.easeTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as [
              number,
              number,
            ],
            zoom,
          });
        });
        ["points", "waters", "clusters"].forEach((layer) => {
          instance.on("mouseenter", layer, () => {
            instance.getCanvas().style.cursor = "pointer";
          });
          instance.on("mouseleave", layer, () => {
            instance.getCanvas().style.cursor = "";
          });
        });
        setReady(true);
      });
      instance.on("error", () =>
        setError("Map layer unavailable. The results list remains available."),
      );
      return () => {
        instance.remove();
        map.current = null;
        setReady(false);
      };
    } catch {
      setError(
        "Interactive map unavailable on this device. Use the results list.",
      );
    }
  }, []);
  function fit() {
    if (!map.current || !items.length) return;
    const bounds = new LngLatBounds();
    items.forEach((w) => bounds.extend([w.longitude, w.latitude]));
    map.current.fitBounds(bounds, {
      padding: compact
        ? 40
        : container.current && container.current.clientWidth < 480
          ? 35
          : 75,
      maxZoom: 14.1,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 700,
    });
  }
  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("district") as GeoJSONSource)?.setData(
      demoContext
        ? district(items)
        : { type: "FeatureCollection", features: [] },
    );
    (map.current.getSource("water-points") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: items.map((w) => ({
        type: "Feature",
        properties: { id: w.id, name: w.name, case_count: w.case_count },
        geometry: { type: "Point", coordinates: [w.longitude, w.latitude] },
      })),
    });
    (map.current.getSource("water-shapes") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: items
        .filter((w) => w.geometry)
        .map((w) => ({
          type: "Feature",
          properties: { id: w.id },
          geometry: w.geometry!,
        })),
    });
    fit();
  }, [items, ready]);
  useEffect(() => {
    const water = items.find((w) => w.id === selected);
    if (water && ready)
      map.current?.easeTo({
        center: [water.longitude, water.latitude],
        zoom: 14.3,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 600,
      });
  }, [selected, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    let markers: Marker[] = [];
    const update = () => {
      markers.forEach((m) => m.remove());
      markers = [];
      if (instance.getZoom() > 12) {
        items.forEach((w) => {
          const button = document.createElement("button");
          button.className = "map-place-label";
          button.textContent = w.name;
          button.title = `${w.name} · ${workflowText(w)}`;
          button.setAttribute("aria-label", `Select ${w.name} on map`);
          button.onclick = () => select.current(w.id);
          markers.push(
            new Marker({ element: button, anchor: "top", offset: [0, 17] })
              .setLngLat([w.longitude, w.latitude])
              .addTo(instance),
          );
        });
      } else {
        const seen = new Set();
        instance
          .queryRenderedFeatures({ layers: ["clusters"] })
          .forEach((f) => {
            const id = f.properties?.cluster_id;
            if (seen.has(id)) return;
            seen.add(id);
            const button = document.createElement("button");
            button.className = "map-cluster-label";
            button.textContent = String(f.properties?.point_count);
            button.setAttribute(
              "aria-label",
              `Zoom into ${f.properties?.point_count} water bodies`,
            );
            button.onclick = async () => {
              const zoom = await (
                instance.getSource("water-points") as GeoJSONSource
              ).getClusterExpansionZoom(id);
              instance.easeTo({
                center: (f.geometry as GeoJSON.Point).coordinates as [
                  number,
                  number,
                ],
                zoom,
              });
            };
            markers.push(
              new Marker({ element: button })
                .setLngLat(
                  (f.geometry as GeoJSON.Point).coordinates as [number, number],
                )
                .addTo(instance),
            );
          });
      }
    };
    instance.on("idle", update);
    instance.on("zoomend", update);
    return () => {
      instance.off("idle", update);
      instance.off("zoomend", update);
      markers.forEach((m) => m.remove());
    };
  }, [ready, items]);
  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage("Location unavailable. Select a place from the list.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 13,
          essential: false,
        });
        setLocationMessage(
          `Device location shown.${items.some((w) => w.synthetic) ? " Demo places use synthetic coordinates." : ""}`,
        );
      },
      () =>
        setLocationMessage(
          "Location permission denied or unavailable. Search or select a place manually.",
        ),
      { timeout: 8000 },
    );
  }
  return (
    <div className={`map-view ${compact ? "map-compact" : ""}`}>
      <div
        ref={container}
        className="map-canvas"
        aria-label="Interactive water-body map"
        data-testid="interactive-map"
      />
      {!compact && (
        <div className="map-tools">
          <button
            className="map-tool"
            onClick={fit}
            aria-label="Fit map to results"
          >
            <Maximize2 size={18} />
          </button>
          <button
            className="map-tool"
            onClick={locate}
            aria-label="Use my location"
          >
            <LocateFixed size={18} />
          </button>
        </div>
      )}
      <div className="map-layer">
        <Layers size={15} />
        <span>
          {configuredStyle
            ? "Configured basemap"
            : demoContext
              ? "Synthetic demo layer"
              : "Neutral map · no basemap configured"}
        </span>
      </div>
      {demoContext && (
        <div className="district-label">
          DEMO REEDWATER DISTRICT<span>Fictional demonstration geography</span>
        </div>
      )}
      <div className="map-legend">
        <span>
          <i className="legend-dot active" />
          Open case
        </span>
        <span>
          <i className="legend-dot" />
          No open cases
        </span>
      </div>
      {(error || locationMessage) && (
        <div className="map-message" role="status">
          <Info size={16} />
          {error || locationMessage}
        </div>
      )}
    </div>
  );
}
function district(items: WaterBody[]): GeoJSON.FeatureCollection {
  const center = items.length
    ? [
        items.reduce((s, w) => s + w.longitude, 0) / items.length,
        items.reduce((s, w) => s + w.latitude, 0) / items.length,
      ]
    : [77.59, 12.97];
  const [x, y] = center;
  const features: GeoJSON.Feature[] = [];
  for (let i = -4; i <= 4; i++) {
    features.push({
      type: "Feature",
      properties: { kind: "street" },
      geometry: {
        type: "LineString",
        coordinates: [
          [x - 0.04, y + i * 0.006 - 0.01],
          [x + 0.04, y + i * 0.006 + 0.01],
        ],
      },
    });
    features.push({
      type: "Feature",
      properties: { kind: "street" },
      geometry: {
        type: "LineString",
        coordinates: [
          [x + i * 0.009 - 0.008, y - 0.04],
          [x + i * 0.009 + 0.008, y + 0.04],
        ],
      },
    });
  }
  for (let i = 0; i < 5; i++) {
    const px = x - 0.025 + i * 0.012,
      py = y + (i % 2 === 0 ? 0.012 : -0.015);
    features.push({
      type: "Feature",
      properties: { kind: "park" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [px, py],
            [px + 0.006, py + 0.001],
            [px + 0.005, py + 0.006],
            [px - 0.001, py + 0.005],
            [px, py],
          ],
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}
function workflowText(w: WaterBody) {
  return w.case_count
    ? `${w.case_count} open cases`
    : "No open cases — condition not assessed";
}
