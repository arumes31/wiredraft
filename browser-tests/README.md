# Workspace regression and performance checks

Run `npm run test:workspace` for installed-inventory search, navigator expansion,
alert navigation, map-copy UI, diagnostics, and tiled PDF export. Go handler tests
separately exercise actual copy persistence, photo isolation, failure cleanup,
share exclusion, and organization boundaries.

Run `npm run test:performance` after `npx playwright install chromium`. It requires
no database. The harness serves the real frontend modules through Playwright
routes and provides deterministic API responses. Two test-only references are
appended to the served app module to inspect canvas geometry and validate the
result of a real mouse drag; production assets expose neither reference.

The baseline uses 240 installed Cisco switches, their full catalog port inventory,
and 239 cables at a 1440 × 1000 viewport. It measures:

- Navigation through topology loading and two animation frames.
- Five measured navigator selections after one warm-up selection.
- Five measured mouse drags after one warm-up drag, each verified to move a device.

Selection and drag budgets use the median; initial load is a single cold-page
sample. Playwright tracing is disabled for the performance case to reduce
instrumentation overhead. The JSON attachment includes every sample and topology
counts. Core CI runs this on Chromium and retains the attachment even on success.

`performance-budgets.json` contains explicit regression ceilings, not claims of
universal speed. Keep the fixture and browser version consistent when comparing
runs. Hardware, browser changes, background load, and antivirus scanning affect
results. This isolates frontend performance: it does not measure PostgreSQL,
real network latency, authentication, or SSE throughput. Run the normal browser
suite for those integrated workflows. Review measurements before changing a budget.

The initial Windows/Chromium reference measured 2.113 s load, 1.001 s median
selection and 2.691 s median drag. Budgets allow headroom for shared CI runners;
they are intended to catch substantial regressions. The fixture uses a quiet
EventSource stub so closed synthetic responses cannot trigger reconnect loops.
