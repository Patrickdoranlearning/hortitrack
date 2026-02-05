/**
 * Client-side route optimization utilities
 * Uses nearest-neighbor algorithm for TSP approximation
 */

import { haversineDistance } from './types';

export interface RouteStop {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

/**
 * Optimize a route using the nearest-neighbor algorithm
 * This is a greedy approximation that works well for small numbers of stops (<20)
 * Returns stops in optimized order
 */
export function optimizeRoute<T extends RouteStop>(stops: T[]): T[] {
  if (stops.length <= 2) return [...stops];

  // Filter out any stops without valid coordinates
  const validStops = stops.filter(s => s.lat != null && s.lng != null);
  if (validStops.length <= 2) return validStops;

  const result: T[] = [];
  const remaining = [...validStops];

  // Start with the first stop
  result.push(remaining.shift()!);

  // Greedily pick the nearest unvisited stop
  while (remaining.length > 0) {
    const current = result[result.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    remaining.forEach((stop, idx) => {
      const dist = haversineDistance(
        { lat: current.lat, lng: current.lng },
        { lat: stop.lat, lng: stop.lng }
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });

    result.push(remaining.splice(nearestIdx, 1)[0]);
  }

  return result;
}

/**
 * Calculate total route distance in kilometers
 */
export function calculateRouteDistance<T extends RouteStop>(stops: T[]): number {
  if (stops.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    totalDistance += haversineDistance(
      { lat: stops[i].lat, lng: stops[i].lng },
      { lat: stops[i + 1].lat, lng: stops[i + 1].lng }
    );
  }

  return Math.round(totalDistance * 10) / 10; // Round to 1 decimal
}

/**
 * Estimate driving time based on distance
 * Assumes average speed of 40 km/h for Irish roads with stops
 */
export function estimateDrivingTime(distanceKm: number): number {
  const averageSpeedKmh = 40;
  return Math.round((distanceKm / averageSpeedKmh) * 60); // Returns minutes
}

/**
 * Format driving time for display
 */
export function formatDrivingTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Generate Google Maps directions URL for multiple stops
 */
export function generateGoogleMapsUrl(stops: RouteStop[]): string {
  if (stops.length === 0) return '';

  if (stops.length === 1) {
    // Single destination
    return `https://www.google.com/maps/dir/?api=1&destination=${stops[0].lat},${stops[0].lng}`;
  }

  // Multiple stops: first is origin, last is destination, middle are waypoints
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1);

  let url = `https://www.google.com/maps/dir/?api=1`;
  url += `&origin=${origin.lat},${origin.lng}`;
  url += `&destination=${destination.lat},${destination.lng}`;

  if (waypoints.length > 0) {
    const waypointStr = waypoints
      .map(w => `${w.lat},${w.lng}`)
      .join('|');
    url += `&waypoints=${encodeURIComponent(waypointStr)}`;
  }

  return url;
}

/**
 * Generate Apple Maps directions URL for multiple stops
 * Note: Apple Maps has limited waypoint support
 */
export function generateAppleMapsUrl(stops: RouteStop[]): string {
  if (stops.length === 0) return '';

  if (stops.length === 1) {
    return `maps://maps.apple.com/?daddr=${stops[0].lat},${stops[0].lng}`;
  }

  // Apple Maps waypoints format
  const destination = stops[stops.length - 1];
  const url = `maps://maps.apple.com/?daddr=${destination.lat},${destination.lng}`;

  return url;
}
