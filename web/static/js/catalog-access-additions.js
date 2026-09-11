/** Manufacturer documents for the four explicitly selected access additions. */
export const accessAdditionSources = Object.freeze({
  c8200: "https://www.cisco.com/c/en/us/td/docs/routers/cloud_edge/c8200/hardware_install/b-cat-8200-series-edge-platforms-hig.pdf",
  aruba2530: "https://support.hpe.com/hpesc/public/api/document/c04623600",
  office1920: "https://arubanetworking.hpe.com/assets/_ja/support/ig/IG_OC1920SwitchSeries.pdf",
});

/** Define one ordered connector group without adding any optional installed module. */
function group(zone, count, type, speed, labels) {
  return { zone, count, type, speed, prefix: "", poe: false, labels };
}

/** Generate the manufacturer's contiguous printed port numbers. */
function numbers(first, count) { return Array.from({ length: count }, (_, index) => String(first + index)); }

/** Build a new revision-1 catalog row whose installed records are never automatically refreshed. */
function row(vendor, model, sku, category, groups, source, note) {
  return { vendor, model, sku, category, units: 1, color: "#c6cccd", groups, inventoryRevision: 1,
    preserveInstalledPorts: true, fidelity: "verified", layout: "access-additions", source, note };
}

/** Raw catalog rows; the shared catalog owns registration and metadata decoration. */
export const accessAdditionProfiles = [
  row("Cisco", "C8200-1N-4T", "C8200-1N-4T", "Router", [
    group("access", 2, "RJ45_1G", 1000, ["GE0/0/0", "GE0/0/1"]),
    group("uplink", 2, "SFP_1G", 1000, ["GE0/0/2", "GE0/0/3"]),
    group("management", 1, "Console", 0, ["CONSOLE"]),
  ], accessAdditionSources.c8200,
  "C8200-1N-4T, 1U rack brackets, internal AC supply, default 8GB DRAM and 16GB M.2 USB storage. NIM and PIM blank covers; no optional PoE adapter, optics or expansion interfaces. USB-A storage and power connectors are ancillary hardware."),
  ...[["2530-48G", "J9775A", 48], ["2530-24G", "J9776A", 24]].map(([model, sku, count]) =>
    row("HPE Aruba", model, sku, "Switch", [
      group("access", count, "RJ45_1G", 1000, numbers(1, count)),
      group("uplink", 4, "SFP_1G", 1000, numbers(count + 1, 4)),
      group("management", 1, "Console", 0, ["CONSOLE"]),
      group("management", 1, "USB_MICRO_CONSOLE", 0, ["USB CONSOLE"]),
    ], accessAdditionSources.aruba2530,
    `HP/Aruba ${model} ${sku}, non-PoE, internal AC supply and supplied 19-inch rack brackets. Four dedicated 1G SFP cages, no installed optics; RJ45 and micro-B console alternatives. No rear fan or removable PSU is inferred.`)),
  row("HPE", "OfficeConnect 1920S 24G 2SFP", "JL381A", "Switch", [
    group("access", 24, "RJ45_1G", 1000, numbers(1, 24)),
    group("uplink", 2, "SFP_1G", 1000, ["25", "26"]),
  ], accessAdditionSources.office1920,
  "Explicit 1920S selection: JL381A 24G 2SFP non-PoE, fanless, internal AC supply, supplied 19-inch rack brackets and no installed optics. Web management uses the network ports; no console, USB or dedicated management socket."),
];
