const allocations = new WeakMap();

/** Preserve the native body's aspect inside saved rack bounds without changing any device or inventory field. */
export function fitAristaAllocation(profile, device, nativeUnits) {
  const units = Math.max(1, Number(device?.faceplate?.unitsU) || nativeUnits);
  if (units === nativeUnits) return profile;
  if (!allocations.has(profile)) allocations.set(profile, new Map());
  const cache = allocations.get(profile);
  if (!cache.has(units)) {
    const body = nativeUnits * 100 * profile.chassis.height - 16;
    const scale = Math.min(1, (units * 100 * .94 - 16) / body);
    cache.set(units, { ...profile, chassis: {
      ...profile.chassis, x: scale === 1 ? profile.chassis.x : (1 - profile.chassis.width * scale) / 2,
      y: profile.chassis.y * Math.min(1, nativeUnits / units), width: profile.chassis.width * scale,
      height: (body * scale + 16) / (units * 100),
    } });
  }
  return cache.get(units);
}
