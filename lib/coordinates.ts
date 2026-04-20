// Coordenadas aproximadas de cada provincia española (primeros 2 dígitos del CP)
// Usamos el centroide de la capital de provincia

export type LatLng = { lat: number; lng: number };

/**
 * Normaliza CPs a 5 dígitos. Varios APIs de mutuas (Allianz, Occident,
 * Sanitas...) devuelven CPs de provincias 01-09 sin cero inicial ("8402"
 * en vez de "08402"), rompiendo el matching por provincia (cp.slice(0,2))
 * y el lookup del índice de ratings/reseñas.
 */
export function normalizeCp(raw: string | number | undefined | null): string {
  const s = (raw == null ? "" : String(raw)).trim();
  if (!s) return "";
  if (/^\d{4}$/.test(s)) return `0${s}`;
  return s;
}

const PROVINCE_COORDS: Record<string, LatLng> = {
  "01": { lat: 42.846, lng: -2.672 },  // Álava / Vitoria
  "02": { lat: 38.994, lng: -1.858 },  // Albacete
  "03": { lat: 38.345, lng: -0.483 },  // Alicante
  "04": { lat: 36.834, lng: -2.463 },  // Almería
  "05": { lat: 40.656, lng: -4.700 },  // Ávila
  "06": { lat: 38.879, lng: -6.970 },  // Badajoz
  "07": { lat: 39.570, lng:  2.651 },  // Baleares / Palma
  "08": { lat: 41.387, lng:  2.170 },  // Barcelona
  "09": { lat: 42.344, lng: -3.697 },  // Burgos
  "10": { lat: 39.476, lng: -6.372 },  // Cáceres
  "11": { lat: 36.527, lng: -6.288 },  // Cádiz
  "12": { lat: 39.986, lng: -0.051 },  // Castellón
  "13": { lat: 38.986, lng: -3.929 },  // Ciudad Real
  "14": { lat: 37.888, lng: -4.779 },  // Córdoba
  "15": { lat: 43.363, lng: -8.412 },  // A Coruña
  "16": { lat: 40.070, lng: -2.137 },  // Cuenca
  "17": { lat: 41.979, lng:  2.819 },  // Girona
  "18": { lat: 37.177, lng: -3.598 },  // Granada
  "19": { lat: 40.633, lng: -3.166 },  // Guadalajara
  "20": { lat: 43.318, lng: -1.982 },  // Guipúzcoa / San Sebastián
  "21": { lat: 37.261, lng: -6.953 },  // Huelva
  "22": { lat: 42.136, lng: -0.408 },  // Huesca
  "23": { lat: 37.779, lng: -3.787 },  // Jaén
  "24": { lat: 42.599, lng: -5.571 },  // León
  "25": { lat: 41.617, lng:  0.620 },  // Lleida
  "26": { lat: 42.467, lng: -2.449 },  // La Rioja / Logroño
  "27": { lat: 43.012, lng: -7.555 },  // Lugo
  "28": { lat: 40.416, lng: -3.703 },  // Madrid
  "29": { lat: 36.721, lng: -4.421 },  // Málaga
  "30": { lat: 37.983, lng: -1.130 },  // Murcia
  "31": { lat: 42.812, lng: -1.645 },  // Navarra / Pamplona
  "32": { lat: 42.336, lng: -7.864 },  // Ourense
  "33": { lat: 43.363, lng: -5.849 },  // Asturias / Oviedo
  "34": { lat: 42.010, lng: -4.534 },  // Palencia
  "35": { lat: 28.124, lng: -15.430 }, // Las Palmas de Gran Canaria
  "36": { lat: 42.433, lng: -8.648 },  // Pontevedra
  "37": { lat: 40.970, lng: -5.663 },  // Salamanca
  "38": { lat: 28.467, lng: -16.250 }, // Santa Cruz de Tenerife
  "39": { lat: 43.462, lng: -3.810 },  // Cantabria / Santander
  "40": { lat: 40.948, lng: -4.119 },  // Segovia
  "41": { lat: 37.389, lng: -5.984 },  // Sevilla
  "42": { lat: 41.764, lng: -2.465 },  // Soria
  "43": { lat: 41.118, lng:  1.245 },  // Tarragona
  "44": { lat: 40.345, lng: -1.106 },  // Teruel
  "45": { lat: 39.857, lng: -4.024 },  // Toledo
  "46": { lat: 39.469, lng: -0.376 },  // Valencia
  "47": { lat: 41.652, lng: -4.724 },  // Valladolid
  "48": { lat: 43.263, lng: -2.935 },  // Vizcaya / Bilbao
  "49": { lat: 41.503, lng: -5.745 },  // Zamora
  "50": { lat: 41.650, lng: -0.887 },  // Zaragoza
  "51": { lat: 35.890, lng: -5.307 },  // Ceuta
  "52": { lat: 35.292, lng: -2.938 },  // Melilla
};

// Fórmula de Haversine — devuelve km
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function coordsFromCP(cp: string): LatLng | null {
  const prefix = cp.slice(0, 2);
  return PROVINCE_COORDS[prefix] ?? null;
}
