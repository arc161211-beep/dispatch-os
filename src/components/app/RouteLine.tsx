// ---------------------------------------------------------------------------
// RouteLine — renders a driving route on a MapLibre GL map.
//
// Usage:
//   <RouteLine map={map} coordinates={[[lng, lat], ...]} color="#4F8CFF" />
//
// The component manages its own source/layer lifecycle.
// ---------------------------------------------------------------------------

import { useEffect } from "react";
import type { Map } from "maplibre-gl";

interface RouteLineProps {
  map: Map | null;
  coordinates: [number, number][];
  color?: string;
  width?: number;
  opacity?: number;
  sourceId?: string;
  layerId?: string;
}

export function RouteLine({
  map,
  coordinates,
  color = "#4F8CFF",
  width = 4,
  opacity = 0.8,
  sourceId = "route-line",
  layerId = "route-line-layer",
}: RouteLineProps) {
  useEffect(() => {
    if (!map || !coordinates.length || coordinates.length < 2) return;

    // Remove previous source/layer if they exist
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates,
        },
      },
    });

    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": color,
        "line-width": width,
        "line-opacity": opacity,
      },
    });

    return () => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [map, coordinates, color, width, opacity, sourceId, layerId]);

  return null;
}
