import { hardwareCatalog, instantiateProfile } from "./catalog.js";

const catalogByModel = new Map(hardwareCatalog.map((profile) => [`${profile.vendor}\0${profile.model}`, profile]));
const canonicalDevices = new Map();

/** Resolve immutable catalog geometry independently of editable device labels and settings. */
export function canonicalFaceplateDevice(device) {
  const key = `${device?.faceplate?.vendor}\0${device?.model}`;
  const catalog = catalogByModel.get(key);
  if (!catalog) return null;
  if (!canonicalDevices.has(key)) {
    const canonical = instantiateProfile(catalog, catalog.model, { x: 0, y: 0 });
    canonical.ports = Object.freeze(canonical.ports.map((port) => Object.freeze(port)));
    Object.freeze(canonical.faceplate);
    canonicalDevices.set(key, Object.freeze({ catalog, device: Object.freeze(canonical) }));
  }
  return canonicalDevices.get(key);
}

/** Fit grouped inventory sockets inside a normalized panel region without changing their indices. */
export function layoutPanelPorts(ports, rect = { x: .24, y: .28, width: .72, height: .5 },
  { rows = 2, portWidth = .03, portHeight = .22, groupGap = .015 } = {}) {
  if (!ports.length) return [];
  const rowCount = Math.max(1, Math.min(ports.length, Math.floor(rows) || 1));
  const groups = [];
  for (const port of ports) {
    const key = `${port.type}\0${port.group || ""}`;
    if (groups.at(-1)?.key !== key) groups.push({ key, ports: [] });
    groups.at(-1).ports.push(port);
  }
  const gap = Math.min(Math.max(0, groupGap), rect.width * .2 / Math.max(1, groups.length - 1));
  const columns = groups.reduce((count, group) => count + Math.ceil(group.ports.length / rowCount), 0);
  const step = (rect.width - gap * (groups.length - 1)) / columns;
  const width = Math.min(portWidth, step * .8);
  const height = Math.min(portHeight, rect.height / rowCount * .65);
  let left = rect.x;
  return groups.flatMap((group) => {
    const groupRows = Math.min(rowCount, group.ports.length);
    const slots = group.ports.map((port, index) => ({
      label: port.label, type: port.type, portIndex: port.portIndex,
      x: left + (Math.floor(index / rowCount) + .5) * step,
      y: rect.y + (index % groupRows + .5) * rect.height / groupRows,
      width, height,
    }));
    left += Math.ceil(group.ports.length / rowCount) * step + gap;
    return slots;
  });
}
