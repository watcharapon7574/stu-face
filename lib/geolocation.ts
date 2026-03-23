export interface ServicePoint {
  id: string
  name: string
  short_name: string
  district: string | null
  lat: number
  lng: number
  radius_meters: number
  is_headquarters: boolean
}

/**
 * Haversine distance in meters between two lat/lng points
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000 // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Get current GPS position
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    })
  })
}

/**
 * Find the nearest service point within radius
 */
export function findNearestServicePoint(
  lat: number,
  lng: number,
  servicePoints: ServicePoint[]
): { point: ServicePoint; distance: number } | null {
  let nearest: { point: ServicePoint; distance: number } | null = null

  for (const sp of servicePoints) {
    const dist = haversineDistance(lat, lng, sp.lat, sp.lng)
    if (dist <= sp.radius_meters) {
      if (!nearest || dist < nearest.distance) {
        nearest = { point: sp, distance: dist }
      }
    }
  }

  return nearest
}

/**
 * Find closest service point regardless of radius (for display)
 */
export function findClosestServicePoint(
  lat: number,
  lng: number,
  servicePoints: ServicePoint[]
): { point: ServicePoint; distance: number } | null {
  if (servicePoints.length === 0) return null

  let closest: { point: ServicePoint; distance: number } | null = null

  for (const sp of servicePoints) {
    const dist = haversineDistance(lat, lng, sp.lat, sp.lng)
    if (!closest || dist < closest.distance) {
      closest = { point: sp, distance: dist }
    }
  }

  return closest
}
