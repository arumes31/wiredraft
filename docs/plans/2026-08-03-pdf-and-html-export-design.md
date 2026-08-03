# PDF and standalone HTML export

## Goal

Extend the existing offline export bay with directly downloadable PDF and HTML documents while preserving the same clean, complete topology rendering used by PNG and SVG.

## Considered approaches

1. Open the SVG in a print window and rely on the browser's Save as PDF action. This is small, but does not produce a direct PDF download and behaves differently across browsers.
2. Add a third-party PDF package. This provides a broad API, but adds supply-chain and bundle weight for a single image page.
3. Encode the existing high-resolution export canvas as JPEG and place it in a minimal standards-compliant PDF container. This stays offline, direct, deterministic, and dependency-free.

The third PDF approach is selected. HTML reuses the vector SVG generator rather than rasterizing the topology.

## Behavior

- PDF export downloads one A3 page, automatically choosing portrait or landscape and fitting the topology inside a small print margin.
- The PDF embeds the high-resolution, non-interactive export canvas and topology name metadata.
- HTML export downloads a single responsive document with an industrial report header, rack/device/cable/VLAN totals, the full topology SVG, print styling, and the complete topology JSON in a non-executable data block.
- Both formats use the same sanitized topology-based filename as PNG, SVG, and JSON.
- All generation remains local to the browser; no remote service, font, script, or package is required.

## Verification

- Browser-module tests validate PDF structure, image embedding, page orientation, cross-reference offsets, HTML escaping, embedded SVG, metadata totals, and safely embedded topology JSON.
- Existing faceplate/export and modal UI tests verify the shared vector output and export popover contract.
