// Fortinet hardware profiles are kept separately because the supported model
// matrix is much larger than the rest of the built-in catalog. Every SKU below
// becomes its own selectable profile; storage, DC-power, PoE, and radio variants
// share a panel only when Fortinet documents the same physical connector layout.

const COLOR = "#8f2525";
const PRODUCT_MATRIX = "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/Fortinet_Product_Matrix.pdf";
const FORTIGATE_MATRIX = "https://docs.fortinet.com/document/fortimanager/7.6.4/release-notes/191178/fortigate-models";
const FORTISWITCH_MODELS = "https://docs.fortinet.com/document/fortiswitch/8.0.0/fortiswitchos-release-notes/784383/introduction";
const FORTISWITCH_SPECS = "https://www.fortinet.com/products/ethernet-switches";

const profiles = [];

function group(zone, count, type, speed, prefix, poe = false) {
  return { zone, count, type, speed, prefix, poe };
}

const ge = (count, prefix = "GE", poe = false) => group("access", count, "RJ45_1G", 1000, prefix, poe);
const mg = (count, speed = 5000, prefix = "MGIG", poe = false) => group("access", count, "RJ45_MGIG", speed, prefix, poe);
const tenT = (count, prefix = "10GE", poe = false) => group("access", count, "RJ45_10G", 10000, prefix, poe);
const sfp = (count, prefix = "SFP") => group("uplink", count, "SFP_1G", 1000, prefix);
const sfpp = (count, prefix = "SFP+") => group("uplink", count, "SFP_PLUS_10G", 10000, prefix);
const sfp28 = (count, prefix = "SFP28") => group("uplink", count, "SFP28_25G", 25000, prefix);
const sfp56 = (count, prefix = "SFP56") => group("uplink", count, "SFP56_50G", 50000, prefix);
const qsfp40 = (count, prefix = "QSFP+") => group("uplink", count, "QSFP_PLUS_40G", 40000, prefix);
const qsfp100 = (count, prefix = "QSFP28") => group("uplink", count, "QSFP28_100G", 100000, prefix);
const qsfp200 = (count, prefix = "QSFP56") => group("uplink", count, "QSFP56_200G", 200000, prefix);
const qsfp400 = (count, prefix = "QSFP-DD") => group("uplink", count, "QSFP_DD_400G", 400000, prefix);
const consolePort = (count = 1) => group("management", count, "Console", 0, "CONSOLE");
const usbMicroConsole = () => group("management", 1, "USB_MICRO_CONSOLE", 0, "CONSOLE");
const usbMiniConsole = () => group("management", 1, "USB_MINI_CONSOLE", 0, "USB-MGMT");
const managementRJ45 = (count, prefix = "MGMT") => group("management", count, "RJ45_1G", 1000, prefix);
const dsl = (count = 1) => group("access", count, "DSL_RJ11", 1000, "DSL");

/** Qualify modular endpoint labels by card so identically numbered sockets remain distinguishable. */
function modularLabels(groups) {
  return groups.map((item) => ({ ...item, labels: Array.from({ length: item.count }, (_, index) => `${item.prefix}${index + 1}`) }));
}

/** Describe the shipped 7000F base population with unique module-qualified endpoint names. */
function chassis7000FGroups(fimCount) {
  return modularLabels([
    ...[1, 2].flatMap((number) => [managementRJ45(1, `SMM${number}-MGMT`), group("management", 2, "Console", 0, `SMM${number}-CONSOLE`)]),
    ...Array.from({ length: fimCount }, (_, index) => {
      const prefix = `FIM${index + 1}`;
      return [qsfp100(18, `${prefix}-DATA`), qsfp400(2, `${prefix}-DD`), qsfp100(2, `${prefix}-M`),
        sfp28(2, `${prefix}-SFP-M`), managementRJ45(2, `${prefix}-MGMT`), group("management", 1, "Console", 0, `${prefix}-CONSOLE`)];
    }).flat(),
    ...Array.from({ length: fimCount }, (_, index) => [qsfp400(2, `FPM${index + 3}-DD`), sfp28(8, `FPM${index + 3}-DATA`)]).flat(),
  ]);
}

/** Add explicit Fortinet SKUs while retaining the revision needed to interpret saved port indices. */
function add(models, category, units, groups, options = {}) {
  for (const entry of models) {
    const model = typeof entry === "string" ? entry : entry.model;
    const sku = typeof entry === "string" ? skuFor(model) : entry.sku;
    profiles.push({
      vendor: "Fortinet",
      model,
      sku,
      category,
      units,
      color: COLOR,
      groups: groups.map((item) => ({ ...item })),
      layout: "fortinet",
      lifecycle: options.lifecycle || "supported",
      fidelity: options.fidelity || "verified",
      source: options.source || (category === "Switch" ? FORTISWITCH_SPECS : PRODUCT_MATRIX),
      note: options.note || "",
      ...(options.inventoryRevision ? { inventoryRevision: options.inventoryRevision } : {}),
      ...(options.preserveInstalledPorts === true ? { preserveInstalledPorts: true } : {}),
    });
  }
}

