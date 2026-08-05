const WebSocket = require("ws");
const { OSController } = require("./osController");

class SocketServer {
    constructor(port = 8080, httpsServer = null) {
        this.port = port;
        this.httpsServer = httpsServer;
        this.wss = null;
        this.osController = new OSController();
        this.clients = new Set();
    }

    async start() {
        await this.osController.init();

        if (this.httpsServer) {
            // Attach WSS to the existing HTTPS server
            this.wss = new WebSocket.Server({ server: this.httpsServer });
            console.log(`[Socket] WSS attached to HTTPS server`);
        } else {
            // Fallback: plain WS on its own port
            this.wss = new WebSocket.Server({ port: this.port });
            console.log(`[Socket] WebSocket server listening on port ${this.port}`);
        }

        this.wss.on("connection", (ws, req) => {
            const clientIp = req.socket.remoteAddress;
            console.log(`[Socket] Client connected from ${clientIp}`);
            this.clients.add(ws);

            ws.on("message", async (message) => {
                try {
                    const payload = JSON.parse(message);
                    await this.handleMessage(ws, payload);
                } catch (err) {
                    console.error("[Socket] Invalid message:", err.message);
                }
            });

            ws.on("close", () => {
                console.log(`[Socket] Client disconnected (${clientIp})`);
                this.clients.delete(ws);
            });

            ws.on("error", (err) => {
                console.error("[Socket] Client error:", err.message);
                this.clients.delete(ws);
            });

            ws.send(JSON.stringify({ type: "connected", message: "HandGesture server ready" }));
        });

        this.wss.on("error", (err) => {
            console.error("[Socket] Server error:", err.message);
        });
    }

    async handleMessage(ws, payload) {
        const { event, data, timestamp } = payload;
        if (!event) {
            console.warn("[Socket] Missing event field");
            return;
        }
        if (event !== "CURSOR_MOVE") {
            console.log(`[Socket] RECEIVED: ${event}`, data);
        } else if (Date.now() % 2000 < 100) {
            console.log(`[Socket] RECEIVED: CURSOR_MOVE`, data);
        }
        await this.osController.dispatch(event, data);
        ws.send(JSON.stringify({ type: "ack", event, timestamp }));
    }

    broadcast(message) {
        const msg = typeof message === "string" ? message : JSON.stringify(message);
        this.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        });
    }

    stop() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
    }
}

module.exports = { SocketServer };
