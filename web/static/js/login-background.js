const CYCLE_DURATION = 16000;
const TARGET_FRAME_INTERVAL = 1000 / 24;
const MAX_PIXEL_RATIO = 1.5;
const DEVICE_SLOT_PITCH = 54;
const MIN_DEVICES_PER_RACK = 3;
const MAX_DEVICES_PER_RACK = 10;

const RACK_PALETTES = [
  { body: "#071214", frame: "#3d7476", header: "#18383a", rail: "#173133", glow: "rgba(66,217,200,.16)" },
  { body: "#081117", frame: "#45677c", header: "#172d3a", rail: "#162a34", glow: "rgba(85,167,237,.15)" },
  { body: "#120f0c", frame: "#80684c", header: "#3a2b1c", rail: "#30251a", glow: "rgba(240,179,90,.13)" },
  { body: "#0d1012", frame: "#647176", header: "#293136", rail: "#222a2d", glow: "rgba(169,194,196,.12)" },
];
const DEVICE_PROFILES = {
  switch: { labels: ["48G ACCESS", "CORE SWITCH", "EDGE 24G", "DATACENTER TOR", "AGGREGATION 48"], heights: [31, 34, 36], ports: [16, 20, 24], rows: 2, fill: "#aab5b3", stroke: "#647879", text: "#102326" },
  firewall: { labels: ["SECURITY GATEWAY", "WAN FIREWALL", "HA FIREWALL", "EDGE SECURITY"], heights: [34, 37], ports: [6, 8, 10], rows: 1, fill: "#b5bcb8", stroke: "#737f7d", text: "#172427" },
  panel: { labels: ["PATCH PANEL 24", "FIBER LIU", "CAT6A PANEL", "MPO CASSETTE"], heights: [29, 31, 34], ports: [16, 20, 24], rows: 2, fill: "#18292b", stroke: "#547477", text: "#9bc2c1" },
  server: { labels: ["COMPUTE NODE", "STORAGE ARRAY", "VIRTUAL HOST", "BACKUP SERVER"], heights: [41, 45, 49], ports: [4, 6], rows: 1, fill: "#111d20", stroke: "#405a5d", text: "#9bc2c1" },
  router: { labels: ["WAN ROUTER", "SD-WAN EDGE", "MPLS ROUTER", "LTE GATEWAY"], heights: [32, 35], ports: [6, 8, 10], rows: 1, fill: "#9da9a8", stroke: "#607476", text: "#102326" },
  power: { labels: ["METERED PDU", "UPS BYPASS", "POWER SHELF"], heights: [29, 32], ports: [4, 6, 8], rows: 1, fill: "#22282a", stroke: "#6d7475", text: "#d1bd92" },
};
const DEVICE_KIND_POOL = ["switch", "switch", "panel", "server", "firewall", "router", "power"];
const LINK_COLORS = {
  trunk: ["#43dfd0", "#56d9ff", "#58c9bc"],
  management: ["#f0b35a", "#e6a34b", "#f1c778"],
  access: ["#55a7ed", "#6b9fe8", "#61b7d4"],
  uplink: ["#81dca3", "#75d7b6", "#94d58d"],
};

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const mix = (start, end, amount) => start + ((end - start) * clamp(amount, 0, 1));
const phase = (elapsed, start, end) => clamp((elapsed - start) / (end - start), 0, 1);

export function seededRandom(seed = Date.now()) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function choose(random, values) {
  return values[Math.floor(random() * values.length)];
}

function randomInt(random, minimum, maximum) {
  return minimum + Math.floor(random() * ((maximum - minimum) + 1));
}

function shuffle(random, values) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = randomInt(random, 0, index);
    [output[index], output[other]] = [output[other], output[index]];
  }
  return output;
}

