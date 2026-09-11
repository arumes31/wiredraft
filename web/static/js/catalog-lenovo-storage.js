/** Describe one storage port group without substituting an Ethernet protocol for SAS or FC. */
function group(type,speed,labels,zone="uplink") {return {zone,type,speed,labels,count:labels.length,prefix:labels[0],poe:false};}

/** Declare a new rack profile whose installed records are never expanded by catalog refresh. */
function profile(vendor,model,units,groups,source,note) {
 return {vendor,model,category:"Server",units,color:"#343638",groups,inventoryRevision:1,preserveInstalledPorts:true,source,note};
}

/** Exact selected rack configurations; drive bays and power assemblies are physical artwork, not network endpoints. */
export const lenovoStorageProfiles=Object.freeze([
 profile("Lenovo","DE2000H",2,[group("FC_SFP_16G",16000,["A FC1","A FC2","B FC1","B FC2"]),
  group("SAS_MINI_HD_12G",12000,["A EXP1","A EXP2","B EXP1","B EXP2"]),
  group("RJ45_1G",1000,["A P1","B P1"],"management"),group("Console",0,["A CON","B CON"],"management"),
  group("USB_MICRO_CONSOLE",0,["A USB","B USB"],"management")],"https://lenovopress.lenovo.com/lp0881.pdf",
  "7Y71A001WW Gen1 2U24 SFF; dual FC base-port controllers, HIC covers, 24x1.2TB 4XB7A14112 drives, two913W AC power/fan canisters and B38Y rack rails. FC transceiver cages unpopulated."),
 profile("Lenovo","DE240S",2,[group("SAS_MINI_HD_12G",12000,["A 1","A 2","A 3","A 4","B 1","B 2","B 3","B 4"])],
  "https://lenovopress.lenovo.com/lp0881.pdf","7Y68A000WW 2U24 SFF; two IOM12 modules, 24x1.2TB 4XB7A14112 drives, two913W AC power/fan canisters and B38Y rack rails."),
 profile("Lenovo","D1212",2,[group("SAS_MINI_HD_12G",12000,["A A","A B","A C","B A","B B","B C"]),group("RJ45_1G",100,["A MGMT","B MGMT"],"management")],
  "https://lenovopress.lenovo.com/lp0512-lenovo-storage-d1212-d1224-drive-enclosures","4587EKU;12x6TB LFF drives, dual three-port ESMs, two580W AC power/cooling modules and included12Gb SAN rack rails. RJ45 management operates at10/100Mb."),
 profile("Lenovo","D1224",2,[group("SAS_MINI_HD_12G",12000,["A A","A B","A C","B A","B B","B C"]),group("RJ45_1G",100,["A MGMT","B MGMT"],"management")],
  "https://lenovopress.lenovo.com/lp0512.pdf","4587A31;24x1.2TB01DC407 SFF drives, dual three-port ESMs, two580W AC power/cooling modules and included12Gb SAN rack rails. RJ45 management operates at10/100Mb."),
 profile("IBM","TS2900",1,[group("SAS_MINI_6G",6000,["SAS"]),group("RJ45_1G",100,["MGMT"],"management")],
  "https://www.ibm.com/support/pages/system/files/inline-files/GC27-2212-08_3.pdf","3572-S7H Ultrium7 half-height drive, closed nine-position cartridge magazine, rack kit7006/45E3785 and single AC supply. One externally accessible Mini-SAS host connector; internal drive interfaces remain hidden. Ethernet management operates at10/100Mb.")
]);
