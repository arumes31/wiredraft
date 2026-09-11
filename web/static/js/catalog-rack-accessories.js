const sehSource = "https://www.seh-technology.com/fileadmin/user/downloads/deviceserver/documentation/myUTN-80_QIG51.pdf";
const schematicSource = "https://github.com/arumes31/wiredraft/blob/main/FACEPLATES.md";

/** Define passive power groups without creating Ethernet or VLAN settings. */
function power(count, labels) { return { zone: "access", count, type: "Power", speed: 0, poe: false, prefix: "", labels }; }

/** Offer an explicitly generic rack strip with front outlets and a rear C20 supply inlet. */
function strip(model, labels, note) {
  return { vendor: "Generic Facility", model, category: "PatchPanel", units: 1, color: "#2b3032", layout: "rack-power-strip",
    inventoryRevision: 1, preserveInstalledPorts: true, groups: [power(labels.length + 1, [...labels, "AC IN"])], source: schematicSource, note };
}

/** Select the closed myUTN-80 installation and two deliberately schematic power-strip configurations. */
export const rackAccessoryProfiles = [
  { vendor: "SEH", model: "myUTN-80", category: "Server", units: 1, color: "#bfc4ca", layout: "seh-rmk1",
    inventoryRevision: 1, preserveInstalledPorts: true, sku: "myUTN-80 + RMK1", source: sehSource,
    note: "myUTN-80 mounted in RMK1, closed blue locking lid, supplied external power pack. One front 10/100 Ethernet interface and rear DC input. Eight USB 2.0 dongle sockets and reset button are behind the locked cover; no external USB wiring is shown.",
    groups: [{ zone: "access", count: 1, type: "RJ45_1G", speed: 100, poe: false, prefix: "", labels: ["LAN"] }, power(1, ["DC IN"])] },
  strip("Rack power strip 8 Schuko", Array.from({ length: 8 }, (_, i) => `SCHUKO ${i + 1}`),
    "Generic horizontal 1U rack strip: eight front Schuko outlets, rear C20 input, no switch, meter or network controller. Schematic planning geometry; no manufacturer SKU, current rating or electrical safety certification is implied."),
  strip("Rack power strip 8 C13 + 2 C19", [...Array.from({ length: 8 }, (_, i) => `C13 ${i + 1}`), "C19 1", "C19 2"],
    "Generic horizontal 1U rack strip: eight C13 and two C19 front outlets, rear C20 input, no switch, meter or network controller. Schematic planning geometry; no manufacturer SKU, current rating or electrical safety certification is implied."),
];
