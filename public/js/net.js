// WebSocket wrapper: connect, auto-identify, dispatch messages by type.

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.myId = null;
    this.connected = false;
    this.onStatus = () => {};
  }

  on(type, fn) { this.handlers[type] = fn; }

  connect(hello) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);
    this.onStatus('connecting');
    this.ws.onopen = () => {
      this.connected = true;
      this.send({ t: 'hello', ...hello });
      this.onStatus('connected');
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.myId = null;
      this.onStatus('disconnected');
    };
    this.ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'welcome') this.myId = msg.id;
      this.handlers[msg.t]?.(msg);
    };
  }

  send(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }
}
