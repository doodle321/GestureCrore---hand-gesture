export class GestureSocket {
    constructor() {
        this.ws = null;
        this.status = 'disconnected';
        this.host = '127.0.0.1';
        this.port = 8080;
        this.listeners = new Map();
    }
    connect(host, port) {
        this.host = host || this.host;
        this.port = port || this.port;
        if (this.ws) { try { this.ws.close(); } catch(e) {} this.ws = null; }
        return new Promise((resolve, reject) => {
            const url = 'ws://' + this.host + ':' + this.port;
            console.log('[WS] Trying ' + url);
            try {
                this.ws = new WebSocket(url);
                let done = false;
                const timer = setTimeout(() => {
                    if (!done) { done = true; this.status = 'disconnected'; this.emit('statusChange', 'disconnected'); reject(new Error('timeout')); }
                }, 3000);
                this.ws.onopen = () => { if (done) return; done = true; clearTimeout(timer); this.status = 'connected'; this.emit('statusChange', 'connected'); console.log('[WS] Connected'); resolve(); };
                this.ws.onerror = () => { if (done) return; done = true; clearTimeout(timer); this.status = 'disconnected'; this.emit('statusChange', 'disconnected'); reject(new Error('error')); };
                this.ws.onclose = () => { if (!done) { done = true; clearTimeout(timer); this.status = 'disconnected'; this.emit('statusChange', 'disconnected'); reject(new Error('closed')); } };
                this.ws.onmessage = (e) => { try { this.emit('message', JSON.parse(e.data)); } catch(err) {} };
            } catch(err) { reject(err); }
        });
    }
    send(type, data) {
        if (!this.ws || this.ws.readyState !== 1) return false;
        try { this.ws.send(JSON.stringify({event: type, data: data, timestamp: Date.now()})); return true; } catch(e) { return false; }
    }
    on(event, cb) { if (!this.listeners.has(event)) this.listeners.set(event, []); this.listeners.get(event).push(cb); }
    emit(event, data) { if (!this.listeners.has(event)) return; this.listeners.get(event).forEach(cb => cb(data)); }
}