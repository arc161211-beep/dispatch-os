// ---------------------------------------------------------------------------
// Open-Meteo weather integration for DispatchOS.
//
// Provides current conditions and hourly forecast for any lat/lng point.
// No API key required — uses the free Open-Meteo public API.
//
// SECURITY: All calls happen server-side through Convex actions.
// ---------------------------------------------------------------------------

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// ---------------------------------------------------------------------------
// Auth helper (mirrors ai.ts / routing.ts pattern)
// ---------------------------------------------------------------------------

interface Session {
  userId: Id<"users">;
  orgId: Id<"organizations">;
}

async function getSessionForAction(ctx: ActionCtx): Promise<Session> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("You must be signed in.");
  const user = await ctx.runQuery(api.users.currentUser, {});
  if (!user?.orgId) throw new ConvexError("Workspace not ready.");
  return { userId, orgId: user.orgId };
}

// ---------------------------------------------------------------------------
// Open-Meteo response types
// ---------------------------------------------------------------------------

interface OpenMeteoCurrent {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  precipitation: number;
  rain: number;
  weather_code: number;
  cloud_cover: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
  visibility: number;
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  rain: number[];
  snowfall: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  visibility: number[];
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
  current_units?: Record<string, string>;
  hourly?: OpenMeteoHourly;
  hourly_units?: Record<string, string>;
  error?: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// WMO Weather Code → human-readable + icon
// ---------------------------------------------------------------------------

export interface WeatherCondition {
  code: number;
  label: string;
  icon: string;
  severity: "normal" | "caution" | "warning" | "severe";
}

export const WMO_CODES: Record<number, WeatherCondition> = {
  0:  { code: 0, label: "Clear sky", icon: "☀️", severity: "normal" },
  1:  { code: 1, label: "Mainly clear", icon: "🌤️", severity: "normal" },
  2:  { code: 2, label: "Partly cloudy", icon: "⛅", severity: "normal" },
  3:  { code: 3, label: "Overcast", icon: "☁️", severity: "normal" },
  45: { code: 45, label: "Fog", icon: "🌫️", severity: "caution" },
  48: { code: 48, label: "Depositing rime fog", icon: "🌫️", severity: "caution" },
  51: { code: 51, label: "Light drizzle", icon: "🌦️", severity: "normal" },
  53: { code: 53, label: "Moderate drizzle", icon: "🌦️", severity: "caution" },
  55: { code: 55, label: "Dense drizzle", icon: "🌧️", severity: "warning" },
  56: { code: 56, label: "Freezing drizzle", icon: "🧊", severity: "severe" },
  57: { code: 57, label: "Heavy freezing drizzle", icon: "🧊", severity: "severe" },
  61: { code: 61, label: "Slight rain", icon: "🌧️", severity: "normal" },
  63: { code: 63, label: "Moderate rain", icon: "🌧️", severity: "caution" },
  65: { code: 65, label: "Heavy rain", icon: "🌧️", severity: "warning" },
  66: { code: 66, label: "Freezing rain", icon: "🧊", severity: "severe" },
  67: { code: 67, label: "Heavy freezing rain", icon: "🧊", severity: "severe" },
  71: { code: 71, label: "Slight snow", icon: "🌨️", severity: "caution" },
  73: { code: 73, label: "Moderate snow", icon: "🌨️", severity: "warning" },
  75: { code: 75, label: "Heavy snow", icon: "❄️", severity: "severe" },
  77: { code: 77, label: "Snow grains", icon: "❄️", severity: "caution" },
  80: { code: 80, label: "Slight rain showers", icon: "🌦️", severity: "normal" },
  81: { code: 81, label: "Moderate rain showers", icon: "🌧️", severity: "caution" },
  82: { code: 82, label: "Violent rain showers", icon: "⛈️", severity: "severe" },
  85: { code: 85, label: "Slight snow showers", icon: "🌨️", severity: "caution" },
  86: { code: 86, label: "Heavy snow showers", icon: "❄️", severity: "severe" },
  95: { code: 95, label: "Thunderstorm", icon: "⛈️", severity: "severe" },
  96: { code: 96, label: "Thunderstorm with hail", icon: "⛈️", severity: "severe" },
  99: { code: 99, label: "Thunderstorm with heavy hail", icon: "⛈️", severity: "severe" },
};

function getCondition(code: number): WeatherCondition {
  return WMO_CODES[code] ?? { code, label: "Unknown", icon: "❓", severity: "normal" };
}

function degToCardinal(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface CurrentWeather {
  temperature: number;       // °F
  feelsLike: number;         // °F
  precipitation: number;     // mm
  rain: number;              // mm
  weatherCode: number;
  condition: WeatherCondition;
  cloudCover: number;        // %
  windSpeed: number;         // mph
  windDirection: number;     // degrees
  windCardinal: string;      // "NW"
  windGusts: number;         // mph
  visibility: number;        // meters
  visibilityMiles: number;
  time: string;              // ISO timestamp
  isSevere: boolean;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  precipProbability: number;
  precip: number;
  rain: number;
  snowfall: number;
  weatherCode: number;
  condition: WeatherCondition;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  visibility: number;
}

export interface WeatherResult {
  lat: number;
  lng: number;
  current: CurrentWeather | null;
  hourly: HourlyForecast[];
  configured: boolean;
  error?: string;
}

function emptyResult(lat: number, lng: number, error?: string): WeatherResult {
  return { lat, lng, current: null, hourly: [], configured: true, error };
}

// ---------------------------------------------------------------------------
// Action: getWeather
// ---------------------------------------------------------------------------

export const getWeather = action({
  args: {
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args): Promise<WeatherResult> => {
    await getSessionForAction(ctx);

    // Validate coordinates
    if (args.latitude < -90 || args.latitude > 90 || args.longitude < -180 || args.longitude > 180) {
      throw new ConvexError("Invalid coordinates.");
    }

    const lat = Math.round(args.latitude * 1000) / 1000;
    const lng = Math.round(args.longitude * 1000) / 1000;

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      current: "temperature_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility",
      hourly: "temperature_2m,precipitation_probability,precipitation,rain,snowfall,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: "America/Chicago",
      forecast_days: "2",
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[weather] Open-Meteo error (${res.status}):`, errText.slice(0, 200));
        return emptyResult(lat, lng, `Weather service returned status ${res.status}.`);
      }

      const data = (await res.json()) as OpenMeteoResponse;

      if (data.error) {
        return emptyResult(lat, lng, data.reason ?? "Weather data unavailable for this location.");
      }

      // Parse current
      let current: CurrentWeather | null = null;
      if (data.current) {
        const c = data.current;
        const condition = getCondition(c.weather_code);
        const visibilityMiles = c.visibility != null ? c.visibility / 1609.34 : 0;
        current = {
          temperature: Math.round(c.temperature_2m * 10) / 10,
          feelsLike: Math.round(c.apparent_temperature * 10) / 10,
          precipitation: c.precipitation,
          rain: c.rain,
          weatherCode: c.weather_code,
          condition,
          cloudCover: c.cloud_cover,
          windSpeed: Math.round(c.wind_speed_10m * 10) / 10,
          windDirection: c.wind_direction_10m,
          windCardinal: degToCardinal(c.wind_direction_10m),
          windGusts: Math.round(c.wind_gusts_10m * 10) / 10,
          visibility: c.visibility,
          visibilityMiles: Math.round(visibilityMiles * 10) / 10,
          time: c.time,
          isSevere: condition.severity === "severe" || c.wind_gusts_10m > 50 || c.visibility < 200,
        };
      }

      // Parse hourly (limit to next 24 hours)
      const hourly: HourlyForecast[] = [];
      if (data.hourly) {
        const h = data.hourly;
        const now = new Date();
        const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        for (let i = 0; i < h.time.length && hourly.length < 24; i++) {
          const t = new Date(h.time[i]);
          if (t < now || t > cutoff) continue;
          hourly.push({
            time: h.time[i],
            temperature: Math.round(h.temperature_2m[i] * 10) / 10,
            precipProbability: h.precipitation_probability[i] ?? 0,
            precip: h.precipitation[i] ?? 0,
            rain: h.rain[i] ?? 0,
            snowfall: h.snowfall[i] ?? 0,
            weatherCode: h.weather_code[i],
            condition: getCondition(h.weather_code[i]),
            windSpeed: Math.round(h.wind_speed_10m[i] * 10) / 10,
            windDirection: h.wind_direction_10m[i],
            windGusts: Math.round(h.wind_gusts_10m[i] * 10) / 10,
            visibility: h.visibility[i] ?? 0,
          });
        }
      }

      return { lat, lng, current, hourly, configured: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[weather] request failed:", msg);
      if (msg.includes("timeout") || msg.includes("abort")) {
        return emptyResult(lat, lng, "Weather request timed out.");
      }
      return emptyResult(lat, lng, "Failed to reach weather service.");
    }
  },
});
