import { canonicalFaceplateDevice, layoutPanelPorts } from "./faceplate-profile.js";

const profiles = new Map();
const GUIDES = {
  gate: "https://docs.fortinet.com/product/fortigate/hardware",
  switch: "https://docs.fortinet.com/product/fortiswitch/hardware",
  "90G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/4ff042da-3220-11ee-8e6d-fa163e15d75b/FG-90G-SERIES-QSG.pdf",
  "120G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f9fb064a-a672-11ee-8673-fa163e15d75b/FG-120G-QSG.pdf",
  "148F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3f38a8b3-0a5f-11eb-96b9-00505692583a/FortiSwitch-148F-Series-QSG.pdf",
  "448E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/9f94e4e9-920c-11ea-aafb-00505692583a/FortiSwitch-448E-Series-QSG.pdf",
  "624F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/073bc97f-589d-11ee-8e6d-fa163e15d75b/FS-624F-648F-Series-QSG.pdf",
  "231F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c03ec18a-01b9-11eb-96b9-00505692583a/FortiAP-231F-QSG.pdf",
  "511F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/1268d682-14fb-11ec-a4c4-00505692583a/FortiExtender-511F-QuickStart_Online.pdf",
  "224E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e80c525a-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-224E-Series-QSG.pdf",
  "248E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e6a256ac-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-248E-Series-QSG.pdf",
  "424E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3c36fae6-fe82-11ea-96b9-00505692583a/FortiSwitch-424E-Series-QSG.pdf",
  "124G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/1c64a2db-dd9e-11ef-8766-ca4255feedd9/FortiSwitch-124G-Series-QSG.pdf",
  "1048E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e5a90707-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-1048E-Series-QuickStart.pdf",
  "1048G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/dfeede22-9992-11f0-855d-6af4c3636dc7/FortiSwitch-1048G-QSG.pdf",
  "2048F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/38b7ea4d-92f3-11ee-a142-fa163e15d75b/FS-2048F-QSG.pdf",
  "3032E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3215b9f7-50b3-11e9-94bf-00505692583a/FortiSwitch-3032E-QSG.pdf",
  "3032G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/8f69aa17-aba7-11f0-a43a-72af6d868cc2/FortiSwitch-3032G-QSG.pdf",
  "524D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e7da2e4b-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-524D-Series-QuickStart.pdf",
  "548D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e79f907f-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-548D-Series-QuickStart.pdf",
  "124E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e391baaa-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-124E-QSG.pdf",
  "148E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/4d0f9a01-6df1-11e9-81a4-00505692583a/FortiSwitch-148E-Series-QSG.pdf",
  "1024E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/002ca2c6-586f-11ec-bdf2-fa163e15d75b/FortiSwitch-1024E-QSG.pdf",
  "T1024F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3cd09f8b-2f5a-11ef-8c42-fa163e15d75b/FortiSwitch-T1024F-FPOE-QSG.pdf",
  "110G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e9bb65da-5e6b-11ef-bfe5-fa163e15d75b/FortiSwitch-110G-FPOE-QSG.pdf",
  "348G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ce3d8422-6a71-11f1-a33a-02356ffb40d9/FortiSwitch-348G-Series-QSG.pdf",
  "M426E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ff713891-de2a-11e9-8977-00505692583a/FortiSwitch-M426E-FPOE-QSG.pdf",
  "248D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/dcbce1f9-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-248D-Series-QSG.pdf",
  "108F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/db0e275b-d07d-11eb-97f7-00505692583a/FortiSwitch-108F-Series-QSG.pdf",
  "224D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/dd96f287-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-224D-FPOE-QSG.pdf",
  "R108F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/76b61865-375d-11f0-a9d0-d2b0d2e22f7d/FSR-108F-QSG.pdf",
  "R112F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ee25faa8-375c-11f0-a9d0-d2b0d2e22f7d/FSR-112F-POE-QSG.pdf",
  "R216F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/0b499254-cf8a-11ef-8766-ca4255feedd9/FSR-216F-POE-QSG.pdf",
  "R424F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ea180604-eae6-11ed-8e6d-fa163e15d75b/FSR-424F-POE-QSG.pdf",
  "30G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/b0f32597-a216-11ef-a705-1222899fa4e9/FG-30G-31G-QSG.pdf",
  "50G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/6a8514a8-4c87-11f0-a9d0-d2b0d2e22f7d/FG-50G-51G-QSG.pdf",
  "200G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ff9309bd-92ed-11ef-a705-1222899fa4e9/FG-200G-Series-QSG.pdf",
  "400G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/b659f32f-2d3f-11f1-b31d-02356ffb40d9/FG-400G-Series-QSG.pdf",
  "700G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/60b7c7f8-4173-11f0-a9d0-d2b0d2e22f7d/FG-700G-Series-QSG.pdf",
  "900G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/fac0bc53-8f12-11ee-a142-fa163e15d75b/FG-900G-Series-QSG.pdf",
  "50G-SFP": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/8c48dcc6-50de-11ef-bfe5-fa163e15d75b/FG-50G-SFP-QSG.pdf",
  "50G-DSL": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f6be9fcf-50dd-11ef-bfe5-fa163e15d75b/FG-50G-DSL-QSG.pdf",
  "50G-POE": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/fc370037-50de-11ef-bfe5-fa163e15d75b/FG-50G-51G-SFP-POE-QSG.pdf",
  "80F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/13f24f18-1d87-11ec-8c53-00505692583a/FG-80F-Series-QSG.pdf",
  "40F-cell": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/fd70142f-ff2f-11e9-8977-00505692583a/FG-FWF-40F-60F-Series-QSG.pdf",
  "400F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-400f-series.pdf",
  "1000F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-1000f-series.pdf",
  "1100E-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-1100e-series.pdf",
  "1800F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-1800f-series.pdf",
  "2600F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-2600f-series.pdf",
  "3000F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-3000f-series.pdf",
  "3200F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-3200f-series.pdf",
  "3500F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-3500f-series.pdf",
  "3700F-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-3700f-series.pdf",
  "3000G-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/pdf/fortigate-3000g-series.pdf",
  "3500G-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/pdf/fortigate-3500g-series.pdf",
  "3800G-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/pdf/fortigate-3800g-series.pdf",
  "4200F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/cd72e3b6-d679-11ea-96b9-00505692583a/FortiGate-4200F-Series-QSG-Supplement.pdf",
  "4400F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/5f9f3bd6-13c6-11eb-96b9-00505692583a/FortiGate-4400F-Series-Supplement.pdf",
  "4800F": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/5fa8d4ee-9cd4-11ed-8e6d-fa163e15d75b/FG-4800F-Series-QSG.pdf",
  "1100E-qsg": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/8505790d-a81f-11e9-81a4-00505692583a/FortiGate-1100E-ACDC-Series-Supplement-QSG.pdf",
  "1800F-qsg": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/1891095c-72e5-11ea-9384-00505692583a/FortiGate-1800F-Series-Supplement.pdf",
  "2600F-qsg": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c1ff9041-55c1-11eb-b9ad-00505692583a/FortiGate-2600F-Series-QSG.pdf",
  "3000F-qsg": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/db9d59f7-e1f0-11ec-bb32-fa163e15d75b/FG-3000F-QSG.pdf",
  "200E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/da490160-1a0a-11e9-9685-f8bc1258b856/FortiGate-200E-201E-QSG.pdf",
  "300E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ef689af9-1a12-11e9-9685-f8bc1258b856/FortiGate_300E-301E_Supplement.pdf",
  "400E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/8a2023c9-299c-11e9-94bf-00505692583a/FortiGate_400_401E_ACDC_Supplement_QSG.pdf",
  "500E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f10f67a8-1a12-11e9-9685-f8bc1258b856/FortiGate_500E-501E_Supplement.pdf",
  "600E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/186de9b7-1a21-11e9-9685-f8bc1258b856/FG-600E-Series-QSG.pdf",
  "50G-5G": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3a955901-cdf9-11ef-91d4-7a9b9721b752/FG-50G-5G-Series-QSG.pdf",
  "2201E-ACDC": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f20a50ba-df0d-11e9-8977-00505692583a/FG-2201E-ACDC-QSG.pdf",
  "3300E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/6816e10f-df0f-11e9-8977-00505692583a/FortiGate-3300E-QSG.pdf",
  "3400E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/f1bcf8ed-299c-11e9-94bf-00505692583a/FortiGate-340xE-Series-QSG-ACDC.pdf",
  "3600E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/91f40509-299d-11e9-94bf-00505692583a/FortiGate-3600E-Series-ACDC-Supplement.pdf",
  "3960E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e7c49731-1a12-11e9-9685-f8bc1258b856/FortiGate-3960E-3980E-ACDC-QSG-Supplement.pdf",
  "2200E-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/fortigate-2200e-series.pdf",
  "2500E-ds": "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/FortiGate_2500E.pdf",
  "2000E": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/30f0af8a-91f2-11f1-8c5a-8e4c95ff11ac/FortiGate-2000E-2500E-QSG.pdf",
  "400E-Bypass": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/92ffc448-af44-11eb-b70b-00505692583a/FortiGate-400E-BYPASS-QSG-Supplement.pdf",
  "800D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/90a1371d-1a0b-11e9-9685-f8bc1258b856/FortiGate-800D-Supplement.pdf",
  "900D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/cb4ad175-1a0b-11e9-9685-f8bc1258b856/FortiGate-900D-Supplement.pdf",
  "1000D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ae004e1f-1a0a-11e9-9685-f8bc1258b856/FortiGate-1000D-Supplement.pdf",
  "3000D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c0a5598b-1a0a-11e9-9685-f8bc1258b856/FortiGate-3000D-QSG-Supplement.pdf",
  "3100D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/c33905b5-1a0a-11e9-9685-f8bc1258b856/FortiGate-3100D-QSG-Supplement.pdf",
  "3200D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/b2956e69-1a0a-11e9-9685-f8bc1258b856/FortiGate-3200D-Supplement.pdf",
  "3700D": "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/a8cceba0-1a0a-11e9-9685-f8bc1258b856/FG-3700D-Supplement.pdf",
};

/** Resolve Fortinet catalog panels without treating unverified variants as exact hardware. */
export function resolveFortinetFaceplate(device) {
  if (device?.faceplate?.vendor !== "Fortinet") return null;
  const canonical = canonicalFaceplateDevice(device);
  if (!canonical) return null;
  if (!profiles.has(device.model)) profiles.set(device.model, buildFortinetProfile(canonical));
  return profiles.get(device.model);
}

/** Create a normalized decorative component; coordinates follow illustrations, not measured dimensions. */
function element(kind, x, y, width, height, label, variant) {
  return { kind, x, y, width, height, ...(label ? { label } : {}), ...(variant ? { variant } : {}),
    ...(kind === "text" ? { fontSize: 6 } : {}) };
}

/** Keep canonical identity on a socket while assigning its documented panel position. */
function slot(port, x, y, width = .027, height = .22) {
  return { label: port.label, type: port.type, portIndex: port.portIndex, x, y, width, height };
}

/** Reuse sourced catalog connector centers and shrink crowded socket envelopes to preserve clearance. */
function catalogSlots(ports, portWidth = .032) {
  return ports.map((port) => {
    const horizontal = ports.filter((other) => other !== port && Math.abs(other.faceplateY - port.faceplateY) < .22)
      .map((other) => Math.abs(other.faceplateX - port.faceplateX)).filter((distance) => distance > .001);
    const vertical = ports.filter((other) => other !== port && Math.abs(other.faceplateX - port.faceplateX) < .032)
      .map((other) => Math.abs(other.faceplateY - port.faceplateY)).filter((distance) => distance > .001);
    return slot(port, port.faceplateX, port.faceplateY, Math.min(portWidth, ...horizontal.map((distance) => distance * .75)),
      Math.min(.22, ...vertical.map((distance) => distance * .7)));
  });
}

