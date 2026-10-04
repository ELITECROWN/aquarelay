# Report-page fixes — 4 October 2026

The report form previously requested 100 full water-body summaries on load and on every search keystroke. Each summary performs additional database reads for incidents, monitoring and sources. A failed request left an empty native selector and no recovery action.

The form now requests 30 identity-only records with a 300 ms search debounce. The lookup uses the existing registry filtering and pagination but skips summary queries. Search displays clickable names and localities, loading and empty-result states, and a retry action on failure. Selecting a match sets its registered identity and coordinates. Previously selected records remain available through the existing direct-record lookup.

Case-list loading is deferred until the evidence step. Route changes reset scroll to prevent arriving beneath the fixed navigation after visiting a scrolled page. Decorative water rendering is capped at 30 fps; both decorative canvases skip drawing in hidden tabs. Original styles, map positioning and the reporting workflow are retained.

Verification includes an identity lookup regression that rejects summary serialization, a browser test for failed lookup recovery and report search selection, existing demo journeys, frontend unit tests and a production build. Live deployment and real Gmail delivery require separate checks; mock transport tests do not establish inbox delivery.