function skuFor(model) {
  return model
    .replace("FortiGate Rugged ", "FGR-")
    .replace("FortiGate ", "FG-")
    .replace("FortiSwitch Rugged ", "FSR-")
    .replace("FortiSwitch ", "FS-")
    .replaceAll(" ", "-")
    .toUpperCase();
}

// Current FortiGate desktop and branch appliances (July 2026 product matrix).
add(["FortiGate 30G", "FortiGate 31G"], "Firewall", 1, [ge(4, "PORT"), consolePort()], { lifecycle: "current" });
add(["FortiGate 40F", "FortiGate 40F-3G4G"], "Firewall", 1, [ge(5, "PORT"), consolePort()], { lifecycle: "current" });
add(["FortiGate 50G", "FortiGate 51G", "FortiGate 50G-5G", "FortiGate 51G-5G"], "Firewall", 1, [ge(5, "PORT"), consolePort()], { lifecycle: "current" });
add(["FortiGate 50G-DSL"], "Firewall", 1, [ge(5, "PORT"), dsl(), consolePort()], { lifecycle: "current" });
add(["FortiGate 50G-SFP"], "Firewall", 1, [ge(5, "PORT"), sfp(1), consolePort()], { lifecycle: "current" });
add(["FortiGate 50G-SFP-POE", "FortiGate 51G-SFP-POE"], "Firewall", 1, [ge(5, "PORT", true), sfp(1), consolePort()], { lifecycle: "current" });
add(["FortiGate 60F", "FortiGate 61F"], "Firewall", 1, [ge(10, "PORT"), consolePort()], { lifecycle: "current" });
add(["FortiGate 70F", "FortiGate 71F", "FortiGate 70G", "FortiGate 71G"], "Firewall", 1, [ge(10, "PORT"), consolePort()], { lifecycle: "current" });
add(["FortiGate 70G-POE", "FortiGate 71G-POE"], "Firewall", 1,
  [ge(4, "PORT", true), ge(6, "PORT"), consolePort()], { lifecycle: "current", inventoryRevision: 1,
    source: "https://www.itk.co.th/Data-Sheet/Firewall/FortiGate/fortigate-fortiwifi-70g-series.pdf",
    note: "Fortinet datasheet R05 PDF8/10: only ports1–4 supply PoE; all eleven endpoint indices remain unchanged." });
add(["FortiGate 80F", "FortiGate 81F", "FortiGate 80F-Bypass"], "Firewall", 1, [ge(10, "PORT"), sfp(2, "SHARED"), consolePort()], { lifecycle: "current", note: "SFP1/SFP2 share media pairs with WAN1/WAN2." });
add(["FortiGate 80F-POE", "FortiGate 81F-POE"], "Firewall", 1, [ge(10, "PORT", true), sfp(2, "SHARED"), consolePort()], { lifecycle: "current", note: "SFP1/SFP2 share media pairs with WAN1/WAN2." });
add(["FortiGate 90G", "FortiGate 91G"], "Firewall", 1, [ge(8, "PORT"), sfpp(2, "SHARED"), consolePort()], { lifecycle: "current", note: "Two 10GE SFP+/RJ45 shared media pairs." });
add(["FortiGate 100F", "FortiGate 101F"], "Firewall", 1, [ge(18), sfp(8), sfpp(2), consolePort()], { lifecycle: "current" });
add(["FortiGate 120G", "FortiGate 121G"], "Firewall", 1, [ge(18), sfp(8), sfpp(4), consolePort()], { lifecycle: "current" });
add(["FortiGate 200G", "FortiGate 201G"], "Firewall", 1, [ge(10), mg(8, 5000), sfp(4), sfpp(8), consolePort()], { lifecycle: "current" });
add(["FortiGate 400G", "FortiGate 401G", "FortiGate 700G", "FortiGate 701G"], "Firewall", 1, [ge(1), mg(1, 2500, "MGMT"), mg(8, 5000), sfp(16), sfpp(4), sfp28(4), consolePort()], { lifecycle: "current" });
add(["FortiGate 900G", "FortiGate 901G"], "Firewall", 1, [ge(17), mg(1, 2500, "MGMT"), sfp(8), sfpp(4), sfp28(4), consolePort()], { lifecycle: "current" });

