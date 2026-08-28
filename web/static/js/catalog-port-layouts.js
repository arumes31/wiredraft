const FORTINET_PORT_SOURCES = Object.freeze({
  "FortiGate 40F": "https://docs.fortinet.com/document/fortigate/7.6.0/hardware-acceleration/965349/fortigate-40f-fast-path-architecture",
  "FortiGate 60F": "https://docs.fortinet.com/document/fortigate/7.6.2/hardware-acceleration/758378/fortigate-60f-and-61f-fast-path-architecture",
  "FortiGate 70F": "https://docs.fortinet.com/document/fortigate/7.0.15/hardware-acceleration/749156/fortigate-70f-and-71f-fast-path-architecture",
  "FortiGate 70G": "https://docs.fortinet.com/document/fortigate/7.4.9/hardware-acceleration/218161/fortigate-70g-and-71g-fast-path-architecture",
  "FortiGate 80F": "https://docs.fortinet.com/document/fortigate/7.2.11/hardware-acceleration/300792/fortigate-80f-81f-and-80f-bypass-fast-path-architecture",
  "FortiGate 100F": "https://docs.fortinet.com/document/fortigate/7.6.6/hardware-acceleration/47902/fortigate-100f-and-101f-fast-path-architecture",
  "FortiGate 200E": "https://docs.fortinet.com/document/fortigate/6.2.17/hardware-acceleration/854455/fortigate-200e-and-201e-fast-path-architecture",
  "FortiGate 200F": "https://docs.fortinet.com/document/fortigate/7.0.10/hardware-acceleration/336140/fortigate-200f-and-201f-fast-path-architecture",
  "FortiGate 400F": "https://docs.fortinet.com/document/fortigate/7.2.5/hardware-acceleration/785717/fortigate-400f-and-401f-fast-path-architecture",
  "FortiGate 600F": "https://docs.fortinet.com/document/fortigate/7.4.7/hardware-acceleration/589036/fortigate-600f-and-601f-fast-path-architecture",
  "FortiGate 6000F": "https://docs.fortinet.com/document/fortigate/7.4.9/fortigate-6000-administration-guide/343054/front-panel-interfaces",
});

const FORTIGATE_40F_60F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/fd70142f-ff2f-11e9-8977-00505692583a/FG-FWF-40F-60F-Series-QSG.pdf";
const FORTIGATE_70F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/19f0e644-700b-11ed-8e6d-fa163e15d75b/FG-70F-Series-QSG.pdf";
const FORTIGATE_70G_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/729241d1-cdfc-11ef-91d4-7a9b9721b752/FG-70G-71G-QSG.pdf";
const FORTIGATE_80F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/13f24f18-1d87-11ec-8c53-00505692583a/FG-80F-Series-QSG.pdf";
const FORTIGATE_100F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/42d64717-83f1-11e9-81a4-00505692583a/FG-100F-QSG.pdf";
const FORTIGATE_200E_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/da490160-1a0a-11e9-9685-f8bc1258b856/FortiGate-200E-201E-QSG.pdf";
const FORTIGATE_200F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/89694abf-1ef2-11eb-96b9-00505692583a/FG-200F-Series-QSG.pdf";
const FORTIGATE_400F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/d6bb2d09-86df-11ed-8e6d-fa163e15d75b/FG-400F-QSG.pdf";
const FORTIGATE_600F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/518f6a17-f647-11ec-bb32-fa163e15d75b/FG-600F-Series-QSG.pdf";

const VERIFIED_MODEL_SOURCES = Object.freeze({
  "Palo Alto:PA-440 / PA-450": "https://docs.paloaltonetworks.com/hardware/pa-400-hardware-reference/pa-400-firewall-overview/pa-400-front-panel",
  "Sophos:XGS 2100 / 2300": "https://docs.sophos.com/nsg/hardware/operatinginstructions/xgs/sophos-operating-instructions-xgs-2100-2300-3100-3300.pdf",
});

