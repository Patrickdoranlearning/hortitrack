'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SmartTarget, ScheduledDelivery, TargetReason } from '@/lib/targeting/types';

// Fix for default marker icons in Leaflet + webpack
// delete (L.Icon.Default.prototype as any)._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: '/images/marker-icon-2x.png',
//   iconUrl: '/images/marker-icon.png',
//   shadowUrl: '/images/marker-shadow.png',
// });

interface MapContainerComponentProps {
  targets: SmartTarget[];
  scheduledDeliveries: ScheduledDelivery[];
  center: [number, number];
  zoom: number;
  onTargetClick?: (target: SmartTarget) => void;
  selectedTargetId?: string | null;
  reasonColors: Record<TargetReason, string>;
}

// Component to handle map auto-fit bounds
function FitBounds({
  targets,
  deliveries
}: {
  targets: SmartTarget[];
  deliveries: ScheduledDelivery[]
}) {
  const map = useMap();

  useEffect(() => {
    const allCoords: [number, number][] = [
      ...targets.filter(t => t.lat && t.lng).map(t => [t.lat!, t.lng!] as [number, number]),
      ...deliveries.filter(d => d.lat && d.lng).map(d => [d.lat!, d.lng!] as [number, number]),
    ];

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, targets, deliveries]);

  return null;
}

// Custom marker for scheduled deliveries
function DeliveryMarker({ delivery }: { delivery: ScheduledDelivery }) {
  if (!delivery.lat || !delivery.lng) return null;

  return (
    <CircleMarker
      center={[delivery.lat, delivery.lng]}
      radius={10}
      fillColor="#ef4444"
      color="#dc2626"
      weight={2}
      opacity={1}
      fillOpacity={0.8}
    >
      <Popup>
        <div className="p-1">
          <div className="font-semibold text-sm">{delivery.customer_name}</div>
          <div className="text-xs text-slate-500">Order #{delivery.order_number}</div>
          {delivery.trolleys_estimated && (
            <div className="text-xs text-slate-500">
              {delivery.trolleys_estimated} trolleys
            </div>
          )}
          <div className="text-xs text-slate-500 mt-1">
            {delivery.zone_name || delivery.county}
            {delivery.routing_key && ` (${delivery.routing_key})`}
          </div>
        </div>
      </Popup>
    </CircleMarker>
  );
}

// Custom marker for targets
function TargetMarker({
  target,
  onClick,
  isSelected,
  color,
}: {
  target: SmartTarget;
  onClick: () => void;
  isSelected: boolean;
  color: string;
}) {
  if (!target.lat || !target.lng) return null;

  return (
    <CircleMarker
      center={[target.lat, target.lng]}
      radius={isSelected ? 12 : 8}
      fillColor={color}
      color={isSelected ? '#000' : color}
      weight={isSelected ? 3 : 2}
      opacity={1}
      fillOpacity={isSelected ? 1 : 0.7}
      eventHandlers={{
        click: onClick,
      }}
    >
      <Popup>
        <div className="p-1 min-w-[160px]">
          <div className="font-semibold text-sm">{target.customer_name}</div>
          <div className="text-xs text-slate-500 mt-1">
            {target.zone_name || target.county}
            {target.routing_key && ` (${target.routing_key})`}
          </div>
          <div className="text-xs mt-2">
            <span className="font-medium">Score:</span> {target.priority_score}
          </div>
          <div className="text-xs text-slate-600 mt-1">{target.context_note}</div>
          {target.phone && (
            <a
              href={`tel:${target.phone}`}
              className="text-xs text-blue-600 hover:underline mt-2 block"
            >
              {target.phone}
            </a>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}

export default function MapContainerComponent({
  targets,
  scheduledDeliveries,
  center,
  zoom,
  onTargetClick,
  selectedTargetId,
  reasonColors,
}: MapContainerComponentProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="w-full h-full rounded-lg"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds targets={targets} deliveries={scheduledDeliveries} />

      {/* Scheduled deliveries (red markers) */}
      {scheduledDeliveries.map((delivery) => (
        <DeliveryMarker key={delivery.order_id} delivery={delivery} />
      ))}

      {/* Target customers (colored by reason) */}
      {targets.map((target) => (
        <TargetMarker
          key={target.customer_id}
          target={target}
          onClick={() => onTargetClick?.(target)}
          isSelected={selectedTargetId === target.customer_id}
          color={reasonColors[target.target_reason]}
        />
      ))}
    </MapContainer>
  );
}