/** Establish honest family coverage before applying narrower, inspected model overrides. */
function buildFortinetProfile({ catalog, device }) {
  const model = catalog.model;
  const rugged = model.includes("Rugged");
  const compact = /^(?:FortiGate [3456789]\d[FG]|FortiSwitch (?:108F|110G))/.test(model) ||
    catalog.category === "AccessPoint" || model.startsWith("FortiExtender");
  const documented = catalog.portLayout.positionFidelity === "exact";
  const source = /^https:\/\//.test(catalog.portLayout.source) ? catalog.portLayout.source : GUIDES.gate;
  const management = device.ports.filter((port) => /CONSOLE|MGMT/.test(port.group || "") || /CONSOLE|MGMT/i.test(port.label));
  const data = device.ports.filter((port) => !management.includes(port));
  const front = documented ? catalogSlots(device.ports, compact ? .052 : .032) : [
    ...layoutPanelPorts(management, { x: .045, y: .45, width: .15, height: .36 }, { rows: 2, portWidth: .035 }),
    ...layoutPanelPorts(data, { x: .25, y: .29, width: .70, height: .47 }, { rows: 2, portWidth: .037 }),
  ];
  const profile = {
    id: `fortinet-${model.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, defaultFace: "front",
    fidelity: "family", source, sourcePage: documented ? "Front-panel connector diagram (catalog reference)" : "Family hardware reference; schematic connector placement",
    connectorFidelity: documented ? "model" : "family", rearHardwareVerified: false,
    geometry: documented ? "catalog" : "schematic",
    chassis: { x: compact || rugged ? .175 : 0, y: .04, width: compact || rugged ? .65 : 1, height: .92 },
    faces: { front: { ports: front, components: [] }, rear: { ports: [], components: [
      element("text", .23, .40, .54, .16, "Rear hardware not verified"),
    ] } },
    limitations: [documented ? "Connector centers follow the catalog reference; rear hardware has not been independently traced." :
      "Connector grouping follows the catalog inventory; chassis, port face and positions are schematic. Rear hardware is unverified."],
    catalogDiscrepancies: [],
    inventoryComplete: null, missingPorts: [], panelsVerified: false,
    inventoryRevision: catalog.inventoryRevision || 0,
  };
  if (!documented && model.startsWith("FortiGate") && !rugged && catalog.fidelity !== "modular") {
    profile.faces.front.components = familyIndicators(["POWER", "STATUS", "HA"], .045, .16, .065);
    profile.limitations.push("Indicator placement is a FortiGate family schematic, not an exact revision-specific drawing.");
  }
  if (model === "FortiGate 40F-3G4G") add40FCellular(profile, device);
  else if (/^FortiGate 8[01]F-(?:Bypass|POE)$/.test(model)) add80FVariant(profile, device);
  else if (/^FortiGate (?:40F|6[01]F|7[01][FG]|8[01]F)(?:-|$)/.test(model)) addDesktopFamily(profile, device);
  else if (/^FortiSwitch 148F(?:-POE|-FPOE)?$/.test(model)) add148F(profile, device);
  else if (/^FortiSwitch 448E(?:-POE|-FPOE)?$/.test(model)) add448E(profile, device);
  else if (/^FortiSwitch (?:624F|648F)(?:-FPOE)?$/.test(model)) addCampusF(profile, device);
  else if (/^FortiGate 12[01]G$/.test(model)) add120G(profile, device);
  else if (/^FortiGate 9[01]G$/.test(model)) add90G(profile, device);
  else if (model === "FortiAP 231F") add231F(profile, device);
  else if (model === "FortiExtender 511F") add511F(profile, device);
  else if (/^FortiSwitch (?:224E|248E)(?:-POE|-FPOE)?$/.test(model)) addAccessE(profile, device);
  else if (/^FortiSwitch 424E(?:-Fiber|-POE|-FPOE)?$/.test(model)) add424E(profile, device);
  else if (/^FortiSwitch 124G(?:-FPOE)?$/.test(model)) add124G(profile, device);
  else if (/^FortiSwitch 1048[EG]$/.test(model)) add1048(profile, device);
  else if (model === "FortiSwitch 2048F") add2048F(profile, device);
  else if (/^FortiSwitch 3032[EG]$/.test(model)) add3032(profile, device);
  else if (/^FortiSwitch 5(?:24|48)D(?:-FPOE)?$/.test(model)) add500D(profile, device);
  else if (/^FortiSwitch 1(?:24|48)E(?:-POE|-FPOE)?$/.test(model)) add100E(profile, device);
  else if (/^FortiSwitch (?:T?1024E|T1024F-FPOE)$/.test(model)) add1024(profile, device);
  else if (model === "FortiSwitch 110G-FPOE") add110G(profile, device);
  else if (model === "FortiSwitch M426E-FPOE") addM426E(profile, device);
  else if (model === "FortiSwitch 248D") add248D(profile, device);
  else if (/^FortiSwitch 348G(?:-FPOE)?$/.test(model)) add348G(profile, device);
  else if (/^FortiSwitch 108F(?:-POE|-FPOE)?$/.test(model)) add108F(profile, device);
  else if (model === "FortiSwitch 224D-FPOE") add224D(profile, device);
  else if (/^FortiSwitch Rugged (?:108F|112F-POE)$/.test(model)) addRugged100F(profile, device);
  else if (model === "FortiSwitch Rugged 216F-POE") addRugged216F(profile, device);
  else if (model === "FortiSwitch Rugged 424F-POE") addRugged424F(profile, device);
  else if (/^FortiGate 3[01]G$/.test(model)) add30G(profile, device);
  else if (/^FortiGate 5[01]G$/.test(model)) add50G(profile, device);
  else if (/^FortiGate 20[01]G$/.test(model)) add200G(profile, device);
  else if (/^FortiGate [47]0[01]G$/.test(model)) add400700G(profile, device);
  else if (/^FortiGate 90[01]G(?:-DC)?$/.test(model)) add900G(profile, device);
  else if (/^FortiGate (?:50G-(?:SFP|DSL)|5[01]G-SFP-POE)$/.test(model)) add50GWiredVariant(profile, device);
  else if (/^FortiGate 40[01]F-DC$/.test(model)) add400FDC(profile, device);
  else if (/^FortiGate 100[01]F$/.test(model)) add1000F(profile, device);
  else if (/^FortiGate 110[01]E$/.test(model)) add1100E(profile, device);
  else if (/^FortiGate 180[01]F$/.test(model)) add1800F(profile, device);
  else if (/^FortiGate 260[01]F$/.test(model)) add2600F(profile, device);
  else if (/^FortiGate 300[01]F$/.test(model)) add3000F(profile, device);
  else if (/^FortiGate 320[01]F$/.test(model)) add3200F(profile, device);
  else if (/^FortiGate 350[01]F$/.test(model)) add3500F(profile, device);
  else if (/^FortiGate 370[01]F$/.test(model)) add3700F(profile, device);
  else if (/^FortiGate 300[01]G$/.test(model)) add3000G(profile, device);
  else if (/^FortiGate 350[01]G$/.test(model)) add3500G(profile, device);
  else if (/^FortiGate 380[01]G$/.test(model)) add3800G(profile, device);
  else if (/^FortiGate (?:420[01]F|440[01]F)(?:-DC)?$/.test(model)) add42004400F(profile, device);
  else if (/^FortiGate 480[01]F(?:-DC)?(?:-NEBS)?$/.test(model)) add4800F(profile, device);
  else if (/^FortiGate (?:1100E|180[01]F|260[01]F|300[01]F)-DC$/.test(model)) addTerminalDC(profile, device);
  else if (/^FortiGate 20[01]E$/.test(model)) add200E(profile, device);
  else if (/^FortiGate (?:[3456]0[01]E|401E-DC)$/.test(model)) addLegacyRackE(profile, device);
  else if (/^FortiGate 5[01]G-5G$/.test(model)) add50GCellular(profile, device);
  else if (model === "FortiGate 2201E-ACDC" || /^FortiGate (?:220[01]E|330[01]E)$/.test(model)) add22013300E(profile, device);
  else if (/^FortiGate (?:340[01]E(?:-DC)?|360[01]E|3600E-DC)$/.test(model)) add34003600E(profile, device);
  else if (/^FortiGate 39[68]0E(?:-DC)?$/.test(model)) add39603980E(profile, device);
  else if (/^FortiGate (?:2000E|2500E)$/.test(model)) add20002500E(profile, device);
  else if (model === "FortiGate 400E-Bypass") add400EBypass(profile, device);
  else if (/^FortiGate 800D(?:-DC)?$/.test(model)) add800D(profile, device);
  else if (/^FortiGate (?:900D|1000D)$/.test(model)) add9001000D(profile, device);
  else if (/^FortiGate 3[012]00D(?:-DC)?$/.test(model)) add300031003200D(profile, device);
  else if (/^FortiGate 3700D(?:-DC)?$/.test(model)) add3700D(profile, device);
  if (/^FortiGate (?:180[01]F(?:-DC)?|350[01]F)$/.test(model)) profile.legacyLayouts = [{ inventoryRevision: 0,
    portIndexMap: Object.fromEntries(device.ports.map((port) => [port.portIndex, port.portIndex])) }];
  if (/^FortiGate 300[01](?:G|F(?:-(?:ACDC|DC))?)$/.test(model)) profile.legacyLayouts = [{ inventoryRevision: 0,
    portIndexMap: Object.fromEntries(device.ports.map((port) => [port.portIndex <= 18 ? port.portIndex : port.portIndex + 2, port.portIndex])) }];
  if (/^FortiGate 420[01]F(?:-DC)?$/.test(model)) profile.legacyLayouts = [{ inventoryRevision: 0,
    portIndexMap: Object.fromEntries(device.ports.filter((port) => ![21, 22].includes(port.portIndex))
      .map((port) => [port.portIndex > 22 ? port.portIndex - 2 : port.portIndex, port.portIndex])) }];
  addLegacyEMapping(profile, device);
  addLegacyDMapping(profile, device);
  const units = Math.max(1, Number(catalog.units) || 1);
  for (const face of Object.values(profile.faces)) {
    for (const port of face.ports) port.height = Math.min(port.height, .24 / units);
  }
  if (catalog.fidelity === "modular") addModularRegion(profile, device, units);
  if (profile.panelsVerified) recordMissingPorts(profile, device);
  return profile;
}

/** Describe omitted sockets without silently adding endpoints or changing the persisted catalog inventory. */
function recordMissingPorts(profile, device) {
  for (const [faceName, face] of Object.entries(profile.faces)) {
    const missing = face.components.filter((component) => component.kind === "console" ||
      (/^FortiGate 9[01]G$/.test(device.model) && component.kind === "rj45"));
    for (const [index, component] of missing.entries()) profile.missingPorts.push({
      model: device.model, existingCount: device.ports.length,
      type: component.kind === "console" ? "Console" : "RJ45_10G",
      label: component.kind === "console" ? "CONSOLE" : `WAN${index + 1} / X${index + 1} (shared copper; revision-dependent label)`,
      face: faceName, slot: { x: component.x + component.width / 2, y: component.y + component.height / 2,
        width: component.width, height: component.height },
    });
  }
}

/** Represent a modular chassis region without claiming an unverified module or power-supply count. */
function addModularRegion(profile, device, units) {
  profile.faces.front.ports = layoutPanelPorts(device.ports, { x: .045, y: .07, width: .14, height: Math.min(.38, .72 / units) },
    { rows: 2, portWidth: .035, portHeight: .24 / units });
  profile.faces.front.components.push(element("module-bay", .245, .14, .67, .72, "MODULE AREA", "blank"));
  profile.limitations.push("The module area is schematic; installed cards, slot count and populated module ports require the exact chassis configuration.");
}

/** Keep family status labels separate from small indicator artwork. */
function familyIndicators(labels, x, y, step) {
  return labels.flatMap((label, index) => [element("led", x + index * step, y, .008, .045),
    element("text", x + index * step - .023, y - .105, .056, .08, label)]);
}

/** Apply the documented connector-bearing rear face across the 40/60/70/80 desktop families. */
function addDesktopFamily(profile, device) {
  profile.defaultFace = "rear";
  profile.faces.rear.ports = profile.faces.front.ports;
  profile.faces.rear.components = [];
  profile.faces.front.ports = [];
  profile.faces.front.components = familyIndicators(["POWER", "STATUS", "HA"], .29, .65, .095);
  const count = device.ports.filter((port) => port.type !== "Console").length;
  profile.faces.front.components.push(element("text", .60, .24, .32, .13, "LINK / ACT"));
  for (let index = 0; index < count; index++) {
    const x = .60 + index * .30 / Math.max(1, count - 1);
    profile.faces.front.components.push(element("led", x, .47, .007, .045), element("led", x, .65, .007, .045));
  }
  profile.limitations = ["The family has rear network connectors and front status indicators. Power, radio and revision-specific controls are omitted until the exact variant is traced."];
}

/** Mark panels inspected in a particular guide while recording catalog limitations separately. */
function inspected(profile, guide, page, discrepancies = []) {
  profile.source = GUIDES[guide];
  profile.sourcePage = `PDF ${page}`;
  profile.fidelity = discrepancies.length ? "family" : "model";
  profile.connectorFidelity = "model";
  profile.geometry = "illustration";
  profile.rearHardwareVerified = true;
  profile.limitations = [];
  profile.catalogDiscrepancies = discrepancies;
  profile.inventoryComplete = discrepancies.length === 0;
  profile.panelsVerified = true;
}

/** Draw four twelve-port banks and two optical columns shared by inspected 48-port access models. */
function access48Slots(ports) {
  return ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < 48) {
      const column = Math.floor(index / 2);
      return slot(port, .112 + column * .0318 + Math.floor(column / 6) * .012, index % 2 ? .68 : .4, .024);
    }
    if (index < 52) return slot(port, index < 50 ? .936 : .969, index % 2 ? .68 : .4, .025);
    return slot(port, .035, .43, .03);
  });
}

/** Compose all three 148F variants, whose rear AC inlet position differs by PoE capability. */
function add148F(profile, device) {
  const suffix = device.model.slice("FortiSwitch 148F".length);
  inspected(profile, "148F", suffix === "-POE" ? "6–7" : suffix === "-FPOE" ? "8–9" : "4–5");
  profile.faces.front.ports = access48Slots(device.ports);
  profile.faces.front.components = [element("usb", .02, .69, .03, .14, undefined, "a"),
    element("led", .076, .42, .005, .045), element("led", .076, .61, .005, .045)];
  profile.faces.rear.components = [element("power", suffix ? .30 : .79, .26, suffix ? .075 : .11, .54, "AC", "ac")];
}

/** Preserve the 448E inventory while showing its documented rear console as an ancillary connector. */
function add448E(profile, device) {
  const suffix = device.model.slice("FortiSwitch 448E".length);
  inspected(profile, "448E", suffix === "-POE" ? "5–6" : suffix === "-FPOE" ? "7–8" : "3–4",
    ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.faces.front.ports = access48Slots(device.ports);
  profile.faces.front.components = [element("usb", .02, .69, .03, .14, undefined, "a"),
    element("led", .076, .42, .005, .045), element("led", .076, .61, .005, .045)];
  profile.faces.rear.components = [element("console", .175, .43, .034, .30, "CONSOLE"),
    element("fan", .277, .13, .09, .73, undefined, "fixed"), element("fan", .39, .13, .09, .73, undefined, "fixed"),
    element("power", .565, .28, .105, .52, "PSU1", "ac"), element("power", .75, .28, .105, .52, "PSU2", "ac")];
  profile.fidelity = "model";
}

/** Compose the inspected 624F and 648F front banks and their distinct three/four-fan rear panels. */
function addCampusF(profile, device) {
  const large = device.model.startsWith("FortiSwitch 648F");
  const count = large ? 48 : 24;
  inspected(profile, "624F", large ? "8–9" : "6–7");
  profile.faces.front.ports = device.ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < count) {
      const column = Math.floor(index / 2);
      const x = large ? .03 + column * .032 + Math.floor(column / 8) * .012 :
        .415 + column * .032 + (column >= 4 ? .019 : 0);
      return slot(port, x, index % 2 ? .69 : .4, .025);
    }
    if (index < count + (large ? 8 : 4)) {
      return slot(port, (large ? .824 : .836) + Math.floor((index - count) / 2) * .032,
        index % 2 ? .69 : .4, .025);
    }
    return slot(port, .961, port.type === "Console" ? .76 : .30, .03, .20);
  });
  profile.faces.front.components = [element("usb", .946, .48, .03, .12, undefined, "a")];
  profile.faces.rear.components = [
    element("coax", .047, .67, .017, .14, "1PPS IN"), element("coax", .074, .67, .017, .14, "1PPS OUT"),
    ...Array.from({ length: large ? 4 : 3 }, (_, index) => element("fan", .146 + index * .11, .12, .087, .74, undefined, "fixed")),
    element("psu", .62, .05, .167, .90, "PSU1", "ac"), element("psu", .812, .05, .167, .90, "PSU2", "ac"),
  ];
}

/** Locate the 120G family's ports independently of its catalog's older sequential naming. */
function add120G(profile, device) {
  inspected(profile, "120G", "4–6", ["Catalog sequential labels do not match HA/MGMT, ports 1–24 and X1–X4; existing labels are preserved."]);
  profile.fidelity = "model";
  profile.inventoryComplete = true;
  profile.hardwareRevision = "Pxxxxx-2x-01 and above";
  profile.limitations.push("The signed-firmware switch cover follows Pxxxxx-2x-01 and above; earlier revisions omit that covered control.");
  profile.faces.front.ports = device.ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < 2) return slot(port, .321, index % 2 ? .70 : .40);
    if (index < 18) {
      const column = Math.floor((index - 2) / 2);
      return slot(port, .372 + column * .0335 + (column >= 4 ? .030 : 0), index % 2 ? .70 : .40);
    }
    if (index < 26) return slot(port, .762 + Math.floor((index - 18) / 2) * .0335, index % 2 ? .70 : .40);
    if (index < 30) return slot(port, .686 + Math.floor((index - 26) / 2) * .034, index % 2 ? .70 : .40);
    return slot(port, .27, .65);
  }).map((port, index) => ({ ...port, physicalLabel: index < 2 ? ["HA", "MGMT"][index] : index < 18 ? String(index - 1) :
    index < 26 ? String(index - 1) : index < 30 ? `X${index - 25}` : "CONSOLE" }));
  profile.faces.front.components = [element("usb", .23, .50, .014, .29, undefined, "a"),
    element("module-bay", .105, .51, .018, .40, "", "blank"),
    element("led", .141, .72, .005, .04), element("button", .175, .70, .006, .04, undefined, "reset"),
    element("vent", .497, .22, .020, .62, undefined, "slots"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .199, .48 + index * .10, .005, .04),
      element("text", .13, .45 + index * .10, .058, .10, label),
    ])];
  profile.faces.rear.components = [element("power", .095, .31, .074, .50, "PSU1", "ac"),
    element("power", .835, .31, .074, .50, "PSU2", "ac"), element("vent", .393, .14, .185, .73, undefined, "perforated")];
}

/** Draw 90G connector positions while exposing its missing shared-media catalog sockets. */
function add90G(profile, device) {
  inspected(profile, "90G", "4–6", ["The catalog omits two shared 10G RJ45 sockets and labels A/B as 7/8. Ancillary shared sockets have no connection endpoints."]);
  profile.fidelity = "model";
  profile.hardwareRevision = "Pxxxxx-11-01 and above";
  profile.limitations.push("The signed-firmware cover and X1/X2 labels follow Pxxxxx-11-01 and above; earlier revisions use WAN1/WAN2 and omit that control.");
  profile.faces.front.ports = device.ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < 8) return slot(port, .565 + Math.floor(index / 2) * .065, index % 2 ? .68 : .34, .052, .25);
    if (index < 10) return slot(port, .32, index % 2 ? .68 : .34, .055, .25);
    return slot(port, .222, .44, .055, .25);
  }).map((port, index) => ({ ...port, physicalLabel: index < 6 ? String(index + 1) : index < 8 ? ["A", "B"][index - 6] :
    index < 10 ? `SFP+${index - 7}` : "CONSOLE" }));
  profile.faces.front.components = [element("usb", .194, .71, .055, .16, undefined, "a"),
    element("rj45", .409, .215, .055, .25, "X1"), element("rj45", .409, .555, .055, .25, "X2"),
    element("module-bay", .91, .215, .043, .22, "", "blank"),
    element("led", .878, .84, .012, .05), element("button", .065, .74, .011, .05, undefined, "reset"),
    element("text", .393, .855, .088, .11, "SHARED"),
    element("led", .13, .70, .012, .07), element("led", .154, .70, .012, .07), element("led", .13, .56, .012, .07)];
  profile.faces.rear.components = [element("vent", .075, .17, .65, .16, undefined, "slots"),
    element("vent", .075, .47, .65, .30, undefined, "slots"),
    element("power", .835, .38, .032, .45, "DC1", "dc-keyed2"), element("power", .897, .38, .032, .45, "DC2", "dc-keyed2")];
}

/** Project the 231F underside connector edge and front indicator strip without inventing a console endpoint. */
function add231F(profile, device) {
  inspected(profile, "231F", "3–4", ["Catalog ETH0/ETH1 correspond to LAN1/PoE and LAN2. The separate RJ45 console is absent from inventory."]);
  profile.defaultFace = "rear";
  profile.limitations.push("The mounting underside and its connector edge are projected into one rear diagram; dimensions are schematic.");
  profile.chassis = { x: .30, y: .04, width: .40, height: .92 };
  profile.faces.front = { ports: [], components: [element("text", .2, .30, .6, .15, "FortiAP 231F"),
    ...familyIndicators(["PWR", "LAN1", "LAN2", "WIFI", "BLE"], .28, .68, .105)] };
  profile.faces.rear = { ports: device.ports.map((port, index) => slot(port, index ? .55 : .71, .73, .075, .21)),
    components: [element("vent", .07, .23, .14, .61, undefined, "slots"),
      element("vent", .82, .23, .11, .61, undefined, "slots"),
      element("module-bay", .28, .23, .45, .30, "MOUNT", "blank"),
      element("console", .352, .625, .075, .21), element("power", .245, .68, .047, .13, undefined, "dc-barrel"),
      element("usb", .44, .04, .12, .11, undefined, "a")] };
}

/** Draw the 511F Ethernet edge and opposite SIM/Bluetooth panel from its illustrated QSG. */
function add511F(profile, device) {
  inspected(profile, "511F", "4–5", ["The catalog omits the separate RJ45 console; it is shown as an ancillary connector."]);
  profile.fidelity = "model";
  profile.limitations.push("The two opposite connector/control edges are the front and rear views. Antenna connectors on a third edge and the top-face cellular indicators are outside these two side-panel projections.");
  profile.faces.front.ports = device.ports.map((port, index) => slot(port,
    index < 4 ? .526 + index * .078 : index === 4 ? .446 : .337, .56, .066, .24));
  profile.faces.front.components = [element("console", .135, .44, .075, .24),
    element("usb", .240, .35, .028, .36, undefined, "a"),
    element("power", .834, .39, .05, .32, "12V", "dc-barrel"),
    element("led", .329, .34, .012, .045)];
  profile.faces.rear.components = [element("module-bay", .453, .39, .313, .50, "SIM", "blank"),
    element("button", .263, .43, .126, .43, "BLUETOOTH"),
    element("led", .304, .41, .035, .045),
    element("button", .825, .54, .012, .075, undefined, "reset"),
    element("text", .79, .75, .10, .10, "RESET"),
    element("module-bay", .156, .54, .039, .075, "", "blank")];
}

/** Trace 224E/248E access panels, including their omitted rear console and variant-specific power connections. */
function addAccessE(profile, device) {
  const large = device.model.startsWith("FortiSwitch 248E");
  const poe = device.model.includes("POE");
  const count = large ? 48 : 24;
  inspected(profile, large ? "248E" : "224E", device.model.endsWith("FPOE") || (!large && poe) ? "8" : "7",
    ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.faces.front.ports = device.ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < count) {
      const column = Math.floor(index / 2);
      return slot(port, large ? .123 + column * .033 + Math.floor(column / 12) * .012 :
        .23 + column * .0485 + (column >= 6 ? .025 : 0), index % 2 ? .70 : .43, large ? .025 : .040);
    }
    if (index < count + 4) return slot(port, (large ? .937 : .86) + Math.floor((index - count) / 2) * (large ? .032 : .083),
      index % 2 ? .70 : .43, large ? .025 : .040);
    return slot(port, large ? .04 : .05, .63, .034);
  });
  profile.faces.front.components = [element("led", large ? .075 : .125, .27, .005, .04),
    element("led", large ? .075 : .125, .38, .005, .04), element("led", large ? .075 : .125, .63, .005, .04)];
  profile.faces.rear.components = [element("console", large ? .88 : .065, .50, .04, .30, "CONSOLE"),
    element("power", large ? .16 : .83, .28, .10, .53, "AC", "ac")];
  if (poe) {
    profile.faces.rear.components.push(element("module-bay", large ? .70 : .15, .46, large ? .16 : .21, .36, "RPS", "blank"));
    profile.limitations.push("The remote-power connector is shown as a labeled region; its multipin contact pattern is not modeled.");
  } else profile.faces.rear.components.push(element("power", .615, .28, .10, .53, "AC", "ac"));
  profile.fidelity = "model";
}

/** Trace the 424E family's rear console and the distinct zero/one/two rear fan arrangements. */
function add424E(profile, device) {
  const fiber = device.model.endsWith("Fiber");
  const poe = device.model.includes("POE");
  inspected(profile, "424E", "3–4", ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.faces.front.ports = device.ports.map((port) => {
    const index = port.portIndex - 1;
    if (index < 24) {
      const column = Math.floor(index / 2);
      return slot(port, (fiber ? .438 : .427) + column * .0325 + Math.floor(column / (fiber ? 4 : 6)) * .010,
        index % 2 ? .68 : .38, .027);
    }
    if (index < 28) return slot(port, .855 + (index - 24) * .0325, .70, .027);
    return slot(port, .031, .43, .033);
  });
  profile.faces.front.components = [element("usb", .015, .69, .033, .14, undefined, "a"),
    ...[0, 1, 2, 3].map((index) => element("led", .085, .32 + index * .12, .005, .04))];
  profile.faces.rear.components = [element("console", poe ? .067 : fiber ? .167 : .136, .47, .035, .32, "CONSOLE"),
    element("power", poe ? .34 : fiber ? .66 : .615, .24, .105, .54, "PSU1", "ac"),
    element("power", poe ? .852 : .80, .24, .105, .54, "PSU2", "ac")];
  if (poe) profile.faces.rear.components.push(element("fan", .55, .08, .09, .82, undefined, "fixed"),
    element("fan", .743, .08, .09, .82, undefined, "fixed"));
  else if (!fiber) profile.faces.rear.components.push(element("fan", .232, .08, .09, .82, undefined, "fixed"));
  profile.fidelity = "model";
}

/** Trace the 124G and 124G-FPOE's three copper banks, six uplinks and fanless rear panels. */
function add124G(profile, device) {
  const poe = device.model.endsWith("FPOE");
  inspected(profile, "124G", poe ? "7–8" : "5–6");
  profile.faces.front.ports = device.ports.map((port) => {
    const index = Number(port.label) - 1;
    if (port.type === "Console") return slot(port, .213, .65, .033);
    if (index < 24) return slot(port, .318 + Math.floor(index / 2) * .036 + Math.floor(index / 8) * .010,
      index % 2 ? .68 : .34, .030);
    return slot(port, .877 + Math.floor((index - 24) / 2) * .043, index % 2 ? .68 : .34, .033);
  });
  profile.faces.front.components = [element("usb", .774, .49, .015, .30, undefined, "a"),
    element("led", .282, .75, .005, .05),
    ...["PWR", "ALARM", "BT/BLE", ...(poe ? ["POE MAX"] : [])].flatMap((label, index) => [
      element("led", .242, .39 + index * .12, .005, .04),
      element("text", .251, .35 + index * .12, .052, .09, label),
    ])];
  profile.faces.rear.components = [element("power", .85, .26, .11, .54, "AC", "ac")];
}

/** Compose the independently traced 1048E and 1048G layouts with their different management sides and fan counts. */
function add1048(profile, device) {
  const generationG = device.model.endsWith("G");
  inspected(profile, generationG ? "1048G" : "1048E", generationG ? "6–7" : "8");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT" || port.type === "Console") return slot(port, generationG ? .029 : .971,
      generationG ? (port.type === "Console" ? .24 : .74) : (port.type === "Console" ? .72 : .35), .030);
    const index = Number(port.label) - 1;
    if (index < 48) {
      const column = Math.floor(index / 2);
      return slot(port, generationG ? .074 + column * .0327 + Math.floor(column / 8) * .006 :
        .025 + column * .0324 + Math.floor(column / 6) * .004, index % 2 ? .68 : .36, .026);
    }
    return slot(port, (generationG ? .876 : .839) + Math.floor((index - 48) / 2) * (generationG ? .043 : .044),
      index % 2 ? .68 : .36, .035);
  });
  profile.faces.front.components = generationG ? [element("usb", .014, .45, .032, .12, undefined, "a"),
    element("vent", .14, .025, .714, .14, undefined, "mesh"),
    ...[0, 1, 2, 3].map((index) => element("led", .064 + index * .013, .12, .004, .04))] :
    [element("vent", .07, .035, .70, .07, undefined, "mesh")];
  profile.faces.rear.components = [element("psu", .045, .03, .168, .94, "PSU2", "ac"),
    element("psu", generationG ? .783 : .787, .03, .168, .94, "PSU1", "ac"),
    ...Array.from({ length: generationG ? 5 : 4 }, (_, index) => element("fan", .225 + index * .11, .035, .102, .93, undefined, "removable"))];
  if (!generationG) profile.faces.rear.components.push(element("usb", .695, .55, .026, .13, undefined, "a"));
}

/** Trace the 2048F's three-row SFP28 groups, lower QSFP rows and six removable fan modules. */
function add2048F(profile, device) {
  inspected(profile, "2048F", "6–7");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT" || port.type === "Console") return slot(port, .953, port.type === "Console" ? .52 : .18, .034, .22);
    const index = Number(port.label) - 1;
    if (index < 48) {
      const column = Math.floor(index / 3);
      return slot(port, .055 + column * .0335 + Math.floor(column / 2) * .0096,
        [.18, .52, .83][index % 3], .030, .19);
    }
    if (index < 56) return slot(port, .718 + Math.floor((index - 48) / 2) * .045 + Math.floor((index - 48) / 4) * .010,
      index % 2 ? .83 : .52, .040, .19);
    return slot(port, .908, index % 2 ? .52 : .18, .032, .20);
  });
  profile.faces.front.components = [element("usb", .892, .76, .032, .12, undefined, "a"),
    ...[0, 1, 2].map((index) => element("led", .026, .36 + index * .075, .004, .04)),
    element("vent", .002, .20, .018, .68, undefined, "mesh"),
    element("vent", .978, .20, .018, .68, undefined, "mesh")];
  profile.faces.rear.components = [element("psu", .035, .02, .125, .96, "PSU2", "ac"),
    element("psu", .84, .02, .125, .96, "PSU1", "ac"),
    ...Array.from({ length: 6 }, (_, index) => element("fan", .176 + index * .111, .025, .098, .95, undefined, "removable"))];
}

/** Trace both 3032 generations without copying the G model's extra SFP+ pair onto the E model. */
function add3032(profile, device) {
  const generationG = device.model.endsWith("G");
  inspected(profile, generationG ? "3032G" : "3032E", generationG ? "6–7" : "7–8");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT" || port.type === "Console") return slot(port, generationG ? .886 : .876,
      port.type === "Console" ? .68 : .30, .033);
    const index = Number(port.label) - 1;
    if (index >= 32) return slot(port, .075, index % 2 ? .64 : .34, .033);
    const column = Math.floor(index / 2);
    return slot(port, (generationG ? .123 : .122) + column * .043 + Math.floor(column / 4) * .015,
      index % 2 ? .64 : .34, .038);
  });
  profile.faces.front.components = [element("usb", generationG ? .942 : .935, .42, .016, .32, undefined, "a"),
    element("vent", .10, .02, .76, .11, undefined, "mesh"),
    element("vent", .025, .59, .025, .30, undefined, "mesh"),
    ...[0, 1, 2, 3].map((index) => element("led", generationG ? .911 : .902, .15 + index * .22, .005, .05))];
  profile.faces.rear.components = [element("psu", .045, .025, .17, .95, "PSU2", "ac"),
    element("psu", .785, .025, .17, .95, "PSU1", "ac"),
    ...Array.from({ length: 5 }, (_, index) => element("fan", .225 + index * .111, .025, .101, .95, undefined, "removable"))];
}

/** Trace the 524D and 548D's copper groups and standard one-PSU configuration with optional second bay. */
function add500D(profile, device) {
  const large = device.model.startsWith("FortiSwitch 548D");
  const poe = device.model.endsWith("FPOE");
  const count = large ? 48 : 24;
  inspected(profile, large ? "548D" : "524D", poe ? "8" : "9");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT") return slot(port, .038, .69, .033);
    if (port.type === "USB_MICRO_CONSOLE") return slot(port, .038, .91, .027, .065);
    const index = Number(port.label) - 1;
    if (index < count) {
      const column = Math.floor(index / 2);
      return slot(port, .081 + column * .0334 + Math.floor(column / 6) * .004, index % 2 ? .73 : .44, .026);
    }
    if (index < count + 4) return slot(port, .889 + Math.floor((index - count) / 2) * .032, index % 2 ? .73 : .44, .027);
    return slot(port, .968, index % 2 ? .73 : .44, .033);
  });
  profile.faces.front.components = [element("module-bay", .02, .12, .033, .16, "ID", "blank"),
    element("vent", .21, .025, .73, .13, undefined, "perforated"),
    ...[0, 1, 2, 3].map((index) => element("led", .119 + index * .017, .13, .005, .045))];
  profile.faces.rear.components = [element("fan", .223, .06, .09, .83, undefined, "fixed"),
    element("module-bay", .59, .025, .205, .95, "PSU2 OPTIONAL", "blank"),
    element("psu", .806, .025, .168, .95, "PSU1", "ac")];
  profile.limitations.push("The guide's standard configuration is shown: one installed PSU and the optional second PSU bay blank.");
}

/** Trace the 100E access variants, including the 124E base model's distinct console position and rear power side. */
function add100E(profile, device) {
  const large = device.model.startsWith("FortiSwitch 148E");
  const poe = device.model.includes("POE");
  const count = large ? 48 : 24;
  inspected(profile, large ? "148E" : "124E", device.model.endsWith("FPOE") ? "9" : poe ? "8" : "7");
  if (!large && !poe) profile.chassis = { x: .125, y: .04, width: .75, height: .92 };
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.type === "Console") return slot(port, large ? .035 : poe ? .055 : .233, .66, large ? .033 : .040);
    const index = Number(port.label) - 1;
    if (index < count) {
      const column = Math.floor(index / 2);
      const x = large ? .115 + column * .0333 + Math.floor(column / 12) * .011 :
        poe ? .445 + column * .0333 + (column >= 6 ? .025 : 0) : .300 + column * .043 + (column >= 6 ? .010 : 0);
      return slot(port, x, index % 2 ? .66 : .35, large || poe ? .027 : .035);
    }
    return slot(port, (large ? .932 : poe ? .90 : .864) + Math.floor((index - count) / 2) * (large ? .035 : poe ? .060 : .080),
      index % 2 ? .66 : .35, large || poe ? .027 : .035);
  });
  profile.faces.front.components = [element("led", large ? .069 : poe ? .112 : .072, .44, .005, .04),
    element("led", large ? .069 : poe ? .112 : .072, .57, .005, .04)];
  if (poe) profile.faces.front.components.push(element("led", large ? .069 : .112, .70, .005, .04));
  profile.faces.rear.components = [element("power", !large && !poe ? .762 : .047, .30, .105, .55, "AC", "ac")];
}

/** Trace the 1024E, T1024E and T1024F-FPOE guides, preserving each model's connector media and PSU size. */
function add1024(profile, device) {
  const generationF = device.model.includes("1024F");
  const copper = device.model.includes("T1024");
  inspected(profile, generationF ? "T1024F" : "1024E", generationF ? "5–6" : copper ? "7" : "6");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT" || port.type === "Console") return slot(port, .897, port.type === "Console" ? .67 : .32, .032);
    const index = Number(port.label) - 1;
    if (index < 24) return slot(port, .424 + Math.floor(index / 2) * .032 + (index >= 12 ? .018 : 0),
      index % 2 ? .67 : .32, .028);
    return slot(port, .845, index % 2 ? .67 : .32, .040);
  });
  profile.faces.front.components = [element("usb", .923, .48, .014, .28, undefined, "a"),
    element("vent", .40, .02, .52, .12, undefined, "mesh"), element("vent", .40, .87, .52, .10, undefined, "mesh"),
    ...Array.from({ length: generationF ? 5 : 4 }, (_, index) => element("led", .947, .34 + index * .12, .005, .04))];
  profile.faces.rear.components = [element("fan", .198, .025, .108, .95, undefined, "removable"),
    element("fan", .314, .025, .108, .95, undefined, "removable"),
    element("psu", generationF ? .62 : .715, .025, generationF ? .17 : .125, .95, "PSU2", "ac"),
    element("psu", generationF ? .800 : .855, .025, generationF ? .17 : .125, .95, "PSU1", "ac")];
}

/** Trace the 110G-FPOE's separate 5G pair and keyed four-contact power inlet. */
function add110G(profile, device) {
  inspected(profile, "110G", "5–6");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.type === "Console") return slot(port, .353, .65, .056);
    const index = Number(port.label) - 1;
    if (index < 8) return slot(port, .486 + Math.floor(index / 2) * .059, index % 2 ? .67 : .34, .050);
    if (index < 10) return slot(port, .748, index % 2 ? .67 : .34, .050);
    return slot(port, .866 + Math.floor((index - 10) / 2) * .074, index % 2 ? .67 : .34, .055);
  });
  profile.faces.front.components = [element("usb", .41, .50, .023, .30, undefined, "a"),
    element("led", .207, .71, .009, .05),
    ...["PWR", "ALARM", "BT/BLE", "POE MAX"].flatMap((label, index) => [element("led", .245, .39 + index * .12, .008, .04),
      element("text", .258, .35 + index * .12, .061, .095, label)])];
  profile.faces.rear.components = [element("vent", .05, .15, .70, .64, undefined, "perforated"),
    element("power", .853, .46, .038, .35, "54V", "dc-keyed4")];
}

/** Trace the M426E-FPOE's mixed copper banks and its three-fan rear panel with omitted console endpoint. */
function addM426E(profile, device) {
  inspected(profile, "M426E", "3", ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.fidelity = "model";
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT") return slot(port, .038, .42, .034);
    const index = Number(port.label) - 1;
    if (index < 24) return slot(port, .352 + Math.floor(index / 2) * .0365 + Math.floor(index / 8) * .008,
      index % 2 ? .68 : .36, .029);
    if (index < 26) return slot(port, .812, index % 2 ? .68 : .36, .029);
    return slot(port, .856 + (index - 26) * .032, .69, .027);
  });
  profile.faces.front.components = [element("usb", .021, .66, .034, .14, undefined, "a"),
    ...[0, 1, 2, 3].map((index) => element("led", .085, .35 + index * .12, .005, .04))];
  profile.faces.rear.components = [element("console", .068, .50, .035, .30, "CONSOLE"),
    ...[.188, .553, .747].map((x) => element("fan", x, .06, .09, .83, undefined, "fixed")),
    element("power", .343, .24, .105, .55, "PSU1", "ac"), element("power", .854, .24, .105, .55, "PSU2", "ac")];
}

/** Trace the 248D's two copper banks, rear console and single fixed AC inlet. */
function add248D(profile, device) {
  inspected(profile, "248D", "7", ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.fidelity = "model";
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT") return slot(port, .038, .63, .034);
    const index = Number(port.label) - 1;
    if (index < 48) return slot(port, .12 + Math.floor(index / 2) * .033 + (index >= 24 ? .014 : 0),
      index % 2 ? .68 : .40, .026);
    return slot(port, .932 + Math.floor((index - 48) / 2) * .035, index % 2 ? .68 : .40, .027);
  });
  profile.faces.front.components = [element("led", .072, .20, .005, .04), element("led", .072, .30, .005, .04),
    element("led", .072, .61, .005, .04)];
  profile.faces.rear.components = [element("console", .136, .47, .037, .31, "CONSOLE"),
    element("power", .60, .24, .115, .55, "AC", "ac")];
}

/** Trace the 348G variants' mixed copper banks, signed-firmware slider and distinct rear cooling arrangements. */
function add348G(profile, device) {
  const poe = device.model.endsWith("FPOE");
  inspected(profile, "348G", poe ? "7–8" : "5–6");
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT" || port.type === "Console") return slot(port, .963, port.type === "Console" ? .76 : .25, .033, .22);
    const index = Number(port.label) - 1;
    if (index < 48) return slot(port, .034 + Math.floor(index / 2) * .0325 + Math.floor(index / 12) * .010,
      index % 2 ? .68 : .35, .027);
    return slot(port, .846 + Math.floor((index - 48) / 2) * .034, index % 2 ? .68 : .35, .029);
  });
  profile.faces.front.components = [element("usb", .947, .465, .030, .10, undefined, "a"),
    element("button", .907, .48, .011, .09, undefined, "reset"),
    element("switch", .927, .46, .016, .06, undefined, "firmware-slider"),
    element("vent", .374, .015, .521, .065, undefined, "slots"),
    ...Array.from({ length: poe ? 4 : 3 }, (_, index) => element("led", .928, .13 + index * .075, .004, .03))];
  profile.faces.rear.components = [
    ...(poe ? [.185, .552, .651, .750] : [.278, .377]).map((x) => element("fan", x, .07, .09, .83, undefined, "fixed")),
    element("power", poe ? .358 : .568, .26, .115, .54, "PSU1", "ac"),
    element("power", poe ? .868 : .752, .26, .115, .54, "PSU2", "ac")];
}

/** Trace each 108F variant, including the base model's rear console and single-row network sockets. */
function add108F(profile, device) {
  const poe = device.model.includes("POE");
  inspected(profile, "108F", device.model.endsWith("FPOE") ? "7–8" : poe ? "5–6" : "3–4");
  profile.faces.front.ports = device.ports.filter((port) => poe || port.type !== "Console").map((port) => {
    if (port.type === "Console") return slot(port, .181, .60, .060);
    const index = Number(port.label) - 1;
    if (index < 8) return slot(port, (poe ? .266 : .162) + index * (poe ? .064 : .079) +
      (index >= 4 ? .020 : 0), poe ? .60 : .52, poe ? .053 : .065);
    return slot(port, (poe ? .84 : .843) + (index - 8) * (poe ? .062 : .082), poe ? .60 : .52, poe ? .055 : .070);
  });
  profile.faces.front.components = [element("button", poe ? .055 : .048, .72, .014, .08, undefined, "reset"),
    ...Array.from({ length: poe ? 3 : 2 }, (_, index) => element("led", .087, (poe ? .47 : .41) + index * (poe ? .12 : .21), .008, .05))];
  profile.faces.rear.components = [poe ? element("power", .658, .27, .20, .52, "AC", "ac") :
    element("power", .151, .20, .032, .57, "12V", "dc-keyed2")];
  profile.faces.rear.ports = poe ? [] : device.ports.filter((port) => port.type === "Console")
    .map((port) => slot(port, .836, .51, .08, .24));
  if (!poe) {
    if (!profile.faces.rear.ports.length) {
      profile.faces.rear.components.push(element("console", .796, .39, .08, .24, "CONSOLE"));
      profile.inventoryComplete = false;
      profile.catalogDiscrepancies.push("The catalog omits the base model's rear RJ45 console; it is drawn without a connection endpoint.");
    }
    profile.faces.front.connectionMarker = { x: .33, y: .83, width: .30, height: .12 };
    profile.faces.rear.connectionMarker = { x: .33, y: .78, width: .30, height: .12 };
  }
}

/** Trace the 224D-FPOE's two copper banks, RPS socket region and two fixed rear fans. */
function add224D(profile, device) {
  inspected(profile, "224D", "8–9", ["The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint."]);
  profile.fidelity = "model";
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT") return slot(port, .036, .67, .034);
    const index = Number(port.label) - 1;
    if (index < 24) return slot(port, .423 + Math.floor(index / 2) * .0357 + (index >= 12 ? .012 : 0),
      index % 2 ? .69 : .40, .029);
    return slot(port, .894 + Math.floor((index - 24) / 2) * .062, index % 2 ? .69 : .40, .031);
  });
  profile.faces.front.components = [element("led", .126, .52, .005, .04),
    ...[0, 1, 2, 3].map((index) => element("led", .088, .40 + index * .12, .005, .04))];
  profile.faces.rear.components = [element("console", .14, .44, .037, .34, "CONSOLE"),
    element("module-bay", .36, .40, .165, .40, "RPS", "blank"),
    element("power", .616, .24, .10, .53, "AC", "ac"),
    element("fan", .762, .20, .075, .72, undefined, "fixed"),
    element("fan", .865, .20, .075, .72, undefined, "fixed")];
  profile.limitations.push("The RPS connector envelope is shown; its proprietary multi-pin contacts are not modeled.");
}

/** Create the numbered contacts of a documented power or digital-I/O terminal block. */
function terminal(x, y, width, height, pins, label) {
  return { ...element("terminal", x, y, width, height, label), pins };
}

/** Retain an explicit rear evidence gap when a rugged guide only illustrates the front and mounting sides. */
function ruggedFrontOnly(profile, guide) {
  inspected(profile, guide, "5–7");
  profile.fidelity = "family";
  profile.panelsVerified = false;
  profile.rearHardwareVerified = false;
  profile.verifiedFaces = ["front"];
  profile.limitations = ["The front is individually traced from this model's photograph. The guide shows mounting sides but no clear opposing rear panel; rear hardware remains unverified."];
}

/** Trace the distinct 108F and 112F rugged fronts, including covered USB, firmware control and terminal blocks. */
function addRugged100F(profile, device) {
  const large = device.model.includes("112F");
  ruggedFrontOnly(profile, large ? "R112F" : "R108F");
  const count = large ? 8 : 6;
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.type === "Console") return slot(port, large ? .840 : .390, large ? .258 : .435, .105, .12);
    if (port.label === "MGMT") return slot(port, large ? .322 : .377, large ? .828 : .797, .115, .12);
    const index = Number(port.label) - 1;
    if (index < count) return slot(port, large ? .350 + Math.floor(index / 2) * .111 :
      [.565, .688, .877][Math.floor(index / 2)], index % 2 ? large ? .403 : .50 : large ? .195 : .265, .095, .12);
    return slot(port, (large ? .475 : .638) + (index - count) * (large ? .142 : .157), large ? .828 : .797, .108, .12);
  });
  profile.faces.front.components = large ? [terminal(.041, .387, .224, .107, 5, "DIGITAL I/O"),
    terminal(.041, .775, .201, .111, 4, "DC1 / DC2"), element("coax", .183, .17, .071, .15, "BLE"),
    element("module-bay", .77, .36, .127, .23, "USB COVER", "blank"),
    element("module-bay", .606, .510, .155, .095, "SIGNED FW", "blank"),
    element("button", .933, .407, .030, .05, undefined, "reset"),
    ...[.36, .42, .47, .55].map((x) => element("led", x, .515, .010, .025))] :
    [terminal(.05, .15, .245, .115, 5, "DIGITAL I/O"), terminal(.049, .724, .211, .117, 4, "DC1 / DC2"),
      element("module-bay", .31, .034, .164, .281, "USB COVER", "blank"),
      element("module-bay", .586, .030, .175, .11, "SIGNED FW", "blank"),
      element("coax", .89, .683, .075, .145, "BLE"),
      element("button", .496, .75, .030, .05, undefined, "reset"),
      ...[.52, .85, .90].map((x) => element("led", x, .09, .011, .03))];
}

/** Trace the 216F's portrait copper banks and four optical rows without stretching them into a rack switch layout. */
function addRugged216F(profile, device) {
  ruggedFrontOnly(profile, "R216F");
  profile.chassis = { x: .425, y: .04, width: .15, height: .92 };
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.type === "Console") return slot(port, .817, .19, .135, .070);
    if (port.label === "MGMT") return slot(port, .817, .302, .135, .070);
    const index = Number(port.label) - 1;
    if (index < 16) return slot(port, index % 2 ? .425 : .565,
      .837 - Math.floor(index / 2) * .082 - (index >= 8 ? .102 : 0), .13, .065);
    return slot(port, .143, .765 - (index - 16) * .18, .12, .07);
  });
  profile.faces.front.components = [element("usb", .76, .047, .065, .080, undefined, "a"),
    element("coax", .145, .075, .090, .05, "BLE"),
    terminal(.745, .817, .075, .12, 4, "DC"), terminal(.745, .66, .075, .15, 5, "I/O"),
    element("button", .770, .378, .040, .027, undefined, "reset"),
    ...Array.from({ length: 18 }, (_, index) => element("led", .765 + index % 3 * .05,
      .432 + Math.floor(index / 3) * .030, .020, .012))];
  profile.limitations.push("The upright DIN-rail face is fitted within the catalog's two-unit allocation; this is not a scale drawing of its 180 mm height.");
}

/** Trace the 424F's full-width one-unit chassis and the documented P26913-05-or-later rear panel. */
function addRugged424F(profile, device) {
  inspected(profile, "R424F", "6, 8–9", [
    "The catalog omits the rear RJ45 console. It is drawn as an ancillary connector without a connection endpoint.",
    "The catalog allocates 2U, while the guide specifies a 44 mm chassis. The physical panel occupies one unit inside that allocation.",
  ]);
  profile.fidelity = "model";
  profile.hardwareRevision = "P26913-05 and above";
  profile.chassis = { x: 0, y: .04, width: 1, height: .46 };
  profile.faces.front.ports = device.ports.map((port) => {
    if (port.label === "MGMT") return slot(port, .049, .46, .040, .12);
    const index = Number(port.label) - 1;
    if (index < 12) return slot(port, .163 + Math.floor(index / 2) * .0444, index % 2 ? .68 : .36, .038, .12);
    if (index < 28) return slot(port, .444 + Math.floor((index - 12) / 2) * .058, index % 2 ? .68 : .36, .044, .12);
    return slot(port, .916, index % 2 ? .68 : .36, .055, .12);
  });
  profile.faces.front.components = [element("usb", .025, .65, .048, .11, undefined, "a"),
    element("button", .112, .67, .008, .05, undefined, "reset"),
    ...[0, 1, 2, 3].map((index) => element("led", .092, .32 + index * .12, .004, .028))];
  profile.faces.rear.components = [element("console", .040, .48, .049, .34, "CONSOLE"),
    terminal(.096, .66, .040, .18, 3, "FAULT"), terminal(.146, .62, .085, .23, 5, "DC1 / DC2"),
    element("coax", .235, .40, .029, .24, "GPS")];
  profile.limitations.push("The rear shown is P26913-05 and above. Earlier revisions use a six-pin DC terminal and omit the separate three-pin fault relay.");
}

/** Record physical silk-screen labels while preserving existing catalog labels, types and endpoint indices. */
function namedSlot(port, physicalLabel, x, y, width = .027, height = .22) {
  return { ...slot(port, x, y, width, height), physicalLabel };
}

/** Record a complete socket inventory whose legacy generated labels differ from the physical panel. */
function notePhysicalLabels(profile) {
  profile.catalogDiscrepancies.push("The catalog's generated labels differ from the physical panel. Physical labels are recorded separately; stored endpoint labels are preserved.");
}

/** Trace the 30G/31G's front I/O bank and rear-only keyed power inlet. */
function add30G(profile, device) {
  inspected(profile, "30G", "4–5");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => port.type === "Console" ? namedSlot(port, "CONSOLE", .203, .64, .095, .24) :
    namedSlot(port, ["WAN", "1", "2", "A"][index], .557 + index * .094, .64, .080, .24));
  profile.faces.front.components = [element("vent", .543, .11, .334, .18, undefined, "slots"),
    element("button", .058, .68, .014, .055, undefined, "reset"),
    element("led", .337, .56, .014, .055), element("text", .284, .55, .051, .08, "STATUS"),
    element("led", .337, .67, .014, .055), element("text", .288, .66, .047, .08, "PWR"),
    element("led", .374, .67, .014, .055), element("text", .389, .66, .038, .08, "HA")];
  profile.faces.rear.components = [element("vent", .064, .16, .743, .71, undefined, "slots"),
    element("power", .84, .41, .045, .42, "12V", "dc-keyed2"),
    element("vent", .91, .17, .037, .70, undefined, "slots")];
}

/** Trace the 50G/51G's front indicator panel and rear reversed Ethernet bank with signed-firmware cover. */
function add50G(profile, device) {
  inspected(profile, "50G", "4–5");
  notePhysicalLabels(profile);
  profile.defaultFace = "rear";
  profile.faces.front.ports = [];
  profile.faces.rear.ports = device.ports.map((port, index) => port.type === "Console" ? namedSlot(port, "CONSOLE", .201, .57, .070, .24) :
    namedSlot(port, ["WAN", "A", "3", "2", "1"][index], .655 + index * .065, .57, .057, .24));
  profile.faces.front.components = [element("button", .048, .66, .010, .05, undefined, "reset"),
    element("led", .092, .70, .010, .05), element("text", .077, .79, .044, .075, "BLE"),
    element("led", .204, .75, .010, .05), element("text", .16, .84, .105, .075, "SIGNED FW"),
    ...familyIndicators(["PWR", "STATUS", "HA"], .34, .73, .065),
    ...["1", "2", "3", "A", "WAN"].flatMap((label, index) => [element("text", .572 + index * .024, .45, .020, .075, label),
      element("led", .58 + index * .024, .58, .010, .05), element("led", .58 + index * .024, .73, .010, .05)]),
    element("coax", .888, .49, .039, .20, "BLE")];
  profile.faces.rear.components = [element("power", .067, .35, .031, .41, "12V", "dc-keyed2"),
    element("usb", .114, .40, .028, .33, undefined, "a"),
    element("module-bay", .258, .51, .035, .47, "", "blank"),
    element("vent", .321, .42, .146, .33, undefined, "slots"),
    element("vent", .08, .11, .39, .18, undefined, "slots"),
    element("vent", .532, .11, .39, .18, undefined, "slots")];
}

/** Trace the 200G/201G's separated 1G, 5G and optical groups with two fixed rear AC supplies. */
function add200G(profile, device) {
  inspected(profile, "200G", "5–6");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    const y = index % 2 ? .67 : .39;
    if (index < 2) return namedSlot(port, ["HA", "MGMT"][index], .203, y, .030);
    if (index < 10) return namedSlot(port, String(index - 1), .324 + Math.floor((index - 2) / 2) * .033, y, .028);
    if (index < 18) return namedSlot(port, String(index - 1), .477 + Math.floor((index - 10) / 2) * .033, y, .028);
    if (index < 22) return namedSlot(port, String(index - 1), .824 + Math.floor((index - 18) / 2) * .034, y, .030);
    if (index < 30) return namedSlot(port, `X${index - 21}`, .672 + Math.floor((index - 22) / 2) * .034, y, .030);
    return namedSlot(port, "CONSOLE", .154, .46, .030);
  });
  profile.faces.front.components = [element("usb", .140, .70, .029, .10, undefined, "a"),
    element("module-bay", .049, .57, .016, .29, "", "blank"),
    element("button", .078, .70, .011, .09, undefined, "reset"),
    element("vent", .237, .24, .049, .57, undefined, "slots"),
    element("vent", .611, .24, .032, .57, undefined, "slots"),
    ...[0, 1, 2, 3].map((index) => element("led", .099, .49 + index * .086, .005, .04))];
  profile.faces.rear.components = [element("power", .093, .33, .071, .49, "PSU2", "ac"),
    element("power", .831, .33, .071, .49, "PSU1", "ac"),
    element("vent", .224, .20, .220, .70, undefined, "perforated"),
    element("vent", .551, .20, .220, .70, undefined, "perforated")];
}

/** Trace the 400G and 700G panels from their separate guides, matching media before legacy management labels. */
function add400700G(profile, device) {
  inspected(profile, device.model.startsWith("FortiGate 4") ? "400G" : "700G", "5–6");
  notePhysicalLabels(profile);
  profile.catalogDiscrepancies.push("The catalog names the 2.5G socket MGMT. The guides identify it as HA and identify the separate 1G socket as MGMT; physical labels follow the guide without changing stored types or labels.");
  profile.faces.front.ports = device.ports.map((port, index) => {
    const y = index % 2 ? .69 : .37;
    if (index < 2) return namedSlot(port, index ? "HA" : "MGMT", .181, index ? .37 : .69, .031);
    if (index < 10) return namedSlot(port, index < 4 ? `WAN${index - 1}` : `LAN${index - 3}`,
      .229 + Math.floor((index - 2) / 2) * .034, y, .029);
    if (index < 26) return namedSlot(port, `LAN${index - 3}`, .383 + Math.floor((index - 10) / 2) * .034 +
      (index >= 18 ? .012 : 0), y, .029);
    if (index < 30) return namedSlot(port, `X${index - 25}`, .681 + Math.floor((index - 26) / 2) * .034, y, .030);
    if (index < 34) return namedSlot(port, `X${index - 25}`, .779 + Math.floor((index - 30) / 2) * .034, y, .030);
    return namedSlot(port, "CONSOLE", .131, .68, .032);
  });
  profile.faces.front.components = [element("usb", .071, .52, .012, .30, undefined, "a"),
    element("usb", .090, .52, .012, .30, undefined, "a"),
    element("button", .052, .66, .005, .035, undefined, "reset"),
    element("module-bay", .927, .74, .048, .17, "", "blank"),
    element("vent", .842, .25, .072, .57, undefined, "mesh"),
    ...[.356, .506, .655, .740].map((x) => element("vent", x, .25, .009, .57, undefined, "mesh")),
    ...[0, 1, 2, 3].map((index) => element("led", .035, .51 + index * .089, .005, .035))];
  profile.faces.rear.components = [element("power", .080, .23, .074, .52, "PWR1", "ac"),
    element("power", .887, .23, .074, .52, "PWR2", "ac"),
    element("vent", .313, .12, .485, .76, undefined, "mesh")];
  profile.limitations.push("The rear drawing shows five internal fans behind a common mesh grille; the visible grille is drawn without inventing removable fan modules.");
}

/** Trace all four 900G AC/DC variants, including their two removable supplies and covered SSD area. */
function add900G(profile, device) {
  inspected(profile, "900G", "7–8");
  notePhysicalLabels(profile);
  profile.catalogDiscrepancies.push("The catalog names the 2.5G socket MGMT; the guide identifies it as HA. The 1G management socket is separately positioned and physically labeled MGMT.");
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (index === 0 || index === 17) return namedSlot(port, index ? "HA" : "MGMT", .181, index ? .37 : .68, .031);
    if (index < 17) return namedSlot(port, String(index), .227 + Math.floor((index - 1) / 2) * .035 +
      (index > 8 ? .008 : 0), index % 2 ? .37 : .68, .029);
    if (index < 26) return namedSlot(port, String(index - 1), .563 + Math.floor((index - 18) / 2) * .034, index % 2 ? .68 : .37, .029);
    if (index < 30) return namedSlot(port, `X${index - 25}`, .714 + Math.floor((index - 26) / 2) * .034, index % 2 ? .68 : .37, .030);
    if (index < 34) return namedSlot(port, `X${index - 25}`, .784 + Math.floor((index - 30) / 2) * .034, index % 2 ? .68 : .37, .030);
    return namedSlot(port, "CONSOLE", .132, .67, .032);
  });
  profile.faces.front.components = [element("usb", .071, .52, .012, .30, undefined, "a"),
    element("usb", .090, .52, .012, .30, undefined, "a"),
    element("button", .051, .74, .008, .07, undefined, "reset"),
    element("vent", .505, .24, .037, .59, undefined, "perforated"),
    element("vent", .685, .24, .009, .59, undefined, "perforated"),
    element("vent", .842, .24, .048, .59, undefined, "perforated"),
    ...[0, 1, 2, 3].map((index) => element("led", .035, .51 + index * .088, .005, .035))];
  profile.faces.rear.components = [element("module-bay", .026, .04, .182, .84, "SSD COVER", "blank"),
    element("vent", .223, .105, .440, .78, undefined, "mesh"),
    element("psu", .692, .025, .125, .95, "PWR2", device.model.endsWith("-DC") ? "dc" : "ac"),
    element("psu", .841, .025, .125, .95, "PWR1", device.model.endsWith("-DC") ? "dc" : "ac")];
  profile.limitations.push("The five internal fans are behind the common rear mesh. The guide depicts the SSD access cover closed for both storage variants.");
}

/** Trace the separately documented SFP, DSL and PoE 50G variants instead of inheriting the base rear panel. */
function add50GWiredVariant(profile, device) {
  const poe = device.model.endsWith("-POE");
  const dsl = device.model.endsWith("-DSL");
  add50G(profile, device);
  inspected(profile, poe ? "50G-POE" : dsl ? "50G-DSL" : "50G-SFP", "4–5");
  notePhysicalLabels(profile);
  profile.faces.rear.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .201, poe ? .64 : .57, .070, .24);
    if (index === 5) return namedSlot(port, dsl ? "DSL" : "SFP", poe ? .343 : .541, poe ? .70 : .64, .061, .24);
    return namedSlot(port, (poe ? ["WAN1", "WAN2", "A", "2", "1"] : ["WAN", "A", "3", "2", "1"])[index],
      (poe ? .461 : .655) + index * .065, poe ? .64 : .57, .057, .24);
  });
  if (!poe) {
    if (dsl) profile.faces.front.components.push(element("text", .505, .60, .041, .08, "DSL"),
      element("led", .52, .73, .010, .05), element("led", .52, .58, .010, .05));
    else profile.faces.front.components.push(element("text", .695, .45, .031, .075, "SFP"), element("led", .70, .58, .010, .05));
    return;
  }
  profile.faces.front.components = [element("button", .048, .66, .010, .05, undefined, "reset"),
    element("led", .092, .70, .010, .05), element("led", .204, .75, .010, .05),
    ...familyIndicators(["PWR", "STATUS", "HA"], .27, .73, .065),
    ...["MAX", "1", "2", "A", "WAN2", "WAN1", "SFP"].flatMap((label, index) => [
      element("text", .590 + index * .034, .45, .030, .075, label),
      element("led", .600 + index * .034, index ? .58 : .73, .010, .05),
      ...(index > 0 && index < 5 ? [element("led", .600 + index * .034, .73, .010, .05)] : []),
    ]), element("coax", .888, .49, .039, .20, "BLE")];
  profile.faces.rear.components = [element("power", .873, .31, .043, .53, "54V", "dc-keyed2"),
    element("usb", .114, .48, .028, .33, undefined, "a"),
    element("module-bay", .060, .52, .035, .47, "", "blank"),
    element("vent", .265, .48, .032, .30, undefined, "slots"),
    element("vent", .784, .48, .061, .30, undefined, "slots"),
    element("vent", .08, .11, .39, .18, undefined, "slots"),
    element("vent", .532, .11, .31, .18, undefined, "slots")];
}

/** Trace the 80F Bypass and 80F/81F PoE panels, including the PoE chassis's extra ventilation strip. */
function add80FVariant(profile, device) {
  const poe = device.model.endsWith("-POE");
  inspected(profile, "80F", poe ? "6" : "5");
  profile.defaultFace = "rear";
  profile.faces.front.ports = [];
  profile.faces.rear.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return slot(port, .153, poe ? .57 : .40, .062, .22);
    const y = index % 2 ? poe ? .79 : .67 : poe ? .54 : .32;
    if (index < 8) return slot(port, .546 + Math.floor(index / 2) * .065, y, .054, .22);
    return slot(port, index < 10 ? .379 : .254, y, .059, .22);
  });
  profile.faces.rear.components = [element("usb", .122, poe ? .79 : .70, .058, .11, undefined, "a"),
    element("power", .821, poe ? .60 : .38, .029, poe ? .30 : .46, poe ? "54V" : "12V", "dc-keyed2"),
    element("power", .880, poe ? .60 : .38, .029, poe ? .30 : .46, poe ? "54V" : "12V", "dc-keyed2")];
  if (poe) profile.faces.rear.components.push(element("vent", .045, .07, .91, .24, undefined, "slots"));
  profile.faces.front.components = [element("button", .925, poe ? .83 : .74, .009, .05, undefined, "reset")];
  if (poe) {
    profile.faces.front.components.push(element("vent", .045, .07, .91, .24, undefined, "slots"),
      ...familyIndicators(["PWR", "STATUS", "HA"], .38, .83, .055), element("led", .534, .83, .007, .03),
      element("text", .512, .88, .051, .08, "MAX POE"));
    for (let index = 0; index < 8; index++) profile.faces.front.components.push(element("led", .56 + index * .024, .74, .008, .03),
      element("led", .56 + index * .024, .83, .008, .03));
    for (let index = 0; index < 2; index++) profile.faces.front.components.push(element("led", .458 + index * .027, .61, .008, .03));
  } else {
    for (const [index, label] of ["BYPASS", "STATUS", "HA", "POWER"].entries()) profile.faces.front.components.push(
      element("led", .291, .42 + index * .10, .008, .045), element("text", .226, .40 + index * .10, .060, .075, label));
    for (let index = 0; index < 6; index++) profile.faces.front.components.push(element("led", .365 + index * .025, .60, .008, .045),
      element("led", .365 + index * .025, .73, .008, .045));
    profile.faces.rear.components.push(element("text", .419, .16, .084, .10, "BYPASS"));
  }
}

/** Trace the cellular 40F panels, excluding the drawing's explicitly WiFi-only rear antenna sockets. */
function add40FCellular(profile, device) {
  inspected(profile, "40F-cell", "6");
  profile.defaultFace = "rear";
  profile.faces.front.ports = [];
  const positions = { WAN: .655, A: .723, "3": .789, "2": .855, "1": .923 };
  profile.faces.rear.ports = device.ports.map((port) => slot(port,
    port.type === "Console" ? .202 : positions[port.label], .55, port.type === "Console" ? .072 : .060, .24));
  profile.faces.front.components = [
    ...[.046, .507, .952].map((x, index) => element("coax", x - .014, .18, .028, .16, index === 1 ? "GPS" : "3G/4G")),
    ...familyIndicators(["PWR", "STATUS", "HA"], .37, .71, .052),
    element("led", .61, .57, .009, .045), element("text", .59, .47, .05, .08, "SVC"),
    element("led", .61, .71, .009, .045), element("text", .58, .80, .06, .08, "3G/4G"),
    ...["1", "2", "3", "A", "WAN"].flatMap((label, index) => [
      element("text", .716 + index * .025, .43, .024, .08, label),
      element("led", .722 + index * .025, .57, .009, .045),
      element("led", .722 + index * .025, .71, .009, .045),
    ]),
  ];
  profile.faces.rear.components = [element("button", .028, .49, .014, .08, undefined, "reset"),
    element("power", .068, .30, .030, .45, "12V", "dc-keyed2"),
    element("usb", .115, .36, .028, .38, undefined, "a"),
    element("vent", .118, .08, .805, .18, undefined, "slots"),
    element("vent", .268, .40, .325, .33, undefined, "slots")];
  profile.limitations.push("The two Micro SIM slots are behind a side cover; they are outside the front/rear views. The guide's rear WiFi antenna connectors and WiFi LED apply only to FortiWiFi and are omitted from this FortiGate model.");
}

/** Trace the separately illustrated 400F/401F DC rear supplies and the shared, explicitly named front panel. */
function add400FDC(profile, device) {
  inspected(profile, "400F-ds", "7");
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return slot(port, .159, .49, .034);
    const y = index % 2 ? .70 : .42;
    if (index < 2) return slot(port, .206, y, .031);
    if (index < 18) return slot(port, .276 + Math.floor((index - 2) / 2) * .0345 + (index >= 10 ? .016 : 0), y, .029);
    if (index < 26) return slot(port, .779 + Math.floor((index - 18) / 2) * .0345, y, .029);
    return slot(port, .617 + Math.floor((index - 26) / 2) * .0345 + (index >= 30 ? .013 : 0), y, .029);
  });
  profile.faces.front.components = [element("usb", .143, .73, .034, .11, undefined, "a"),
    element("vent", .237, .22, .012, .60, undefined, "slots"),
    element("vent", .563, .22, .030, .60, undefined, "slots"),
    element("vent", .909, .22, .074, .60, undefined, "slots"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .106, .49 + index * .085, .005, .035),
      element("text", .040, .47 + index * .085, .059, .060, label),
    ])];
  profile.faces.rear.components = [element("vent", .151, .18, .100, .72, undefined, "perforated"),
    element("vent", .300, .18, .338, .72, undefined, "perforated"),
    element("psu", .697, .025, .128, .95, "PWR1", "dc"),
    element("psu", .839, .025, .126, .95, "PWR2", "dc")];
}

/** Trace the 1000F/1001F two-unit chassis, including its horizontal QSFP pair and rear SSD cover. */
function add1000F(profile, device) {
  inspected(profile, "1000F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .127, .81, .032, .12);
    if (index < 2) return namedSlot(port, index ? "HA" : "MGMT", .176, index ? .665 : .83, .031, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 10) return namedSlot(port, String(index - 1), .277 + Math.floor((index - 2) / 2) * .034, y, .030, .12);
    if (index < 26) return namedSlot(port, String(index - 1), .435 + Math.floor((index - 10) / 2) * .034 +
      (index >= 18 ? .013 : 0), y, .030, .12);
    if (index < 34) return namedSlot(port, String(index - 1), .733 + Math.floor((index - 26) / 2) * .034, y, .030, .12);
    return namedSlot(port, String(index - 1), .880 + (index - 34) * .047, .855, .041, .12);
  });
  profile.faces.front.components = [
    ...[.012, .342, .671].map((x) => element("vent", x, .035, .316, .44, undefined, "perforated")),
    element("vent", .204, .61, .047, .27, undefined, "perforated"),
    element("vent", .860, .57, .123, .12, undefined, "perforated"),
    element("vent", .955, .70, .028, .21, undefined, "perforated"),
    element("usb", .068, .73, .010, .16, undefined, "a"),
    element("usb", .089, .73, .010, .16, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .050, .71 + index * .048, .004, .025),
      element("text", .012, .70 + index * .048, .033, .036, label),
    ])];
  profile.faces.rear.components = [
    ...[.08, .286, .493].map((x, index) => element("fan", x, .14, .178, .79, `FAN${index + 1}`, "fixed")),
    element("module-bay", .728, .05, .210, .40, "SSD COVER", "blank"),
    element("psu", .700, .52, .130, .46, "PWR1", "ac"),
    element("psu", .846, .52, .130, .46, "PWR2", "ac")];
}

/** Trace the AC 1100E/1101E panels with stacked QSFP ports and three fixed rear fans. */
function add1100E(profile, device) {
  inspected(profile, "1100E-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .160, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, index ? "MGMT" : "HA", .206, y, .031, .12);
    if (index < 18) return namedSlot(port, String(index - 1), .248 + Math.floor((index - 2) / 2) * .034 +
      (index >= 10 ? .010 : 0), y, .030, .12);
    if (index < 26) return namedSlot(port, String(index - 1), .537 + Math.floor((index - 18) / 2) * .034, y, .030, .12);
    if (index < 30) return namedSlot(port, String(index - 1), .679 + Math.floor((index - 26) / 2) * .034, y, .030, .12);
    if (index < 34) return namedSlot(port, String(index - 1), .752 + Math.floor((index - 30) / 2) * .034, y, .030, .12);
    return namedSlot(port, String(index - 1), .835, y, .041, .12);
  });
  profile.faces.front.components = [element("vent", .013, .045, .975, .43, undefined, "perforated"),
    element("usb", .102, .730, .030, .060, undefined, "a"),
    element("usb", .102, .842, .030, .060, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .088, .73 + index * .043, .004, .022),
      element("text", .043, .72 + index * .043, .039, .032, label),
    ])];
  profile.faces.rear.components = [
    ...[.035, .218, .401].map((x, index) => element("fan", x, .11, .178, .83, `FAN${index + 1}`, "fixed")),
    element("psu", .695, .52, .133, .46, "PWR1", "ac"),
    element("psu", .845, .52, .133, .46, "PWR2", "ac")];
  profile.limitations.push("This profile covers the explicitly listed AC models. The separately sold DC model requires its own rear connector trace.");
}

/** Trace the AC 1800F/1801F chassis with optical HA sockets and its corrected single-console inventory. */
function add1800F(profile, device) {
  inspected(profile, "1800F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .092, .71, .032, .12);
    const y = index % 2 ? .815 : .65;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .145, y, .031, .12);
    if (index < 18) return namedSlot(port, String(index - 1), .256 + Math.floor((index - 2) / 2) * .034 +
      (index >= 10 ? .012 : 0), y, .030, .12);
    if (index < 26) return namedSlot(port, String(index - 1), .551 + Math.floor((index - 18) / 2) * .034, y, .030, .12);
    if (index < 28) return namedSlot(port, `HA${index - 25}`, .213, y, .029, .12);
    if (index < 40) return namedSlot(port, String(index - 3), .690 + Math.floor((index - 28) / 2) * .034, y, .030, .12);
    return namedSlot(port, String(index - 3), .897 + Math.floor((index - 40) / 2) * .047, y, .039, .12);
  });
  profile.faces.front.components = [
    ...[.212, .409, .608, .807].map((x) => element("vent", x, .055, .180, .405, undefined, "perforated")),
    element("vent", .015, .345, .182, .105, undefined, "perforated"),
    element("vent", .174, .58, .010, .31, undefined, "slots"),
    element("vent", .973, .58, .010, .31, undefined, "slots"),
    element("usb", .075, .811, .034, .065, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .061, .66 + index * .052, .004, .024),
      element("text", .019, .65 + index * .052, .036, .034, label),
    ])];
  profile.faces.rear.components = [
    ...[.048, .249, .452].map((x, index) => element("fan", x, .10, .176, .81, `FAN${index + 1}`, "fixed")),
    element("psu", .702, .39, .123, .48, "PSU2", "ac"),
    element("psu", .827, .39, .123, .48, "PSU1", "ac")];
  profile.limitations.push("Inventory revision 1 removes the former second console entry; saved revision-0 endpoints keep their IDs and indices, with the unsupported extra endpoint shown as unmapped.");
}

/** Trace the AC 2600F panels, whose individually illustrated enclosure matches the 1800F with different socket banks. */
function add2600F(profile, device) {
  add1800F(profile, device);
  inspected(profile, "2600F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .092, .71, .032, .12);
    const y = index % 2 ? .815 : .65;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .145, y, .031, .12);
    if (index < 18) return namedSlot(port, String(index - 1), .272 + Math.floor((index - 2) / 2) * .034 +
      (index >= 10 ? .022 : 0), y, .030, .12);
    if (index < 20) return namedSlot(port, `HA${index - 17}`, .213, y, .029, .12);
    if (index < 36) return namedSlot(port, String(index - 3), .588 + Math.floor((index - 20) / 2) * .034 +
      (index >= 28 ? .016 : 0), y, .030, .12);
    return namedSlot(port, String(index - 3), .892 + Math.floor((index - 36) / 2) * .047, y, .039, .12);
  });
}

/** Compose the three separately drawn upper ventilation panels and compact control area on larger F models. */
function largeFControls(offset = 0) {
  return [...[.012, .342, .672].map((x) => element("vent", x, .035, .316, .44, undefined, "perforated")),
    element("usb", .093 + offset, .73, .012, .16, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .057 + offset, .70 + index * .048, .004, .024),
      element("text", .018 + offset, .69 + index * .048, .033, .034, label),
    ])];
}

/** Trace the AC 3000F/3001F layout while retaining explicit mappings for the former extra copper endpoints. */
function add3000F(profile, device) {
  inspected(profile, "3000F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return { ...namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12), compatibleTypes: ["RJ45_1G"] };
    if (index < 18) return namedSlot(port, String(index - 1), .237 + Math.floor((index - 2) / 2) * .0344 +
      (index >= 10 ? .010 : 0), y, .030, .12);
    if (index < 34) return namedSlot(port, index >= 32 ? `HA${index - 31}` : String(index - 1),
      .534 + Math.floor((index - 18) / 2) * .0344 + (index >= 26 ? .009 : 0), y, .030, .12);
    return namedSlot(port, String(index - 3), .834 + Math.floor((index - 34) / 2) * .051, y, .041, .12);
  });
  profile.faces.front.components = largeFControls();
  profile.faces.rear.components = [
    ...[.054, .279, .505].map((x, index) => element("fan", x, .15, .184, .80, `FAN${index + 1}`, "fixed")),
    element("module-bay", .712, .05, .207, .40, "SSD COVER", "blank"),
    element("psu", .704, .52, .132, .46, "PWR1", "ac"),
    element("psu", .839, .52, .132, .46, "PWR2", "ac")];
  profile.limitations.push("Revision 1 corrects management media and removes the two former extra copper entries. Revision-0 optical and console indices map explicitly; all saved endpoint IDs and configuration remain intact.");
}

/** Trace the 3200F/3201F optical banks, horizontal QSFP-DD row and four-fan rear with opposite-end supplies. */
function add3200F(profile, device) {
  inspected(profile, "3200F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12);
    if (index < 6) return namedSlot(port, String(index - 1), .366 + Math.floor((index - 2) / 2) * .0345, y, .030, .12);
    if (index < 8) return namedSlot(port, `HA${index - 5}`, .332, y, .030, .12);
    if (index < 18) return namedSlot(port, String(index - 3), .435 + Math.floor((index - 8) / 2) * .0345 +
      (index >= 10 ? .017 : 0), y, .030, .12);
    return namedSlot(port, String(index - 3), .796 + (index - 18) * .050, .835, .041, .12);
  });
  profile.faces.front.components = [...largeFControls(),
    element("vent", .224, .63, .077, .24, undefined, "mesh"),
    element("vent", .772, .63, .203, .10, undefined, "mesh")];
  profile.faces.rear.components = [element("psu", .017, .028, .096, .71, "PWR1", "ac"),
    element("psu", .885, .028, .096, .71, "PWR2", "ac"),
    ...[.128, .316, .505, .694].map((x, index) => element("fan", x, .15, .176, .80, `FAN${index + 1}`, "fixed"))];
}

/** Trace the 3500F/3501F full SFP28 front row and four-fan rear, including legacy management media compatibility. */
function add3500F(profile, device) {
  inspected(profile, "3500F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .138, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return { ...namedSlot(port, `MGMT${index + 1}`, .190, y, .031, .12), compatibleTypes: ["RJ45_1G"] };
    if (index < 34) {
      const column = Math.floor((index - 2) / 2);
      return namedSlot(port, index < 4 ? `HA${index - 1}` : String(index - 3),
        .245 + column * .034 + Math.floor(column / 4) * .010, y, .030, .12);
    }
    return namedSlot(port, String(index - 3), .846 + Math.floor((index - 34) / 2) * .051, y, .041, .12);
  });
  profile.faces.front.components = largeFControls(.006);
  profile.faces.rear.components = [element("psu", .017, .065, .090, .60, "PWR1", "ac"),
    element("psu", .891, .065, .090, .60, "PWR2", "ac"),
    ...[.123, .315, .507, .699].map((x, index) => element("fan", x, .16, .185, .77, `FAN${index + 1}`, "fixed"))];
  profile.limitations.push("Inventory revision 1 identifies the management sockets as 10GE. The identity revision map also accepts the saved revision-0 1GE media type without rewriting endpoint configuration.");
}

/** Trace the 3700F/3701F extra optical bank in the separately documented four-fan enclosure. */
function add3700F(profile, device) {
  add3200F(profile, device);
  inspected(profile, "3700F-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12);
    if (index < 6) return namedSlot(port, String(index - 1), .366 + Math.floor((index - 2) / 2) * .0345, y, .030, .12);
    if (index < 8) return namedSlot(port, `HA${index - 5}`, .332, y, .030, .12);
    if (index < 26) return namedSlot(port, String(index - 3), .435 + Math.floor((index - 8) / 2) * .0345 +
      (index >= 10 ? .017 : 0) + (index >= 18 ? .012 : 0), y, .030, .12);
    return namedSlot(port, String(index - 3), .796 + (index - 26) * .050, .835, .041, .12);
  });
}

/** Compose the rear specifically illustrated in the 3000G and 3500G datasheets. */
function largeGRear() {
  return [...[.007, .039].map((x, index) => element("module-bay", x, .42, .030, .53, `SSD${index + 1}`, "blank")),
    ...[.143, .344, .545].map((x, index) => element("fan", x, .19, .180, .79, `FAN${index + 1}`, "fixed")),
    element("psu", .729, .49, .128, .49, "PWR1", "ac"),
    element("psu", .862, .49, .128, .49, "PWR2", "ac")];
}

/** Trace the 3000G/3001G WAN labels, signed-firmware cover and the rear storage arrangement. */
function add3000G(profile, device) {
  inspected(profile, "3000G-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return { ...namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12), compatibleTypes: ["RJ45_1G"] };
    if (index < 18) return namedSlot(port, index < 4 ? `WAN${index - 1}` : String(index - 3),
      .240 + Math.floor((index - 2) / 2) * .0344 + (index >= 10 ? .010 : 0), y, .030, .12);
    if (index < 34) return namedSlot(port, index >= 32 ? `HA${index - 31}` : String(index - 3),
      .536 + Math.floor((index - 18) / 2) * .0344 + (index >= 26 ? .008 : 0), y, .030, .12);
    return namedSlot(port, String(index - 5), .841 + Math.floor((index - 34) / 2) * .051, y, .041, .12);
  });
  profile.faces.front.components = [...largeFControls(.020),
    element("module-bay", .015, .80, .034, .17, "", "blank"),
    element("text", .005, .68, .050, .09, "SIGNED FW"),
    element("button", .977, .83, .006, .035, undefined, "reset")];
  profile.faces.front.components.find((component) => component.kind === "usb").x = .093;
  profile.faces.rear.components = largeGRear();
  profile.limitations.push("Rear storage sled covers are shown closed; installed capacity differs between storage variants. Revision-0 extra copper endpoints remain unmapped and optical indices use an explicit revision map.");
}

/** Trace the 3500G/3501G mixed QSFP/QSFP-DD bank and two optical WAN sockets. */
function add3500G(profile, device) {
  inspected(profile, "3500G-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12);
    if (index < 4) return namedSlot(port, `HA${index - 1}`, .240, y, .030, .12);
    if (index < 32) {
      const column = Math.floor((index - 4) / 2);
      return namedSlot(port, index < 6 ? `WAN${index - 3}` : String(index - 5),
        .280 + column * .034 + (column >= 2 ? .007 : 0) + (column >= 6 ? .012 : 0) + (column >= 10 ? .008 : 0), y, .028, .12);
    }
    if (index < 36) return namedSlot(port, String(index - 5), .803 + Math.floor((index - 32) / 2) * .044, y, .039, .12);
    return namedSlot(port, String(index - 5), .895 + (index - 36) * .051, .835, .041, .12);
  });
  profile.faces.front.components = [...largeFControls(.020),
    element("module-bay", .015, .80, .034, .17, "", "blank"),
    element("text", .005, .68, .050, .09, "SIGNED FW"),
    element("button", .977, .83, .006, .035, undefined, "reset"),
    element("vent", .765, .60, .010, .30, undefined, "perforated"),
    element("vent", .872, .60, .100, .13, undefined, "perforated")];
  profile.faces.front.components.find((component) => component.kind === "usb").x = .093;
  profile.faces.rear.components = largeGRear();
}

/** Trace the photographed 3800G/3801G three-unit panel, display, four supplies and three removable fans. */
function add3800G(profile, device) {
  inspected(profile, "3800G-ds", "7");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .180, .82, .034, .08);
    const y = index % 2 ? .90 : .79;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .230, y, .034, .08);
    if (index < 4) return namedSlot(port, `HA${index - 1}`, .278, y, .030, .08);
    if (index < 20) {
      const column = Math.floor((index - 4) / 2);
      return namedSlot(port, index < 6 ? `WAN${index - 3}` : String(index - 5),
        .380 + column * .0336 + (column >= 4 ? .007 : 0), y, .029, .08);
    }
    if (index < 22) return namedSlot(port, `HA${index - 17}`, .328, y, .039, .08);
    if (index < 26) return namedSlot(port, String(index - 7), .669 + Math.floor((index - 22) / 2) * .045, y, .039, .08);
    return namedSlot(port, String(index - 7), .768 + (index - 26) * .0545, .91, .042, .08);
  });
  profile.faces.front.components = [element("lcd", .014, .035, .194, .49),
    element("vent", .014, .54, .194, .09, undefined, "perforated"),
    ...[.217, .482, .748].map((x) => element("vent", x, .035, .245, .595, undefined, "perforated")),
    element("usb", .163, .929, .034, .036, undefined, "a"),
    element("vent", .118, .725, .023, .23, undefined, "slots"),
    element("vent", .180, .691, .450, .022, undefined, "slots"),
    element("vent", .660, .691, .300, .022, undefined, "slots"),
    element("vent", .747, .75, .220, .090, undefined, "slots"),
    element("module-bay", .012, .86, .058, .115, "", "blank"),
    element("text", .014, .785, .055, .060, "SIGNED FW"),
    element("button", .972, .91, .006, .022, undefined, "reset"),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .147, .795 + index * .028, .003, .013),
      element("text", .102, .79 + index * .028, .037, .025, label),
    ])];
  profile.faces.rear.components = [
    ...[.021, .848].flatMap((x, column) => [.028, .365].map((y, row) =>
      element("psu", x, y, .132, .315, `PSU${column ? row ? 3 : 4 : row ? 1 : 2}`, "ac"))),
    ...[.157, .386, .615].map((x, index) => element("fan", x, .09, .227, .90, `FAN${index + 1}`, "removable")),
    element("module-bay", .009, .71, .044, .28, "SSD1", "blank"),
    element("module-bay", .054, .71, .044, .28, "SSD2", "blank")];
  profile.limitations.push("Panel coordinates are traced from the official hardware photograph. The storage sled covers are represented closed, without asserting installed capacity.");
}

/** Reproduce the separately illustrated 4200F, 4400F and 4800F supply populations and three-fan rear assemblies. */
function hyperscaleFRear(units, dc, fourDC = false) {
  const short = units === 3;
  const supplied = short || dc && !fourDC ? 2 : 4;
  const positions = short ? [.388, .687] : [.035, .275, .515, .755];
  const height = short ? .290 : .230;
  const fanY = short ? .077 : .300;
  const fanHeight = short ? .900 : .685;
  const coverY = short ? .117 : .325;
  const coverHeight = short ? .753 : .574;
  return [
    element("handle", .006, .13, .018, .54), element("handle", .977, .13, .018, .54),
    ...positions.map((y, index) => !short && index < 4 - supplied ?
      element("module-bay", .030, y, .124, height, "", "blank") :
      element("psu", .030, y, .124, height, `PSU${positions.length - index}`, dc ? "dc-keyed2" : "ac")),
    ...(short ? [element("module-bay", .030, .058, .124, .323, "", "blank")] :
      [element("module-bay", .261, .088, .655, .148, "", "blank")]),
    element("module-bay", .174, coverY, .086, coverHeight, "", "blank"),
    ...[.184, .224].map((x, index) => element("text", x - .012, coverY - .063, .034, .047, `SSD${index + 1}`)),
    ...[.184, .224].map((x) => element("vent", x, coverY + .08, .024, coverHeight - .16, undefined, "slots")),
    ...[.264, .497, .730].map((x, index) => element("fan", x, fanY, .231, fanHeight, `FAN${index + 1}`, "removable")),
    element("text", .967, .90, .030, .045, "GND"),
  ];
}

/** Trace the low connector strip and upper perforated grilles shared explicitly by the 4200F and 4400F drawings. */
function hyperscaleFControls(model, units) {
  const short = units === 3;
  const stripY = short ? .662 : .740;
  const lightY = short ? .785 : .848;
  const lightStep = short ? .039 : .026;
  return [
    element("text", .042, .087, .143, .070, model),
    element("vent", .029, short ? .25 : .22, .175, short ? .353 : .474, undefined, "perforated"),
    ...[.224, .422, .620, .818].map((x) => element("vent", x, .038, .177, short ? .565 : .656, undefined, "perforated")),
    element("vent", .039, stripY, .933, .043, undefined, "slots"),
    element("usb", short ? .090 : .084, short ? .905 : .924, .032, short ? .033 : .026, undefined, "a"),
    element("vent", .188, short ? .740 : .801, .025, short ? .183 : .147, undefined, "slots"),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .072, lightY + index * lightStep, .004, short ? .016 : .012),
      element("text", .030, lightY - .004 + index * lightStep, .036, short ? .028 : .020, label),
    ]),
  ];
}

/** Trace all twenty SFP28 sockets and the differing QSFP banks of the 4200F and 4400F AC/DC models. */
function add42004400F(profile, device) {
  const short = device.model.startsWith("FortiGate 420");
  const dc = device.model.endsWith("-DC");
  inspected(profile, short ? "4200F" : "4400F", dc ? "3, 5 (front; DC rear)" : "3–4 (front; AC rear)");
  notePhysicalLabels(profile);
  const sfpColumns = short ? [.238, .271, .326, .360, .392, .426, .475, .508, .542, .575] :
    [.233, .266, .323, .356, .390, .423, .477, .510, .543, .576];
  const qsfpColumns = short ? [.634, .676, .753, .796] : [.632, .677, .754, .800, .868, .915];
  const height = short ? .080 : .060;
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", short ? .106 : .100, short ? .827 : .866, .032, height);
    const y = index % 2 ? short ? .89 : .914 : short ? .79 : .83;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, short ? .158 : .150, y, .032, height);
    if (index < 22) return namedSlot(port, index < 4 ? `HA${index - 1}` : index < 6 ? `AUX${index - 3}` : String(index - 5),
      sfpColumns[Math.floor((index - 2) / 2)], y, .029, height);
    return namedSlot(port, String(index - 5), qsfpColumns[Math.floor((index - 22) / 2)], y, .038, height);
  });
  profile.faces.front.components = [...hyperscaleFControls(short ? "FortiGate 4200F" : "FortiGate 4400F", short ? 3 : 4),
    ...(short ? [element("vent", .825, .740, .145, .183, undefined, "slots")] : [])];
  profile.faces.rear.components = hyperscaleFRear(short ? 3 : 4, dc);
  profile.limitations.push("The guide's standard PSU population is shown. Storage sled covers remain closed; installed capacity differs between storage variants.");
  if (short) profile.limitations.push("Inventory revision 1 includes twenty SFP28 sockets. Revision-0 endpoints retain their IDs and configuration; an explicit index map keeps saved QSFP and console connections separate from the two added optical slots.");
}

/** Trace the 2026 4800F AC/DC/NEBS guide, including split upper ventilation and the full QSFP-DD bank. */
function add4800F(profile, device) {
  const dc = device.model.includes("-DC");
  inspected(profile, "4800F", dc ? "9, 11 (front; DC rear)" : "9–10 (front; AC rear)");
  notePhysicalLabels(profile);
  profile.hardwareRevision = "QuickStart Guide June 23, 2026; all six AC/DC/NEBS SKUs explicitly listed";
  const sfpColumns = [.218, .251, .301, .334, .368, .401];
  const qsfpColumns = [.455, .501, .555, .602, .654, .700];
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .104, .878, .032, .060);
    const y = index % 2 ? .922 : .832;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .153, y, .032, .060);
    if (index < 14) return namedSlot(port, index < 4 ? `HA${index - 1}` : index < 6 ? `AUX${index - 3}` : String(index - 5),
      sfpColumns[Math.floor((index - 2) / 2)], y, .029, .060);
    if (index < 26) return namedSlot(port, String(index - 5), qsfpColumns[Math.floor((index - 14) / 2)], y, .038, .060);
    return namedSlot(port, String(index - 5), .759 + Math.floor((index - 26) / 2) * .055, y, .043, .060);
  });
  profile.faces.front.components = [element("text", .040, .093, .143, .070, "FortiGate 4800F"),
    element("vent", .015, .230, .186, .460, undefined, "perforated"),
    ...[.212, .409, .606].map((x) => element("vent", x, .050, .181, .640, undefined, "perforated")),
    element("vent", .802, .050, .077, .230, undefined, "perforated"),
    element("module-bay", .891, .050, .094, .230, "", "blank"),
    element("vent", .802, .308, .183, .382, undefined, "perforated"),
    element("vent", .027, .735, .950, .040, undefined, "slots"),
    element("vent", .181, .80, .014, .144, undefined, "slots"),
    element("usb", .088, .938, .032, .026, undefined, "a"),
    element("button", .022, .921, .008, .024, undefined, "reset"),
    element("text", .012, .954, .030, .022, "BLE"),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .071, .842 + index * .028, .004, .012),
      element("text", .035, .840 + index * .028, .032, .022, label),
    ])];
  profile.faces.rear.components = hyperscaleFRear(4, dc, true);
  profile.limitations.push("The current guide's closed front grille and rear storage cover arrangement is shown. NEBS models have the filter preinstalled; installed storage capacity is not inferred from cover artwork.");
}

/** Apply the explicitly shared front drawings and separately traced terminal-powered DC rears from four model guides. */
function addTerminalDC(profile, device) {
  const model = device.model;
  if (model.startsWith("FortiGate 1100")) {
    add1100E(profile, device);
    inspected(profile, "1100E-qsg", "3–4 (shared front; separate DC rear)");
    profile.faces.rear.components = [
      ...[.034, .219, .403].map((x, index) => element("fan", x, .10, .179, .85, `FAN${index + 1}`, "fixed")),
      element("psu", .692, .497, .133, .483, "PWR1", "dc-terminal2"),
      element("psu", .842, .497, .133, .483, "PWR2", "dc-terminal2")];
  } else if (model.startsWith("FortiGate 300")) {
    add3000F(profile, device);
    inspected(profile, "3000F-qsg", "6–7 (shared front; separate AC/DC rears)");
    for (const component of profile.faces.rear.components) if (component.kind === "psu") component.variant = "dc-terminal2";
    profile.limitations.push("Inventory revision 1 corrects the former extra copper endpoints. The explicit revision map preserves saved optical and console connections without changing IDs or configuration.");
  } else {
    const is1800 = model.startsWith("FortiGate 180");
    if (is1800) add1800F(profile, device);
    else add2600F(profile, device);
    inspected(profile, is1800 ? "1800F-qsg" : "2600F-qsg", is1800 ? "3, 5 (shared front; DC rear)" : "4, 6 (shared front; DC rear)");
    profile.faces.rear.components = [
      ...[.054, .255, .456].map((x, index) => element("fan", x, .105, .170, .80, `FAN${index + 1}`, "fixed")),
      element("psu", .719, .405, .111, .46, "PSU2", "dc-terminal2"),
      element("psu", .833, .405, .111, .46, "PSU1", "dc-terminal2")];
    if (is1800) profile.limitations.push("Inventory revision 1 has one console. The old extra console endpoint remains preserved and unmapped.");
  }
  notePhysicalLabels(profile);
  profile.limitations.push("The model guide explicitly includes the DC SKU and illustrates its two supplies with separate positive, negative and grounding screw terminals.");
}

/** Draw the separately verified standard rear populations of the 300/400/500/600E enclosures. */
function legacyRackERear(generation, dc) {
  const fourFans = generation === 400 || generation === 600;
  return [
    ...Array.from({ length: fourFans ? 4 : 3 }, (_, index) => element("fan", (fourFans ? .089 : .107) + index * .098,
      .10, .088, .80, `FAN${index + 1}`, "fixed")),
    element("module-bay", fourFans ? .699 : .707, .025, .121, .95, "PWR2 OPTIONAL", "blank"),
    element("psu", fourFans ? .842 : .852, .025, .121, .95, "PWR1", dc ? "dc-terminal2" : "ac"),
  ];
}

/** Trace the distinct high-port-count and 10GE-uplink E-series panels using each model's own guide. */
function addLegacyRackE(profile, device) {
  const generation = Number(device.model.match(/ ([3456])0/)[1]) * 100;
  const dense = generation <= 400;
  inspected(profile, `${generation}E`, "3–4 (front; standard rear)");
  notePhysicalLabels(profile);
  const copperColumns = dense ? [.361, .394, .427, .460, .510, .543, .575, .607] : [.580, .613, .662, .695];
  const opticalColumns = dense ? [.655, .689, .723, .757, .798, .832, .865, .899] : [.769, .802, .849, .883];
  const copperEnd = dense ? 18 : 10;
  const opticalEnd = dense ? 34 : 18;
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", dense ? .218 : .367, .64, .032, .22);
    const y = index % 2 ? .70 : .39;
    if (index < 2) return namedSlot(port, dense ? index ? "HA" : "MGMT" : index ? "MGMT" : "HA",
      dense ? index ? .307 : .263 : .417, dense ? .64 : y, .032, .22);
    if (index < copperEnd) return namedSlot(port, String(index - 1), copperColumns[Math.floor((index - 2) / 2)], y, .027, .22);
    if (index < opticalEnd) return namedSlot(port, index >= opticalEnd - 2 ? `VW${index - opticalEnd + 3}` :
      index >= opticalEnd - 4 ? `S${index - opticalEnd + 5}` : String(index - 1), opticalColumns[Math.floor((index - copperEnd) / 2)], y, .029, .22);
    return namedSlot(port, `X${index - opticalEnd + 1}`, .942, y, .030, .22);
  });
  profile.faces.front.components = [element("text", .020, .115, .122, .11, device.model.replace(/-DC$/, "")),
    element("vent", .015, dense ? .55 : .56, dense ? .098 : .210, .29, undefined, "perforated"),
    ...(dense ? [element("vent", .160, .10, .165, .18, undefined, "perforated")] : [
      element("vent", .167, .10, .060, .36, undefined, "perforated"),
      element("vent", .304, .10, .082, .18, undefined, "perforated"),
      element("vent", .448, .12, .090, .70, undefined, "perforated")]),
    ...[.44, .68].map((y) => element("usb", dense ? .161 : .304, y, .028, .11, undefined, "a")),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", dense ? .143 : .250, .43 + index * .105, .004, .035),
      element("text", dense ? .112 : .260, .42 + index * .105, .027, .065, label),
    ])];
  profile.faces.rear.components = legacyRackERear(generation, device.model.endsWith("-DC"));
  profile.limitations.push("The guide's standard configuration has one installed power supply and the optional second bay blank. The 300/500E rear has three fans; the separately illustrated 400/600E rear has four.");
}

/** Trace the 200E/201E's WAN bank, storage-only status indicator and fourteen-contact rear RPS inlet. */
function add200E(profile, device) {
  inspected(profile, "200E", "3 (front; rear; separate 201E indicator drawing)");
  notePhysicalLabels(profile);
  const dataColumns = [.509, .541, .577, .610, .644, .687, .720];
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .370, .47, .032, .22);
    const y = index % 2 ? .64 : .34;
    if (index < 2) return namedSlot(port, index ? "MGMT" : "HA", .423, y, .032, .22);
    if (index < 4) return namedSlot(port, `WAN${index - 1}`, .475, y, .032, .22);
    if (index < 18) return namedSlot(port, String(index - 3), dataColumns[Math.floor((index - 4) / 2)], y, .029, .22);
    return namedSlot(port, String(index - 3), index < 20 ? .831 : .864, y, .030, .22);
  });
  profile.faces.front.components = [element("text", .025, .17, .132, .11, device.model),
    element("vent", .018, .54, .255, .33, undefined, "perforated"),
    element("vent", .181, .10, .085, .41, undefined, "perforated"),
    element("vent", .895, .09, .085, .80, undefined, "perforated"),
    element("usb", .354, .690, .032, .10, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "PWR"].flatMap((label, index) => [
      element("led", .320, .46 + index * .087, .004, .027),
      element("text", .327, .45 + index * .087, .025, .060, label),
    ]),
    ...(device.model === "FortiGate 201E" ? [element("led", .290, .721, .004, .027),
      element("text", .276, .62, .030, .070, "HDD")] : [])];
  profile.faces.rear.components = [element("vent", .122, .20, .208, .69, undefined, "perforated"),
    element("vent", .378, .20, .107, .69, undefined, "perforated"),
    { ...element("power", .620, .43, .080, .40, undefined, "dc-multipin"), columns: 7 },
    element("text", .612, .18, .096, .10, "RPS 12V"),
    element("power", .880, .28, .050, .52, undefined, "iec"),
    element("switch", .936, .30, .035, .50, undefined, "power")];
}

/** Trace the cellular 50G/51G's five exposed SMA sockets, separate BLE cap and rear-only Ethernet bank. */
function add50GCellular(profile, device) {
  inspected(profile, "50G-5G", "5–6 (front; rear), cover explicitly lists FG-50G-5G and FG-51G-5G");
  notePhysicalLabels(profile);
  profile.defaultFace = "rear";
  profile.faces.front.ports = [];
  profile.faces.rear.ports = device.ports.map((port, index) => port.type === "Console" ?
    namedSlot(port, "CONSOLE", .201, .578, .067, .24) :
    namedSlot(port, ["WAN", "A", "3", "2", "1"][index], .653 + index * .065, .578, .060, .24));
  profile.faces.front.components = [
    element("text", .137, .48, .22, .11, "FortiGate 50G-5G"),
    ...[.035, .922].map((x) => element("coax", x, .14, .045, .25)),
    ...[.035, .922].map((x) => element("text", x, .43, .045, .075, "5G")),
    element("coax", .878, .49, .039, .22, undefined, "capped"),
    element("text", .873, .77, .050, .075, "BLE"),
    element("button", .049, .680, .010, .040, undefined, "reset"),
    element("text", .025, .78, .067, .065, "BLE/RESET"),
    element("led", .095, .72, .008, .045),
    element("text", .087, .81, .030, .065, "BLE"),
    element("led", .205, .76, .008, .045),
    element("text", .171, .85, .09, .070, "SIGNED FW"),
    ...[0, 1, 2].map((index) => element("led", .365 + index * .024, .723, .008, .045)),
    element("text", .320, .641, .119, .070, "PWR STATUS HA"),
    ...["SVC", "5G"].flatMap((label, index) => [
      element("led", .460, .572 + index * .151, .008, .045),
      element("text", .450, .496 + index * .151, .030, .070, label),
    ]),
    ...[.572, .723].flatMap((y) => Array.from({ length: 5 }, (_, index) => element("led", .580 + index * .024, y, .008, .045))),
    element("text", .568, .48, .131, .070, "1 2 3 A WAN"),
    element("text", .699, .562, .060, .070, "LINK/ACT"),
    element("text", .699, .713, .060, .070, "SPEED"),
  ];
  profile.faces.rear.components = [
    ...[.013, .477, .941].map((x) => element("coax", x, .075, .045, .25)),
    ...["5G", "GPS", "5G"].map((label, index) => element("text", [.013, .477, .941][index], .338, .045, .075, label)),
    element("vent", .082, .090, .383, .20, undefined, "slots"),
    element("vent", .531, .090, .390, .20, undefined, "slots"),
    element("power", .067, .350, .030, .415, undefined, "dc-keyed2"),
    element("usb", .115, .410, .028, .350, undefined, "a"),
    element("module-bay", .258, .526, .035, .46, "", "blank"),
    element("text", .246, .350, .065, .120, "SIGNED FW"),
    element("vent", .312, .409, .285, .398, undefined, "slots"),
  ];
  profile.limitations.push("Five exposed SMA sockets are shown separately from the BLE antenna cap. The signed-firmware switch is under its illustrated rear access cover; external antenna rods and internal SIM slots are outside the panel view.");
}

/** Trace the single upper intake grille and lower control strip illustrated separately in the large E-series guides. */
function legacyLargeEControls(model) {
  return [element("vent", .009, .018, .982, .465, undefined, "perforated"),
    element("text", .014, .531, .135, .06, model),
    element("usb", .095, .748, .012, .16, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .056, .716 + index * .046, .004, .022),
      element("text", .010, .711 + index * .046, .039, .032, label),
    ])];
}

/** Place the opposite-end vertical supplies and four separately identified fan grilles on inspected two-unit E models. */
function legacyLargeERear(dc, ground = true) {
  return [
    ...[.018, .888].map((x, index) => ({ ...element("psu", x, .035, .096, .67, `PWR${index + 1}`, dc ? "dc-terminal2" : "ac"),
      orientation: "vertical" })),
    ...[.132, .323, .514, .705].map((x, index) => element("fan", x, .15, .178, .80, `FAN${index + 1}`, "fixed")),
    ...(ground ? [.048, .088].map((x) => element("screw", x, .842, .020, .085)) : []),
  ];
}

/** Trace the 2201E-ACDC and 3300E/3301E drawings, keeping their differently positioned copper banks distinct. */
function add22013300E(profile, device) {
  const newer = device.model.startsWith("FortiGate 220");
  const acdc = device.model.endsWith("-ACDC");
  inspected(profile, newer ? acdc ? "2201E-ACDC" : "2200E-ds" : "3300E",
    newer ? acdc ? "7 front; 8 rear" : "7 front and rear; 8 both model specifications" : "3 front; 4 rear");
  notePhysicalLabels(profile);
  profile.faces.front.components = legacyLargeEControls(device.model.replace("FortiGate ", ""));
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .137, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .189, y, .031, .12);
    if (index < 14) return namedSlot(port, String(index - 1), .242 + Math.floor((index - 2) / 2) * .0334 +
      (index >= 10 ? .013 : 0), y, .030, .12);
    if (index < 18) {
      const position = namedSlot(port, String(index - 1), (newer ? .539 : .462) + Math.floor((index - 14) / 2) * .034,
        y, .030, .12);
      return newer ? position : { ...position, compatibleTypes: ["RJ45_1G"] };
    }
    if (index < 34) return namedSlot(port, index >= 32 ? `HA${index - 31}` : String(index - 1),
      .615 + Math.floor((index - 18) / 2) * .034, y, .030, .12);
    const position = namedSlot(port, String(index - 3), .913 + Math.floor((index - 34) / 2) * .047, y, .038, .12);
    return newer ? position : { ...position, compatibleTypes: ["QSFP28_100G"] };
  });
  profile.faces.rear.components = legacyLargeERear(false);
  if (acdc) profile.hardwareRevision = "FG-2201E-ACDC QuickStart Guide, June 10, 2025; explicitly illustrated C16 AC inlets.";
  else if (!newer) profile.limitations.push("Inventory revision 1 adds two missing copper endpoints, identifies data13–16 as 10GE and QSFP31–34 as 40GE. Legacy indices and saved media configuration are mapped without rewriting them.");
}

/** Trace each 3400E/3401E and 3600E/3601E optical bank and its separately pictured AC or DC rear. */
function add34003600E(profile, device) {
  const larger = device.model.includes("360");
  const dc = device.model.endsWith("-DC");
  inspected(profile, larger ? "3600E" : "3400E", "3 front; 4 AC and DC rears");
  notePhysicalLabels(profile);
  const opticalEnd = larger ? 34 : 26;
  profile.faces.front.components = legacyLargeEControls(device.model.replace("FortiGate ", "").replace(/-DC$/, ""));
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .81, .032, .12);
    const y = index % 2 ? .83 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .184, y, .031, .12);
    if (index < opticalEnd) {
      const column = Math.floor((index - 2) / 2);
      return namedSlot(port, index < 4 ? `HA${index - 1}` : String(index - 3),
        .246 + column * .0336 + Math.floor(column / 4) * .010, y, .030, .12);
    }
    return namedSlot(port, String(index - 3), .846 + Math.floor((index - opticalEnd) / 2) * .052, y, .040, .12);
  });
  profile.faces.rear.components = legacyLargeERear(dc, !larger || dc);
  profile.limitations.push(larger
    ? "Inventory revision 1 restores eight SFP28 and two QSFP28 sockets omitted by the former family inventory. Explicit mappings preserve existing saved optical and console connections."
    : "Inventory revision 1 removes the former extra console entry. The first31 saved physical indices retain their sockets; the second console remains an unmapped endpoint.");
}

/** Trace the two explicitly different 3960E/3980E fronts and the dual fan trays with three vertical rear supplies. */
function add39603980E(profile, device) {
  const larger = device.model.includes("3980");
  const dc = device.model.endsWith("-DC");
  inspected(profile, "3960E", "3 model-specific fronts; 5 AC and DC rears");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .101, .880, .032, .08);
    const y = index % 2 ? .918 : .862;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .152, y, .031, .054);
    if (index < 18) return { ...namedSlot(port, String(index - 1), .195 + Math.floor((index - 2) / 2) * .0335,
      y, .030, .054), compatibleTypes: ["SFP28_25G"] };
    const column = index - 18;
    return namedSlot(port, String(index - 1), larger ? .483 + column * .0448 : .482 + column * .043 + Math.floor(column / 2) * .046,
      .924, .039, .057);
  });
  profile.faces.front.components = [element("vent", .010, .023, .978, .60, undefined, "perforated"),
    element("vent", .240, .620, .748, .132, undefined, "perforated"),
    element("text", .018, .676, .180, .044, device.model.replace("FortiGate ", "").replace(/-DC$/, "")),
    element("usb", .085, .938, .031, .034, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .035, .851 + index * .023, .004, .014),
      element("text", .007, .848 + index * .023, .026, .022, label),
    ]),
    ...(larger ? [element("vent", .454, .818, .460, .066, undefined, "slots")]
      : [.457, .588, .724].map((x) => element("vent", x, .818, .090, .066, undefined, "slots"))),
  ];
  profile.faces.rear.components = [element("handle", .030, .089, .025, .70),
    element("module-bay", .410, .080, .113, .88, "", "blank"),
    ...[.114, .557].flatMap((x) => [
      element("fan", x, .073, .222, .418, "", "fixed"),
      element("fan", x, .499, .222, .418, "", "fixed"),
      element("handle", x + .222, .369, .021, .26),
    ]),
    ...[.076, .341, .607].map((y, index) => ({ ...element("psu", .892, y, .098, .257, `PWR${index + 1}`, dc ? "dc-terminal2" : "ac"),
      orientation: "vertical" })),
    ...[.905, .955].map((x) => element("screw", x, .911, .020, .054)),
  ];
  profile.limitations.push("Inventory revision 1 replaces the former family port mix with the illustrated sixteen SFP+ and model-specific QSFP28 count. Surplus saved endpoints remain unmapped; surviving endpoints retain explicit index and media compatibility mappings.");
}

/** Preserve prior E-series endpoint indices across corrections without assigning surplus saved sockets to new physical ports. */
function addLegacyEMapping(profile, device) {
  const model = device.model;
  let portIndexMap;
  if (/^FortiGate 330[01]E$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => ![17, 18].includes(port.portIndex))
      .map((port) => [port.portIndex > 18 ? port.portIndex - 2 : port.portIndex, port.portIndex]));
  } else if (/^FortiGate 340[01]E(?:-DC)?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.map((port) => [port.portIndex, port.portIndex]));
  } else if (/^FortiGate 360[01]E(?:-DC)?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => port.portIndex <= 26 ||
      port.portIndex >= 35 && port.portIndex <= 38 || port.type === "Console")
      .map((port) => [port.type === "Console" ? 31 : port.portIndex <= 26 ? port.portIndex : port.portIndex - 8, port.portIndex]));
  } else if (/^FortiGate 39[68]0E(?:-(?:DC|ACDC))?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => port.portIndex <= 26 || port.type === "Console")
      .map((port) => [port.type === "Console" ? 43 : port.portIndex <= 18 ? port.portIndex : port.portIndex + 16, port.portIndex]));
  } else if (/^FortiGate (?:2000E|2500E)$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => port.portIndex <= 14 || port.type === "SFP_PLUS_10G" || port.type === "Console")
      .map((port) => [port.type === "Console" ? 39 : port.portIndex <= 14 ? port.portIndex : port.portIndex - 20, port.portIndex]));
  } else if (model === "FortiGate 400E-Bypass") {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => port.portIndex <= 18 || port.type === "Console")
      .map((port) => [port.portIndex, port.portIndex]));
  }
  if (portIndexMap) profile.legacyLayouts = [{ inventoryRevision: 0, portIndexMap }];
}

/** Trace the independently illustrated 2000E and 2500E fronts, including the latter's fixed LC bypass sockets. */
function add20002500E(profile, device) {
  const bypass = device.model === "FortiGate 2500E";
  inspected(profile, bypass ? "2500E-ds" : "2000E", bypass ? "7 front and rear" : "3 front; 4 rear");
  notePhysicalLabels(profile);
  profile.faces.front.components = [element("text", .012, .085, .15, .10, device.model.replace("FortiGate ", "")),
    element("vent", .178, .080, .798, .40, undefined, "perforated"),
    element("vent", .022, .295, .156, .185, undefined, "perforated"),
    element("usb", .049, .769, .029, .058, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .028, .619 + index * .058, .005, .026),
      element("text", .002, .614 + index * .058, .024, .035, label),
    ]),
    ...(bypass ? [element("led", .907, .680, .006, .032), element("text", .884, .606, .022, .04, "BP")] : []),
  ];
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .063, .676, .031, .12);
    const y = index % 2 ? .810 : .660;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .109, y, .031, .12);
    if (index < 34) {
      const column = Math.floor((index - 2) / 2);
      return namedSlot(port, String(index - 1), .155 + column * .0331 + (column >= 8 ? .008 : 0), y, .030, .12);
    }
    if (port.type === "FIBER_LC") return namedSlot(port, String(index - 1), .927, y, .026, .12);
    const column = Math.floor((index - 34) / 2);
    return { ...namedSlot(port, String(index - 1), (bypass ? .697 : .762) + column * .0338 +
      (column >= (bypass ? 4 : 2) ? .008 : 0), y, .030, .12), compatibleTypes: ["SFP28_25G"] };
  });
  profile.faces.rear.components = [
    ...[.055, .279, .506].map((x, index) => element("fan", x, .163, .183, .78, `FAN${index * 2 + 1}/${index * 2 + 2}`, "fixed")),
    ...[.716, .848].map((x, index) => element("psu", x, .454, .128, .459, `PWR${index + 1}`, "ac")),
    ...[.620, .860].map((y) => element("screw", .014, y, .023, .085)),
  ];
  profile.limitations.push("Three rear grille openings cover six tandem fans; only the exposed openings are drawn. Inventory revision 1 corrects the former family mix without assigning surplus saved optical endpoints to new copper sockets.");
}

/** Trace the 400E-Bypass's sixteen copper bypass pairs and two installed rear supplies. */
function add400EBypass(profile, device) {
  inspected(profile, "400E-Bypass", "2 front; 3 rear");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .132, .640, .032, .24);
    if (index < 2) return namedSlot(port, index ? "MGMT" : "HA", .177, index ? .630 : .350, .031, .24);
    const column = Math.floor((index - 2) / 2);
    return namedSlot(port, String(index - 1), .238 + column * .0368 + Math.floor(column / 2) * .0212,
      index % 2 ? .630 : .350, .031, .24);
  });
  profile.faces.front.components = [element("text", .012, .11, .151, .11, "400E-BYPASS"),
    element("usb", .074, .505, .012, .285, undefined, "a"),
    element("usb", .095, .505, .012, .285, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .043, .470 + index * .090, .004, .04),
      element("text", .009, .465 + index * .090, .030, .055, label),
    ]),
    ...Array.from({ length: 8 }, (_, index) => element("vent", .201 + index * .0948, .21, .010, .57, undefined, "perforated")),
    element("vent", .957, .21, .021, .57, undefined, "perforated"),
  ];
  profile.faces.rear.components = [...[.120, .600].map((y) => element("screw", .046, y, .026, .20)),
    ...[.090, .186, .283, .379].map((x, index) => element("fan", x, .080, .088, .84, `FAN${index + 1}`, "fixed")),
    element("psu", .698, .030, .121, .94, "PWR2", "ac"), element("psu", .838, .030, .121, .94, "PWR1", "ac"),
  ];
  profile.limitations.push("Inventory revision 1 replaces the former optical entries with the documented copper bypass pairs. Existing optical saved endpoints remain unmapped.");
}

/** Draw the 800D's separately numbered WAN bypass partners and its standard single populated power bay. */
function add800D(profile, device) {
  const dc = device.model.endsWith("-DC");
  inspected(profile, "800D", "3 front, AC rear and DC rear");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .238, .540, .033, .25);
    const y = index % 2 ? .565 : .285;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .316, y, .032, .25);
    if (index < 4) return namedSlot(port, String(index - 1), .369 + (index - 2) * .049, .565, .032, .25);
    if (index < 24) {
      const column = Math.floor((index - 4) / 2);
      return namedSlot(port, String(index - 1), .469 + column * .0328 + (column >= 4 ? .014 : 0), y, .030, .25);
    }
    if (index < 26) return namedSlot(port, `WAN${index - 23}`, .369 + (index - 24) * .049, .285, .032, .25);
    return namedSlot(port, String(index - 3), .831 + Math.floor((index - 26) / 2) * .0332, y, .030, .25);
  });
  profile.faces.front.components = [element("text", .020, .130, .135, .14, "800D"),
    element("usb", .173, .363, .031, .10, undefined, "a"), element("usb", .173, .550, .031, .10, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .264, .245 + index * .118, .004, .04),
      element("text", .271, .240 + index * .118, .026, .053, label),
    ]),
  ];
  profile.faces.rear.components = [
    ...[.013, .110, .207, .305, .403].map((x, index) => element("fan", x, .070, .088, .85, `FAN${index + 1}`, "fixed")),
    ...[.567, .617].map((x) => element("screw", x, .530, .023, .23)),
    element("psu", .708, .040, .119, .90, "PWR1", dc ? "dc-recessed3-inlet-right" : "ac-inlet-right"),
    element("module-bay", .850, .045, .121, .90, "PWR2 OPTIONAL", "blank"),
  ];
  profile.limitations.push("The standard illustrated rear has one supply and one optional blank bay. Revision 1 adds WAN1/WAN2 after the existing copper identities; each WAN socket is above its data1/data2 bypass partner.");
}

/** Trace the distinct one- and two-unit mixed-media D fronts and their perforated rear panels. */
function add9001000D(profile, device) {
  const tall = device.model === "FortiGate 1000D";
  inspected(profile, tall ? "1000D" : "900D", "3 front and rear");
  notePhysicalLabels(profile);
  const rowY = tall ? [.656, .801] : [.378, .635];
  const height = tall ? .12 : .24;
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", tall ? .194 : .205, tall ? .790 : .635, .032, height);
    if (port.type === "USB_MINI_CONSOLE") return namedSlot(port, "USB MGMT", tall ? .090 : .102, tall ? .865 : .748, .021, tall ? .050 : .085);
    const y = rowY[index % 2];
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, tall ? .247 : .257, y, .032, height);
    if (index < 18) {
      const offset = index - 2;
      return namedSlot(port, String(offset < 8 ? offset + 9 : offset + 17),
        (offset < 8 ? tall ? .449 : .453 : tall ? .834 : .824) + Math.floor(offset % 8 / 2) * .033, y, .031, height);
    }
    if (index < 34) {
      const offset = index - 18;
      return namedSlot(port, String(offset < 8 ? offset + 1 : offset + 9),
        (offset < 8 ? .301 : .681) + Math.floor(offset % 8 / 2) * .033, y, .031, height);
    }
    return namedSlot(port, index === 34 ? "B" : "A", .615, y, .031, height);
  });
  profile.faces.front.components = tall ? [
    element("text", .019, .070, .135, .12, "1000D"),
    element("vent", .172, .048, .807, .405, undefined, "perforated"),
    element("vent", .020, .295, .153, .158, undefined, "perforated"),
    element("usb", .124, .716, .032, .069, undefined, "a"), element("usb", .124, .814, .032, .069, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .056, .665 + index * .061, .005, .029),
      element("text", .028, .659 + index * .061, .025, .036, label),
    ]),
  ] : [element("text", .020, .110, .111, .15, "900D"),
    element("usb", .134, .432, .032, .10, undefined, "a"), element("usb", .134, .620, .032, .10, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .042 + Math.floor(index / 2) * .027, .608 + index % 2 * .115, .004, .04),
      element("text", .048 + Math.floor(index / 2) * .027, .604 + index % 2 * .115, .015, .055, label),
    ]),
  ];
  profile.faces.rear.components = [
    ...(tall ? [.074, .275, .475].map((x) => element("vent", x, .142, .182, .79, undefined, "perforated"))
      : [.060, .293].map((x) => element("vent", x, .218, .211, .64, undefined, "perforated"))),
    ...[.727, .849].map((x, index) => element("psu", x, tall ? .550 : .052, .117, tall ? .43 : .89, `PWR${index + 1}`, "ac-inlet-right")),
  ];
  profile.limitations.push("The rear drawings expose perforated vent fields, without separately visible fan modules. Revision 1 appends the separate USB management endpoint without changing older identities.");
  if (tall) profile.limitations.push("The guide calls the USB management interface USB B; its enlarged drawing shows the five-contact mini-B receptacle.");
}

/** Trace each 3000D/3100D/3200D optical-bank arrangement and the independently pictured AC/DC supply connectors. */
function add300031003200D(profile, device) {
  const model = device.model.replace("FortiGate ", "").replace(/-DC$/, "");
  const dc = device.model.endsWith("-DC");
  const wide = model === "3200D";
  inspected(profile, model, wide ? "5 front; 6 AC and DC rears" : "3 front; 4 AC and DC rears");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", wide ? .094 : .080, .702, .032, .12);
    const y = index % 2 ? .810 : .665;
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, wide ? .142 : .127, y, .032, .12);
    const column = Math.floor((index - 2) / 2);
    return namedSlot(port, String(index - 1), (wide ? .188 : .446) + column * .0331 + Math.floor(column / 8) * .010,
      y, .030, .12);
  });
  profile.faces.front.components = [element("text", .018, .072, .137, .115, model),
    element("vent", .173, .049, .807, .405, undefined, "perforated"),
    element("vent", .021, .289, .152, .166, undefined, "perforated"),
    element("usb", wide ? .079 : .065, .815, .030, .055, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .026, .650 + index * .061, .004, .023),
      element("text", .004, .643 + index * .061, .019, .032, label),
    ]),
    ...(!wide ? [element("vent", .173, .578, .245, .286, undefined, "perforated")] : []),
    ...(model === "3000D" ? [element("vent", .709, .578, .271, .286, undefined, "perforated")] : []),
  ];
  profile.faces.rear.components = [
    ...[.025, .156].map((x, index) => element("psu", x, .500, .128, .480, `PWR${index + 1}`, dc ? "dc-keyed3-inlet-right" : "ac-inlet-right")),
    ...[.314, .545, .776].map((x, index) => element("fan", x, .173, .182, .78, `FAN${index * 2 + 1}/${index * 2 + 2}`, "fixed")),
    ...[.645, .875].map((y) => element("screw", .966, y, .022, .09)),
  ];
  profile.limitations.push("Three exposed rear grille openings cover tandem fan pairs; the supplies are separately drawn for AC and DC variants.");
  if (wide && !dc) profile.limitations.push("The publisher clips the AC rear figure at both edges on PDF page 6. Its underlying vector outline was inspected to verify the complete power bays and chassis grounding studs.");
  if (model === "3100D") profile.limitations.push("Revision 1 corrects forty-eight catalog SFP+ endpoints to the documented thirty-two. Surplus saved endpoints remain unmapped, and the console keeps an explicit old-index mapping.");
}

/** Trace the 3700D's left QSFP row, right SFP banks and opposite-end vertical supplies. */
function add3700D(profile, device) {
  const dc = device.model.endsWith("-DC");
  inspected(profile, "3700D", "3 front, AC rear and DC rear; 4 connector details");
  notePhysicalLabels(profile);
  profile.faces.front.ports = device.ports.map((port, index) => {
    if (port.type === "Console") return namedSlot(port, "CONSOLE", .116, .783, .032, .080);
    if (port.type === "USB_MINI_CONSOLE") return { ...namedSlot(port, "USB MGMT", .040, .885, .020, .040),
      connectorKind: "usb-mini", compatibleTypes: ["Console"] };
    if (index < 2) return namedSlot(port, `MGMT${index + 1}`, .164, index % 2 ? .859 : .769, .031, .080);
    if (index < 30) {
      const column = Math.floor((index - 2) / 2);
      return namedSlot(port, String(index + 3), .495 + column * .0338 + (column >= 6 ? .015 : 0),
        index % 2 ? .859 : .769, .030, .080);
    }
    return namedSlot(port, String(index - 29), .216 + (index - 30) * .055, .870, .043, .075);
  });
  profile.faces.front.components = [element("vent", .020, .055, .963, .493, undefined, "perforated"),
    element("text", .021, .610, .140, .07, "3700D"), element("usb", .101, .865, .029, .042, undefined, "a"),
    ...["STATUS", "ALARM", "HA", "POWER"].flatMap((label, index) => [
      element("led", .080, .743 + index * .038, .004, .017),
      element("text", .052, .739 + index * .038, .024, .027, label),
    ]),
  ];
  profile.faces.rear.components = [
    ...[.006, .903].map((x, index) => ({ ...element("psu", x, .434, .091, .419, `PWR${index + 1}`, dc ? "dc-terminal2" : "ac"),
      orientation: "vertical" })),
    element("handle", .101, .120, .017, .81), element("handle", .882, .120, .017, .81),
    ...[.160, .389, .618].map((x, index) => element("fan", x, .257, .202, .63, `FAN${index * 2 + 1}/${index * 2 + 2}`, "fixed")),
    ...[.650, .758].map((y) => element("screw", .852, y, .019, .052)),
  ];
  profile.limitations.push("Revision 1 identifies the former second console entry as the illustrated USB mini-B management socket while preserving its saved index. Three grille openings cover six tandem fans.");
}

/** Preserve D-series saved identities when correcting missing WAN/USB sockets or surplus optical inventory. */
function addLegacyDMapping(profile, device) {
  const model = device.model;
  let portIndexMap;
  if (/^FortiGate 800D(?:-DC)?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => ![25, 26].includes(port.portIndex))
      .map((port) => [port.portIndex > 26 ? port.portIndex - 2 : port.portIndex, port.portIndex]));
  } else if (/^FortiGate (?:900D|1000D)$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.filter((port) => port.type !== "USB_MINI_CONSOLE").map((port) => [port.portIndex, port.portIndex]));
  } else if (/^FortiGate 3100D(?:-DC)?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.map((port) => [port.type === "Console" ? 51 : port.portIndex, port.portIndex]));
  } else if (/^FortiGate 3700D(?:-DC)?$/.test(model)) {
    portIndexMap = Object.fromEntries(device.ports.map((port) => [port.portIndex, port.portIndex]));
  }
  if (portIndexMap) profile.legacyLayouts = [{ inventoryRevision: 0, portIndexMap }];
}
