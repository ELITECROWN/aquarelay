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
