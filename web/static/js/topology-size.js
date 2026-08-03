export const TopologySizeThresholds = Object.freeze({
  devices: { warning: 350, critical: 800 },
  links: { warning: 1200, critical: 3000 },
  ports: { warning: 12000, critical: 30000 },
  estimatedBytes: { warning: 8_000_000, critical: 24_000_000 },
});

export function topologySize(topology) {
  const devices = topology?.devices?.length || 0;
  const links = topology?.links?.length || 0;
  const ports = (topology?.devices || []).reduce((sum, device) => sum + (device.ports?.length || 0), 0);
  const estimatedBytes = new Blob([JSON.stringify(topology || {})]).size;
  const measurements = { devices, links, ports, estimatedBytes };
  let level = "normal";
  for (const [name, value] of Object.entries(measurements)) {
    if (value >= TopologySizeThresholds[name].critical) level = "critical";
    else if (level === "normal" && value >= TopologySizeThresholds[name].warning) level = "warning";
  }
  return { ...measurements, level };
}

export function topologySizeMessage(size) {
  if (size.level === "normal") return "";
  const megabytes = (size.estimatedBytes / 1_000_000).toFixed(1);
  return `${size.level === "critical" ? "Browser memory limit risk" : "Large topology"}: ${size.devices} devices, ${size.links} links, ${size.ports} ports, ~${megabytes} MB JSON`;
}
