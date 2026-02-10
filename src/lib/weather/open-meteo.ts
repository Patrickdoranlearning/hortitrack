/**
 * Open-Meteo Weather Service
 * 
 * Free weather API - no API key required
 * https://open-meteo.com/
 */

import { logError } from '@/lib/log';

export interface WeatherData {
  temperature: number;
  humidity: number;
  precipitationForecast: string;
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
  };
  daily: {
    time: string[];
    precipitation_sum: number[];
  };
}

/**
 * Format precipitation data into a human-readable forecast string
 */
function formatPrecipitation(daily: OpenMeteoResponse['daily']): string {
  const { time, precipitation_sum } = daily;
  
  // Find days with rain
  const rainyDays: string[] = [];
  time.forEach((date, index) => {
    const precip = precipitation_sum[index];
    if (precip > 0.5) { // More than 0.5mm is considered rain
      const dayName = new Date(date).toLocaleDateString('en-IE', { weekday: 'short' });
      rainyDays.push(`${dayName} (${precip.toFixed(1)}mm)`);
    }
  });
  
  if (rainyDays.length === 0) {
    return 'No significant rain expected in the next 7 days.';
  }
  
  if (rainyDays.length === 1) {
    return `Rain expected on ${rainyDays[0]}.`;
  }
  
  if (rainyDays.length <= 3) {
    return `Rain expected on ${rainyDays.join(', ')}.`;
  }
  
  return `Rain expected on ${rainyDays.length} of the next 7 days.`;
}

/**
 * Fetch current weather and 7-day precipitation forecast from Open-Meteo
 * 
 * @param lat Latitude coordinate
 * @param lng Longitude coordinate
 * @returns Weather data including temperature, humidity, and precipitation forecast
 */
export async function getWeather(lat: number, lng: number): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lng.toString());
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m');
  url.searchParams.set('daily', 'precipitation_sum');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'auto');
  
  const response = await fetch(url.toString(), {
    // Cache for 1 hour to reduce API calls
    next: { revalidate: 3600 },
  });
  
  if (!response.ok) {
    logError('Open-Meteo API error', { status: response.status, statusText: response.statusText });
    // Return fallback data on error
    return {
      temperature: 15,
      humidity: 70,
      precipitationForecast: 'Weather data unavailable.',
    };
  }
  
  const data: OpenMeteoResponse = await response.json();
  
  return {
    temperature: Math.round(data.current.temperature_2m),
    humidity: Math.round(data.current.relative_humidity_2m),
    precipitationForecast: formatPrecipitation(data.daily),
  };
}

// Default coordinates for Ireland (Dublin)
export const DEFAULT_COORDS = {
  latitude: 53.3498,
  longitude: -6.2603,
} as const;

