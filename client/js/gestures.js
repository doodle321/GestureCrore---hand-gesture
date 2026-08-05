export class GestureEngine {
    constructor(opts = {}) {
        this.opts = { smoothingFrames: opts.smoothingFrames || 5, clickThreshold: opts.clickThreshold || 0.04, swipeVelocityThreshold: opts.swipeVelocityThreshold || 0.15, cooldownMs: opts.cooldownMs || 300 };
        this.cursorBuffer = []; this.palmHistory = []; this.cooldowns = {};
        this.scrollPrevY = null;
    }
    updateOptions(o) { Object.assign(this.opts, o); }
    process(landmarks) {
        if (!landmarks || landmarks.length < 21) return null;
        const fingers = this.fingerStates(landmarks);
        const palm = this.palmCenter(landmarks);
        this.palmHistory.push({x: palm.x, y: palm.y, t: Date.now()});
        if (this.palmHistory.length > 10) this.palmHistory.shift();
        const vel = this.velocity(); const stationary = this.isStationary();

        if (!fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky && this.ok('FULLSCREEN')) { this.setcd('FULLSCREEN'); return {type: 'FULLSCREEN', label: 'Fullscreen'}; }

        const pinch = this.dist(landmarks[4], landmarks[8]);
        if (pinch <= this.opts.clickThreshold && this.ok('CLICK')) { this.setcd('CLICK'); return {type: 'CLICK', label: 'Click'}; }

        // SCROLL MODE: index + middle up, ring+pinky folded
        if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
            const tip = landmarks[8];
            const s = this.smooth(tip.x, tip.y);
            let deltaY = 0;
            if (this.scrollPrevY !== null) {
                deltaY = (s.y - this.scrollPrevY) * window.innerHeight * 2.5;
            }
            this.scrollPrevY = s.y;
            return {type: 'SCROLL_MOVE', data: {x: s.x, y: s.y, deltaY: deltaY}, label: 'Scroll Mode', continuous: true};
        }
        this.scrollPrevY = null;

        const openPalm = fingers.index && fingers.middle && fingers.ring && fingers.pinky;
        if (openPalm) {
            if (Math.abs(vel.vx) > this.opts.swipeVelocityThreshold) {
                if (vel.vx > 0 && this.ok('RIGHT')) { this.setcd('RIGHT'); return {type: 'NAV_FORWARD', label: 'Forward'}; }
            }
            if (Math.abs(vel.vy) > this.opts.swipeVelocityThreshold) {
                if (vel.vy < 0 && this.ok('UP')) { this.setcd('UP'); return {type: 'SCROLL_UP', label: 'Scroll Up'}; }
                if (vel.vy > 0 && this.ok('DOWN')) { this.setcd('DOWN'); return {type: 'SCROLL_DOWN', label: 'Scroll Down'}; }
            }
        }

        if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
            const tip = landmarks[8]; const s = this.smooth(tip.x, tip.y);
            return {type: 'LASER_MOVE', data: {x: s.x, y: s.y}, label: 'Laser', continuous: true};
        }

        return {type: 'NONE', label: 'No Gesture'};
    }
    fingerStates(lm) { const ext = (t,p) => lm[t].y < lm[p].y; return { thumb: this.dist(lm[4], lm[5]) > 0.05, index: ext(8,6), middle: ext(12,10), ring: ext(16,14), pinky: ext(20,18) }; }
    palmCenter(lm) { return {x: (lm[0].x + lm[9].x)/2, y: (lm[0].y + lm[9].y)/2}; }
    dist(a,b) { const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
    smooth(x,y) { this.cursorBuffer.push({x,y}); if (this.cursorBuffer.length > this.opts.smoothingFrames) this.cursorBuffer.shift(); const n = this.cursorBuffer.length; return { x: this.cursorBuffer.reduce((s,p)=>s+p.x,0)/n, y: this.cursorBuffer.reduce((s,p)=>s+p.y,0)/n }; }
    velocity() { if (this.palmHistory.length < 2) return {vx:0, vy:0}; const r = this.palmHistory.slice(-5); const a=r[0], b=r[r.length-1]; const dt = b.t - a.t; if (!dt) return {vx:0, vy:0}; return {vx: (b.x-a.x)/(dt/1000), vy: (b.y-a.y)/(dt/1000)}; }
    isStationary() { if (this.palmHistory.length < 5) return false; const r = this.palmHistory.slice(-5); const last = r[r.length-1]; let max = 0; for (const p of r) { const d = Math.sqrt((p.x-last.x)**2 + (p.y-last.y)**2); if (d > max) max = d; } return max < 0.02; }
    ok(id) { const last = this.cooldowns[id]; return !last || (Date.now()-last) > this.opts.cooldownMs; }
    setcd(id) { this.cooldowns[id] = Date.now(); }
}