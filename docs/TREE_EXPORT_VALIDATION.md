# Full-tree export regression

The viewport-sized export clipped people and connections beyond the current screen. PDF and PNG now use the local geometry of the tree content group (including connections), add border padding, and expand the cloned SVG/wrappers. Both SVG attributes and copied CSS pan/zoom transforms are cleared in the clone. Grid backgrounds do not inflate tree bounds. The live viewport is preserved.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed, zero errors and 48 existing warnings.
- `npm test`: 52 passed, including negative-coordinate bounds and large-tree raster limits.
- `node scripts/tree-export.browser.cjs`: passed using externally installed Playwright and Chrome. The fixture uses the app's SVG/foreignObject and scrolling-wrapper structure, the production export helper, html2canvas and jsPDF. Pixel checks verify people at negative coordinates and beyond the viewport, identical output at two pan/zoom settings, unchanged live DOM/scroll, and a successful browser PDF download containing an image.
- `npm run build`: compilation and TypeScript passed; local page-data collection requires Firebase Admin credentials, which were not supplied. Configured Vercel Preview is a separate build check.

For the browser regression, provide Playwright through existing developer tooling (for example, `NODE_PATH` pointing to an external installation) and installed Chrome. No application dependencies or lockfiles were changed. The browser fixture uses synthetic data and does not contact Firebase or initiate export billing.

## Preview review

Repeat PDF and PNG exports from an authenticated Preview tree that extends beyond all screen edges, including negative coordinates. Pan/zoom and scroll, export again, and confirm that both versions retain every person and relationship. Check a single-person tree, portraits, watermark eligibility and a large tree. Large exports reduce raster resolution to keep the complete tree within 16,384 pixels per dimension and approximately 16 million pixels; they do not crop it. Authenticated end-to-end verification is not implied by the synthetic browser test.

The earlier PR #3 PDF confirmation remains valid for its tested small tree and successful download/opening. It did not test off-screen completeness; this subsequent defect and regression coverage qualify that earlier evidence.
