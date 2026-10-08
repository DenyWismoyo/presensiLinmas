'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LeafletGeotagMapProps {
  latitude: number;
  longitude: number;
  radius: number;
  onChangeLocation?: (lat: number, lng: number) => void;
  interactive?: boolean;
  className?: string;
  zoom?: number;
}

export default function LeafletGeotagMap({
  latitude,
  longitude,
  radius,
  onChangeLocation,
  interactive = true,
  className = '',
  zoom = 18,
}: LeafletGeotagMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Inisialisasi Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Bersihkan map instance lama jika ada
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Inisialisasi Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: zoom,
      scrollWheelZoom: interactive,
      dragging: interactive,
    });

    // Tile Layer OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Kustom Pin Marker SVG Presisi Tinggi tanpa inline styles
    const customIcon = L.divIcon({
      className: 'leaflet-custom-pin',
      html: `
        <div class="leaflet-custom-pin-inner">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="#dc2626">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });

    // Buat Marker Posko
    const marker = L.marker([latitude, longitude], {
      icon: customIcon,
      draggable: interactive,
    }).addTo(map);

    // Buat Lingkaran Geofence
    const circle = L.circle([latitude, longitude], {
      radius: radius || 100,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
      weight: 2,
      dashArray: '4, 6',
    }).addTo(map);

    marker.bindPopup(`<b>Titik Posko Linmas</b><br>Radius: ${radius} meter`).openPopup();

    // Event jika Marker di-drag
    if (interactive && onChangeLocation) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        circle.setLatLng(pos);
        onChangeLocation(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
      });

      // Event jika Map di-klik langsung
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        onChangeLocation(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
      });
    }

    mapInstanceRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Fix render size pada modal / tab yang baru dibuka
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sinkronisasi posisi jika koordinat diubah dari luar (input manual atau GPS)
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;

    const currentPos = markerRef.current.getLatLng();
    const latDiff = Math.abs(currentPos.lat - latitude);
    const lngDiff = Math.abs(currentPos.lng - longitude);

    if (latDiff > 0.000001 || lngDiff > 0.000001) {
      markerRef.current.setLatLng([latitude, longitude]);
      circleRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.panTo([latitude, longitude]);
    }
  }, [latitude, longitude]);

  // Sinkronisasi radius jika input radius diubah
  useEffect(() => {
    if (!circleRef.current || !markerRef.current) return;
    circleRef.current.setRadius(radius || 100);
    markerRef.current.setPopupContent(`<b>Titik Posko Linmas</b><br>Radius: ${radius} meter`);
  }, [radius]);

  return <div ref={mapContainerRef} className={`leaflet-map-canvas ${className}`} />;
}
