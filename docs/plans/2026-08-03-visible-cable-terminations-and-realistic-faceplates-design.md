# Visible cable terminations and realistic faceplates design

## Goal

Make every installed cable visibly reach its physical connector while improving faceplate likeness across the complete built-in hardware catalog. Product imagery and official front-panel documentation inform vector geometry; the application remains offline and does not redistribute vendor photography.

## Rendering layers

The canvas renders cable bodies behind equipment, device chassis and controls above those bodies, then the endpoint sections of those same cable curves above the faceplate. Each overlay is an exact Bézier subcurve clipped just beyond the device edge and ending at the real port center. Link selection, tracing, warning states, VLAN colors, pulses, labels, and hit testing continue to use the complete underlying curve.

The SVG exporter follows the same order so exported diagrams do not hide cable endpoints. PNG export inherits the canvas rendering path.

## Faceplate research and templates

The hardware catalog is inventoried by vendor, model family, chassis height, connector population, and documented front-panel layout. Official product pages, data sheets, quick-start guides, and hardware installation guides are the preferred visual sources. Equivalent power, regional, or lifecycle variants may share one researched chassis template when their front panels are physically identical.

The renderer uses data-driven vector templates rather than embedded product images. Templates describe chassis finish, rack ears, vent fields, port-bank surrounds, display and status areas, drive or module bays, power/management zones, badges, and other distinctive front-panel landmarks. Exact port positions remain authoritative and interactive. Known model families select researched templates; imported or unknown profiles receive a detailed generic template based on category and connector population.

No external image is required at runtime. Product names and vendor marks remain identification labels rather than copied artwork.

## Compatibility and failure handling

Existing topology JSON remains valid. Template selection derives from persisted vendor, model, category, layout, height, and port geometry. A missing or unrecognized template falls back deterministically without preventing rendering, persistence, or export.

If primary documentation does not expose a reliable front view, the catalog entry retains its existing fidelity designation and uses the closest documented family chassis. The implementation must not claim exact visual fidelity where the source only supports a family-level layout.

## Verification

Pure JavaScript tests cover exact cable endpoint subcurves, device-edge clipping, template resolution, family aliases, and fallback behavior. Export checks verify that SVG cable endpoints appear after device bodies and remain Bézier paths without separate plug graphics. Existing Go tests, race detection, vet, JavaScript syntax checks, catalog counts, and Docker health checks remain green. Representative visual checks cover each vendor and every distinct researched chassis family.

## Visual-feedback revision

The initial tangent-tail implementation reached the mathematical port center but looked like a separate vertical antenna when the chassis hid the underlying cable. The revised renderer redraws the original curve itself from just outside the device boundary to the socket. This keeps the visible line continuous and removes the oversized plug graphic.

Port link LEDs are state indicators, not activity animations. An `up` port is rendered as a steady green LED and a `down` port as a dark inactive LED in every graphics mode. Active ports alone do not schedule continuous canvas frames; moving cable pulses remain a separate optional visualization of cable activity.
