import os

base = os.path.expanduser("~/md/hand gesture")

# 1. websocket.js
ws = '''export class GestureSocket {
    constructor() {
        this.ws = null;
        this.status = 'disconnected';
n        this.host = '127.0.0.1';
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
n    }
    send(type, data) {
        if (!this.ws || this.ws.readyState !== 1) return false;
        try { this.ws.send(JSON.stringify({event: type, data: data, timestamp: Date.now()})); return true; } catch(e) { return false; }
    }
    on(event, cb) { if (!this.listeners.has(event)) this.listeners.set(event, []); this.listeners.get(event).push(cb); }
    emit(event, data) { if (!this.listeners.has(event)) return; this.listeners.get(event).forEach(cb => cb(data)); }
}
'''
with open(os.path.join(base, 'client/js/websocket.js'), 'w') as f: f.write(ws)

# 2. gestures.js
gestures = '''export class GestureEngine {
    constructor(opts = {}) {
        this.opts = { smoothingFrames: opts.smoothingFrames || 5, clickThreshold: opts.clickThreshold || 0.04, swipeVelocityThreshold: opts.swipeVelocityThreshold || 0.15, cooldownMs: opts.cooldownMs || 300 };
        this.cursorBuffer = []; this.palmHistory = []; this.cooldowns = {};
    }
    updateOptions(o) { Object.assign(this.opts, o); }
    process(landmarks) {
        if (!landmarks || landmarks.length < 21) return null;
        const fingers = this.fingerStates(landmarks);
        const palm = this.palmCenter(landmarks);
        this.palmHistory.push({x: palm.x, y: palm.y, t: Date.now()});
        if (this.palmHistory.length > 10) this.palmHistory.shift();
        const vel = this.velocity(); const stationary = this.isStationary();
        if (!fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky && this.ok('FULLSCREEN')) { this.setcd('FULLSCREEN'); return {type: 'FULLSCREEN', label: 'Fullscreen ✊'}; }
        const pinch = this.dist(landmarks[4], landmarks[8]);
        if (pinch <= this.opts.clickThreshold && this.ok('CLICK')) { this.setcd('CLICK'); return {type: 'CLICK', label: 'Click 👌'}; }
        if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky && this.ok('PLAY')) { this.setcd('PLAY'); return {type: 'PLAY_PAUSE', label: 'Play/Pause ✌️'}; }
        const openPalm = fingers.index && fingers.middle && fingers.ring && fingers.pinky;
        if (openPalm) {
            if (Math.abs(vel.vx) > this.opts.swipeVelocityThreshold) {
                if (vel.vx < 0 && this.ok('LEFT')) { this.setcd('LEFT'); return {type: 'NAV_BACK', label: 'Back 👋'}; }
                if (vel.vx > 0 && this.ok('RIGHT')) { this.setcd('RIGHT'); return {type: 'NAV_FORWARD', label: 'Forward 👋'}; }
            }
            if (Math.abs(vel.vy) > this.opts.swipeVelocityThreshold) {
                if (vel.vy < 0 && this.ok('UP')) { this.setcd('UP'); return {type: 'SCROLL_UP', label: 'Scroll Up 👆'}; }
                if (vel.vy > 0 && this.ok('DOWN')) { this.setcd('DOWN'); return {type: 'SCROLL_DOWN', label: 'Scroll Down 👇'}; }
            }
        }
        if (stationary && fingers.index && this.ok('ZOOM')) { const d = this.dist(landmarks[4], landmarks[8]); const lvl = Math.max(0.5, Math.min(2.0, 0.5 + d * 6)); this.setcd('ZOOM'); return {type: 'ZOOM', data: {level: Math.round(lvl*100)/100}, label: 'Zoom ' + Math.round(lvl*100) + '% 🤏'}; }
        if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) { const tip = landmarks[8]; const s = this.smooth(tip.x, tip.y); return {type: 'LASER_MOVE', data: {x: s.x, y: s.y}, label: 'Laser ☝️', continuous: true}; }
        return {type: 'NONE', label: 'No Gesture'};
n    }
    fingerStates(lm) { const ext = (t,p) => lm[t].y < lm[p].y; return { thumb: this.dist(lm[4], lm[5]) > 0.05, index: ext(8,6), middle: ext(12,10), ring: ext(16,14), pinky: ext(20,18) }; }
    palmCenter(lm) { return {x: (lm[0].x + lm[9].x)/2, y: (lm[0].y + lm[9].y)/2}; }
    dist(a,b) { const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
    smooth(x,y) { this.cursorBuffer.push({x,y}); if (this.cursorBuffer.length > this.opts.smoothingFrames) this.cursorBuffer.shift(); const n = this.cursorBuffer.length; return { x: this.cursorBuffer.reduce((s,p)=>s+p.x,0)/n, y: this.cursorBuffer.reduce((s,p)=>s+p.y,0)/n }; }
    velocity() { if (this.palmHistory.length < 2) return {vx:0, vy:0}; const r = this.palmHistory.slice(-5); const a=r[0], b=r[r.length-1]; const dt = b.t - a.t; if (!dt) return {vx:0, vy:0}; return {vx: (b.x-a.x)/(dt/1000), vy: (b.y-a.y)/(dt/1000)}; }
    isStationary() { if (this.palmHistory.length < 5) return false; const r = this.palmHistory.slice(-5); const last = r[r.length-1]; let max = 0; for (const p of r) { const d = Math.sqrt((p.x-last.x)**2 + (p.y-last.y)**2); if (d > max) max = d; } return max < 0.02; }
    ok(id) { const last = this.cooldowns[id]; return !last || (Date.now()-last) > this.opts.cooldownMs; }
    setcd(id) { this.cooldowns[id] = Date.now(); }
}
'''
with open(os.path.join(base, 'client/js/gestures.js'), 'w') as f: f.write(gestures)

