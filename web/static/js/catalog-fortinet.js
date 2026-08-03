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
const managementRJ45 = (count, prefix = "MGMT") => group("management", count, "RJ45_1G", 1000, prefix);
const dsl = (count = 1) => group("access", count, "DSL_RJ11", 1000, "DSL");

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
add(["FortiGate 70G-POE", "FortiGate 71G-POE"], "Firewall", 1, [ge(10, "PORT", true), consolePort()], { lifecycle: "current" });
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
add(["FortiGate 1800F", "FortiGate 1801F"], "Firewall", 2, [ge(18), sfp(8), sfpp(2), sfp28(12), qsfp100(4), consolePort(2)], { lifecycle: "current" });
add(["FortiGate 2600F", "FortiGate 2601F"], "Firewall", 2, [ge(2), tenT(16), sfpp(2), sfp28(16), qsfp100(4), consolePort()], { lifecycle: "current" });
add(["FortiGate 3000F", "FortiGate 3001F", "FortiGate 3000G", "FortiGate 3001G"], "Firewall", 2, [ge(2), tenT(18), sfp28(16), qsfp100(6), consolePort()], { lifecycle: "current" });
add(["FortiGate 3200F", "FortiGate 3201F"], "Firewall", 2, [tenT(2), sfp28(4), sfp56(12), qsfp400(4), consolePort()], { lifecycle: "current" });
add(["FortiGate 3500F", "FortiGate 3501F"], "Firewall", 2, [ge(2), sfp28(32), qsfp100(6), consolePort()], { lifecycle: "current" });
add(["FortiGate 3500G", "FortiGate 3501G"], "Firewall", 2, [tenT(2), sfp28(30), qsfp100(4), qsfp400(2), consolePort()], { lifecycle: "current" });
add(["FortiGate 3700F", "FortiGate 3701F"], "Firewall", 2, [tenT(2), sfp28(4, "ULL-SFP28"), sfp56(20), qsfp400(4), consolePort()], { lifecycle: "current" });
add(["FortiGate 3800G", "FortiGate 3801G"], "Firewall", 3, [tenT(2), sfp56(18), qsfp200(6), qsfp400(4), consolePort()], { lifecycle: "current" });
add(["FortiGate 4200F", "FortiGate 4201F"], "Firewall", 3, [ge(2), sfp28(18), qsfp100(8), consolePort()], { lifecycle: "current" });
add(["FortiGate 4400F", "FortiGate 4401F"], "Firewall", 4, [ge(2), sfp28(20), qsfp100(12), consolePort()], { lifecycle: "current" });
add(["FortiGate 4800F", "FortiGate 4801F", "FortiGate 4801F-NEBS"], "Firewall", 4, [tenT(2), sfp56(12), qsfp200(12), qsfp400(8), consolePort()], { lifecycle: "current" });

