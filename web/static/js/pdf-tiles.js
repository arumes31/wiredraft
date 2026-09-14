const PAGE_WIDTH = 1190.55;
const PAGE_HEIGHT = 841.89;
const MARGIN = 24;
const FOOTER = 16;
const OVERLAP = 18;

export function pdfTilePlan(bounds, scale = .75) {
  if (![.75, 1, 1.5].includes(scale) || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
      || bounds.width <= 0 || bounds.height <= 0) throw new Error("Invalid PDF page dimensions or scale");
  const width = (PAGE_WIDTH - MARGIN * 2) / scale;
  const height = (PAGE_HEIGHT - MARGIN * 2 - FOOTER) / scale;
  const stepX = width - OVERLAP / scale, stepY = height - OVERLAP / scale;
  const columns = Math.max(1, Math.ceil((bounds.width + 40 - width) / stepX) + 1);
  const rows = Math.max(1, Math.ceil((bounds.height + 40 - height) / stepY) + 1);
  if (columns * rows > 100) throw new Error("This export exceeds 100 pages. Choose a smaller print scale or reduce the map extent.");
  return Array.from({ length: columns * rows }, (_, index) => ({
    x: bounds.x - 20 + index % columns * stepX,
    y: bounds.y - 20 + Math.floor(index / columns) * stepY,
    width, height, row: Math.floor(index / columns) + 1, column: index % columns + 1, rows, columns,
  }));
}

/** Each page has a separately rendered tile, retaining detail on very large maps. */
export async function exportTiledPDF(topology, engine, scale, onProgress = () => {}, signal) {
  const plan = pdfTilePlan(engine.worldBounds(), scale);
  const pages = [];
  const snapshot = JSON.stringify(topology);
  const assertSnapshot = () => {
    signal?.throwIfAborted();
    if (JSON.stringify(engine.state.topology) !== snapshot) throw new Error("The map changed during export. Please export again.");
  };
  for (const [index, region] of plan.entries()) {
    onProgress(`Rendering page ${index + 1} of ${plan.length}…`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assertSnapshot();
    const canvas = engine.renderExport({ region });
    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("Could not encode PDF page")), "image/jpeg", .94,
    ));
    pages.push({ bytes: new Uint8Array(await blob.arrayBuffer()), ...region,
      pixelWidth: canvas.width, pixelHeight: canvas.height });
    canvas.width = canvas.height = 0;
  }
  assertSnapshot();
  const bytes = buildTiledPDF(pages, topology.name);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${topology.name.replace(/[^a-z0-9]+/gi, "-") || "topology"}-pages.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return pages.length;
}

export function buildTiledPDF(pages, title) {
  if (!pages.length || pages.length > 100) throw new Error("PDF requires 1 to 100 pages");
  const encoder = new TextEncoder();
  const chunks = [], offsets = [0];
  let size = 0;
  const append = (value) => { const bytes = typeof value === "string" ? encoder.encode(value) : value; chunks.push(bytes); size += bytes.length; };
  const object = (id, body) => { offsets[id] = size; append(`${id} 0 obj\n${body}\nendobj\n`); };
  const fontID = 3 + pages.length * 3, infoID = fontID + 1;
  append("%PDF-1.4\n%WIREDRAFT\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`);
  pages.forEach((page, index) => {
    const id = 3 + index * 3;
    if (!(page.bytes instanceof Uint8Array) || !page.bytes.length || !Number.isInteger(page.pixelWidth)
        || !Number.isInteger(page.pixelHeight) || page.pixelWidth <= 0 || page.pixelHeight <= 0) throw new Error("Invalid PDF image");
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /XObject << /Im0 ${id + 1} 0 R >> /Font << /F1 ${fontID} 0 R >> >> /Contents ${id + 2} 0 R >>`);
    offsets[id + 1] = size;
    append(`${id + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`);
    append(page.bytes); append("\nendstream\nendobj\n");
    const label = `Page ${index + 1}/${pages.length} - row ${page.row}, column ${page.column} - 18pt overlap`;
    const content = `q\n${PAGE_WIDTH - 2 * MARGIN} 0 0 ${PAGE_HEIGHT - 2 * MARGIN - FOOTER} ${MARGIN} ${MARGIN + FOOTER} cm\n/Im0 Do\nQ\nBT /F1 9 Tf ${MARGIN} 24 Td (${label}) Tj ET\n`;
    object(id + 2, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
  });
  object(fontID, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const titleHex = Array.from({ length: String(title).length }, (_, i) => String(title).charCodeAt(i).toString(16).padStart(4, "0")).join("");
  object(infoID, `<< /Title <FEFF${titleHex}> /Creator (WireDraft) >>`);
  const xref = size;
  append(`xref\n0 ${infoID + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= infoID; id++) append(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  append(`trailer\n<< /Size ${infoID + 1} /Root 1 0 R /Info ${infoID} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
