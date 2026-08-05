import { VisionEngine } from './vision.js';
import { GestureEngine } from './gestures.js';
import { GestureSocket } from './websocket.js';

class App {
    constructor() {
        this.video = document.getElementById('webcam');
        this.canvas = document.getElementById('overlay');
        this.loading = document.getElementById('loading');
        this.label = document.getElementById('gesture-label');
        this.laser = document.getElementById('laser-pointer');
        this.zoomInd = document.getElementById('zoom-indicator');
        this.vision = new VisionEngine();
        this.gestures = new GestureEngine();
        this.socket = new GestureSocket();
        this.stream = null; this.running = false; this.deviceId = null;
        this.zoom = 1.0; this.laserPos = {x:0,y:0}; this.zoomTimer = null;
    }
    async init() {
        try { this.bindUI(); await this.listCameras(); await this.startCamera(); this.tryConnect(); this.log('App ready', 'ok'); }
        catch(e) { this.log('Init error: ' + e.message, 'err'); console.error(e); }
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
            document.getElementById('debug-ws').textContent = s;
        });
    }
    async listCameras() {
        try {
            await navigator.mediaDevices.getUserMedia({video:true});
            const devs = await navigator.mediaDevices.enumerateDevices();
            const cams = devs.filter(d => d.kind === 'videoinput');
            const sel = document.getElementById('camera-select');
            sel.innerHTML = '<option value="">Default Camera</option>';
            cams.forEach((c,i) => { const opt = document.createElement('option'); opt.value = c.deviceId; opt.textContent = c.label || 'Camera ' + (i+1); sel.appendChild(opt); });
            this.log('Found ' + cams.length + ' camera(s)', 'ok');
        } catch(e) { this.log('Camera list failed: ' + e.message, 'err'); }
    }
    async startCamera() {
        try {
            const cons = {video: {width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30}}};
            if (this.deviceId) cons.video.deviceId = {exact: this.deviceId};
            this.stream = await navigator.mediaDevices.getUserMedia(cons);
            this.video.srcObject = this.stream;
            await new Promise(r => { this.video.onloadedmetadata = () => { this.video.play(); r(); }; });
            this.vision.resizeCanvas(this.video, this.canvas);
            await this.vision.initialize();
            this.loading.classList.add('hidden');
            this.vision.start(this.video, this.canvas, list => this.onResults(list));
            this.running = true;
            document.getElementById('toggle-camera-btn').textContent = 'Stop Camera';
            this.log('Camera started', 'ok');
        } catch(e) {
            this.log('Camera error: ' + e.message, 'err');
            console.error(e);
            alert('Camera failed: ' + e.message);
        }
    }
    stopCamera() {
        this.vision.stop();
        if (this.stream) { this.stream.getTracks().forEach(t=>t.stop()); this.stream=null; }
        this.video.srcObject = null;
        this.running = false;
        document.getElementById('toggle-camera-btn').textContent = 'Start Camera';
        this.label.textContent = 'Camera stopped';
        this.hideLaser();
        this.log('Camera stopped');
    }
    async tryConnect() {
        const host = document.getElementById('server-host').value || '127.0.0.1';
        const port = parseInt(document.getElementById('server-port').value) || 8080;
        try { await this.socket.connect(host, port); } catch(e) { this.log('WS auto-connect failed (optional)', 'warn'); }
    }
    async manualConnect() {
        const host = document.getElementById('server-host').value || '127.0.0.1';
        const port = parseInt(document.getElementById('server-port').value) || 8080;
        this.log('Connecting to ' + host + ':' + port + '...');
        try { await this.socket.connect(host, port); this.log('Connected!', 'ok'); }
        catch(e) { this.log('Connect failed: ' + e.message, 'err'); }
    }
    showLaser(nx, ny, mode) {
        const x = (1-nx) * window.innerWidth;
        const y = ny * window.innerHeight;
        this.laserPos = {x,y};
        this.laser.style.left = x+'px';
        this.laser.style.top = y+'px';
        this.laser.classList.add('active');
        this.laser.classList.remove('scrolling');
        if (mode === 'scroll') this.laser.classList.add('scrolling');
    }
    hideLaser() { this.laser.classList.remove('active', 'scrolling'); }
    doClick() {
        const {x,y} = this.laserPos;
        if (!x && !y) return;
        this.laser.classList.add('clicking');
        setTimeout(()=>this.laser.classList.remove('clicking'), 200);
        const el = document.elementFromPoint(x,y);
        if (el) { el.click(); el.focus(); this.log('Clicked '+el.tagName, 'ok'); }
        this.socket.send('CLICK', {x:x/window.innerWidth, y:y/window.innerHeight});
    }
    doScroll(deltaY) {
        const {x,y} = this.laserPos;
        if (!x && !y) return;
        let el = document.elementFromPoint(x,y);
        let target = null;
        while (el && el !== document.body && el !== document.documentElement) {
            const style = getComputedStyle(el);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
                target = el; break;
            }
            el = el.parentElement;
        }
        if (!target) window.scrollBy({top: deltaY, behavior: 'auto'});
        else target.scrollTop += deltaY;
    }
    doNav(dir) {
        if (dir==='back') { history.back(); this.log('Back', 'ok'); }
        else { history.forward(); this.log('Forward', 'ok'); }
    }
    doPlayPause() {
        const vids = document.querySelectorAll('video');
        if (!vids.length) { this.log('No videos', 'warn'); return; }
        vids.forEach(v => { v.paused ? v.play() : v.pause(); });
        this.log('Play/Pause toggled', 'ok');
    }
    doZoom(lvl) {
        this.zoom = lvl;
        document.body.style.transform = 'scale('+lvl+')';
        document.body.style.transformOrigin = 'top left';
        document.body.style.width = (100/lvl)+'%';
        this.zoomInd.textContent = 'Zoom: ' + Math.round(lvl*100)+'%';
        this.zoomInd.classList.add('visible');
        clearTimeout(this.zoomTimer);
        this.zoomTimer = setTimeout(()=>this.zoomInd.classList.remove('visible'), 1500);
        this.log('Zoom '+Math.round(lvl*100)+'%', 'ok');
    }
    doFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(()=>{});
            this.log('Fullscreen ON', 'ok');
        } else {
            document.exitFullscreen().catch(()=>{});
            this.log('Fullscreen OFF', 'ok');
        }
    }
    onResults(list) {
        if (!list || !list.length) {
            this.label.textContent = 'No hand detected';
            document.getElementById('debug-gesture').textContent = 'None';
            this.hideLaser();
            return;
        }
        const r = this.gestures.process(list[0]);
        if (!r) return;
        document.getElementById('debug-gesture').textContent = r.type;

        if (r.type === 'LASER_MOVE') {
            const speed = parseFloat(document.getElementById('cursor-speed').value);
            const cx=0.5, cy=0.5;
            const x = Math.max(0, Math.min(1, (r.data.x-cx)*speed+cx));
            const y = Math.max(0, Math.min(1, (r.data.y-cy)*speed+cy));
            this.showLaser(x, y, 'laser');
            this.label.textContent = r.label;
            document.getElementById('debug-cursor').textContent = 'x:'+x.toFixed(2)+' y:'+y.toFixed(2);
            this.socket.send('LASER_MOVE', {x,y});
            return;
        }

        if (r.type === 'SCROLL_MOVE') {
            const speed = parseFloat(document.getElementById('cursor-speed').value);
            const cx=0.5, cy=0.5;
            const x = Math.max(0, Math.min(1, (r.data.x-cx)*speed+cx));
            const y = Math.max(0, Math.min(1, (r.data.y-cy)*speed+cy));
            this.showLaser(x, y, 'scroll');
            this.label.textContent = r.label;
            document.getElementById('debug-cursor').textContent = 'scroll Δ:'+Math.round(r.data.deltaY);
            if (Math.abs(r.data.deltaY) > 2) this.doScroll(r.data.deltaY);
            this.socket.send('SCROLL_MOVE', {x,y,deltaY:r.data.deltaY});
            return;
        }

        this.hideLaser();

        if (r.type !== 'NONE') {
            this.label.textContent = r.label;
            switch(r.type) {
                case 'CLICK': this.doClick(); break;
                case 'SCROLL_UP': this.doScroll(-window.innerHeight*0.4); break;
                case 'SCROLL_DOWN': this.doScroll(window.innerHeight*0.4); break;
                case 'NAV_BACK': this.doNav('back'); break;
                case 'NAV_FORWARD': this.doNav('forward'); break;
                case 'PLAY_PAUSE': this.doPlayPause(); break;
                case 'ZOOM': this.doZoom(r.data.level); break;
                case 'FULLSCREEN': this.doFullscreen(); break;
            }
            document.getElementById('debug-sent').textContent = r.type;
            this.log('Action: '+r.type, 'ok');
            this.socket.send(r.type, r.data || {});
        } else {
            this.label.textContent = r.label;
        }
    }
    log(msg, type) {
        const el = document.getElementById('debug-log');
        const entry = document.createElement('div');
        entry.className = 'log-entry' + (type ? ' log-'+type : '');
        const t = new Date().toLocaleTimeString();
        entry.textContent = '[' + t.split(' ')[0] + '] ' + msg;
        el.appendChild(entry);
        el.scrollTop = el.scrollHeight;
        while (el.children.length > 50) el.removeChild(el.firstChild);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});