// Supported E/D-series and fixed-panel legacy appliances. Family-equivalent
// entries are called out in the installer when an exact current matrix is not
// published; storage and DC variants preserve the base model faceplate.
add(["FortiGate 200E", "FortiGate 201E"], "Firewall", 1, [ge(18), sfp(4), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 200F", "FortiGate 201F"], "Firewall", 1, [ge(18), sfp(8), sfpp(4), consolePort()], { lifecycle: "supported", source: FORTIGATE_MATRIX });
add(["FortiGate 300E", "FortiGate 301E", "FortiGate 400E", "FortiGate 400E-Bypass", "FortiGate 401E"], "Firewall", 1, [ge(18), sfp(16), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 400F", "FortiGate 401F"], "Firewall", 1, [ge(18), sfp(8), sfpp(8), consolePort()], { lifecycle: "supported", source: FORTIGATE_MATRIX });
add(["FortiGate 500E", "FortiGate 501E", "FortiGate 600E", "FortiGate 601E"], "Firewall", 1, [ge(10), sfp(8), sfpp(2), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 600F", "FortiGate 601F"], "Firewall", 1, [ge(18), sfp(8), sfpp(4), sfp28(4), consolePort()], { lifecycle: "supported", source: FORTIGATE_MATRIX });
add(["FortiGate 800D"], "Firewall", 1, [ge(24), sfp(8), sfpp(2), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 900D"], "Firewall", 1, [ge(18), sfp(16), sfpp(2), consolePort()], { lifecycle: "legacy", fidelity: "family", source: FORTIGATE_MATRIX });
add(["FortiGate 1000D"], "Firewall", 2, [ge(18), sfp(16), sfpp(2), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 1100E", "FortiGate 1101E"], "Firewall", 2, [ge(18), sfp(8), sfpp(4), sfp28(4), qsfp40(2), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 2000E", "FortiGate 2200E", "FortiGate 2201E", "FortiGate 2500E"], "Firewall", 2, [ge(14), sfp28(20), qsfp40(4), consolePort()], { lifecycle: "legacy", fidelity: "family", source: FORTIGATE_MATRIX });
add(["FortiGate 3000D"], "Firewall", 2, [ge(2), sfpp(16), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 3100D", "FortiGate 3200D"], "Firewall", 2, [ge(2), sfpp(48), consolePort()], { lifecycle: "legacy", fidelity: "family", source: FORTIGATE_MATRIX });
add(["FortiGate 3300E", "FortiGate 3301E"], "Firewall", 2, [ge(16), sfp28(16), qsfp100(4), consolePort()], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 3400E", "FortiGate 3401E"], "Firewall", 2, [ge(2), sfp28(24), qsfp100(4), consolePort(2)], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 3600E", "FortiGate 3600E-DC", "FortiGate 3601E"], "Firewall", 2, [ge(2), sfp28(24), qsfp100(4), consolePort()], { lifecycle: "legacy", fidelity: "family", source: FORTIGATE_MATRIX });
add(["FortiGate 3700D"], "Firewall", 3, [ge(2), sfpp(28), qsfp40(4), consolePort(2)], { lifecycle: "legacy", source: FORTIGATE_MATRIX });
add(["FortiGate 3960E", "FortiGate 3980E"], "Firewall", 3, [ge(2), sfp28(32), qsfp100(8), consolePort()], { lifecycle: "legacy", fidelity: "family", source: FORTIGATE_MATRIX });

// Chassis platforms have no single fixed data-port faceplate. The profile shows
// their fixed management plane and explicitly tells the operator to add the
// installed interface/process modules as separate devices.
add(["FortiGate 5001E", "FortiGate 5001E1"], "Firewall", 2, [ge(2, "MGMT"), consolePort()], { lifecycle: "supported", fidelity: "modular", source: FORTIGATE_MATRIX, note: "Blade; data interfaces depend on the installed chassis/module configuration." });
add(["FortiGate 6000F", "FortiGate 6001F", "FortiGate 6300F", "FortiGate 6301F", "FortiGate 6500F", "FortiGate 6501F"], "Firewall", 3, [sfp28(24), qsfp100(4), managementRJ45(5), consolePort(2)], { lifecycle: "supported", source: FORTIGATE_MATRIX, note: "Common 6000F front-panel interface layout with HA1/HA2 and MGMT1-MGMT3." });
add(["FortiGate 7000E", "FortiGate 7000F", "FortiGate 7030E", "FortiGate 7040E", "FortiGate 7060E", "FortiGate 7081F"], "Firewall", 12, [ge(2, "MGMT"), consolePort(2)], { lifecycle: "supported", fidelity: "modular", source: FORTIGATE_MATRIX, note: "Modular chassis; data interfaces depend on installed FIM/FPM modules." });
add(["FortiGate 7121F"], "Firewall", 16, [ge(2, "MGMT"), consolePort(2)], { lifecycle: "supported", fidelity: "modular", source: FORTIGATE_MATRIX, note: "Modular chassis; data interfaces depend on installed FIM/FPM modules." });

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
  "FortiGate 6501F-DC": "FortiGate 6501F", "FortiGate 7060E-8-DC": "FortiGate 7060E", "FortiGate 7081F-DC": "FortiGate 7081F",
  "FortiGate 7081F-2-DC": "FortiGate 7081F", "FortiGate 7121F-2": "FortiGate 7121F", "FortiGate 7121F-2-DC": "FortiGate 7121F",
  "FortiGate 7121F-DC": "FortiGate 7121F",
};
for (const [model, baseModel] of Object.entries(dcAliases)) {
  const base = profiles.find((profile) => profile.model === baseModel);
  if (base) profiles.push({ ...base, model, sku: skuFor(model), note: `Power/chassis variant of ${baseModel}; identical network connector faceplate.` });
}

// FortiGate Rugged physical appliances.
add(["FortiGate Rugged 50G-5G"], "Firewall", 2, [ge(6), sfp(2), consolePort()], { lifecycle: "current", fidelity: "family", source: FORTIGATE_MATRIX });
add(["FortiGate Rugged 60F", "FortiGate Rugged 60F-3G4G", "FortiGate Rugged 70F", "FortiGate Rugged 70F-3G4G", "FortiGate Rugged 70G", "FortiGate Rugged 70G-5G-Dual"], "Firewall", 3, [ge(6), sfp(2), consolePort(2)], { lifecycle: "current", source: FORTIGATE_MATRIX });

// FortiSwitch 100/200 series.
add(["FortiSwitch 108F"], "Switch", 1, [ge(8, "PORT"), sfp(2), consolePort()], { lifecycle: "current" });
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
add(["FortiSwitch 224D-FPOE", "FortiSwitch 224E-POE"], "Switch", 1, [ge(24, "PORT", true), sfp(4), consolePort()], { lifecycle: "supported", source: FORTISWITCH_MODELS });
add(["FortiSwitch 224E"], "Switch", 1, [ge(24, "PORT"), sfp(4), consolePort()], { lifecycle: "supported", source: FORTISWITCH_MODELS });
add(["FortiSwitch 248D"], "Switch", 1, [ge(48, "PORT"), sfp(4), consolePort()], { lifecycle: "supported", source: FORTISWITCH_MODELS });
add(["FortiSwitch 248E-POE", "FortiSwitch 248E-FPOE"], "Switch", 1, [ge(48, "PORT", true), sfp(4), consolePort()], { lifecycle: "supported", source: FORTISWITCH_MODELS });

// FortiSwitch campus and multi-gig series.
add(["FortiSwitch 348G"], "Switch", 1, [ge(24, "GE"), mg(24, 2500), sfpp(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 348G-FPOE"], "Switch", 1, [ge(24, "GE", true), mg(24, 2500, "MGIG", true), sfpp(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 424E"], "Switch", 1, [ge(24, "PORT"), sfpp(4), consolePort()], { lifecycle: "supported" });
add(["FortiSwitch 424E-POE", "FortiSwitch 424E-FPOE"], "Switch", 1, [ge(24, "PORT", true), sfpp(4), consolePort()], { lifecycle: "supported" });
add(["FortiSwitch 424E-Fiber"], "Switch", 1, [sfp(24, "PORT"), sfpp(4), consolePort()], { lifecycle: "supported" });
add(["FortiSwitch M426E-FPOE"], "Switch", 1, [ge(16, "GE", true), mg(8, 2500, "2.5GE", true), mg(2, 5000, "5GE", true), sfpp(4), consolePort()], { lifecycle: "supported" });
add(["FortiSwitch 448E"], "Switch", 1, [ge(48, "PORT"), sfpp(4), consolePort()], { lifecycle: "supported" });
add(["FortiSwitch 448E-POE", "FortiSwitch 448E-FPOE"], "Switch", 1, [ge(48, "PORT", true), sfpp(4), consolePort()], { lifecycle: "supported" });
add(["FortiSwitch 524D", "FortiSwitch 524D-FPOE"], "Switch", 1, [ge(24, "PORT", true), sfpp(4), qsfp40(2), consolePort()], { lifecycle: "legacy", fidelity: "family", source: FORTISWITCH_MODELS });
add(["FortiSwitch 548D", "FortiSwitch 548D-FPOE"], "Switch", 1, [ge(48, "PORT", true), sfpp(4), qsfp40(2), consolePort()], { lifecycle: "legacy", source: FORTISWITCH_MODELS });
add(["FortiSwitch 624F"], "Switch", 1, [mg(24, 5000), sfp28(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 624F-FPOE"], "Switch", 1, [mg(24, 5000, "MGIG", true), sfp28(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 648F"], "Switch", 1, [mg(32, 2500, "2.5GE"), mg(16, 5000, "5GE"), sfp28(8), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 648F-FPOE"], "Switch", 1, [mg(32, 2500, "2.5GE", true), mg(16, 5000, "5GE", true), sfp28(8), consolePort()], { lifecycle: "current" });

// FortiSwitch core, data-center, and rugged platforms.
add(["FortiSwitch 1024E"], "Switch", 1, [sfpp(24, "PORT"), qsfp100(2), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch T1024E"], "Switch", 1, [tenT(24, "PORT"), qsfp100(2), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch T1024F-FPOE"], "Switch", 1, [tenT(24, "PORT", true), qsfp100(2), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 1048E"], "Switch", 1, [sfpp(48, "PORT"), qsfp100(4), qsfp40(2), ge(1, "MGMT"), consolePort()], { lifecycle: "supported" });
add(["FortiSwitch 1048G"], "Switch", 1, [sfpp(48, "PORT"), qsfp100(6), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 2048F"], "Switch", 1, [sfp28(48, "PORT"), qsfp100(8), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch 3032E"], "Switch", 1, [qsfp100(32, "PORT"), ge(1, "MGMT"), consolePort()], { lifecycle: "supported" });
add(["FortiSwitch 3032G"], "Switch", 1, [qsfp100(32, "PORT"), sfpp(2), ge(1, "MGMT"), consolePort()], { lifecycle: "current" });
add(["FortiSwitch Rugged 108F"], "Switch", 2, [ge(6, "PORT"), sfp(2), consolePort()], { lifecycle: "current" });
add(["FortiSwitch Rugged 112F-POE"], "Switch", 2, [ge(8, "PORT", true), sfp(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch Rugged 216F-POE"], "Switch", 2, [ge(16, "PORT", true), sfpp(4), consolePort()], { lifecycle: "current" });
add(["FortiSwitch Rugged 424F-POE"], "Switch", 2, [mg(24, 2500, "PORT", true), sfpp(4), qsfp40(2), consolePort()], { lifecycle: "current" });

// Detect accidental duplicate model rows during development; duplicate options
// are otherwise hard to notice in a long select list.
const seen = new Set();
for (const profile of profiles) {
  if (seen.has(profile.model)) throw new Error(`Duplicate Fortinet profile: ${profile.model}`);
  seen.add(profile.model);
}

export const fortinetProfiles = profiles;
export const fortinetCatalogSources = { PRODUCT_MATRIX, FORTIGATE_MATRIX, FORTISWITCH_MODELS, FORTISWITCH_SPECS };
