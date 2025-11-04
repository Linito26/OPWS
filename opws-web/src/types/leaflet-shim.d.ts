import * as React from "react";
import type { LatLngExpression } from "leaflet";

declare module "react-leaflet" {
  export type MapContainerProps = {
    center?: LatLngExpression;
    zoom?: number;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  };
  export const MapContainer: React.FC<MapContainerProps>;

  export type TileLayerProps = {
    url: string;
    attribution?: string;
  };
  export const TileLayer: React.FC<TileLayerProps>;

  export const Marker: React.FC<{ position: LatLngExpression; children?: React.ReactNode }>;
  export const Popup: React.FC<{ children?: React.ReactNode }>;
}
