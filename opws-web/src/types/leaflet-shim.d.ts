// Tipos mínimos para que TS no marque error si no tienes @types/leaflet
declare module "leaflet" {
    export type LatLngExpression =
      | [number, number]
      | { lat: number; lng: number }
      | { lat: number; lon: number };
  
    // Export por defecto usado como "L"
    const L: any;
    export default L;
  }
  