# 3. app.js
app = '''import { VisionEngine } from './vision.js';
import { GestureEngine } from './gestures.js';
import { GestureSocket } from './websocket.js';

class App {
    constructor() {
        this.video = document.getElementById('webcam');
        this.canvas = document.getElementById('overlay');
        this.loading = document.getElementById('loading');
        this.label = document.getElementById('gesture-label');
n        this.laser = document.getElementById('laser-pointer');
        this.zoomInd = document.getElementById('zoom-indicator');
        this.vision = new VisionEngine();
        this.gestures = new GestureEngine();
        this.socket = new GestureSocket();
        this.stream = null; this.running = false; this.deviceId = null;\n        this.zoom = 1.0; this.laserPos = {x:0,y:0}; this.zoomTimer = null;
    }
    async init() {
        try { this.bindUI(); await this.listCameras(); await this.startCamera(); this.tryConnect(); this.log('App ready', 'ok'); }
n        catch(e) { this.log('Init error: ' + e.message, 'err'); console.error(e); }
    }
    bindUI() {
        const $ = id => document.getElementById(id);
        $('cursor-speed').oninput = e => $('cursor-speed-val').textContent = e.target.value + 'x';
        $('click-threshold').oninput = e => { $('click-threshold-val').textContent = e.target.value; this.gestures.updateOptions({clickThreshold: parseFloat(e.target.value)}); };
        $('smoothing').oninput = e => { $('smoothing-val').textContent = e.target.value; this.gestures.updateOptions({smoothingFrames: parseInt(e.target.value)}); };
        $('cooldown').oninput = e => { $('cooldown-val').textContent = e.target.value + 'ms'; this.gestures.updateOptions({cooldownMs: parseInt(e.target.value)}); };
        $('camera-select').onchange = e => { this.deviceId = e.target.value || null; if (this.running) { this.stopCamera(); setTimeout(()=>this.startCamera(), 300); } };
        $('refresh-cameras-btn').onclick = () => this.listCameras();
        $('connect-btn').onclick = () => this.manualConnect();
        $('toggle-camera-btn').onclick = () => { if (this.running) this.stopCamera(); else this.startCamera(); };
        this.socket.on('statusChange', s => {
            const badge = document.getElementById('network-status');
            badge.className = 'status-badge ' + s;
            badge.querySelector('.status-text').textContent = s === 'connected' ? 'Connected' : s === 'reconnecting' ? 'Reconnecting...' : 'Disconnected';
n            document.getElementById('debug-ws').textContent = s;
        });
    }
    async listCameras() {
        try {
            await navigator.mediaDevices.getUserMedia({video:true});
n            const devs = await navigator.mediaDevices.enumerateDevices();
n            const cams = devs.filter(d => d.kind === 'videoinput');
n            const sel = document.getElementById('camera-select');
n            sel.innerHTML = '<option value="">Default Camera</option>';
n            cams.forEach((c,i) => { const opt = document.createElement('option'); opt.value = c.deviceId; opt.textContent = c.label || 'Camera ' + (i+1); sel.appendChild(opt); });
n            this.log('Found ' + cams.length + ' camera(s)', 'ok');
n        } catch(e) { this.log('Camera list failed: ' + e.message, 'err'); }
n    }
n    async startCamera() {
n        try {
n            const cons = {video: {width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30}}};\n            if (this.deviceId) cons.video.deviceId = {exact: this.deviceId};\n            this.stream = await navigator.mediaDevices.getUserMedia(cons);\n            this.video.srcObject = this.stream;\n            await new Promise(r => { this.video.onloadedmetadata = () => { this.video.play(); r(); }; });\n            this.vision.resizeCanvas(this.video, this.canvas);\n            await this.vision.initialize();\n            this.loading.classList.add('hidden');\n            this.vision.start(this.video, this.canvas, list => this.onResults(list));\n            this.running = true;\n            document.getElementById('toggle-camera-btn').textContent = 'Stop Camera';\n            this.log('Camera started', 'ok');\n        } catch(e) {\n            this.log('Camera error: ' + e.message, 'err');\n            console.error(e);\n            alert('Camera failed: ' + e.message);\n        }\n    }\n    stopCamera() {\n        this.vision.stop();\n        if (this.stream) { this.stream.getTracks().forEach(t=>t.stop()); this.stream=null; }\n        this.video.srcObject = null;\n        this.running = false;\n        document.getElementById('toggle-camera-btn').textContent = 'Start Camera';\n        this.label.textContent = 'Camera stopped';\n        this.hideLaser();\n        this.log('Camera stopped');\n    }\n    async tryConnect() {\n        const host = document.getElementById('server-host').value || '127.0.0.1';\n        const port = parseInt(document.getElementById('server-port').value) || 8080;\n        try { await this.socket.connect(host, port); } catch(e) { this.log('WS auto-connect failed (optional)', 'warn'); }\n    }\n    async manualConnect() {\n        const host = document.getElementById('server-host').value || '127.0.0.1';\n        const port = parseInt(document.getElementById('server-port').value) || 8080;\n        this.log('Connecting to ' + host + ':' + port + '...');\n        try { await this.socket.connect(host, port); this.log('Connected!', 'ok'); }\n        catch(e) { this.log('Connect failed: ' + e.message, 'err'); }\n    }\n    showLaser(nx, ny) {\n        const x = (1-nx) * window.innerWidth;\n        const y = ny * window.innerHeight;\n        this.laserPos = {x,y};\n        this.laser.style.left = x+'px';\n        this.laser.style.top = y+'px';\n        this.laser.classList.add('active');\n    }\n    hideLaser() { this.laser.classList.remove('active'); }\n    doClick() {\n        const {x,y} = this.laserPos;\n        if (!x && !y) return;\n        this.laser.classList.add('clicking');\n        setTimeout(()=>this.laser.classList.remove('clicking'), 200);\n        const el = document.elementFromPoint(x,y);\n        if (el) { el.click(); el.focus(); this.log('Clicked '+el.tagName, 'ok'); }\n        this.socket.send('CLICK', {x:x/window.innerWidth, y:y/window.innerHeight});\n    }\n    doScroll(dir) {\n        const amt = window.innerHeight * 0.4;\n        window.scrollBy({top: dir==='up'?-amt:amt, behavior:'smooth'});\n        this.log('Scrolled '+dir, 'ok');\n    }\n    doNav(dir) {\n        if (dir==='back') { history.back(); this.log('Back', 'ok'); }\n        else { history.forward(); this.log('Forward', 'ok'); }\n    }\n    doPlayPause() {\n        const vids = document.querySelectorAll('video');\n        if (!vids.length) { this.log('No videos', 'warn'); return; }\n        vids.forEach(v => { v.paused ? v.play() : v.pause(); });\n        this.log('Play/Pause toggled', 'ok');\n    }\n    doZoom(lvl) {\n        this.zoom = lvl;\n        document.body.style.transform = 'scale('+lvl+')';\n        document.body.style.transformOrigin = 'top left';\n        document.body.style.width = (100/lvl)+'%';\n        this.zoomInd.textContent = 'Zoom: ' + Math.round(lvl*100)+'%';\n        this.zoomInd.classList.add('visible');\n        clearTimeout(this.zoomTimer);\n        this.zoomTimer = setTimeout(()=>this.zoomInd.classList.remove('visible'), 1500);\n        this.log('Zoom '+Math.round(lvl*100)+'%', 'ok');\n    }\n    doFullscreen() {\n        if (!document.fullscreenElement) {\n            document.documentElement.requestFullscreen().catch(()=>{});\n            this.log('Fullscreen ON', 'ok');\n        } else {\n            document.exitFullscreen().catch(()=>{});\n            this.log('Fullscreen OFF', 'ok');\n        }\n    }\n    onResults(list) {\n        if (!list || !list.length) {\n            this.label.textContent = 'No hand detected';\n            document.getElementById('debug-gesture').textContent = 'None';\n            this.hideLaser();\n            return;\n        }\n        const r = this.gestures.process(list[0]);\n        if (!r) return;\n        document.getElementById('debug-gesture').textContent = r.type;\n        if (r.type === 'LASER_MOVE') {\n            const speed = parseFloat(document.getElementById('cursor-speed').value);\n            const cx=0.5, cy=0.5;\n            const x = Math.max(0, Math.min(1, (r.data.x-cx)*speed+cx));\n            const y = Math.max(0, Math.min(1, (r.data.y-cy)*speed+cy));\n            this.showLaser(x,y);\n            this.label.textContent = r.label;\n            document.getElementById('debug-cursor').textContent = 'x:'+x.toFixed(2)+' y:'+y.toFixed(2);\n            this.socket.send('LASER_MOVE', {x,y});\n            return;\n        }\n        this.hideLaser();\n        if (r.type !== 'NONE') {\n            this.label.textContent = r.label;\n            switch(r.type) {\n                case 'CLICK': this.doClick(); break;\n                case 'SCROLL_UP': this.doScroll('up'); break;\n                case 'SCROLL_DOWN': this.doScroll('down'); break;\n                case 'NAV_BACK': this.doNav('back'); break;\n                case 'NAV_FORWARD': this.doNav('forward'); break;\n                case 'PLAY_PAUSE': this.doPlayPause(); break;\n                case 'ZOOM': this.doZoom(r.data.level); break;\n                case 'FULLSCREEN': this.doFullscreen(); break;\n            }\n            document.getElementById('debug-sent').textContent = r.type;\n            this.log('Action: '+r.type, 'ok');\n            this.socket.send(r.type, r.data || {});\n        } else {\n            this.label.textContent = r.label;\n        }\n    }\n    log(msg, type) {\n        const el = document.getElementById('debug-log');\n        const entry = document.createElement('div');\n        entry.className = 'log-entry' + (type ? ' log-'+type : '');\n        const t = new Date().toLocaleTimeString();\n        entry.textContent = '[' + t.split(' ')[0] + '] ' + msg;\n        el.appendChild(entry);\n        el.scrollTop = el.scrollHeight;\n        while (el.children.length > 50) el.removeChild(el.firstChild);\n    }\n}\n\ndocument.addEventListener('DOMContentLoaded', () => {\n    window.app = new App();\n    window.app.init();\n});\n'''\nwith open(os.path.join(base, 'client/js/app.js'), 'w') as f: f.write(app)

print('All 3 files written successfully!')\n