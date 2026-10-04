import type {StyleSpecification} from "maplibre-gl";
export const realMap: StyleSpecification = {
  version: 8,
  sources: { streets:{type:'raster',tiles:[import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'} },
  layers: [
    {id:'streets-basemap',type:'raster',source:'streets'},
  ],
};
