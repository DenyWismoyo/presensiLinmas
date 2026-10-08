/**
 * Geofencing Utilities — Haversine Formula
 */

export function isWithinRadius(
  userLat: number,
  userLng: number,
  unitLat: number,
  unitLng: number,
  radiusMeters: number
): boolean {
  const distance = getDistanceMeters(userLat, userLng, unitLat, unitLng);
  return distance <= radiusMeters;
}

export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