function createPorts(device, random) {
  const rows = device.portRows;
  const count = device.portCount;
  const left = device.x + (device.kind === "server" || device.kind === "power" ? device.width * .58 : device.width * .34);
  const right = device.x + device.width - 11;
  const columns = Math.ceil(count / rows);
  const gap = (right - left) / Math.max(1, columns - 1);

  return Array.from({ length: count }, (_, index) => {
    const row = index % rows;
    const column = Math.floor(index / rows);
    return {
      id: `${device.id}-p${index + 1}`,
      name: device.kind === "firewall" && index < 2 ? `WAN${index + 1}` : `${index + 1}`,
      x: left + (column * gap),
      y: device.y + (rows === 1 ? device.height * .58 : device.height * (.42 + (row * .28))),
      row,
      connected: false,
    };
  });
}

function createDevice(rack, index, slotY, slotHeight, random, kind) {
  const profile = DEVICE_PROFILES[kind];
  const height = choose(random, profile.heights);
  const y = slotY + (random() * Math.max(0, slotHeight - height - 5));
  const device = {
    id: `${rack.id}-device-${index}`,
    rackId: rack.id,
    kind,
    x: rack.x + 18,
    y,
    width: rack.width - 36,
    height,
    label: choose(random, profile.labels),
    portCount: choose(random, profile.ports),
    portRows: profile.rows,
    fill: profile.fill,
    stroke: profile.stroke,
    textColor: profile.text,
    accentColor: choose(random, ["#42d9c8", "#55a7ed", "#f0b35a", "#81dca3"]),
    ports: [],
    revealAt: .12 + (index * (.035 + (random() * .018))) + (random() * .025),
  };
  device.ports = createPorts(device, random);
  return device;
}

function linkPath(source, target, sourceRack, targetRack, lane) {
  if (sourceRack.id === targetRack.id) {
    const useRight = lane % 2 === 0;
    const sideLane = Math.floor(lane / 2);
    const gutterX = useRight
      ? sourceRack.x + sourceRack.width + 10 + (sideLane * 4)
      : sourceRack.x - 10 - (sideLane * 4);
    return [source, { x: gutterX, y: source.y }, { x: gutterX, y: target.y }, target];
  }

  const sourceIsLeft = sourceRack.x < targetRack.x;
  const sourceEdge = sourceIsLeft ? sourceRack.x + sourceRack.width : sourceRack.x;
  const targetEdge = sourceIsLeft ? targetRack.x : targetRack.x + targetRack.width;
  const corridorX = mix(sourceEdge, targetEdge, .5) + ((lane - 2) * 5);
  return [source, { x: corridorX, y: source.y }, { x: corridorX, y: target.y }, target];
}