const exactFortiGateLayouts = new Map([
  ["FortiGate 40F", zones(["WAN", "A", "1", "2", "3"], [], ["CONSOLE"])],
  ["FortiGate 60F", zones(["1", "2", "3", "4", "5", "A", "B", "DMZ", "WAN1", "WAN2"], [], ["CONSOLE"])],
  ["FortiGate 70F", zones(["1", "2", "3", "4", "5", "A", "B", "DMZ", "WAN1", "WAN2"], [], ["CONSOLE"])],
  ["FortiGate 70G", zones(["1", "2", "3", "4", "5", "6", "A", "B", "WAN1", "WAN2"], [], ["CONSOLE"])],
  ["FortiGate 80F", zones(["1", "2", "3", "4", "5", "6", "A", "B", "WAN1", "WAN2"], ["SFP1", "SFP2"], ["CONSOLE"])],
  ["FortiGate 100F", zones(["DMZ", "MGMT", "WAN1", "WAN2", "HA1", "HA2", ...range(1, 12)], [...range(13, 20), "X1", "X2"], ["CONSOLE"])],
  ["FortiGate 200E", zones(["MGMT", "HA", "WAN1", "WAN2", ...range(1, 14)], range(15, 18), ["CONSOLE"])],
  ["FortiGate 200F", zones(["HA", "MGMT", ...range(1, 16)], [...range(17, 24), "X1", "X2", "X3", "X4"], ["CONSOLE"])],
  ["FortiGate 400F", zones(["HA", "MGMT", ...range(1, 16)], [...range(17, 24), "X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8"], ["CONSOLE"])],
  ["FortiGate 600F", zones(["HA", "MGMT", ...range(1, 16)], [...range(17, 24), "X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8"], ["CONSOLE"])],
  ["FortiGate 6000F", zones([], [...range(1, 28)], ["HA1", "HA2", "MGMT1", "MGMT2", "MGMT3", "CONSOLE1", "CONSOLE2"])],
]);

const exactFortiGateFaceplates = new Map([
  ["FortiGate 40F", faceplateLayout(FORTIGATE_40F_60F_QSG, [
    [["WAN", "A", "3", "2", "1"], portRow(5, .63, .91, .55)],
    [["CONSOLE"], [{ x: .25, y: .55 }]],
  ])],
  ["FortiGate 60F", faceplateLayout(FORTIGATE_40F_60F_QSG, [
    [["WAN2", "WAN1", "DMZ", "B", "A", "5", "4", "3", "2", "1"], portRow(10, .36, .92, .55)],
    [["CONSOLE"], [{ x: .2, y: .55 }]],
  ])],
  ["FortiGate 70F", faceplateLayout(FORTIGATE_70F_QSG, [
    [["WAN2", "WAN1", "DMZ", "B", "A", "5", "4", "3", "2", "1"], portRow(10, .36, .92, .55)],
    [["CONSOLE"], [{ x: .2, y: .55 }]],
  ])],
  ["FortiGate 70G", faceplateLayout(FORTIGATE_70G_QSG, [
    [["WAN2", "WAN1", "B", "A", "6", "5", "4", "3", "2", "1"], portRow(10, .36, .92, .55)],
    [["CONSOLE"], [{ x: .2, y: .55 }]],
  ])],
  ["FortiGate 80F", faceplateLayout(FORTIGATE_80F_QSG, [
    [["1", "2", "3", "4", "5", "6", "A", "B"], portGrid(8, .58, .88, .4, .7)],
    [["WAN1", "WAN2"], [{ x: .43, y: .4 }, { x: .43, y: .7 }]],
    [["SFP1", "SFP2"], [{ x: .31, y: .4 }, { x: .31, y: .7 }]],
    [["CONSOLE"], [{ x: .16, y: .55 }]],
  ])],
  ["FortiGate 100F", faceplateLayout(FORTIGATE_100F_QSG, [
    [["DMZ", "MGMT"], [{ x: .3, y: .4 }, { x: .3, y: .7 }]],
    [["WAN1", "WAN2"], [{ x: .37, y: .4 }, { x: .37, y: .7 }]],
    [["HA1", "HA2"], [{ x: .44, y: .4 }, { x: .44, y: .7 }]],
    [range(1, 12), portGrid(12, .51, .72, .4, .7)],
    [range(13, 20), portGrid(8, .79, .88, .4, .7)],
    [["X1", "X2"], [{ x: .95, y: .4 }, { x: .95, y: .7 }]],
    [["CONSOLE"], [{ x: .235, y: .7 }]],
  ])],
  ["FortiGate 200E", faceplateLayout(FORTIGATE_200E_QSG, [
    [["HA", "MGMT", "WAN1", "WAN2"], portRow(4, .39, .54, .55)],
    [range(1, 14), portGrid(14, .59, .79, .4, .7)],
    [range(15, 18), portGrid(4, .87, .93, .4, .7)],
    [["CONSOLE"], [{ x: .32, y: .55 }]],
  ])],
  ["FortiGate 200F", faceplateLayout(FORTIGATE_200F_QSG, [
    [["HA", "MGMT"], [{ x: .23, y: .4 }, { x: .23, y: .7 }]],
    [range(1, 16), portGrid(16, .32, .56, .4, .7)],
    [["X1", "X2", "X3", "X4"], portGrid(4, .64, .7, .4, .7)],
    [range(17, 24), portGrid(8, .79, .91, .4, .7)],
    [["CONSOLE"], [{ x: .16, y: .55 }]],
  ])],
  ["FortiGate 400F", faceplateLayout(FORTIGATE_400F_QSG, [
    [["HA", "MGMT"], [{ x: .2, y: .4 }, { x: .2, y: .7 }]],
    [range(1, 16), portGrid(16, .29, .54, .4, .7)],
    [["X1", "X2", "X3", "X4"], portGrid(4, .63, .69, .4, .7)],
    [["X5", "X6", "X7", "X8"], portGrid(4, .75, .81, .4, .7)],
    [range(17, 24), portGrid(8, .86, .95, .4, .7)],
    [["CONSOLE"], [{ x: .14, y: .55 }]],
  ])],
  ["FortiGate 600F", faceplateLayout(FORTIGATE_600F_QSG, [
    [["HA", "MGMT"], [{ x: .22, y: .4 }, { x: .22, y: .7 }]],
    [range(1, 16), portGrid(16, .3, .55, .4, .7)],
    [range(17, 24), portGrid(8, .64, .75, .4, .7)],
    [["X1", "X2", "X3", "X4"], portGrid(4, .8, .85, .4, .7)],
    [["X5", "X6", "X7", "X8"], portGrid(4, .9, .95, .4, .7)],
    [["CONSOLE"], [{ x: .15, y: .55 }]],
  ])],
]);

