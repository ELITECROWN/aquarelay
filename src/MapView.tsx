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
const realMap: StyleSpecification = {
  version: 8,
  sources: { streets:{type:'raster',tiles:[import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'} },
  layers: [
    {id:'streets-basemap',type:'raster',source:'streets'},
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
  const locationMarker=useRef<Marker|null>(null);
  const autoFit=useRef(true);
  current.current = items;
  const configuredStyle = import.meta.env.VITE_MAP_STYLE_URL;
  const demoContext =
    items.length > 0 && items.every((w) => w.synthetic);
  useEffect(() => {
    if (!container.current) return;
    try {
      const instance = new Map({
        container: container.current,
        style: import.meta.env.VITE_MAP_STYLE_URL || realMap,
        center: [77.59, 12.97],
        zoom: 13.4,
        attributionControl: { compact: false },
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
          data:{ type: "FeatureCollection", features: [] },
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
        locationMarker.current?.remove();locationMarker.current=null;
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
      { type: "FeatureCollection", features: [] },
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
    if(autoFit.current)fit();
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
        autoFit.current=false;
        if(map.current){locationMarker.current?.remove();locationMarker.current=new Marker({color:'#1769e0'}).setLngLat([position.coords.longitude,position.coords.latitude]).addTo(map.current);locationMarker.current.getElement().setAttribute('aria-label','Your approximate device location');}
        map.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 13,
          essential: false,
        });
        setLocationMessage(
          `Device location shown · accuracy approximately ${Math.round(position.coords.accuracy)} metres.${items.some((w) => w.synthetic) ? " Demo places use synthetic coordinates." : ""}`,
        );
      },
      () =>
        setLocationMessage(
          "Location permission denied or unavailable. Search or select a place manually.",
        ),
      { timeout: 10000, enableHighAccuracy:true, maximumAge:30000 },
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
            : "OpenStreetMap street map"}
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
function workflowText(w: WaterBody) {
  return w.case_count
    ? `${w.case_count} open cases`
    : "No open cases — condition not assessed";
}
