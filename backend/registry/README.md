# Bengaluru OpenStreetMap starter snapshot

`bengaluru-osm-2026-10-03.json` was downloaded from the Overpass service at
`https://maps.mail.ru/osm/tools/overpass/api/interpreter`. Its OSM base timestamp
is `2026-10-03T17:59:05Z`. Attribution: © OpenStreetMap contributors.
Licence: [ODbL 1.0](https://www.openstreetmap.org/copyright).

The query and bounding box are defined in `app/osm_registry.py`. This rectangular
region is not the official Bengaluru municipal boundary. The raw snapshot has
4,908 water features. The importer accepts 868 features with explicit lake,
pond, canal or stream classification and valid feature centres inside the box.
Unclassified polygons, drains, basins, reservoirs and other unsupported types
remain in this source snapshot for review; they are not guessed to be lakes.

Imported points are feature centres, not shoreline polygons. Different OSM
elements can refer to the same physical water body; local duplicate and identity
review is still required. Names and classifications are community mapping, not
municipal verification. No incidents, observations, species, responsible
organisations, environmental assessments or hydrological links are invented.

Preview: `python -m app.osm_registry --file registry/bengaluru-osm-2026-10-03.json`.
Add `--commit` to import into the configured database. Existing OSM IDs are
preserved. Production launch can import this with `REGISTRY_STARTER_PATH`.


## Sodepur–Barrackpore and Potheri expansion — 4 October 2026

Sodepur–Barrackpore uses an approximate east-bank coverage box:
22.67–22.80 N, 88.36–88.43 E. It is not a municipal boundary. The raw
snapshot was obtained from overpass.kumi.systems and covers a slightly wider
western box (88.34 E); the importer excludes the west-bank features. The
underlying OSM timestamp is 2026-07-24T11:04:51Z, not the download date.
The accepted features total 1,474: 1,463 ponds, 8 lakes, 2 streams and 1 canal.
Only 13 have mapped names. Do not invent names for the others.

Potheri uses 12.79–12.86 N, 80.00–80.08 E. After Overpass timeouts, the direct
OpenStreetMap map API returned 35 water features; 12 explicitly classified
lakes/ponds with centres inside the box are accepted. Returned way-node
bounding boxes determine their centres. The direct API response has no OSM
base timestamp; retrieval time and endpoint are retained in snapshot metadata.
This fallback does not process relation-only features. Reservoirs, basins and
unclassified water polygons remain excluded and require manual review.

Potheri Lake is a provisional desk match to lake way 67551369 using mapped
location and the geotagged Wikimedia Commons photograph metadata. Local
identity/boundary confirmation remains pending. The OSM tags remain unchanged;
the name and historical SRMIST cleanup reference are separately attributed.
The cleanup citation does not create a resolved incident, responsible authority,
current condition or imported photograph. Source documents retain their licences.

For a one-time hosted import, set REGISTRY_STARTER_PATHS to:
registry/sodepur-barrackpore-osm-2026-10-04.json,registry/potheri-osm-2026-10-04.json
Clear the variable after verified import. Repeated imports preserve existing IDs
and do not overwrite user edits. Region searches use the locality field.

## Descriptive labels and locality points — 4 October 2026

`place-anchors-osm-2026-10-04.json` contains 1,468 public OSM locality nodes,
retrieved from the official nodes API. These are place points, not water-body
names or administrative polygons. Attribution: © OpenStreetMap contributors;
licence ODbL-1.0. Source endpoint and selection snapshot date are retained.
Production enrichment replaces only generated Unnamed labels; mapped/reviewed
names remain unchanged. Descriptive labels include type, nearby mapped locality
within 2 km (otherwise region), and coordinates. Local water-body names remain
unknown until a source or field review establishes them. Available original OSM
identity tags are exposed separately from current environmental observations.