export function buildLoginBackdropScene(width, height, random = Math.random) {
  const sceneWidth = Math.max(320, width);
  const sceneHeight = Math.max(420, height);
  const rackCapacity = clamp(Math.floor(sceneWidth / 390), 1, 4);
  const rackCount = randomInt(random, Math.max(1, rackCapacity - 1), rackCapacity);
  const outerMargin = Math.max(28, sceneWidth * .035);
  const gap = clamp(sceneWidth * (.027 + (random() * .018)), 28, 68);
  const available = sceneWidth - (outerMargin * 2) - (gap * (rackCount - 1));
  const cellWidth = available / rackCount;
  const racks = [];
  const devices = [];

  for (let rackIndex = 0; rackIndex < rackCount; rackIndex += 1) {
    const rackWidth = clamp(cellWidth * (.8 + (random() * .17)), 205, 330);
    const palette = choose(random, RACK_PALETTES);
    const rackY = 52 + (random() * 68);
    const maximumHeight = Math.max(280, sceneHeight - rackY - 28);
    const minimumHeight = Math.min(maximumHeight, Math.max(275, sceneHeight * (.58 + (random() * .08))));
    const rack = {
      id: `ambient-rack-${rackIndex + 1}`,
      name: `RACK ${String.fromCharCode(65 + rackIndex)}${String(Math.floor(random() * 9) + 1).padStart(2, "0")}`,
      x: outerMargin + (rackIndex * (cellWidth + gap)) + ((cellWidth - rackWidth) / 2),
      y: rackY,
      width: rackWidth,
      height: mix(minimumHeight, maximumHeight, .55 + (random() * .45)),
      unitsU: choose(random, [24, 32, 42, 48]),
      palette,
      revealAt: .015 + (rackIndex * .035),
    };
    racks.push(rack);

    const firstY = rack.y + 63;
    const usableHeight = rack.height - 88;
    // The tallest ambient chassis is 49px. A 54px slot preserves its 5px
    // clearance while allowing the login racks to read as actively populated.
    const maximumDevices = clamp(
      Math.floor(usableHeight / DEVICE_SLOT_PITCH),
      MIN_DEVICES_PER_RACK,
      MAX_DEVICES_PER_RACK,
    );
    const deviceCount = randomInt(random, Math.max(MIN_DEVICES_PER_RACK, maximumDevices - 1), maximumDevices);
    const step = usableHeight / deviceCount;
    const kinds = ["switch", "panel"];
    if (deviceCount > 2) kinds.push("server");
    while (kinds.length < deviceCount) kinds.push(choose(random, DEVICE_KIND_POOL));
    const randomizedKinds = shuffle(random, kinds);
    for (let deviceIndex = 0; deviceIndex < deviceCount; deviceIndex += 1) {
      const slotY = firstY + (deviceIndex * step);
      const device = createDevice(rack, deviceIndex, slotY, step, random, randomizedKinds[deviceIndex]);
      device.revealAt += rackIndex * .025;
      devices.push(device);
    }
  }

  const links = [];
  const usedPorts = new Set();
  const deviceByRack = (rack) => devices.filter((device) => device.rackId === rack.id);
  const freePort = (device) => {
    const availablePorts = device.ports.filter((port) => !usedPorts.has(port.id));
    return availablePorts.length ? choose(random, availablePorts) : undefined;
  };
  const addLink = (sourceDevice, targetDevice, lane, role) => {
    const source = freePort(sourceDevice);
    const target = freePort(targetDevice);
    if (!source || !target) return;
    usedPorts.add(source.id);
    usedPorts.add(target.id);
    const sourceRack = racks.find((rack) => rack.id === sourceDevice.rackId);
    const targetRack = racks.find((rack) => rack.id === targetDevice.rackId);
    links.push({
      id: `ambient-link-${links.length + 1}`,
      sourceDeviceId: sourceDevice.id,
      targetDeviceId: targetDevice.id,
      sourcePortId: source.id,
      targetPortId: target.id,
      role,
      color: choose(random, LINK_COLORS[role]),
      path: linkPath({ x: source.x, y: source.y }, { x: target.x, y: target.y }, sourceRack, targetRack, lane),
      revealAt: 0,
    });
  };

  racks.forEach((rack, rackIndex) => {
    const rackDevices = deviceByRack(rack);
    for (let targetIndex = 1; targetIndex < rackDevices.length; targetIndex += 1) {
      const sourceIndex = randomInt(random, Math.max(0, targetIndex - 2), targetIndex - 1);
      addLink(rackDevices[sourceIndex], rackDevices[targetIndex], targetIndex - 1, choose(random, ["access", "access", "management", "uplink"]));
    }
    if (rackDevices.length > 3 && random() > .42) {
      const sourceIndex = randomInt(random, 0, Math.floor(rackDevices.length / 2) - 1);
      const targetIndex = randomInt(random, Math.ceil(rackDevices.length / 2), rackDevices.length - 1);
      addLink(rackDevices[sourceIndex], rackDevices[targetIndex], rackDevices.length, choose(random, ["trunk", "uplink", "access"]));
    }
    if (rackIndex < racks.length - 1) {
      const nextDevices = deviceByRack(racks[rackIndex + 1]);
      const crossRackCount = randomInt(random, 1, Math.min(4, rackDevices.length, nextDevices.length));
      const sources = shuffle(random, rackDevices);
      const targets = shuffle(random, nextDevices);
      for (let lane = 0; lane < crossRackCount; lane += 1) {
        const role = choose(random, ["trunk", "trunk", "uplink", "management"]);
        if (random() < .24) addLink(targets[lane], sources[lane], lane, role);
        else addLink(sources[lane], targets[lane], lane, role);
      }
    }
  });

  const orderedLinks = shuffle(random, links);
  orderedLinks.forEach((link, index) => {
    link.id = `ambient-link-${index + 1}`;
    link.revealAt = .43 + (index * Math.min(.025, .32 / Math.max(1, orderedLinks.length))) + (random() * .012);
  });
  const connectedPorts = new Set(orderedLinks.flatMap((link) => [link.sourcePortId, link.targetPortId]));
  devices.forEach((device) => device.ports.forEach((port) => { port.connected = connectedPorts.has(port.id); }));

  return { width: sceneWidth, height: sceneHeight, racks, devices, links: orderedLinks, duration: CYCLE_DURATION };
}