// Current FortiGate data-center appliances.
add(["FortiGate 1000F", "FortiGate 1001F"], "Firewall", 2, [ge(1), mg(1, 2500), tenT(8), sfpp(16), sfp28(8), qsfp100(2), consolePort()], { lifecycle: "current" });
add(["FortiGate 1800F", "FortiGate 1801F"], "Firewall", 2, [ge(18), sfp(8), sfpp(2), sfp28(12), qsfp100(4), consolePort()], {
  lifecycle: "current", inventoryRevision: 1,
  source: "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-1800f-series.pdf",
  note: "PDF page 7 shows one RJ45 console and one ancillary USB socket. Older saved extra-console endpoints remain unmapped.",
});
add(["FortiGate 2600F", "FortiGate 2601F"], "Firewall", 2, [ge(2), tenT(16), sfpp(2), sfp28(16), qsfp100(4), consolePort()], { lifecycle: "current" });
add(["FortiGate 3000F", "FortiGate 3001F"], "Firewall", 2, [tenT(18), sfp28(16), qsfp100(6), consolePort()], {
  lifecycle: "current", inventoryRevision: 1,
  source: "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-3000f-series.pdf",
  note: "PDF page 7: two 10GE management and sixteen 10GE data sockets. Saved revision-0 extra copper endpoints remain unmapped.",
});
add(["FortiGate 3000G", "FortiGate 3001G"], "Firewall", 2, [tenT(18), sfp28(16), qsfp100(6), consolePort()], {
  lifecycle: "current", inventoryRevision: 1,
  source: "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/pdf/fortigate-3000g-series.pdf",
  note: "PDF page 7: two management, two WAN and fourteen data RJ45 sockets, all 10GE; old extra copper endpoints remain unmapped.",
});
add(["FortiGate 3200F", "FortiGate 3201F"], "Firewall", 2, [tenT(2), sfp28(4), sfp56(12), qsfp400(4), consolePort()], { lifecycle: "current" });
add(["FortiGate 3500F", "FortiGate 3501F"], "Firewall", 2, [tenT(2), sfp28(32), qsfp100(6), consolePort()], {
  lifecycle: "current", inventoryRevision: 1,
  source: "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-3500f-series.pdf",
  note: "PDF page 7 identifies both management sockets as 10GE; old saved port configuration is preserved by a revision map.",
});
add(["FortiGate 3500G", "FortiGate 3501G"], "Firewall", 2, [tenT(2), sfp28(30), qsfp100(4), qsfp400(2), consolePort()], { lifecycle: "current" });
add(["FortiGate 3700F", "FortiGate 3701F"], "Firewall", 2, [tenT(2), sfp28(4, "ULL-SFP28"), sfp56(20), qsfp400(4), consolePort()], { lifecycle: "current" });
add(["FortiGate 3800G", "FortiGate 3801G"], "Firewall", 3, [tenT(2), sfp56(18), qsfp200(6), qsfp400(4), consolePort()], { lifecycle: "current" });
add(["FortiGate 4200F", "FortiGate 4201F"], "Firewall", 3, [ge(2), sfp28(20), qsfp100(8), consolePort()], {
  lifecycle: "current", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/cd72e3b6-d679-11ea-96b9-00505692583a/FortiGate-4200F-Series-QSG-Supplement.pdf",
  note: "PDF page 3 identifies twenty SFP28 sockets: two HA, two AUX and sixteen data. An explicit revision map preserves older saved optical and console endpoints.",
});
add(["FortiGate 4400F", "FortiGate 4401F"], "Firewall", 4, [ge(2), sfp28(20), qsfp100(12), consolePort()], { lifecycle: "current" });
add(["FortiGate 4800F", "FortiGate 4801F", "FortiGate 4801F-NEBS"], "Firewall", 4, [tenT(2), sfp56(12), qsfp200(12), qsfp400(8), consolePort()], { lifecycle: "current" });

