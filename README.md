# GestureCrore — Hand Gesture Control Web App

> Control your computer hands-free using nothing but your webcam.

GestureCrore is an offline-first, local-network Human-Computer Interaction (HCI) system that turns hand gestures into real-time mouse, keyboard, and media commands. It runs entirely on your local machine — no cloud, no data leaving your network.

---

## Features

| Gesture | Action | Icon |
|---|---|---|
| ☝️ Index finger up | Laser pointer / cursor move | ☝️ |
| 👌 Thumb + index pinch | Mouse click | 👌 |
| ✌️ Peace sign (index + middle) | scroll | ✌️ |
| ✊ Closed fist | Toggle fullscreen | ✊ |

- **Real-time hand tracking** powered by [MediaPipe HandLandmarker](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- **Web-based UI** with live webcam overlay and gesture debug panel
- **OS-level control** via `@nut-tree-fork/nut-js` (mouse, keyboard, volume)
- **Secure local networking** with self-signed HTTPS & WSS
- **Adjustable sensitivity** — cursor speed, click threshold, smoothing frames, cooldown
- **Browser extension** support (manifest v3 included)
- **Cross-platform** — Windows, macOS, Linux

---

## Architecture

```
GestureCrore/
├── client/              # Frontend web app
│   ├── index.html       # Main UI
│   ├── js/
│   │   ├── vision.js        # MediaPipe hand tracking
│   │   ├── gestures.js      # Gesture recognition engine
│   │   ├── app.js           # Application logic & UI bindings
│   │   └── websocket.js     # WebSocket client
│   ├── manifest.json    # Browser extension manifest
│   ├── background.js
│   └── content.js
├── server/              # Backend Node.js server
│   ├── index.js         # HTTPS + WebSocket server entry
│   ├── socketServer.js  # WebSocket message handler
│   ├── osController.js  # OS automation (mouse, keyboard, volume)
│   └── utils/
│       └── network.js   # Local IP detection
├── css/
│   └── style.css        # App styling
├── cert.pem / key.pem   # Self-signed SSL certificates
├── package.json
└── fix.py               # Utility script to regenerate client JS
```

### How It Works

1. **Detection** — The browser captures your webcam feed and MediaPipe extracts 21 hand landmarks in real time.
2. **Recognition** — `gestures.js` interprets finger positions and palm motion into discrete gestures.
3. **Transmission** — Recognized gestures are sent over a secure WebSocket to the local Node.js server.
4. **Execution** — The server dispatches OS-level commands (move cursor, click, press keys, adjust volume) via `nut-js`.

---

## Prerequisites

- **Node.js** `>= 18.0.0`
- A **webcam**
- **OS-specific dependencies** for `nut-js` mouse/keyboard control:

| OS | Requirement |
|---|---|
| **Windows** | None (works out of the box) |
| **macOS** | Accessibility permissions for the terminal/app |
| **Linux** | X11 session (not Wayland) + `libxtst-dev` |
| | `sudo apt install libxtst-dev` |

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/doodle321/GestureCrore---hand-gesture.git
cd GestureCrore---hand-gesture
```

### 2. Install dependencies

```bash
npm install
```

This installs:
- `express` — static file server
- `ws` — WebSocket server
- `@nut-tree-fork/nut-js` — OS automation library

### 3. Generate self-signed SSL certificates *(if missing)*

The app uses HTTPS/WSS for secure local communication. If `cert.pem` and `key.pem` are missing, generate them:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
```

---

## Usage

### Start the server

```bash
npm start
# or
npm run dev
```

You should see output like:

```
========================================
[HandGesture Host Server Active]
--------------------------------------
Local Access:   https://localhost:3000
Network Access: https://192.168.x.x:3000
WebSocket Port: 8080 (WSS)
--------------------------------------
WARNING: You will see a browser security
warning because this uses a self-signed
certificate. Click "Advanced" → "Proceed".
--------------------------------------
Press CTRL+C to stop the server.
========================================
```

### Open the client

Navigate to `https://localhost:3000` in your browser.

> **Note:** Because the certificate is self-signed, your browser will show a security warning. Click **Advanced** → **Proceed to localhost (unsafe)**. This is expected for local development.

### Grant camera permissions

When prompted, allow the browser to access your webcam.

### Control your PC

Raise your hand in front of the camera and use the gestures listed above. The on-screen debug panel shows:
- Current gesture
- Cursor coordinates
- WebSocket connection status
- Action log

---

## Configuration

The web UI exposes these tunable parameters in real time:

| Setting | Default | Description |
|---|---|---|
| **Cursor Speed** | `1.0x` | Multiplier for laser pointer movement |
| **Click Threshold** | `0.04` | Pinch distance to trigger a click |
| **Smoothing Frames** | `5` | Frames averaged for cursor smoothing |
| **Cooldown** | `300ms` | Minimum time between repeated actions |
| **Server Host** | `127.0.0.1` | WebSocket server IP |
| **Server Port** | `8080` | WebSocket server port |

---

## Browser Extension Mode

The `client/manifest.json` allows loading the app as a Chrome/Edge extension:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `client/` folder
5. The extension injects gesture control into any webpage

---

## Keyboard Shortcuts (Server Terminal)

While the server is running in a TTY:

| Key | Action |
|---|---|
| `Ctrl + C` | Graceful shutdown |
| `Ctrl + F` | Failsafe — moves cursor to `(0, 0)` |

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `nut-js` fails to initialize on Linux | Ensure you're on **X11** (not Wayland). Install `libxtst-dev`: `sudo apt install libxtst-dev` |
| Camera not detected | Check browser permissions. Try refreshing the camera list with the **Refresh Cameras** button. |
| WebSocket disconnected | Verify the server is running and the host/port in the UI match the server output. |
| Self-signed cert warning | This is normal for local HTTPS. Click **Advanced → Proceed**. For a permanent fix, add the cert to your OS trust store. |
| Gestures not recognized | Ensure good lighting and keep your hand within the camera frame. Adjust **Click Threshold** and **Smoothing** if needed. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Hand Tracking | MediaPipe Tasks Vision (`HandLandmarker`) |
| Frontend | Vanilla JS, HTML5 Canvas, Web APIs |
| Backend | Node.js, Express |
| Real-time Comm | WebSocket (`ws` library) |
| OS Automation | `@nut-tree-fork/nut-js` |
| Networking | Self-signed HTTPS + WSS |

---
