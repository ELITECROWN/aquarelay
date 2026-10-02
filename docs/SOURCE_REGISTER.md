# Sources and licences

| Material | Origin | Licence / use | Label |
|---|---|---|---|
| District, water geometry and coordinates | AquaRelay-authored fictional fixtures | CC0-1.0 | Synthetic demo geography |
| Organisation identities, responsibility notes and contacts | AquaRelay-authored fictional directory | CC0-1.0 | Fictional organisation, no official verification |
| Measurements, incidents, species observations, actions and history | AquaRelay-authored fixtures | CC0-1.0 | Synthetic demonstration records |
| NGO CSV/JSON/XLSX samples | `fixtures/` | CC0-1.0 | Synthetic dataset; deliberately missing temperature unit/timezone |
| Synthetic evidence in browser tests | Canvas-authored illustration reading SYNTHETIC DEMO EVIDENCE | CC0-1.0 | Illustration, not a photograph of an incident |
| Map context roads and parks | Procedurally authored fictional GeoJSON | CC0-1.0 | Synthetic layer, not a real basemap |
| Icons | Lucide | ISC | Interface icons |
| Interactive map renderer | MapLibre GL JS | BSD-3-Clause | Renderer attribution; synthetic geography |
| Typography | System font stack, Segoe UI / Arial fallback | Installed OS fonts | No remote font assets |
| User uploads / imports | Original uploader/source | Source must supply permission/licence | Reporter evidence or source data, synthetic where applicable |

No photos or generated incident photographs are seeded as real evidence. Public image derivatives remove EXIF. Public video derivatives remove metadata and audio; originals require owner/organisation authorization. Hashes are integrity references, not proof of truth.

External tile styles must be configured under their provider’s licence and display provider attribution. No OpenStreetMap tile bulk downloading or unrestricted public-geocoder autocomplete is implemented.

Consulted primary references: [MapLibre docs](https://maplibre.org/maplibre-gl-js/docs/), [SensorThings](https://www.ogc.org/standards/sensorthings/), [STAplus](https://www.ogc.org/standards/sensor-things-api-extension/), [FHIR R4 Observation](https://hl7.org/fhir/R4/observation.html), [Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/), [PostGIS radius queries](https://postgis.net/documentation/tips/st-dwithin/).

Development tooling also follows the current [Tailwind source-detection documentation](https://tailwindcss.com/docs/detecting-classes-in-source-files) and [Vite watcher options](https://vite.dev/config/server-options#server-watch). Frontend scanning is limited to `src`; backend runtime data and generated reports cannot trigger application reloads.