// Supported E/D-series and fixed-panel legacy appliances. Family-equivalent
// entries are called out in the installer when an exact current matrix is not
// published; storage and DC variants preserve the base model faceplate.
add(["FortiGate 200E", "FortiGate 201E"], "Firewall", 1, [ge(18), sfp(4), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 200F", "FortiGate 201F"], "Firewall", 1, [ge(18), sfp(8), sfpp(4), consolePort()], { lifecycle: "supported", source: FORTIGATE_MATRIX });
add(["FortiGate 300E", "FortiGate 301E", "FortiGate 400E", "FortiGate 401E"], "Firewall", 1, [ge(18), sfp(16), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 400E-Bypass"], "Firewall", 1, [ge(34), consolePort()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/92ffc448-af44-11eb-b70b-00505692583a/FortiGate-400E-BYPASS-QSG-Supplement.pdf",
  note: "PDF page 2 shows HA, MGMT and thirty-two copper bypass ports. Former optical saved endpoints remain unmapped.",
});
add(["FortiGate 400F", "FortiGate 401F"], "Firewall", 1, [ge(18), sfp(8), sfpp(8), consolePort()], { lifecycle: "supported", source: FORTIGATE_MATRIX });
add(["FortiGate 500E", "FortiGate 501E", "FortiGate 600E", "FortiGate 601E"], "Firewall", 1, [ge(10), sfp(8), sfpp(2), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 600F", "FortiGate 601F"], "Firewall", 1, [ge(18), sfp(8), sfpp(4), sfp28(4), consolePort()], { lifecycle: "supported", source: FORTIGATE_MATRIX });
add(["FortiGate 800D"], "Firewall", 1, [ge(26), sfp(8), sfpp(2), consolePort()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/90a1371d-1a0b-11e9-9685-f8bc1258b856/FortiGate-800D-Supplement.pdf",
  note: "PDF page 3 shows twenty-two data, two WAN and two management copper sockets. New WAN indices preserve older copper endpoint identities.",
});
add(["FortiGate 900D"], "Firewall", 1, [ge(18), sfp(16), sfpp(2), consolePort(), usbMiniConsole()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/cb4ad175-1a0b-11e9-9685-f8bc1258b856/FortiGate-900D-Supplement.pdf",
  note: "PDF page 3 documents a separate USB mini-B management socket, appended without shifting older endpoint indices.",
});
add(["FortiGate 1000D"], "Firewall", 2, [ge(18), sfp(16), sfpp(2), consolePort(), usbMiniConsole()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ae004e1f-1a0a-11e9-9685-f8bc1258b856/FortiGate-1000D-Supplement.pdf",
  note: "PDF page 3 illustrates the mini-B USB management socket separately from the RJ45 console and two USB-A server sockets; the new endpoint is appended.",
});
add(["FortiGate 1100E", "FortiGate 1101E"], "Firewall", 2, [ge(18), sfp(8), sfpp(4), sfp28(4), qsfp40(2), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 2200E", "FortiGate 2201E"], "Firewall", 2, [ge(14), sfp28(20), qsfp40(4), consolePort()], {
  lifecycle: "legacy", source: "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-2200e-series.pdf",
});
add(["FortiGate 2000E"], "Firewall", 2, [ge(34), sfpp(6), consolePort()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/30f0af8a-91f2-11f1-8c5a-8e4c95ff11ac/FortiGate-2000E-2500E-QSG.pdf",
  note: "PDF page 3 shows thirty-two data plus two management copper ports and six SFP+. Explicit revision mappings preserve saved endpoints.",
});
add(["FortiGate 2500E"], "Firewall", 2, [ge(34), sfpp(10), group("uplink", 2, "FIBER_LC", 10000, "BYPASS"), consolePort()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/FortiGate_2500E.pdf",
  note: "PDF page 7 distinguishes ten pluggable SFP+ slots from two fixed LC bypass optics; thirty-two copper data, two management and one console complete the inventory.",
});
add(["FortiGate 3000D"], "Firewall", 2, [ge(2), sfpp(16), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 3100D"], "Firewall", 2, [ge(2), sfpp(32), consolePort()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c33905b5-1a0a-11e9-9685-f8bc1258b856/FortiGate-3100D-QSG-Supplement.pdf",
  note: "PDF page 3 identifies thirty-two SFP+ slots. Former surplus optical endpoints remain unmapped; the saved console is explicitly mapped.",
});
add(["FortiGate 3200D"], "Firewall", 2, [ge(2), sfpp(48), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 3300E", "FortiGate 3301E"], "Firewall", 2, [ge(14), tenT(4), sfp28(16), qsfp40(4), consolePort()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/6816e10f-df0f-11e9-8977-00505692583a/FortiGate-3300E-QSG.pdf",
  note: "PDF page 3: two GE management, twelve GE data, four 10GE copper, sixteen SFP28 including HA1/2, four 40GE QSFP+ and one console. Explicit revision mappings preserve saved endpoints.",
});
add(["FortiGate 3400E", "FortiGate 3401E"], "Firewall", 2, [ge(2), sfp28(24), qsfp100(4), consolePort()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f1bcf8ed-299c-11e9-94bf-00505692583a/FortiGate-340xE-Series-QSG-ACDC.pdf",
  note: "PDF page 3 shows one console. Revision 1 retains all existing physical indices; the former second console remains an unmapped saved endpoint.",
});
add(["FortiGate 3600E", "FortiGate 3600E-DC", "FortiGate 3601E"], "Firewall", 2, [ge(2), sfp28(32), qsfp100(6), consolePort()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/91f40509-299d-11e9-94bf-00505692583a/FortiGate-3600E-Series-ACDC-Supplement.pdf",
  note: "PDF page 3 identifies thirty data plus two HA SFP28 and six QSFP28 sockets. Explicit revision mappings retain older optical and console endpoint identities.",
});
add(["FortiGate 3700D"], "Firewall", 3, [ge(2), sfpp(28), qsfp40(4), consolePort(), usbMiniConsole()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/a8cceba0-1a0a-11e9-9685-f8bc1258b856/FG-3700D-Supplement.pdf",
  note: "PDF page 3 distinguishes one RJ45 console from one USB mini-B management socket. Revision 1 retains the original endpoint indices.",
});
add(["FortiGate 3960E"], "Firewall", 5, [ge(2), sfpp(16), qsfp100(6), consolePort()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e7c49731-1a12-11e9-9685-f8bc1258b856/FortiGate-3960E-3980E-ACDC-QSG-Supplement.pdf",
  note: "PDF page 3: two GE management, sixteen 10GE SFP+ and six 100GE QSFP28 sockets, plus one console. Former extra saved endpoints remain unmapped.",
});
add(["FortiGate 3980E"], "Firewall", 5, [ge(2), sfpp(16), qsfp100(10), consolePort()], {
  lifecycle: "legacy", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e7c49731-1a12-11e9-9685-f8bc1258b856/FortiGate-3960E-3980E-ACDC-QSG-Supplement.pdf",
  note: "PDF page 3: two GE management, sixteen 10GE SFP+ and ten 100GE QSFP28 sockets, plus one console. Explicit revision mappings preserve original saved IDs and configuration.",
});

// Chassis platforms have no single fixed data-port faceplate. The profile shows
// their fixed management plane and explicitly tells the operator to add the
// installed interface/process modules as separate devices.
add(["FortiGate 5001E", "FortiGate 5001E1"], "Firewall", 5,
  [ge(2,"MGMT"), {...qsfp40(2),labels:["1","2"]}, {...sfpp(2),labels:["3","4"]}, consolePort()],
  {inventoryRevision:1,preserveInstalledPorts:true,fidelity:"verified",source:"https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/7b72a53e-1a0a-11e9-9685-f8bc1258b856/fortigate-5001E-security-system-guide.pdf",note:"One exact blade in slot 3 of a FortiGate-5060 DC carrier; five front and six rear air-baffle blanks, primary shelf manager, alarm panel, two fan trays, two PEMs. Standalone operation, slot 3 power capability 500, normal SW6. Blade network/console endpoints only; carrier services are physical ancillary art."});
add(["FortiGate 6000F"], "Firewall", 3, [sfp28(24), qsfp100(4), managementRJ45(5), consolePort(2)], { lifecycle: "supported", fidelity: "family", source: FORTIGATE_MATRIX, note: "Family label; select a documented 6001F, 6300F, 6301F, 6500F or 6501F SKU for its physical panel." });
add(["FortiGate 6001F", "FortiGate 6300F", "FortiGate 6301F", "FortiGate 6500F", "FortiGate 6501F"], "Firewall", 3,
  [sfp28(24), qsfp100(4), managementRJ45(2), group("management", 3, "SFP_PLUS_10G", 10000, "MGMT-SFP"), consolePort()], {
    lifecycle: "supported", inventoryRevision: 1,
    source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ffef9904-1a11-11e9-9685-f8bc1258b856/fortigate-6000F-system-guide.pdf",
    note: "PDF pages 7–8 and 13: twenty-four SFP28, four QSFP28, two RJ45 management, three SFP+ management/HA and one console. Revision 1 preserves existing indices and corrects management media; a surplus saved second console remains unmapped.",
  });
add(["FortiGate 7000E", "FortiGate 7000F"], "Firewall", 12, [ge(2, "MGMT"), consolePort(2)], { lifecycle: "supported", fidelity: "modular", source: FORTIGATE_MATRIX, note: "Modular chassis; data interfaces depend on installed FIM/FPM modules." });
add(["FortiGate 7060E", "FortiGate 7060E-8-DC"], "Firewall", 8, modularLabels([
  ...[1, 2].flatMap((number) => [managementRJ45(1, `SMM${number}-MGMT`), group("management", 2, "Console", 0, `SMM${number}-CONSOLE`)]),
  ...[1, 2].flatMap((number) => [managementRJ45(4, `FIM${number}-MGMT`), sfpp(2, `FIM${number}-M`), qsfp100(4, `FIM${number}-C`)]),
]), { fidelity: "modular", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/5bada950-1a11-11e9-9685-f8bc1258b856/fortigate-7060E-system-guide.pdf",
  note: "Selected 8U base with two FIM-7920E and two FPM-7620E cards, two SMMs, empty slots 5/6 and four AC or SKU-specific DC supplies. New inventory includes 26 usable connectors; saved 12U allocations and ambiguous old consoles are retained without reassignment." });
add(["FortiGate 7030E"], "Firewall", 6, modularLabels([managementRJ45(1, "SMM-MGMT"), consolePort(2),
  managementRJ45(4, "FIM1-MGMT"), sfpp(2, "FIM1-M"), sfpp(32, "FIM1-A")]), {
  lifecycle: "supported", fidelity: "modular", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/496f257b-1a0a-11e9-9685-f8bc1258b856/fortigate-7030E-system-guide.pdf",
  note: "6U; illustrated SFP10G configuration: FIM-7901E in slot1, FPM-7620E in slots3/4, sealed slot2 and three AC PSUs. Other FIM configurations require a different inventory. Saved 12U allocations and endpoints are retained.",
});
add(["FortiGate 7040E"], "Firewall", 6, modularLabels([managementRJ45(1, "SMM-MGMT"), consolePort(2),
  managementRJ45(4, "FIM1-MGMT"), sfpp(2, "FIM1-M"), qsfp100(4, "FIM1-C"),
  managementRJ45(4, "FIM2-MGMT"), sfpp(2, "FIM2-M"), qsfp100(4, "FIM2-C")]), {
  lifecycle: "supported", fidelity: "modular", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/18bec63c-1a0a-11e9-9685-f8bc1258b856/fortigate-7040E-system-guide.pdf",
  note: "6U; illustrated configuration: FIM-7920E in slots1/2, FPM-7630E in slots3/4 and three AC PSUs. Other installed modules require their own inventories. Saved 12U allocations and endpoints are retained.",
});
add(["FortiGate 7081F", "FortiGate 7081F-DC", "FortiGate 7081F-2-DC"], "Firewall", 12, chassis7000FGroups(1), {
  lifecycle: "supported", fidelity: "modular", inventoryRevision: 1,
  source: "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-7121f.pdf",
  note: "Ordering page13: shipped base with one FIM-7921F (FIM-7941F for -2-DC), one FPM-7620F, two SMMs and six AC/DC supplies. Unused module slots are blank. Unsupported FPM console and covered manufacturer MGMT are hardware only. Old ambiguous consoles remain unmapped.",
});
add(["FortiGate 7121F", "FortiGate 7121F-2", "FortiGate 7121F-DC", "FortiGate 7121F-2-DC"], "Firewall", 16, chassis7000FGroups(2), {
  lifecycle: "supported", fidelity: "modular", inventoryRevision: 1,
  source: "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-7121f.pdf",
  note: "Generation1 base: two FIM-7921F (FIM-7941F for -2), two FPM-7620F, two SMMs and eight AC/DC supplies. Eight unused FPM slots are blank. Unsupported FPM console and covered manufacturer MGMT are hardware only. Old ambiguous consoles remain unmapped.",
});

// DC and ACDC SKUs use the same connector faceplate as their base model.
const dcAliases = {
  "FortiGate 400F-DC": "FortiGate 400F", "FortiGate 401E-DC": "FortiGate 401E", "FortiGate 401F-DC": "FortiGate 401F",
  "FortiGate 800D-DC": "FortiGate 800D", "FortiGate 900G-DC": "FortiGate 900G", "FortiGate 901G-DC": "FortiGate 901G",
  "FortiGate 1100E-DC": "FortiGate 1100E", "FortiGate 1800F-DC": "FortiGate 1800F", "FortiGate 1801F-DC": "FortiGate 1801F",
  "FortiGate 2201E-ACDC": "FortiGate 2201E", "FortiGate 2600F-DC": "FortiGate 2600F", "FortiGate 2601F-DC": "FortiGate 2601F",
  "FortiGate 3000D-DC": "FortiGate 3000D", "FortiGate 3000F-ACDC": "FortiGate 3000F", "FortiGate 3000F-DC": "FortiGate 3000F",
  "FortiGate 3001F-ACDC": "FortiGate 3001F", "FortiGate 3001F-DC": "FortiGate 3001F", "FortiGate 3100D-DC": "FortiGate 3100D",
  "FortiGate 3200D-DC": "FortiGate 3200D", "FortiGate 3400E-DC": "FortiGate 3400E", "FortiGate 3401E-DC": "FortiGate 3401E",
  "FortiGate 3700D-DC": "FortiGate 3700D", "FortiGate 3960E-ACDC": "FortiGate 3960E", "FortiGate 3960E-DC": "FortiGate 3960E",
  "FortiGate 3980E-DC": "FortiGate 3980E", "FortiGate 4200F-DC": "FortiGate 4200F", "FortiGate 4201F-DC": "FortiGate 4201F",
  "FortiGate 4400F-DC": "FortiGate 4400F", "FortiGate 4401F-DC": "FortiGate 4401F", "FortiGate 4800F-DC": "FortiGate 4800F",
  "FortiGate 4801F-DC": "FortiGate 4801F", "FortiGate 4801F-DC-NEBS": "FortiGate 4801F",
  "FortiGate 6300F-DC": "FortiGate 6300F", "FortiGate 6301F-DC": "FortiGate 6301F", "FortiGate 6500F-DC": "FortiGate 6500F",
  "FortiGate 6501F-DC": "FortiGate 6501F",
};
for (const [model, baseModel] of Object.entries(dcAliases)) {
  const base = profiles.find((profile) => profile.model === baseModel);
  if (base) profiles.push({ ...base, model, sku: skuFor(model), note: `Power/chassis variant of ${baseModel}; identical network connector faceplate.` });
}

// Preserve saved inventories and rack allocations for the documented five-unit 3900E chassis.
for (const profile of profiles) {
  if (/^FortiGate (?:39[68]0E(?:-(?:ACDC|DC))?|300[01]F-ACDC)$/.test(profile.model)) {
    profile.preserveInstalledPorts = true;
  }
}

// FortiGate Rugged physical appliances.
add(["FortiGate Rugged 50G-5G"], "Firewall", 2, [ge(6), sfp(2), consolePort(2)], {
  lifecycle: "current", inventoryRevision: 1,
  source: "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/2418bdeb-8b25-11ef-989d-ae5dfae880d6/FGR-50G-5G-QSG.pdf",
  note: "PDF page 8: six GE, two SFP, one RJ45 console and a separate RJ45 serial data socket. Revision 1 appends the missing serial endpoint without moving previous indices.",
});
add(["FortiGate Rugged 60F", "FortiGate Rugged 60F-3G4G", "FortiGate Rugged 70F", "FortiGate Rugged 70F-3G4G", "FortiGate Rugged 70G", "FortiGate Rugged 70G-5G-Dual"], "Firewall", 3, [ge(6), sfp(2), consolePort(2)], { lifecycle: "current", source: FORTIGATE_MATRIX });

// FortiSwitch 100/200 series.
add(["FortiSwitch 108F"], "Switch", 1, [ge(8, "PORT"), sfp(2)], { lifecycle: "current" });
add(["FortiSwitch 108F-POE", "FortiSwitch 108F-FPOE"], "Switch", 1, [ge(8, "PORT", true), sfp(2), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 110G-FPOE"], "Switch", 1, [mg(8, 2500, "2.5GE", true), mg(2, 5000, "5GE", true), sfpp(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 124E"], "Switch", 1, [ge(24, "PORT"), sfp(4), consolePort()], { lifecycle: "legacy", source: FORTISWITCH_MODELS });
add(["FortiSwitch 124E-POE", "FortiSwitch 124E-FPOE"], "Switch", 1, [ge(24, "PORT", true), sfp(4), consolePort()], { lifecycle: "legacy", source: FORTISWITCH_MODELS });
add(["FortiSwitch 124F"], "Switch", 1, [ge(24, "PORT"), sfpp(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 124G"], "Switch", 1, [mg(24, 2500, "PORT"), sfpp(6), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 124F-POE", "FortiSwitch 124F-FPOE"], "Switch", 1, [ge(24, "PORT", true), sfpp(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 124G-FPOE"], "Switch", 1, [mg(24, 2500, "PORT", true), sfpp(6), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 148E"], "Switch", 1, [ge(48, "PORT"), sfp(4), consolePort()], { lifecycle: "legacy", source: FORTISWITCH_MODELS });
add(["FortiSwitch 148E-POE"], "Switch", 1, [ge(48, "PORT", true), sfp(4), consolePort()], { lifecycle: "legacy", source: FORTISWITCH_MODELS });
add(["FortiSwitch 148F"], "Switch", 1, [ge(48, "PORT"), sfpp(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 148F-POE", "FortiSwitch 148F-FPOE"], "Switch", 1, [ge(48, "PORT", true), sfpp(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 224D-FPOE"], "Switch", 1, [ge(24, "PORT", true), sfp(4), managementRJ45(1)], { lifecycle: "supported", source: FORTISWITCH_MODELS });
add(["FortiSwitch 224E"], "Switch", 1, [ge(24, "PORT"), sfp(4), managementRJ45(1)], { lifecycle: "supported", source: FORTISWITCH_MODELS });
add(["FortiSwitch 224E-POE"], "Switch", 1, [ge(12, "POE", true), ge(12, "PORT"), sfp(4), managementRJ45(1)], { lifecycle: "supported", source: FORTISWITCH_MODELS });
add(["FortiSwitch 248D"], "Switch", 1, [ge(48, "PORT"), sfp(4), managementRJ45(1)], { lifecycle: "supported", source: FORTISWITCH_MODELS });
add(["FortiSwitch 248E-POE"], "Switch", 1, [ge(24, "POE", true), ge(24, "PORT"), sfp(4), managementRJ45(1)], { lifecycle: "supported", source: FORTISWITCH_MODELS });
add(["FortiSwitch 248E-FPOE"], "Switch", 1, [ge(48, "PORT", true), sfp(4), managementRJ45(1)], { lifecycle: "supported", source: FORTISWITCH_MODELS });

// FortiSwitch campus and multi-gig series.
add(["FortiSwitch 348G"], "Switch", 1, [ge(24, "GE"), mg(24, 2500), sfpp(4), consolePort(), managementRJ45(1)], { lifecycle: "current" });
add(["FortiSwitch 348G-FPOE"], "Switch", 1, [ge(24, "GE", true), mg(24, 2500, "MGIG", true), sfpp(4), consolePort(), managementRJ45(1)], { lifecycle: "current" });
add(["FortiSwitch 424E"], "Switch", 1, [ge(24, "PORT"), sfpp(4), managementRJ45(1)], { lifecycle: "supported" });
add(["FortiSwitch 424E-POE", "FortiSwitch 424E-FPOE"], "Switch", 1, [ge(24, "PORT", true), sfpp(4), managementRJ45(1)], { lifecycle: "supported" });
add(["FortiSwitch 424E-Fiber"], "Switch", 1, [sfp(24, "PORT"), sfpp(4), managementRJ45(1)], { lifecycle: "supported" });
add(["FortiSwitch M426E-FPOE"], "Switch", 1, [
  ge(16, "GE", true), mg(8, 2500, "2.5GE", true), mg(2, 5000, "5GE"), sfpp(4), managementRJ45(1),
], { lifecycle: "supported" });
add(["FortiSwitch 448E"], "Switch", 1, [ge(48, "PORT"), sfpp(4), managementRJ45(1)], { lifecycle: "supported" });
add(["FortiSwitch 448E-POE", "FortiSwitch 448E-FPOE"], "Switch", 1, [ge(48, "PORT", true), sfpp(4), managementRJ45(1)], { lifecycle: "supported" });
add(["FortiSwitch 524D"], "Switch", 1, [ge(24, "PORT"), sfpp(4), qsfp40(2), managementRJ45(1), usbMicroConsole()], { lifecycle: "legacy" });
add(["FortiSwitch 524D-FPOE"], "Switch", 1, [ge(24, "PORT", true), sfpp(4), qsfp40(2), managementRJ45(1), usbMicroConsole()], { lifecycle: "legacy" });
add(["FortiSwitch 548D"], "Switch", 1, [ge(48, "PORT"), sfpp(4), qsfp40(2), managementRJ45(1), usbMicroConsole()], { lifecycle: "legacy" });
add(["FortiSwitch 548D-FPOE"], "Switch", 1, [ge(48, "PORT", true), sfpp(4), qsfp40(2), managementRJ45(1), usbMicroConsole()], { lifecycle: "legacy" });
add(["FortiSwitch 624F"], "Switch", 1, [mg(24, 5000), sfp28(4), managementRJ45(1), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 624F-FPOE"], "Switch", 1, [mg(24, 5000, "MGIG", true), sfp28(4), managementRJ45(1), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 648F"], "Switch", 1, [mg(32, 2500, "2.5GE"), mg(16, 5000, "5GE"), sfp28(8), managementRJ45(1), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 648F-FPOE"], "Switch", 1, [mg(32, 2500, "2.5GE", true), mg(16, 5000, "5GE", true), sfp28(8), managementRJ45(1), consolePort()], { lifecycle: "current" });

// FortiSwitch core, data-center, and rugged platforms.
add(["FortiSwitch 1024E"], "Switch", 1, [sfpp(24, "PORT"), qsfp100(2), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch T1024E"], "Switch", 1, [tenT(24, "PORT"), qsfp100(2), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch T1024F-FPOE"], "Switch", 1, [tenT(24, "PORT", true), qsfp100(2), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 1048E"], "Switch", 1, [sfpp(48, "PORT"), qsfp100(4), qsfp40(2), ge(1, "MGMT"), consolePort()], { lifecycle: "supported" });
add(["FortiSwitch 1048G"], "Switch", 1, [sfpp(48, "PORT"), qsfp100(6), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 2048F"], "Switch", 1, [sfp28(48, "PORT"), qsfp100(8), sfpp(2), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 3032E"], "Switch", 1, [qsfp100(32, "PORT"), ge(1, "MGMT"), consolePort()], { lifecycle: "supported" });
add(["FortiSwitch 3032G"], "Switch", 1, [qsfp100(32, "PORT"), sfpp(2), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch Rugged 108F"], "Switch", 2, [ge(6, "PORT"), sfp(2), consolePort(), managementRJ45(1)], { lifecycle: "current" });
add(["FortiSwitch Rugged 112F-POE"], "Switch", 2, [ge(8, "PORT", true), sfp(4), consolePort(), managementRJ45(1)], { lifecycle: "current", inventoryRevision: 1, preserveInstalledPorts: true });
add(["FortiSwitch Rugged 216F-POE"], "Switch", 2, [ge(16, "PORT", true), sfpp(4), consolePort(), {...managementRJ45(1), speed: 100}], { lifecycle: "current", inventoryRevision: 1, preserveInstalledPorts: true });
add(["FortiSwitch Rugged 424F-POE"], "Switch", 2, [
  mg(12, 2500, "PORT", true),
  group("uplink", 12, "SFP_PLUS_10G", 2500, "2.5G SFP+"),
  sfpp(4), qsfp40(2), managementRJ45(1),
], { lifecycle: "current" });

// Each family alias selects one documented population without changing the exact SKU row.
for (const [alias, exactModel, units, selection] of [
  ["FortiGate 6000F", "FortiGate 6301F", 3, "FG-6301F generation2 AC, six internal FPCs, two1TB RAID1 log disks, three SP-FG4000F-PS2000W high-line supplies, three FG-6000F-FAN trays and shipped four-post sliding rails."],
  ["FortiGate 7000E", "FortiGate 7060E", 8, "FG-7060E-8 AC bundle with FIM-7920E-C selected at order: two FIM-7920E, two FPM-7620E, two SMMs, four1500W AC supplies in PWR1-4 and three dual-fan trays; other card and supply slots covered."],
  ["FortiGate 7000F", "FortiGate 7081F", 12, "FG-7081F AC shipped base: one FIM-7921F in slot1, one FPM-7620F in slot3, two SMMs, six2500W AC supplies, six covered card slots and three triple-fan trays; Saf-D-Grid appliance inlets."],
]) {
  const aliasProfile = profiles.find(profile => profile.model === alias);
  const exactProfile = profiles.find(profile => profile.model === exactModel);
  Object.assign(aliasProfile, {units, groups: structuredClone(exactProfile.groups), inventoryRevision: 1,
    preserveInstalledPorts: true, fidelity: "verified", source: exactProfile.source,
    note: `Selected ${selection} Original family inventories and rack allocations remain unchanged; no optics or extra modules installed.`});
}

// Detect accidental duplicate model rows during development; duplicate options
// are otherwise hard to notice in a long select list.
const seen = new Set();
for (const profile of profiles) {
  if (seen.has(profile.model)) throw new Error(`Duplicate Fortinet profile: ${profile.model}`);
  seen.add(profile.model);
}

export const fortinetProfiles = profiles;
export const fortinetCatalogSources = { PRODUCT_MATRIX, FORTIGATE_MATRIX, FORTISWITCH_MODELS, FORTISWITCH_SPECS };
