// ---------------------------------------------------------------------------
// WeatherCard — reusable component for displaying weather at a location.
//
// Shows current conditions, 24h forecast, severe weather warnings,
// and Open-Meteo attribution.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Cloud, Droplets, Eye, Gauge, Loader2, Wind,
  AlertTriangle,
} from "lucide-react";
import type { CurrentWeather, HourlyForecast, WeatherResult } from "@/convex/weather";

// ---------------------------------------------------------------------------
// Coordinate cache (client-side, avoids duplicate requests)
// ---------------------------------------------------------------------------

const cache = new Map<string, { data: WeatherResult; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function cacheKey(lat: number, lng: number): string {
  return `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`;
}

// ---------------------------------------------------------------------------
// WeatherCard
// ---------------------------------------------------------------------------

interface WeatherCardProps {
  latitude: number;
  longitude: number;
  label?: string;
  compact?: boolean;
  showForecast?: boolean;
  className?: string;
}

export function WeatherCard({
  latitude,
  longitude,
  label,
  compact = false,
  showForecast = true,
  className = "",
}: WeatherCardProps) {
  const getWeather = useAction(api.weather.getWeather);
  const [result, setResult] = useState<WeatherResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = cacheKey(latitude, longitude);

  const fetchWeather = useCallback(async () => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setResult(cached.data);
      setLoading(false);
      if (cached.data.error) setError(cached.data.error);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getWeather({ latitude, longitude });
      cache.set(key, { data, ts: Date.now() });
      setResult(data);
      if (data.error) setError(data.error);
    } catch {
      setError("Failed to load weather data.");
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, key, getWeather]);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  if (loading) {
    return (
      <div className={`rounded-xl border border-border/50 bg-card p-4 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading weather…
        </div>
      </div>
    );
  }

  if (error || !result?.current) {
    return (
      <div className={`rounded-xl border border-border/50 bg-card p-4 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Cloud className="size-4" /> {error ?? "Weather data unavailable"}
        </div>
      </div>
    );
  }

  const { current, hourly } = result;

  return (
    <div className={`rounded-xl border border-border/50 bg-card overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        {label && (
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        )}
        {current.isSevere && (
          <div className="flex items-center gap-1 rounded-full bg-[#EF4444]/10 px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">
            <AlertTriangle className="size-3" /> SEVERE
          </div>
        )}
      </div>

      {/* Current conditions */}
      <div className="px-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{current.condition.icon}</span>
            <div>
              <p className="text-2xl font-bold tabular-nums leading-none">{Math.round(current.temperature)}°</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Feels {Math.round(current.feelsLike)}°F</p>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm font-medium">{current.condition.label}</p>
            {current.condition.severity !== "normal" && (
              <p className={`text-[11px] font-medium ${
                current.condition.severity === "severe" ? "text-[#EF4444]" :
                current.condition.severity === "warning" ? "text-[#F59E0B]" : "text-[#F5A623]"
              }`}>
                {current.condition.severity === "severe" ? "Drive with extreme caution" :
                 current.condition.severity === "warning" ? "Reduced visibility expected" : "Reduced visibility"}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <WeatherStat icon={<Wind className="size-3" />} label="Wind"
            value={`${Math.round(current.windSpeed)} mph`}
            detail={`${current.windCardinal} · Gusts ${Math.round(current.windGusts)}`}
            warn={current.windGusts > 40} />
          <WeatherStat icon={<Droplets className="size-3" />} label="Precip"
            value={current.precipitation > 0 ? `${current.precipitation}"` : "None"}
            detail={current.rain > 0 ? `Rain: ${current.rain}"` : undefined}
            warn={current.precipitation > 5} />
          <WeatherStat icon={<Eye className="size-3" />} label="Visibility"
            value={`${current.visibilityMiles} mi`}
            detail={current.visibility < 1609 ? "Low visibility" : undefined}
            warn={current.visibility < 1609} />
        </div>

        {!compact && (
          <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Cloud className="size-3" /> {current.cloudCover}% cloud</span>
            <span className="flex items-center gap-1"><Gauge className="size-3" /> {current.windDirection}° {current.windCardinal}</span>
          </div>
        )}
      </div>

      {/* 24h Forecast */}
      {showForecast && hourly.length > 0 && (
        <div className="border-t border-border/40 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2">24-Hour Forecast</p>
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
            {hourly.slice(0, 12).map((h, i) => <ForecastHour key={i} data={h} />)}
          </div>
        </div>
      )}

      {/* Attribution */}
      <div className="px-4 pb-2">
        <p className="text-[9px] text-muted-foreground/50">
          Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground/70">Open-Meteo.com</a>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WeatherStat
// ---------------------------------------------------------------------------

function WeatherStat({ icon, label, value, detail, warn = false }: {
  icon: React.ReactNode; label: string; value: string; detail?: string; warn?: boolean;
}) {
  return (
    <div className={`rounded-lg p-2 text-center ${warn ? "bg-[#EF4444]/5 border border-[#EF4444]/20" : "bg-muted/50"}`}>
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xs font-semibold tabular-nums ${warn ? "text-[#EF4444]" : ""}`}>{value}</p>
      {detail && <p className="text-[10px] text-muted-foreground mt-0.5">{detail}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ForecastHour
// ---------------------------------------------------------------------------

function ForecastHour({ data }: { data: HourlyForecast }) {
  const hour = new Date(data.time).getHours();
  const label = hour === 0 ? "12a" : hour === 12 ? "12p" : hour < 12 ? `${hour}a` : `${hour - 12}p`;
  return (
    <div className="flex flex-col items-center gap-1 min-w-[48px] rounded-lg bg-muted/30 px-2 py-1.5">
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{data.condition.icon}</span>
      <span className="text-[11px] font-semibold tabular-nums">{Math.round(data.temperature)}°</span>
      {data.precipProbability > 0 && (
        <span className="text-[9px] text-[#4F8CFF] font-medium">{data.precipProbability}%</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RouteWeather — origin + destination side by side
// ---------------------------------------------------------------------------

export function RouteWeather({
  originLabel, originLat, originLng,
  destLabel, destLat, destLng,
  className = "",
}: {
  originLabel: string; originLat: number; originLng: number;
  destLabel: string; destLat: number; destLng: number;
  className?: string;
}) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      <WeatherCard latitude={originLat} longitude={originLng} label={`🌤️ ${originLabel}`} compact showForecast={false} />
      <WeatherCard latitude={destLat} longitude={destLng} label={`🌤️ ${destLabel}`} compact showForecast={false} />
    </div>
  );
}
