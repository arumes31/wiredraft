const EVENT_TYPES = ["topology_updated", "device_created", "device_moved", "device_deleted", "link_created", "link_deleted", "port_updated", "vlan_changed"];

export class TopologyEvents {
  constructor(onTopology, onStatus) {
    this.onTopology = onTopology;
    this.onStatus = onStatus;
    this.source = null;
    this.topologyID = null;
    this.retry = 1000;
    this.timer = 0;
    this.stopped = true;
  }

  connect(topologyID) {
    this.close();
    this.topologyID = topologyID;
    this.stopped = false;
    this.open();
  }

  open() {
    if (this.stopped || !this.topologyID) return;
    this.onStatus("connecting");
    const source = new EventSource(`/api/v1/topologies/${encodeURIComponent(this.topologyID)}/events`);
    this.source = source;
    source.onopen = () => {
      this.retry = 1000;
      this.onStatus("online");
    };
    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (event) => {
        try {
          this.onTopology(JSON.parse(event.data), type);
        } catch (error) {
          console.error("Invalid SSE topology", error);
        }
      });
    }
    source.onerror = () => {
      if (this.stopped) return;
      source.close();
      this.onStatus("offline");
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.open(), this.retry);
      this.retry = Math.min(this.retry * 2, 30000);
    };
  }

  close() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.source?.close();
    this.source = null;
  }
}
