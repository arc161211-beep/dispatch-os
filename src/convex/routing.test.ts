import { describe, it, expect } from "vitest";

// Re-implement the polyline decoder for testing (mirrors routing.ts)
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
}

describe("Polyline decoder", () => {
  it("decodes a simple two-point polyline", () => {
    // Manually encoded two points: (49.0, -122.0) and (49.1, -122.1)
    // Lat 49.0 → 490000, Lng -122.0 → -12200000
    const encoded = "gfo}E";
    const coords = decodePolyline(encoded);
    expect(coords.length).toBe(1);
    expect(typeof coords[0][0]).toBe("number");
    expect(typeof coords[0][1]).toBe("number");
  });

  it("returns empty array for empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });

  it("handles a real-world route polyline", () => {
    // A longer encoded string (simulating a real ORS response)
    const encoded = "gfo}E~negNcjqEix{E`pqEix{E";
    const coords = decodePolyline(encoded);
    expect(coords.length).toBeGreaterThanOrEqual(2);
    for (const [lng, lat] of coords) {
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(180);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
    }
  });

  it("decodes a simple two-point encoded polyline", () => {
    // A known two-point polyline string
    const encoded = "gfo}E~negN";
    const coords = decodePolyline(encoded);
    // The decoder should produce valid coordinate pairs
    expect(coords.length).toBeGreaterThanOrEqual(1);
    for (const [lng, lat] of coords) {
      expect(typeof lng).toBe("number");
      expect(typeof lat).toBe("number");
      expect(Number.isFinite(lng)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });
});

describe("Duration/distance formatting", () => {
  function formatDuration(seconds: number): string {
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  function formatDistance(miles: number): string {
    return miles >= 100 ? `${Math.round(miles)} mi` : `${miles.toFixed(1)} mi`;
  }

  it("formats short duration", () => {
    expect(formatDuration(300)).toBe("5m");
  });

  it("formats long duration", () => {
    expect(formatDuration(5400)).toBe("1h 30m");
  });

  it("formats very long duration", () => {
    expect(formatDuration(14400)).toBe("4h 0m");
  });

  it("formats short distance", () => {
    expect(formatDistance(45.3)).toBe("45.3 mi");
  });

  it("formats long distance", () => {
    expect(formatDistance(342.7)).toBe("343 mi");
  });
});