export function partialOrthogonalPath(points, progress) {
  if (!points.length || progress <= 0) return [];
  if (progress >= 1) return points.map((point) => ({ ...point }));
  const lengths = points.slice(1).map((point, index) => (
    Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y)
  ));
  const targetLength = lengths.reduce((sum, length) => sum + length, 0) * progress;
  const output = [{ ...points[0] }];
  let travelled = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (travelled + segmentLength <= targetLength) {
      output.push({ ...points[index + 1] });
      travelled += segmentLength;
      continue;
    }
    const remaining = targetLength - travelled;
    const start = points[index];
    const end = points[index + 1];
    const amount = segmentLength ? remaining / segmentLength : 0;
    output.push({ x: mix(start.x, end.x, amount), y: mix(start.y, end.y, amount) });
    break;
  }
  return output;
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawRack(context, rack, elapsed) {
  const reveal = phase(elapsed, rack.revealAt, rack.revealAt + .16);
  if (!reveal) return;
  const height = rack.height * reveal;
  context.save();
  context.globalAlpha = .27 + (reveal * .38);
  context.shadowColor = rack.palette.glow;
  context.shadowBlur = 22;
  roundedRect(context, rack.x, rack.y, rack.width, height, 6);
  context.fillStyle = rack.palette.body;
  context.fill();
  context.strokeStyle = rack.palette.frame;
  context.lineWidth = 1;
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = rack.palette.header;
  context.fillRect(rack.x, rack.y, rack.width, Math.min(38, height));
  context.fillStyle = "#98c4c2";
  context.font = "700 11px Bahnschrift, sans-serif";
  context.fillText(rack.name, rack.x + 16, rack.y + 23);
  context.fillStyle = "#3aa99f";
  context.font = "6px Bahnschrift, sans-serif";
  context.fillText(`${rack.unitsU}U · SYNTHETIC VIEW`, rack.x + 16, rack.y + 32);
  context.fillStyle = rack.palette.rail;
  context.fillRect(rack.x + 7, rack.y + 43, 7, Math.max(0, height - 51));
  context.fillRect(rack.x + rack.width - 14, rack.y + 43, 7, Math.max(0, height - 51));
  context.restore();
}

function drawDevice(context, device, elapsed) {
  const reveal = phase(elapsed, device.revealAt, device.revealAt + .1);
  if (!reveal) return;
  const x = mix(device.x - 22, device.x, reveal);
  context.save();
  context.globalAlpha = reveal * .78;
  roundedRect(context, x, device.y, device.width, device.height, 3);
  context.fillStyle = device.fill;
  context.fill();
  context.strokeStyle = device.stroke;
  context.stroke();
  context.fillStyle = device.textColor;
  context.font = "700 7px Bahnschrift, sans-serif";
  context.fillText(device.label, x + 8, device.y + 13);
  context.font = "5px Bahnschrift, sans-serif";
  context.fillStyle = device.kind === "panel" || device.kind === "server" || device.kind === "power" ? "#668788" : "#52696b";
  context.fillText(device.kind.toUpperCase(), x + 8, device.y + 23);
  context.fillStyle = device.accentColor;
  context.fillRect(x + 7, device.y + device.height - 4, Math.max(18, device.width * .16), 1);

  if (device.kind === "server") {
    for (let fan = 0; fan < 2; fan += 1) {
      context.beginPath();
      context.arc(x + device.width * (.36 + fan * .11), device.y + device.height * .58, 8, 0, Math.PI * 2);
      context.strokeStyle = "#34575a";
      context.stroke();
    }
  }

  device.ports.forEach((port) => {
    const portX = port.x + (x - device.x);
    context.fillStyle = device.kind === "panel" ? "#071113" : "#17282a";
    context.fillRect(portX - 2.3, port.y - 2, 4.6, 4);
    context.fillStyle = port.connected ? "#2bd28f" : "#385255";
    context.fillRect(portX + 2.8, port.y - 2.2, 1.3, 1.3);
  });
  context.restore();
}

