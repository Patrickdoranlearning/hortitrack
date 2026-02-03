'use client';

import { useEffect, useRef, useId } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SmartTarget, ScheduledDelivery } from '@/lib/targeting/types';
import { getProbabilityColor, getValueBasedRadius } from '@/lib/targeting/types';

interface MapContainerComponentProps {
  targets: SmartTarget[];
  scheduledDeliveries: ScheduledDelivery[];
  center: [number, number];
  zoom: number;
  onTargetClick?: (target: SmartTarget) => void;
  selectedTargetId?: string | null;
}

export default function MapContainerComponent({
  targets,
  scheduledDeliveries,
  center,
  zoom,
  onTargetClick,
  selectedTargetId,
}: MapContainerComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();
  const markersRef = useRef<L.CircleMarker[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Create the map
    const map = L.map(containerRef.current, {
      center: center,
      zoom: zoom,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [center, zoom]);

  // Update markers when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    // Add scheduled delivery markers (red)
    const deliveryCoords: [number, number][] = [];
    scheduledDeliveries.forEach(delivery => {
      if (!delivery.lat || !delivery.lng) return;

      deliveryCoords.push([delivery.lat, delivery.lng]);

      const marker = L.circleMarker([delivery.lat, delivery.lng], {
        radius: 12,
        fillColor: '#dc2626',
        color: '#991b1b',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(map);

      marker.bindPopup(`
        <div class="p-1 min-w-[180px]">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #dc2626;"></div>
            <span style="font-size: 12px; font-weight: 500; color: #b91c1c;">Scheduled Delivery</span>
          </div>
          <div style="font-weight: 600; font-size: 14px;">${delivery.customer_name}</div>
          <div style="font-size: 12px; color: #64748b;">Order #${delivery.order_number}</div>
          ${delivery.trolleys_estimated ? `<div style="font-size: 12px; color: #64748b;">${delivery.trolleys_estimated} trolleys</div>` : ''}
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            ${delivery.zone_name || delivery.county}
            ${delivery.routing_key ? ` (${delivery.routing_key})` : ''}
          </div>
        </div>
      `);

      markersRef.current.push(marker);
    });

    // Add route line for deliveries
    if (deliveryCoords.length >= 2) {
      routeLineRef.current = L.polyline(deliveryCoords, {
        color: '#6366f1',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 6',
      }).addTo(map);
    }

    // Add target markers (colored by probability)
    const allCoords: [number, number][] = [...deliveryCoords];

    targets.forEach(target => {
      if (!target.lat || !target.lng) return;

      allCoords.push([target.lat, target.lng]);

      const color = getProbabilityColor(target.probability_score);
      const isSelected = selectedTargetId === target.customer_id;
      const radius = getValueBasedRadius(target.value_quartile, isSelected);

      const marker = L.circleMarker([target.lat, target.lng], {
        radius: radius,
        fillColor: color,
        color: isSelected ? '#000' : color,
        weight: isSelected ? 3 : 2,
        opacity: 1,
        fillOpacity: isSelected ? 1 : 0.8,
      }).addTo(map);

      marker.bindPopup(`
        <div class="p-1 min-w-[180px]">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${color};"></div>
            <span style="font-size: 12px; font-weight: 500; color: ${color};">${target.probability_score}% Probability</span>
          </div>
          <div style="font-weight: 600; font-size: 14px;">${target.customer_name}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            ${target.zone_name || target.county}
            ${target.routing_key ? ` (${target.routing_key})` : ''}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 8px; font-size: 12px;">
            <div><span style="color: #94a3b8;">Orders:</span> <span style="font-weight: 500;">${target.total_orders || 0}</span></div>
            <div><span style="color: #94a3b8;">Avg:</span> <span style="font-weight: 500;">${target.avg_order_value ? `€${Math.round(target.avg_order_value)}` : '-'}</span></div>
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 8px; font-style: italic;">${target.context_note}</div>
          ${target.phone ? `<a href="tel:${target.phone}" style="font-size: 12px; color: #2563eb; margin-top: 8px; display: block; font-weight: 500;">📞 ${target.phone}</a>` : ''}
        </div>
      `);

      marker.on('click', () => {
        onTargetClick?.(target);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [targets, scheduledDeliveries, selectedTargetId, onTargetClick]);

  return (
    <div
      ref={containerRef}
      id={`map-${uniqueId}`}
      className="w-full h-full rounded-lg"
      style={{ minHeight: '400px' }}
    />
  );
}
