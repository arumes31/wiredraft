import { CableMode, cableBezier, distanceToCurve, pointOnBezier } from "./cabling.js";
import { findPort } from "./state.js";

const DEVICE_WIDTH = 690;
const UNIT_HEIGHT = 100;
const GRID = 10;

export class CanvasEngine {
  constructor(canvas, state, callbacks = {}) {
    this.canvas = canvas;
    this.state = state;
    this.callbacks = callbacks;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.camera = { x: 35, y: 35, zoom: 0.85 };
    this.deviceBoxes = [];
    this.portBoxes = [];
    this.linkCurves = [];
    this.hoveredPort = null;
    this.pointerWorld = { x: 0, y: 0 };
    this.mode = CableMode.IDLE;
    this.draft = null;
    this.drag = null;
    this.pan = null;
    this.selectionBox = null;
    this.selectedDevices = new Set();
    this.isSpaceDown = false;
    this.frame = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.bind();
    this.resize();
    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
  }

  bind() {
    this.canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.pointerUp(event));
    this.canvas.addEventListener("pointercancel", (event) => this.pointerUp(event));
    this.canvas.addEventListener("wheel", (event) => this.wheel(event), { passive: false });
    this.canvas.addEventListener("contextmenu", (event) => this.contextMenu(event));
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space" && !isFormField(event.target)) this.isSpaceDown = true;
      if (event.key === "Escape") this.cancelInteraction();
    });
    window.addEventListener("keyup", (event) => {
      if (event.code === "Space") this.isSpaceDown = false;
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.ratio = ratio;
    this.width = rect.width;
    this.height = rect.height;
  }

  loop(time) {
    this.renderFrame(this.ctx, this.width, this.height, this.camera, time, true);
    this.frame = requestAnimationFrame(this.loop);
  }

  renderFrame(ctx, width, height, camera, time, overlays) {
    ctx.setTransform(this.ratio || 1, 0, 0, this.ratio || 1, 0, 0);
    ctx.fillStyle = "#090e10";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    this.drawGrid(ctx, width, height, camera);
    this.layoutScene();
    this.drawLinks(ctx, time);
    for (const device of this.state.topology?.devices || []) this.drawDevice(ctx, device, time);
    if (overlays) {
      this.drawDraft(ctx);
      this.drawSelectionBox(ctx);
      this.drawTooltip(ctx);
    }
    ctx.restore();
  }

  drawGrid(ctx, width, height, camera) {
    const left = -camera.x / camera.zoom;
    const top = -camera.y / camera.zoom;
    const right = left + width / camera.zoom;
    const bottom = top + height / camera.zoom;
    const minor = 20;
    ctx.beginPath();
    for (let x = Math.floor(left / minor) * minor; x < right; x += minor) {
      ctx.moveTo(x, top); ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / minor) * minor; y < bottom; y += minor) {
      ctx.moveTo(left, y); ctx.lineTo(right, y);
    }
    ctx.lineWidth = 1 / camera.zoom;
    ctx.strokeStyle = "rgba(91, 122, 126, .08)";
    ctx.stroke();
    ctx.beginPath();
    for (let x = Math.floor(left / 100) * 100; x < right; x += 100) {
      ctx.moveTo(x, top); ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / 100) * 100; y < bottom; y += 100) {
      ctx.moveTo(left, y); ctx.lineTo(right, y);
    }
    ctx.strokeStyle = "rgba(91, 122, 126, .14)";
    ctx.stroke();
  }

  layoutScene() {
    this.deviceBoxes = [];
    this.portBoxes = [];
    const topology = this.state.topology;
    if (!topology) return;
    for (const device of topology.devices) {
      const height = Math.max(UNIT_HEIGHT, (device.faceplate.unitsU || 1) * UNIT_HEIGHT);
      this.deviceBoxes.push({ device, x: device.positionX, y: device.positionY, width: DEVICE_WIDTH, height });
      const rows = Math.max(1, Math.min(4, device.faceplate.rows || 1));
      const columns = Math.ceil(device.ports.length / rows);
      const startX = device.positionX + 170;
      const available = 475;
      const stepX = columns > 1 ? Math.min(31, available / (columns - 1)) : 0;
      const groupWidth = stepX * Math.max(0, columns - 1);
      const baseX = startX + Math.max(0, (available - groupWidth) / 2);
      const stepY = rows === 1 ? 0 : 29;
      const baseY = device.positionY + height / 2 - (stepY * (rows - 1)) / 2;
      device.ports.forEach((port, index) => {
        const row = index % rows;
        const column = Math.floor(index / rows);
		const hasFaceplatePosition = port.faceplateX > 0 && port.faceplateY > 0;
		const centerX = hasFaceplatePosition ? device.positionX + port.faceplateX * DEVICE_WIDTH : baseX + column * stepX;
		const centerY = hasFaceplatePosition ? device.positionY + port.faceplateY * height : baseY + row * stepY;
        this.portBoxes.push({ port, device, x: centerX - 9, y: centerY - 7, width: 18, height: 14, centerX, centerY });
      });
    }
  }

  drawLinks(ctx, time) {
    const topology = this.state.topology;
    if (!topology) return;
    const portMap = new Map(this.portBoxes.map((box) => [box.port.id, box]));
    const vlanMap = new Map(topology.vlans.map((vlan) => [vlan.id, vlan]));
    const warnings = new Set((this.state.analysis?.issues || []).map((issue) => issue.linkId));
    this.linkCurves = [];
    for (const link of topology.links) {
      const source = portMap.get(link.sourcePortId);
      const target = portMap.get(link.targetPortId);
      if (!source || !target) continue;
      const curve = cableBezier({ x: source.centerX, y: source.centerY }, { x: target.centerX, y: target.centerY });
      this.linkCurves.push({ link, curve });
      const sourceSpeed = source.port.speedMbps || 1000;
      const targetSpeed = target.port.speedMbps || 1000;
      const speed = Math.min(sourceSpeed, targetSpeed);
      const thickness = speed >= 40000 ? 6 : speed >= 10000 ? 4 : 2.5;
      const selected = this.state.selection?.type === "link" && this.state.selection.id === link.id;
      const traced = this.state.traceLinkIDs.has(link.id);
      if (selected || traced) {
        this.strokeCurve(ctx, curve, traced ? "#f6f8ca" : "#7affee", thickness + 8, .25);
      }
      this.strokeCurve(ctx, curve, "#020607", thickness + 4, .95);
      const vlanIDs = link.vlanIds?.length ? link.vlanIds : [link.primaryVlan || 1];
      if (vlanIDs.length === 1) {
        this.strokeCurve(ctx, curve, vlanMap.get(vlanIDs[0])?.colorHex || "#75888b", thickness, .96);
      } else {
        const shown = vlanIDs.slice(0, 5);
        shown.forEach((vlanID, index) => {
          this.strokeCurve(ctx, curve, vlanMap.get(vlanID)?.colorHex || "#75888b", Math.max(1.3, thickness / 2), .96, (index - (shown.length - 1) / 2) * 2.2);
        });
      }
      this.drawCableLabel(ctx, link, curve, vlanMap);
      this.drawPulse(ctx, curve, time, vlanMap.get(link.primaryVlan)?.colorHex || "#dce7e6");
      if (warnings.has(link.id)) this.drawWarning(ctx, pointOnBezier(curve, .57));
    }
  }

  strokeCurve(ctx, curve, color, width, alpha = 1, offset = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    if (offset) ctx.translate(offset, 0);
    ctx.beginPath();
    ctx.moveTo(curve.source.x, curve.source.y);
    ctx.bezierCurveTo(curve.cp1.x, curve.cp1.y, curve.cp2.x, curve.cp2.y, curve.target.x, curve.target.y);
    ctx.stroke();
    ctx.restore();
  }

  drawCableLabel(ctx, link, curve, vlanMap) {
    const center = pointOnBezier(curve, .5);
    const text = link.vlanIds?.length > 1 ? `TRUNK · ${link.vlanIds.join("/")}` : `VLAN ${link.primaryVlan || 1}`;
    ctx.font = "700 9px Bahnschrift Condensed, sans-serif";
    const width = ctx.measureText(text).width + 14;
    ctx.fillStyle = "rgba(7, 13, 15, .92)";
    ctx.strokeStyle = vlanMap.get(link.primaryVlan)?.colorHex || "#60757a";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(center.x - width / 2, center.y - 10, width, 20, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#c9d6d7";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, center.x, center.y + .5);
  }

  drawPulse(ctx, curve, time, color) {
    const point = pointOnBezier(curve, ((time / 2200) % 1));
    ctx.save();
    ctx.shadowBlur = 9; ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(point.x, point.y, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawWarning(ctx, point) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.fillStyle = "#f0b35a"; ctx.strokeStyle = "#20170b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#20170b"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", 0, 3);
    ctx.restore();
  }

  drawDevice(ctx, device, time) {
    const box = this.deviceBoxes.find((candidate) => candidate.device.id === device.id);
    if (!box) return;
    const selected = this.state.selection?.type === "device" && this.state.selection.id === device.id;
    const multiSelected = this.selectedDevices.has(device.id);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 7;
    const gradient = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.height);
    gradient.addColorStop(0, lighten(device.faceplate.vendorColor, 18));
    gradient.addColorStop(.17, device.faceplate.vendorColor);
    gradient.addColorStop(.82, darken(device.faceplate.vendorColor, 15));
    gradient.addColorStop(1, "#0b1012");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = selected || multiSelected ? "#66eddd" : "#52666b";
    ctx.lineWidth = selected || multiSelected ? 2.5 : 1;
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.width, box.height, 8); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    this.drawRackEars(ctx, box);
    this.drawDeviceIdentity(ctx, device, box);
	this.drawVendorDetails(ctx, device, box);
    for (const portBox of this.portBoxes.filter((candidate) => candidate.device.id === device.id)) {
      this.drawPort(ctx, portBox, time);
    }
    this.drawDeviceLEDs(ctx, box, time);
    ctx.restore();
  }

  drawRackEars(ctx, box) {
    ctx.fillStyle = "rgba(5, 9, 10, .62)";
    ctx.fillRect(box.x + 5, box.y + 8, 14, box.height - 16);
    ctx.fillRect(box.x + box.width - 19, box.y + 8, 14, box.height - 16);
    for (const x of [box.x + 12, box.x + box.width - 12]) {
      for (const y of [box.y + 20, box.y + box.height - 20]) {
        ctx.fillStyle = "#050808"; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#607176"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

	drawVendorDetails(ctx, device, box) {
		const vendor = device.faceplate.vendor || "";
		const x = box.x + 151;
		const y = box.y + box.height / 2 - 20;
		ctx.save();
		if (vendor === "Fortinet") {
			ctx.fillStyle = "#ef4b45";
			for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
				if ((row + column) % 2 === 0) ctx.fillRect(x + column * 6, y + row * 6, 4, 4);
			}
		} else if (vendor === "Cisco") {
			ctx.strokeStyle = "#65bde8"; ctx.lineWidth = 1.5;
			for (let index = 0; index < 5; index += 1) {
				ctx.beginPath(); ctx.moveTo(x + index * 5, y + 15); ctx.lineTo(x + index * 5, y + 15 - (index % 3 + 1) * 4); ctx.stroke();
			}
		} else if (vendor === "HPE Aruba") {
			ctx.strokeStyle = "#f28c28"; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.moveTo(x, y + 17); ctx.lineTo(x + 20, y); ctx.stroke();
		} else if (vendor === "Ubiquiti") {
			ctx.fillStyle = "#0a1113"; ctx.strokeStyle = "#a8b7ba"; ctx.lineWidth = 1;
			ctx.fillRect(x - 3, y - 2, 31, 23); ctx.strokeRect(x - 3, y - 2, 31, 23);
			ctx.fillStyle = "#73d4ff"; ctx.font = "7px Bahnschrift Condensed, sans-serif"; ctx.textAlign = "center"; ctx.fillText("UNIFI", x + 12, y + 12);
		} else {
			ctx.fillStyle = "rgba(3, 8, 9, .5)";
			for (let row = 0; row < 4; row += 1) for (let column = 0; column < 8; column += 1) {
				ctx.beginPath(); ctx.arc(x + column * 4, y + row * 5, 1, 0, Math.PI * 2); ctx.fill();
			}
		}
		ctx.restore();
	}

  drawDeviceIdentity(ctx, device, box) {
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#eef8f7"; ctx.font = "700 14px Bahnschrift Condensed, sans-serif";
	const vendor = device.faceplate.vendor || "NETDIAGRAM";
	ctx.fillStyle = vendorColor(vendor);
	ctx.font = "700 8px Bahnschrift Condensed, sans-serif";
	ctx.fillText(vendor.toUpperCase(), box.x + 31, box.y + 18, 125);
	ctx.fillStyle = "#eef8f7"; ctx.font = "700 14px Bahnschrift Condensed, sans-serif";
	ctx.fillText(device.name, box.x + 31, box.y + 34, 125);
    ctx.fillStyle = "#86a0a3"; ctx.font = "9px Bahnschrift Condensed, sans-serif";
	ctx.fillText(device.model || device.category, box.x + 31, box.y + 47, 125);
    ctx.fillStyle = "rgba(4, 8, 9, .45)";
	ctx.fillRect(box.x + 31, box.y + 57, 114, 18);
    ctx.fillStyle = "#5f777b"; ctx.font = "700 8px Bahnschrift Condensed, sans-serif";
	ctx.fillText(`${device.category.toUpperCase()} · ${device.faceplate.unitsU}U`, box.x + 38, box.y + 69);
  }

  drawPort(ctx, box, time) {
    const { port } = box;
    const hovered = this.hoveredPort?.port.id === port.id;
    const selected = this.state.selection?.type === "port" && this.state.selection.id === port.id;
    const draftTarget = this.draft?.target?.port.id === port.id;
    const invalid = this.draft && !this.isEligibleTarget(this.draft.source, box);
    ctx.save();
    if (hovered || selected || draftTarget) {
      ctx.shadowColor = draftTarget ? "#42d9c8" : "#7affee"; ctx.shadowBlur = 11;
    }
    ctx.fillStyle = invalid ? "#2d1717" : "#080d0f";
    ctx.strokeStyle = invalid ? "#743b38" : hovered || selected || draftTarget ? "#7affee" : "#60757a";
    ctx.lineWidth = hovered || selected ? 1.8 : 1;
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.width, box.height, 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    if (port.type.startsWith("SFP") || port.type.startsWith("QSFP")) {
      ctx.fillStyle = "#344246"; ctx.fillRect(box.x + 3, box.y + 4, box.width - 6, 3);
    } else {
      ctx.strokeStyle = "#6b512b"; ctx.lineWidth = .7;
      for (let pin = 0; pin < 6; pin += 1) {
        const x = box.x + 3 + pin * 2.3; ctx.beginPath(); ctx.moveTo(x, box.y + 3); ctx.lineTo(x, box.y + 7); ctx.stroke();
      }
    }
    const active = port.status === "up";
    ctx.fillStyle = active ? ((Math.floor(time / 330 + port.portIndex) % 3) ? "#42d98b" : "#f0b35a") : "#2d393b";
    if (active) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 5; }
    ctx.beginPath(); ctx.arc(box.x + box.width - 2, box.y - 3, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#829397"; ctx.font = "7px Bahnschrift Condensed, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(port.label, box.centerX, box.y + box.height + 9);
  }

  drawDeviceLEDs(ctx, box, time) {
    const x = box.x + box.width - 40;
    const y = box.y + box.height / 2;
    [0, 1, 2].forEach((index) => {
      ctx.save();
      const color = index === 0 ? "#42d98b" : index === 1 && Math.floor(time / 600) % 2 ? "#f0b35a" : "#314346";
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = index < 2 ? 7 : 0;
      ctx.beginPath(); ctx.arc(x + index * 9, y, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
  }

  drawDraft(ctx) {
    if (!this.draft) return;
    const source = { x: this.draft.source.centerX, y: this.draft.source.centerY };
    const target = this.draft.target ? { x: this.draft.target.centerX, y: this.draft.target.centerY } : this.pointerWorld;
    const curve = cableBezier(source, target);
    ctx.save(); ctx.setLineDash([8, 6]);
    this.strokeCurve(ctx, curve, this.draft.target ? "#42d9c8" : "#8fa4a7", 2.5, .9);
    ctx.restore();
  }

  drawSelectionBox(ctx) {
    if (!this.selectionBox) return;
    const x = Math.min(this.selectionBox.start.x, this.selectionBox.end.x);
    const y = Math.min(this.selectionBox.start.y, this.selectionBox.end.y);
    const width = Math.abs(this.selectionBox.end.x - this.selectionBox.start.x);
    const height = Math.abs(this.selectionBox.end.y - this.selectionBox.start.y);
    ctx.fillStyle = "rgba(66, 217, 200, .08)"; ctx.strokeStyle = "rgba(66, 217, 200, .72)"; ctx.lineWidth = 1 / this.camera.zoom; ctx.setLineDash([6 / this.camera.zoom, 4 / this.camera.zoom]);
    ctx.fillRect(x, y, width, height); ctx.strokeRect(x, y, width, height); ctx.setLineDash([]);
  }

  drawTooltip(ctx) {
    if (!this.hoveredPort || this.drag || this.pan || this.draft) return;
    const box = this.hoveredPort;
    const port = box.port;
    const topology = this.state.topology;
    const connected = topology.links.find((link) => link.sourcePortId === port.id || link.targetPortId === port.id);
    let endpoint = "UNPATCHED";
    if (connected) {
      const peerID = connected.sourcePortId === port.id ? connected.targetPortId : connected.sourcePortId;
      const peer = findPort(topology, peerID);
      endpoint = peer ? `${peer.device.name} / ${peer.port.label}` : "UNKNOWN PEER";
    }
    const lines = [
      `${box.device.name} · PORT ${port.label}`,
      `${port.type}  /  ${port.speedMbps} Mbps`,
      `${port.mode.toUpperCase()} · NATIVE ${port.nativeVlan || "—"}`,
      `TAGGED ${port.allowedVlans?.join(", ") || "NONE"}`,
      endpoint,
    ];
    ctx.font = "10px Bahnschrift Condensed, sans-serif";
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 24;
    const x = box.centerX + 18; const y = box.centerY - 22;
    ctx.fillStyle = "rgba(7, 13, 15, .97)"; ctx.strokeStyle = "#476168"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, width, 78, 4); ctx.fill(); ctx.stroke();
    lines.forEach((line, index) => {
      ctx.fillStyle = index === 0 ? "#71e8da" : index === 4 ? "#f0b35a" : "#aebebf";
      ctx.font = index === 0 ? "700 10px Bahnschrift Condensed, sans-serif" : "9px Bahnschrift Condensed, sans-serif";
      ctx.textAlign = "left"; ctx.fillText(line, x + 12, y + 16 + index * 13);
    });
  }

  pointerDown(event) {
    this.canvas.setPointerCapture(event.pointerId);
    const screen = this.eventPoint(event);
    const world = this.screenToWorld(screen);
    if (event.button === 1 || (event.button === 0 && this.isSpaceDown)) {
      event.preventDefault();
      this.pan = { screen, camera: { ...this.camera } };
      this.canvas.style.cursor = "grabbing";
      return;
    }
    if (event.button !== 0) return;
    const port = this.hitPort(world);
    if (port) {
      this.state.select("port", port.port.id);
	  const isOccupied = this.state.topology.links.some((link) => [link.sourcePortId, link.targetPortId].includes(port.port.id));
	  if (isOccupied) return;
      this.mode = CableMode.DRAFTING_CABLE;
      this.draft = { source: port, target: null };
      return;
    }
    const device = this.hitDevice(world);
    if (device) {
      if (!event.shiftKey || !this.selectedDevices.has(device.device.id)) {
        if (!event.shiftKey) this.selectedDevices.clear();
        this.selectedDevices.add(device.device.id);
      }
      this.state.select("device", device.device.id);
      this.drag = { start: world, originals: new Map(), snapshot: structuredClone(this.state.topology) };
      for (const selectedID of this.selectedDevices) {
        const selected = this.state.topology.devices.find((item) => item.id === selectedID);
        if (selected) this.drag.originals.set(selectedID, { x: selected.positionX, y: selected.positionY });
      }
      return;
    }
    const link = this.hitLink(world);
    if (link) {
      this.mode = CableMode.SELECTED_LINK;
      this.state.select("link", link.link.id);
      return;
    }
    this.state.select(null, null);
    this.selectedDevices.clear();
    this.selectionBox = { start: world, end: world };
  }

  pointerMove(event) {
    const screen = this.eventPoint(event);
    const world = this.screenToWorld(screen);
    this.pointerWorld = world;
    this.callbacks.onPointer?.(world, this.camera.zoom);
    if (this.pan) {
      this.camera.x = this.pan.camera.x + screen.x - this.pan.screen.x;
      this.camera.y = this.pan.camera.y + screen.y - this.pan.screen.y;
      return;
    }
    if (this.drag) {
      const dx = world.x - this.drag.start.x;
      const dy = world.y - this.drag.start.y;
      for (const [id, original] of this.drag.originals) {
        const device = this.state.topology.devices.find((item) => item.id === id);
        if (!device) continue;
        device.positionX = Math.max(0, Math.round((original.x + dx) / GRID) * GRID);
        device.positionY = Math.max(0, Math.round((original.y + dy) / GRID) * GRID);
      }
      this.state.emit("topology");
      return;
    }
    if (this.selectionBox) {
      this.selectionBox.end = world;
      return;
    }
    if (this.draft) {
      const candidate = this.nearestPort(world, 18 / this.camera.zoom);
      this.draft.target = candidate && this.isEligibleTarget(this.draft.source, candidate) ? candidate : null;
    }
    this.hoveredPort = this.hitPort(world, 4 / this.camera.zoom);
    this.canvas.style.cursor = this.hoveredPort ? "pointer" : this.draft ? "crosshair" : "default";
  }

  pointerUp(event) {
    const wasDrag = this.drag;
    if (this.pan) {
      this.pan = null; this.canvas.style.cursor = "default";
    } else if (this.draft) {
      const { source, target } = this.draft;
      if (target) this.callbacks.onLinkCreate?.(source, target);
      this.draft = null; this.mode = CableMode.IDLE;
    } else if (wasDrag) {
      this.state.history.push(wasDrag.snapshot);
      this.state.history = this.state.history.slice(-50);
      this.state.future = [];
      for (const id of wasDrag.originals.keys()) {
        const device = this.state.topology.devices.find((item) => item.id === id);
        if (device) this.callbacks.onDeviceUpdate?.(structuredClone(device));
      }
      this.drag = null;
    } else if (this.selectionBox) {
      const left = Math.min(this.selectionBox.start.x, this.selectionBox.end.x);
      const top = Math.min(this.selectionBox.start.y, this.selectionBox.end.y);
      const right = Math.max(this.selectionBox.start.x, this.selectionBox.end.x);
      const bottom = Math.max(this.selectionBox.start.y, this.selectionBox.end.y);
      this.selectedDevices = new Set(this.deviceBoxes.filter((box) => box.x < right && box.x + box.width > left && box.y < bottom && box.y + box.height > top).map((box) => box.device.id));
      const first = this.selectedDevices.values().next().value;
      if (first) this.state.select("device", first);
      this.selectionBox = null;
    }
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  }

  wheel(event) {
    event.preventDefault();
    const screen = this.eventPoint(event);
    const before = this.screenToWorld(screen);
    const factor = Math.exp(-event.deltaY * .0015);
    this.camera.zoom = Math.max(.1, Math.min(5, this.camera.zoom * factor));
    this.camera.x = screen.x - before.x * this.camera.zoom;
    this.camera.y = screen.y - before.y * this.camera.zoom;
    this.callbacks.onPointer?.(this.pointerWorld, this.camera.zoom);
  }

  contextMenu(event) {
    event.preventDefault();
    const link = this.hitLink(this.screenToWorld(this.eventPoint(event)));
    if (link) this.callbacks.onLinkDelete?.(link.link);
  }

  cancelInteraction() {
    if (this.drag?.snapshot) this.state.setTopology(this.drag.snapshot);
    this.draft = null; this.drag = null; this.pan = null; this.selectionBox = null; this.mode = CableMode.IDLE;
    this.canvas.style.cursor = "default";
  }

  isEligibleTarget(source, target) {
    if (!source || !target || source.port.id === target.port.id || source.device.id === target.device.id) return false;
    return !this.state.topology.links.some((link) => [link.sourcePortId, link.targetPortId].includes(target.port.id));
  }

  eventPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  screenToWorld(point) {
    return { x: (point.x - this.camera.x) / this.camera.zoom, y: (point.y - this.camera.y) / this.camera.zoom };
  }

  hitPort(point, tolerance = 0) {
    for (let index = this.portBoxes.length - 1; index >= 0; index -= 1) {
      const box = this.portBoxes[index];
      if (point.x >= box.x - tolerance && point.x <= box.x + box.width + tolerance && point.y >= box.y - tolerance && point.y <= box.y + box.height + tolerance) return box;
    }
    return null;
  }

  nearestPort(point, radius) {
    let nearest = null; let distance = radius;
    for (const box of this.portBoxes) {
      const current = Math.hypot(point.x - box.centerX, point.y - box.centerY);
      if (current < distance) { nearest = box; distance = current; }
    }
    return nearest;
  }

  hitDevice(point) {
    for (let index = this.deviceBoxes.length - 1; index >= 0; index -= 1) {
      const box = this.deviceBoxes[index];
      if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) return box;
    }
    return null;
  }

  hitLink(point) {
    for (let index = this.linkCurves.length - 1; index >= 0; index -= 1) {
      if (distanceToCurve(point, this.linkCurves[index].curve) <= 8 / this.camera.zoom) return this.linkCurves[index];
    }
    return null;
  }

  fit() {
    const bounds = this.worldBounds();
    const zoom = Math.max(.1, Math.min(1.5, Math.min((this.width - 70) / bounds.width, (this.height - 70) / bounds.height)));
    this.camera.zoom = zoom;
    this.camera.x = (this.width - bounds.width * zoom) / 2 - bounds.x * zoom;
    this.camera.y = (this.height - bounds.height * zoom) / 2 - bounds.y * zoom;
    this.callbacks.onPointer?.(this.pointerWorld, this.camera.zoom);
  }

  worldBounds() {
    this.layoutScene();
    if (!this.deviceBoxes.length) return { x: 0, y: 0, width: 800, height: 500 };
    const left = Math.min(...this.deviceBoxes.map((box) => box.x));
    const top = Math.min(...this.deviceBoxes.map((box) => box.y));
    const right = Math.max(...this.deviceBoxes.map((box) => box.x + box.width));
    const bottom = Math.max(...this.deviceBoxes.map((box) => box.y + box.height));
    return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
  }

  portCenters() {
    this.layoutScene();
    return new Map(this.portBoxes.map((box) => [box.port.id, { x: box.centerX, y: box.centerY }]));
  }

  renderExport() {
    const bounds = this.worldBounds();
    const scale = Math.min(2, 7000 / Math.max(bounds.width + 100, bounds.height + 100));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil((bounds.width + 100) * scale);
    canvas.height = Math.ceil((bounds.height + 100) * scale);
    const context = canvas.getContext("2d");
    const oldRatio = this.ratio;
    this.ratio = 1;
    this.renderFrame(context, canvas.width, canvas.height, { x: (50 - bounds.x) * scale, y: (50 - bounds.y) * scale, zoom: scale }, performance.now(), false);
    this.ratio = oldRatio;
    return canvas;
  }
}

function isFormField(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement;
}

function lighten(hex, amount) { return shift(hex, amount); }
function darken(hex, amount) { return shift(hex, -amount); }
function shift(hex, amount) {
  const value = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex.slice(1) : "243438";
  const parts = [0, 2, 4].map((index) => Math.max(0, Math.min(255, parseInt(value.slice(index, index + 2), 16) + amount)));
  return `rgb(${parts.join(",")})`;
}

function vendorColor(vendor) {
	const colors = { Fortinet: "#ef4b45", Cisco: "#65bde8", "HPE Aruba": "#f28c28", Juniper: "#7fba46", Ubiquiti: "#73d4ff", MikroTik: "#d8e5e8", Dell: "#6fc3e8", NETGEAR: "#9c7bd8", "TP-Link Omada": "#58bf68", Arista: "#53b7d4", Extreme: "#bd7be0", Ruckus: "#f0a34a", "Palo Alto": "#f0a34a", Sophos: "#62a8df", "Check Point": "#e56f9d" };
  return colors[vendor] || "#42d9c8";
}