const FORTISWITCH_1024E_QSG = "https://docs.fortinet.com/document/fortiswitch/hardware/fortiswitch-t1024e-1024e-quickstart-guide";
const FORTISWITCH_124E_QSG = "https://docs.fortinet.com/document/fortiswitch/hardware/fortiswitch-124e-series-quickstart-guide";
const FORTISWITCH_124F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/67241563-25de-11eb-96b9-00505692583a/FortiSwitch-124F-Series-QSG.pdf";
const FORTISWITCH_148E_QSG = "https://docs.fortinet.com/document/fortiswitch/hardware/fortiswitch-148e-series-quickstart-guide";
const FORTISWITCH_148F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3f38a8b3-0a5f-11eb-96b9-00505692583a/FortiSwitch-148F-Series-QSG.pdf";
const FORTISWITCH_124G_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/1c64a2db-dd9e-11ef-8766-ca4255feedd9/FortiSwitch-124G-Series-QSG.pdf";
const FORTISWITCH_624F_648F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/073bc97f-589d-11ee-8e6d-fa163e15d75b/FS-624F-648F-Series-QSG.pdf";
const FORTISWITCH_110G_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e9bb65da-5e6b-11ef-bfe5-fa163e15d75b/FortiSwitch-110G-FPOE-QSG.pdf";
const FORTISWITCH_108F_QSG = "https://docs.fortinet.com/document/fortiswitch/hardware/fortiswitch-108f-series-qsg";
const FORTISWITCH_424E_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3c36fae6-fe82-11ea-96b9-00505692583a/FortiSwitch-424E-Series-QSG.pdf";
const FORTISWITCH_448E_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/9f94e4e9-920c-11ea-aafb-00505692583a/FortiSwitch-448E-Series-QSG.pdf";
const FORTISWITCH_1048E_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e5a90707-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-1048E-Series-QuickStart.pdf";
const FORTISWITCH_2048F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/38b7ea4d-92f3-11ee-a142-fa163e15d75b/FS-2048F-QSG.pdf";
const FORTISWITCH_3032E_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3215b9f7-50b3-11e9-94bf-00505692583a/FortiSwitch-3032E-QSG.pdf";
const FORTISWITCH_3032G_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/8f69aa17-aba7-11f0-a43a-72af6d868cc2/FortiSwitch-3032G-QSG.pdf";
const FORTISWITCH_T1024F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/3cd09f8b-2f5a-11ef-8c42-fa163e15d75b/FortiSwitch-T1024F-FPOE-QSG.pdf";
const FORTISWITCH_RUGGED_108F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/76b61865-375d-11f0-a9d0-d2b0d2e22f7d/FSR-108F-QSG.pdf";
const FORTISWITCH_RUGGED_112F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ee25faa8-375c-11f0-a9d0-d2b0d2e22f7d/FSR-112F-POE-QSG.pdf";
const FORTISWITCH_RUGGED_216F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/0b499254-cf8a-11ef-8766-ca4255feedd9/FSR-216F-POE-QSG.pdf";
const FORTISWITCH_RUGGED_424F_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ea180604-eae6-11ed-8e6d-fa163e15d75b/FSR-424F-POE-QSG.pdf";
const FORTISWITCH_224D_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/dd96f287-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-224D-FPOE-QSG.pdf";
const FORTISWITCH_224E_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e80c525a-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-224E-Series-QSG.pdf";
const FORTISWITCH_248D_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/dcbce1f9-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-248D-Series-QSG.pdf";
const FORTISWITCH_248E_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e6a256ac-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-248E-Series-QSG.pdf";
const FORTISWITCH_M426E_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ff713891-de2a-11e9-8977-00505692583a/FortiSwitch-M426E-FPOE-QSG.pdf";
const FORTISWITCH_524D_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e7da2e4b-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-524D-Series-QuickStart.pdf";
const FORTISWITCH_548D_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/e79f907f-202f-11e9-b6f6-f8bc1258b856/FortiSwitch-548D-Series-QuickStart.pdf";
const FORTISWITCH_348G_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/ce3d8422-6a71-11f1-a33a-02356ffb40d9/FortiSwitch-348G-Series-QSG.pdf";
const FORTISWITCH_1048G_QSG = "https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/dfeede22-9992-11f0-855d-6af4c3636dc7/FortiSwitch-1048G-QSG.pdf";

