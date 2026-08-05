const https = require("https");
const fs = require("fs");
const express = require("express");
const path = require("path");
const { SocketServer } = require("./socketServer");
const { getLocalIp } = require("./utils/network");

const HTTP_PORT = 3000;
const WS_PORT = 8080;

const app = express();
app.use(express.static(path.join(__dirname, "../client")));

app.get("/health", (req, res) => {
    res.json({ status: "ok", version: "1.0.0" });
});

// Read self-signed certificate
const key = fs.readFileSync("key.pem");
const cert = fs.readFileSync("cert.pem");

// Create HTTPS server
const httpsServer = https.createServer({ key, cert }, app);

httpsServer.listen(HTTP_PORT, "0.0.0.0", () => {
    const localIp = getLocalIp();
    console.log(`
========================================
[HandGesture Host Server Active]
----------------------------------------
Local Access:   https://localhost:${HTTP_PORT}
Network Access: https://${localIp}:${HTTP_PORT}
WebSocket Port: ${WS_PORT}  (WSS)
----------------------------------------
WARNING: You will see a browser security
warning because this uses a self-signed
certificate. Click "Advanced" → "Proceed".
----------------------------------------
Press CTRL+C to stop the server.
========================================
    `);
});

// Attach WebSocket server to the same HTTPS server (so WSS works)
const socketServer = new SocketServer(WS_PORT, httpsServer);
socketServer.start();

// Failsafe hook
try {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on("data", (data) => {
            const key = data.toString();
            if (key === "\u0003") {
                console.log("\n[Server] Shutting down...");
                socketServer.stop();
                process.exit(0);
            }
            if (key === "\u0006") {
                console.log("[Server] FAILSAFE triggered");
                socketServer.osController.failsafe();
            }
        });
    }
} catch (e) {}

process.on("SIGINT", () => {
    console.log("\n[Server] Shutting down...");
    socketServer.stop();
    process.exit(0);
});
