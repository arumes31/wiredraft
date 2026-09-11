// Manufacturer-verified rack configurations; raw profiles are integrated by catalog.js.
const definitions = [
  { vendor: "Lenovo", model: "ThinkSystem SR650", key: "sr650", sku: "7X06CTO1WW", units: 2, width: 445, height: 87, depth: 764, source: "https://lenovopress.lenovo.com/lp1050.pdf", pages: "PDF 5 figure 4 front; PDF 6 figure 6 rear; 83–85 risers; 97 power", management: "XCC", drives: 8,
    configuration: "Original ThinkSystem SR650 7X06CTO1WW, two Xeon Silver 4110 processors, eight 7XB7A00049 1TB 3.5-inch SATA hot-swap drives, 4XH7A08770 eight-bay backplane and 7Y37A01084 RAID 930-8i in internal slot 7. X722 7ZT7A00545 four-port 1Gb RJ45 LOM; 7XH7A02677 primary and 7XH7A02679 secondary risers, six external PCIe positions covered. Two 7N67A00883 750W Platinum C14 supplies. Front VGA kit 7Z17A02578 installed. Six internal system fans, 7M27A05702 tool-less sliding rails, no bezel, rear drives, serial or additional PCIe adapters." },
  { vendor: "Lenovo", model: "ThinkSystem SR650 V2", key: "sr650v2", sku: "7Z73CTO1WW", units: 2, width: 445, height: 87, depth: 764, source: "https://lenovopress.lenovo.com/lp1392.pdf", pages: "PDF 7 figures 2/3; 52 configuration B; 91–93 risers; 94 OCP; 106 power", management: "XCC", drives: 12,
    configuration: "ThinkSystem SR650 V2 7Z73CTO1WW, two Xeon Silver 4310 processors, twelve 7XB7A00049 1TB 3.5-inch SATA hot-swap drives on the documented twelve-bay SAS/SATA backplane with onboard SATA (configuration B). Intel I350 4XC7A08277 four-port 1Gb RJ45 OCP 3.0 adapter. Two 4XH7A61079 risers plus 4XH7A61049 riser 3, eight PCIe positions covered. Two 4P57A75974 1100W Platinum Gen2 v2 C14 supplies. Front VGA/diagnostic latch kit 4X97A12645; 4M17A11754 sliding rails. Six internal 4F17A14497 standard fans, 2U entry heatsinks and standard air baffle (the selected 120W/12LFF thermal configuration has a 30°C ambient limit). No bezel, optional rear/middle drives, serial, GPU or PCIe adapters." },
  { vendor: "IBM", model: "System x3550 M5", key: "x3550m5", sku: "5463 CTO / A59W + A59X", units: 1, width: 429, height: 43, depth: 734, source: "https://lenovopress.lenovo.com/tips1194.pdf", pages: "PDF 4 figures 2/3; 20–21 drive kits; 26–27 risers; 33 power; 36 LCD; 39 rails", management: "IMM", drives: 8,
    configuration: "System x3550 M5 machine type 5463 CTO, maintained in Lenovo manufacturer documentation and indexed under the requested IBM brand. Two Xeon E5-2620 v3 processors; A59W base plus A59X/00KA055 expansion provide eight 2.5-inch hot-swap bays, populated with eight 00AJ141 1TB SATA G3HS drives. ServeRAID M5210 46C9110 in dedicated internal slot 4. Embedded BCM5719 four-port 1Gb RJ45 and dedicated IMM2.1. Risers 00KA061 and 00KA066 provide three covered low-profile slots. Two 00KA094 550W Platinum C14 supplies. 00KA054 advanced LCD installed, optical bay covered, eight internal fans and 00KA606 sliding rails. No bezel, serial kit, rear drives or optional network cards." }
];

/** Return independent raw catalog records with valid external connector types and explicit selected populations. */
export const lenovoServerProfiles = definitions.map(d => ({
  vendor: d.vendor, model: d.model, category: "Server", units: d.units, color: "#30363a", layout: "lenovo-server",
  inventoryRevision: 1, preserveInstalledPorts: true, fidelity: "verified", source: d.source, sku: d.sku, note: d.configuration,
  groups: [
    { zone: "access", count: 4, type: "RJ45_1G", speed: 1000, poe: false, prefix: "NIC", labels: ["NIC1", "NIC2", "NIC3", "NIC4"] },
    { zone: "management", count: 1, type: "RJ45_1G", speed: 1000, poe: false, prefix: d.management, labels: [d.management] },
    { zone: "access", inventoryAppend: true, count: 2, type: "Power", speed: 0, poe: false, prefix: "AC", labels: ["AC-L", "AC-R"] }
  ]
}));
export const lenovoServerConfigurations = new Map(definitions.map(d => [`${d.vendor}\0${d.model}`, Object.freeze(d)]));