function strokePath(context, points) {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.stroke();
}

export function renderLoginBackdrop(context, scene, elapsedMilliseconds) {
  const cycle = clamp(elapsedMilliseconds / scene.duration, 0, 1);
  const sceneOpacity = phase(cycle, 0, .06) * (1 - phase(cycle, .94, 1));
  context.clearRect(0, 0, scene.width, scene.height);
  context.save();
  context.globalAlpha = sceneOpacity;
  scene.racks.forEach((rack) => drawRack(context, rack, cycle));
  scene.devices.forEach((device) => drawDevice(context, device, cycle));
  scene.links.forEach((link) => {
    const reveal = phase(cycle, link.revealAt, link.revealAt + .1);
    if (!reveal) return;
    const points = partialOrthogonalPath(link.path, reveal);
    context.save();
    context.globalAlpha = .35 + (reveal * .55);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(0,0,0,.8)";
    context.lineWidth = 4;
    strokePath(context, points);
    context.strokeStyle = link.color;
    context.lineWidth = 1.6;
    context.setLineDash(link.role === "management" ? [4, 4] : []);
    strokePath(context, points);
    if (reveal === 1) {
      const endpoint = link.path.at(-1);
      context.fillStyle = "#36e59c";
      context.shadowColor = "#36e59c";
      context.shadowBlur = 5;
      context.fillRect(endpoint.x - 1.5, endpoint.y - 1.5, 3, 3);
    }
    context.restore();
  });
  context.restore();
}

/* The controller is a thin browser adapter; scene and renderer behavior are tested separately. */
export function startLoginBackground(canvas) {
  const context = canvas?.getContext?.("2d", { alpha: true });
  if (!context || typeof window === "undefined") return () => {};

  let scene;
  let frame = 0;
  let startedAt = performance.now();
  let lastFrameAt = -Infinity;
  let stopped = false;
  let sceneSequence = 0;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const nextSceneRandom = () => {
    sceneSequence += 1;
    let entropy = (Date.now() ^ Math.floor(performance.now() * 1000) ^ Math.imul(sceneSequence, 0x9e3779b1)) >>> 0;
    if (globalThis.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      globalThis.crypto.getRandomValues(value);
      entropy ^= value[0];
    }
    return seededRandom(entropy);
  };

  const sizeCanvas = () => {
    const width = Math.max(320, window.innerWidth);
    const height = Math.max(420, window.innerHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    scene = buildLoginBackdropScene(width, height, nextSceneRandom());
    startedAt = performance.now();
  };

  const drawStatic = () => {
    cancelAnimationFrame(frame);
    canvas.dataset.animation = "static";
    renderLoginBackdrop(context, scene, scene.duration * .86);
  };

  const loop = (now) => {
    if (stopped || document.hidden || motionQuery.matches) return;
    frame = requestAnimationFrame(loop);
    if (now - lastFrameAt < TARGET_FRAME_INTERVAL) return;
    lastFrameAt = now;
    const elapsed = now - startedAt;
    if (elapsed >= scene.duration) {
      scene = buildLoginBackdropScene(scene.width, scene.height, nextSceneRandom());
      startedAt = now;
    }
    renderLoginBackdrop(context, scene, now - startedAt);
  };

  const start = () => {
    cancelAnimationFrame(frame);
    if (motionQuery.matches) {
      drawStatic();
      return;
    }
    canvas.dataset.animation = "running";
    lastFrameAt = -Infinity;
    frame = requestAnimationFrame(loop);
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      canvas.dataset.animation = "paused";
      return;
    }
    startedAt = performance.now();
    start();
  };
  const onResize = () => {
    sizeCanvas();
    start();
  };

  sizeCanvas();
  start();
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  motionQuery.addEventListener?.("change", start);

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    motionQuery.removeEventListener?.("change", start);
    delete canvas.dataset.animation;
  };
}
