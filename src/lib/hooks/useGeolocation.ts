'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDistanceMeters } from '../utils/geofence';

interface TargetLocation {
  latitude: number;
  longitude: number;
  radius: number;
}

export function useGeolocation(target?: TargetLocation | null) {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithin, setIsWithin] = useState<boolean | null>(null);

  const fetchPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation tidak didukung pada browser ini.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ latitude, longitude, accuracy });
        setLoading(false);

        if (target) {
          const dist = getDistanceMeters(latitude, longitude, target.latitude, target.longitude);
          setDistance(dist);
          setIsWithin(dist <= target.radius);
        }
      },
      (err) => {
        setLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Izin akses lokasi ditolak. Harap izinkan GPS pada browser/HP.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Informasi lokasi GPS tidak tersedia.');
            break;
          case err.TIMEOUT:
            setError('Waktu pencarian lokasi GPS habis.');
            break;
          default:
            setError('Terjadi kesalahan membaca koordinat GPS.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }, [target?.latitude, target?.longitude, target?.radius]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  return {
    coords,
    loading,
    error,
    distance,
    isWithin,
    accuracyWarning: coords ? coords.accuracy > 50 : false,
    refreshLocation: fetchPosition,
  };
}