const exactFortiSwitchLayouts = new Map([
  ...exactLayouts(["FortiSwitch 1024E"], FORTISWITCH_1024E_QSG, [
      ["SFP_PLUS_10G:PORT", portGrid(24, .36, .72, .4, .7)],
      ["QSFP28_100G:QSFP28", portGrid(2, .78, .78, .4, .7)],
      ["RJ45_1G:MGMT", [{ x: .84, y: .55 }]],
      ["Console:CONSOLE", [{ x: .235, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch T1024E"], FORTISWITCH_1024E_QSG, [
    ["RJ45_10G:PORT", portGrid(24, .36, .72, .4, .7)],
    ["QSFP28_100G:QSFP28", portGrid(2, .78, .78, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .84, y: .55 }]],
    ["Console:CONSOLE", [{ x: .235, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch T1024F-FPOE"], FORTISWITCH_T1024F_QSG, [
    ["RJ45_10G:PORT", portGrid(24, .42, .76, .4, .7)],
    ["QSFP28_100G:QSFP28", portGrid(2, .82, .82, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .88, y: .4 }]],
    ["Console:CONSOLE", [{ x: .88, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch 1048E"], FORTISWITCH_1048E_QSG, [
    ["SFP_PLUS_10G:PORT", portGrid(48, .025, .81, .4, .7)],
    ["QSFP28_100G:QSFP28", portGrid(4, .84, .88, .4, .7)],
    ["QSFP_PLUS_40G:QSFP+", portGrid(2, .925, .925, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .975, y: .4 }]],
    ["Console:CONSOLE", [{ x: .975, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch 2048F"], FORTISWITCH_2048F_QSG, [
    ["SFP28_25G:PORT", portGrid(48, .04, .64, .4, .7)],
    ["QSFP28_100G:QSFP28", portGrid(8, .71, .84, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portGrid(2, .88, .88, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .94, y: .4 }]],
    ["Console:CONSOLE", [{ x: .94, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch 3032E"], FORTISWITCH_3032E_QSG, [
    ["QSFP28_100G:PORT", portGrid(32, .1, .83, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .89, y: .4 }]],
    ["Console:CONSOLE", [{ x: .89, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch 3032G"], FORTISWITCH_3032G_QSG, [
    ["QSFP28_100G:PORT", portGrid(32, .1, .83, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portGrid(2, .07, .07, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .89, y: .4 }]],
    ["Console:CONSOLE", [{ x: .89, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch 124E", "FortiSwitch 124E-POE", "FortiSwitch 124E-FPOE"], FORTISWITCH_124E_QSG,
    accessSwitch24Layout("SFP_1G:SFP")),
  ...exactLayouts(["FortiSwitch 124F", "FortiSwitch 124F-POE", "FortiSwitch 124F-FPOE"], FORTISWITCH_124F_QSG,
    accessSwitch24Layout("SFP_PLUS_10G:SFP+")),
  ...exactLayouts(["FortiSwitch 148E", "FortiSwitch 148E-POE"], FORTISWITCH_148E_QSG,
    accessSwitch48Layout("SFP_1G:SFP")),
  ...exactLayouts(["FortiSwitch 148F", "FortiSwitch 148F-POE", "FortiSwitch 148F-FPOE"], FORTISWITCH_148F_QSG,
    accessSwitch48Layout("SFP_PLUS_10G:SFP+")),
  ...exactLayouts(["FortiSwitch 124G", "FortiSwitch 124G-FPOE"], FORTISWITCH_124G_QSG, [
    ["RJ45_MGIG:PORT", portGrid(24, .3, .7, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portGrid(6, .77, .89, .4, .7)],
    ["Console:CONSOLE", [{ x: .235, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch 110G-FPOE"], FORTISWITCH_110G_QSG, [
    ["RJ45_MGIG:2.5GE", portGrid(8, .49, .68, .4, .7)],
    ["RJ45_MGIG:5GE", portGrid(2, .755, .755, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portGrid(4, .87, .94, .4, .7)],
    ["Console:CONSOLE", [{ x: .39, y: .55 }]],
  ]),
  ...exactLayouts(["FortiSwitch 108F"], FORTISWITCH_108F_QSG, [
    ["RJ45_1G:PORT", portRow(8, .17, .77, .55)],
    ["SFP_1G:SFP", portRow(2, .86, .94, .55)],
  ]),
  ...exactLayouts(["FortiSwitch 108F-POE", "FortiSwitch 108F-FPOE"], FORTISWITCH_108F_QSG, [
    ["RJ45_1G:PORT", portRow(8, .29, .74, .55)],
    ["SFP_1G:SFP", portRow(2, .84, .91, .55)],
    ["Console:CONSOLE", [{ x: .18, y: .55 }]],
  ]),
  ...exactLayouts(["FortiSwitch 424E", "FortiSwitch 424E-POE", "FortiSwitch 424E-FPOE"], FORTISWITCH_424E_QSG, [
    ["RJ45_1G:PORT", portGrid(24, .43, .78, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portRow(4, .86, .96, .55)],
    ["RJ45_1G:MGMT", [{ x: .055, y: .4 }]],
  ]),
  ...exactLayouts(["FortiSwitch 424E-Fiber"], FORTISWITCH_424E_QSG, [
    ["SFP_1G:PORT", portGrid(24, .43, .78, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portRow(4, .86, .96, .55)],
    ["RJ45_1G:MGMT", [{ x: .055, y: .4 }]],
  ]),
  ...exactLayouts(["FortiSwitch 448E", "FortiSwitch 448E-POE", "FortiSwitch 448E-FPOE"], FORTISWITCH_448E_QSG, [
    ["RJ45_1G:PORT", portGrid(48, .19, .88, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portGrid(4, .94, .97, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .06, y: .4 }]],
  ]),
  ...exactLayouts(["FortiSwitch 624F", "FortiSwitch 624F-FPOE"], FORTISWITCH_624F_648F_QSG, [
    ["RJ45_MGIG:MGIG", portGrid(24, .42, .72, .4, .7)],
    ["SFP28_25G:SFP28", portGrid(4, .79, .85, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .96, y: .4 }]],
    ["Console:CONSOLE", [{ x: .96, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch 648F", "FortiSwitch 648F-FPOE"], FORTISWITCH_624F_648F_QSG, [
    ["RJ45_MGIG:2.5GE", portGrid(32, .05, .52, .4, .7)],
    ["RJ45_MGIG:5GE", portGrid(16, .55, .75, .4, .7)],
    ["SFP28_25G:SFP28", portGrid(8, .79, .87, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .96, y: .4 }]],
    ["Console:CONSOLE", [{ x: .96, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch Rugged 108F"], FORTISWITCH_RUGGED_108F_QSG, [
    ["RJ45_1G:PORT", portGrid(6, .58, .78, .34, .64)],
    ["SFP_1G:SFP", portRow(2, .64, .78, .82)],
    ["Console:CONSOLE", [{ x: .38, y: .48 }]],
    ["RJ45_1G:MGMT", [{ x: .38, y: .82 }]],
  ]),
  ...exactLayouts(["FortiSwitch Rugged 112F-POE"], FORTISWITCH_RUGGED_112F_QSG, [
    ["RJ45_1G:PORT", portGrid(8, .34, .7, .34, .58)],
    ["SFP_1G:SFP", portRow(4, .34, .7, .82)],
    ["Console:CONSOLE", [{ x: .78, y: .2 }]],
    ["RJ45_1G:MGMT", [{ x: .18, y: .82 }]],
  ]),
  ...exactLayouts(["FortiSwitch Rugged 216F-POE"], FORTISWITCH_RUGGED_216F_QSG, [
    ["RJ45_1G:PORT", portGrid(16, .3, .72, .43, .66)],
    ["SFP_PLUS_10G:SFP+", portRow(4, .3, .5, .2)],
    ["Console:CONSOLE", [{ x: .72, y: .82 }]],
    ["RJ45_1G:MGMT", [{ x: .57, y: .82 }]],
  ]),
  ...exactLayouts(["FortiSwitch Rugged 424F-POE"], FORTISWITCH_RUGGED_424F_QSG, [
    ["RJ45_MGIG:PORT", portGrid(12, .25, .48, .34, .64)],
    ["SFP_PLUS_10G:2.5G SFP+", portGrid(12, .53, .76, .34, .64)],
    ["SFP_PLUS_10G:SFP+", portGrid(4, .81, .86, .34, .64)],
    ["QSFP_PLUS_40G:QSFP+", portGrid(2, .92, .92, .34, .64)],
    ["RJ45_1G:MGMT", [{ x: .1, y: .55 }]],
  ]),
  ...exactLayouts(["FortiSwitch 224D-FPOE"], FORTISWITCH_224D_QSG, accessSwitch24FrontMgmtLayout()),
  ...exactLayouts(["FortiSwitch 224E"], FORTISWITCH_224E_QSG, accessSwitch24FrontMgmtLayout()),
  ...exactLayouts(["FortiSwitch 224E-POE"], FORTISWITCH_224E_QSG, [
    ["RJ45_1G:POE", portGrid(12, .23, .48, .4, .7)],
    ["RJ45_1G:PORT", portGrid(12, .51, .76, .4, .7)],
    ["SFP_1G:SFP", portGrid(4, .84, .92, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .06, y: .55 }]],
  ]),
  ...exactLayouts(["FortiSwitch 248D"], FORTISWITCH_248D_QSG, accessSwitch48FrontMgmtLayout()),
  ...exactLayouts(["FortiSwitch 248E-FPOE"], FORTISWITCH_248E_QSG, accessSwitch48FrontMgmtLayout()),
  ...exactLayouts(["FortiSwitch 248E-POE"], FORTISWITCH_248E_QSG, [
    ["RJ45_1G:POE", portGrid(24, .19, .52, .4, .7)],
    ["RJ45_1G:PORT", portGrid(24, .55, .88, .4, .7)],
    ["SFP_1G:SFP", portGrid(4, .94, .97, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .06, y: .55 }]],
  ]),
  ...exactLayouts(["FortiSwitch M426E-FPOE"], FORTISWITCH_M426E_QSG, [
    ["RJ45_1G:GE", portGrid(16, .34, .6, .4, .7)],
    ["RJ45_MGIG:2.5GE", portGrid(8, .64, .76, .4, .7)],
    ["RJ45_MGIG:5GE", portGrid(2, .81, .81, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portRow(4, .88, .96, .55)],
    ["RJ45_1G:MGMT", [{ x: .06, y: .55 }]],
  ]),
  ...exactLayouts(["FortiSwitch 524D", "FortiSwitch 524D-FPOE"], FORTISWITCH_524D_QSG, [
    ["RJ45_1G:PORT", portGrid(24, .25, .62, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portGrid(4, .83, .89, .4, .7)],
    ["QSFP_PLUS_40G:QSFP+", portGrid(2, .95, .95, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .06, y: .7 }]],
    ["USB_MICRO_CONSOLE:CONSOLE", [{ x: .06, y: .35 }]],
  ]),
  ...exactLayouts(["FortiSwitch 548D", "FortiSwitch 548D-FPOE"], FORTISWITCH_548D_QSG, [
    ["RJ45_1G:PORT", portGrid(48, .19, .86, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portGrid(4, .9, .94, .4, .7)],
    ["QSFP_PLUS_40G:QSFP+", portGrid(2, .975, .975, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .06, y: .7 }]],
    ["USB_MICRO_CONSOLE:CONSOLE", [{ x: .06, y: .35 }]],
  ]),
  ...exactLayouts(["FortiSwitch 348G", "FortiSwitch 348G-FPOE"], FORTISWITCH_348G_QSG, [
    ["RJ45_1G:GE", portGrid(24, .21, .5, .4, .7)],
    ["RJ45_MGIG:MGIG", portGrid(24, .53, .82, .4, .7)],
    ["SFP_PLUS_10G:SFP+", portGrid(4, .86, .91, .4, .7)],
    ["Console:CONSOLE", [{ x: .96, y: .35 }]],
    ["RJ45_1G:MGMT", [{ x: .96, y: .7 }]],
  ]),
  ...exactLayouts(["FortiSwitch 1048G"], FORTISWITCH_1048G_QSG, [
    ["SFP_PLUS_10G:PORT", portGrid(48, .15, .86, .4, .7)],
    ["QSFP28_100G:QSFP28", portGrid(6, .9, .97, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .06, y: .7 }]],
    ["Console:CONSOLE", [{ x: .06, y: .35 }]],
  ]),
]);

export function resolvePhysicalPortGroups(profile) {
  const groups = profile.groups.map((group) => ({
    ...group,
    labels: group.labels ? [...group.labels] : undefined,
    positions: group.positions?.map((position) => ({ ...position })),
  }));
  const familyName = fortinetFamilyName(profile.model);
  const exact = profile.vendor === "Fortinet" ? exactFortiGateLayouts.get(familyName) : null;
  if (exact) {
    applyZoneLabels(groups, exact);
    applyLabelPositions(groups, exactFortiGateFaceplates.get(familyName));
    return groups;
  }
  if (profile.vendor === "Fortinet" && profile.model.startsWith("FortiSwitch")) {
    applySequentialDataLabels(groups);
    applyExactFortiSwitchLayout(groups, exactFortiSwitchLayouts.get(profile.model));
    return groups;
  }
  if (profile.vendor === "Fortinet" && profile.model.startsWith("FortiGate")) {
    applySequentialDataLabels(groups);
    return groups;
  }
  if (profile.vendor === "Palo Alto") {
    let ethernet = 1;
    for (const group of groups) {
      if (group.labels?.length === group.count) {
        if (group.zone === "access" || group.zone === "uplink") ethernet += group.count;
        continue;
      }
      if (group.zone === "access" || group.zone === "uplink") {
        group.labels = Array.from({ length: group.count }, () => `ethernet1/${ethernet++}`);
      } else {
        group.labels = managementLabels(group);
      }
    }
    return groups;
  }
  if (profile.vendor === "Sophos") {
    let port = 1;
    for (const group of groups) {
      if (group.labels?.length === group.count) {
        if (group.zone !== "management") port += group.count;
        continue;
      }
      group.labels = group.zone === "management" ? managementLabels(group, ["MGMT", "COM"]) :
        Array.from({ length: group.count }, () => `Port${port++}`);
    }
    return groups;
  }
  if (profile.vendor === "Check Point") {
    let port = 1;
    for (const group of groups) {
      if (group.labels?.length === group.count) {
        if (group.zone !== "management") port += group.count;
        continue;
      }
      group.labels = group.zone === "management" ? managementLabels(group, ["Mgmt", "Sync"]) :
        Array.from({ length: group.count }, () => String(port++));
    }
    return groups;
  }
  if (profile.category === "Switch") {
    applySequentialDataLabels(groups);
    return groups;
  }
  for (const group of groups) group.labels ||= defaultLabels(group);
  return groups;
}

export function portLayoutMetadata(profile) {
  const familyName = fortinetFamilyName(profile.model);
  const exactSource = exactFortiGateFaceplates.get(familyName)?.source || FORTINET_PORT_SOURCES[familyName] || exactFortiSwitchLayouts.get(profile.model)?.source || VERIFIED_MODEL_SOURCES[`${profile.vendor}:${profile.model}`];
  const generic = profile.fidelity === "generic" || profile.vendor?.startsWith("Generic");
  const modular = profile.fidelity === "modular";
  const explicitLabels = profile.groups.every((group) => group.labels?.length === group.count);
  const explicitPositions = profile.groups.every((group) => group.positions?.length === group.count);
  const exactPositions = explicitPositions || exactFortiGateFaceplates.has(familyName) || exactFortiSwitchLayouts.has(profile.model);
  return {
    fidelity: exactSource ? "exact" : profile.fidelity || "family",
    source: exactSource || profile.source || "vendor front-panel family documentation",
    labelFidelity: exactSource || (profile.fidelity === "exact" && explicitLabels) ? "exact" : generic ? "generic" : modular ? "modular" : "family",
    positionFidelity: exactPositions ? "exact" : generic ? "generic" : modular ? "modular" : "schematic",
    sourceScope: exactSource || profile.fidelity === "exact" ? "model" : generic ? "generic" : modular ? "modular" : "family",
  };
}

function applyExactFortiSwitchLayout(groups, layout) {
  if (!layout) return;
  for (const group of groups) {
    const positions = layout.groups.get(`${group.type}:${group.prefix || ""}`);
    if (positions?.length === group.count) group.positions = positions.map((position) => ({ ...position }));
  }
}

function applyLabelPositions(groups, layout) {
  if (!layout) return;
  for (const group of groups) {
    const positions = (group.labels || []).map((label) => layout.positions.get(label));
    if (positions.length === group.count && positions.every(Boolean)) {
      group.positions = positions.map((position) => ({ ...position }));
    }
  }
}

function fortinetFamilyName(model) {
  const aliases = [
    [/^FortiGate 40F(?:-|$)/, "FortiGate 40F"],
    [/^FortiGate (?:60F|61F)(?:-|$)/, "FortiGate 60F"],
    [/^FortiGate (?:70F|71F)(?:-|$)/, "FortiGate 70F"],
    [/^FortiGate (?:70G|71G)(?:-|$)/, "FortiGate 70G"],
    [/^FortiGate (?:80F|81F)(?:-|$)/, "FortiGate 80F"],
    [/^FortiGate (?:100F|101F)(?:-|$)/, "FortiGate 100F"],
    [/^FortiGate (?:200E|201E)(?:-|$)/, "FortiGate 200E"],
    [/^FortiGate (?:200F|201F)(?:-|$)/, "FortiGate 200F"],
    [/^FortiGate (?:400F|401F)(?:-|$)/, "FortiGate 400F"],
    [/^FortiGate (?:600F|601F)(?:-|$)/, "FortiGate 600F"],
    [/^FortiGate (?:6000F|6001F|6300F|6301F|6500F|6501F)(?:-|$)/, "FortiGate 6000F"],
  ];
  if (!model.startsWith("FortiGate ") || model.startsWith("FortiGate Rugged")) return model;
  return aliases.find(([pattern]) => pattern.test(model))?.[1] || model;
}

function applyZoneLabels(groups, labelsByZone) {
  for (const zone of ["access", "uplink", "management"]) {
    let offset = 0;
    for (const group of groups.filter((candidate) => candidate.zone === zone)) {
      const labels = labelsByZone[zone].slice(offset, offset + group.count);
      group.labels = labels.length === group.count ? labels : defaultLabels(group);
      offset += group.count;
    }
  }
}

function applySequentialDataLabels(groups) {
  let port = 1;
  for (const group of groups) {
    if (group.labels?.length === group.count) {
      if (group.zone !== "management" && group.type !== "Stack") port += group.count;
      continue;
    }
    if (group.type === "Stack") {
      group.labels = defaultLabels(group);
    } else if (group.zone === "management" || /^MGMT$/i.test(group.prefix || "")) {
      group.labels = managementLabels(group);
    } else {
      group.labels = Array.from({ length: group.count }, () => String(port++));
    }
  }
}

function managementLabels(group, preferred = []) {
  if (preferred.length >= group.count) return preferred.slice(0, group.count);
  const prefix = /^CONSOLE$/i.test(group.prefix || "") ? "CONSOLE" : "MGMT";
  return Array.from({ length: group.count }, (_, index) => group.count === 1 ? prefix : `${prefix}${index + 1}`);
}

function defaultLabels(group) {
  const prefix = group.prefix || "";
  return Array.from({ length: group.count }, (_, index) => `${prefix}${index + 1}`);
}

function zones(access, uplink, management) {
  return { access: access.map(String), uplink: uplink.map(String), management: management.map(String) };
}

function range(first, last) {
  return Array.from({ length: last - first + 1 }, (_, index) => String(first + index));
}

function portGrid(count, x1, x2, topY, bottomY) {
  const rows = count > 1 ? 2 : 1;
  const columns = Math.ceil(count / rows);
  return Array.from({ length: count }, (_, index) => ({
    x: columns === 1 ? (x1 + x2) / 2 : x1 + (x2 - x1) * Math.floor(index / rows) / (columns - 1),
    y: rows === 1 ? (topY + bottomY) / 2 : index % rows === 0 ? topY : bottomY,
  }));
}

function portRow(count, x1, x2, y) {
  return Array.from({ length: count }, (_, index) => ({
    x: count === 1 ? (x1 + x2) / 2 : x1 + (x2 - x1) * index / (count - 1),
    y,
  }));
}

function exactLayouts(models, source, groups) {
  return models.map((model) => [model, { source, groups: new Map(groups) }]);
}

function faceplateLayout(source, groups) {
  const positions = new Map();
  for (const [labels, points] of groups) {
    labels.forEach((label, index) => positions.set(String(label), points[index]));
  }
  return { source, positions };
}

function accessSwitch24Layout(uplinkKey) {
  return [
    ["RJ45_1G:PORT", portGrid(24, .3, .7, .4, .7)],
    [uplinkKey, portGrid(4, .78, .86, .4, .7)],
    ["Console:CONSOLE", [{ x: .235, y: .7 }]],
  ];
}

function accessSwitch48Layout(uplinkKey) {
  return [
    ["RJ45_1G:PORT", portGrid(48, .27, .87, .4, .7)],
    [uplinkKey, portGrid(4, .91, .95, .4, .7)],
    ["Console:CONSOLE", [{ x: .235, y: .55 }]],
  ];
}

function accessSwitch24FrontMgmtLayout() {
  return [
    ["RJ45_1G:PORT", portGrid(24, .23, .76, .4, .7)],
    ["SFP_1G:SFP", portGrid(4, .84, .92, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .06, y: .55 }]],
  ];
}

function accessSwitch48FrontMgmtLayout() {
  return [
    ["RJ45_1G:PORT", portGrid(48, .19, .88, .4, .7)],
    ["SFP_1G:SFP", portGrid(4, .94, .97, .4, .7)],
    ["RJ45_1G:MGMT", [{ x: .06, y: .55 }]],
  ];
}
