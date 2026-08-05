const { exec } = require("child_process");
const os = require("os");

class OSController {
    constructor() {
        this.nut = null;
        this.screenW = 1920;
        this.screenH = 1080;
        this.lastClickTime = 0;
        this.clickCooldown = 300;
        this.lastKeyTime = 0;
        this.keyCooldown = 300;
        this.initialized = false;
        this.currentVolume = 50;
    }

    async init() {
        try {
            this.nut = await import("@nut-tree-fork/nut-js");
            this.nut.mouse.config.mouseSpeed = 10000;
            try {
                this.screenW = await this.nut.screen.width();
                this.screenH = await this.nut.screen.height();
                console.log(`[OS] Screen detected: ${this.screenW}x${this.screenH}`);
            } catch (e) {
                console.warn("[OS] Could not detect screen size, using default 1920x1080");
            }
            this.initialized = true;
            console.log("[OS] Controller initialized with @nut-tree-fork/nut-js");
        } catch (err) {
            console.error("[OS] Failed to initialize nut.js:", err.message);
            console.error("[OS] Mouse/keyboard control will not function.");
            console.error("[OS] On Linux, make sure you have X11 (not Wayland) and libxtst-dev installed.");
            console.error("[OS] Install with: sudo apt install libxtst-dev");
            this.initialized = false;
        }
    }

    async dispatch(event, data) {
        if (!this.initialized) {
            console.warn("[OS] Controller not initialized, ignoring event:", event);
            return;
        }
        try {
            switch (event) {
                case "CURSOR_MOVE":
                    await this.moveCursor(data.x, data.y);
                    break;
                case "CLICK":
                    await this.handleClick(data.button);
                    break;
                case "KEY_PRESS":
                    await this.handleKeyPress(data.key);
                    break;
                case "VOLUME_SET":
                    await this.setVolume(data.level);
                    break;
                default:
                    console.warn("[OS] Unknown event:", event);
            }
        } catch (err) {
            console.error(`[OS] Error executing ${event}:`, err.message);
        }
    }

    async moveCursor(normX, normY) {
        const x = Math.round(normX * this.screenW);
        const y = Math.round(normY * this.screenH);
        const clampedX = Math.max(0, Math.min(this.screenW - 1, x));
        const clampedY = Math.max(0, Math.min(this.screenH - 1, y));
        await this.nut.mouse.setPosition(new this.nut.Point(clampedX, clampedY));
    }

    async handleClick(button) {
        const now = Date.now();
        if (now - this.lastClickTime < this.clickCooldown) return;
        this.lastClickTime = now;
        if (button === "left") {
            await this.nut.mouse.click(this.nut.Button.LEFT);
            console.log("[OS] Left click executed");
        } else if (button === "right") {
            await this.nut.mouse.click(this.nut.Button.RIGHT);
            console.log("[OS] Right click executed");
        }
    }

    async handleKeyPress(key) {
        const now = Date.now();
        if (now - this.lastKeyTime < this.keyCooldown) return;
        this.lastKeyTime = now;
        const keyMap = {
            "left_arrow": this.nut.Key.Left,
            "right_arrow": this.nut.Key.Right,
            "up_arrow": this.nut.Key.Up,
            "down_arrow": this.nut.Key.Down,
            "space": this.nut.Key.Space,
            "enter": this.nut.Key.Enter,
            "escape": this.nut.Key.Escape,
            "tab": this.nut.Key.Tab,
            "backspace": this.nut.Key.Backspace,
            "delete": this.nut.Key.Delete,
            "home": this.nut.Key.Home,
            "end": this.nut.Key.End,
            "pageup": this.nut.Key.PageUp,
            "pagedown": this.nut.Key.PageDown
        };
        const nutKey = keyMap[key.toLowerCase()];
        if (nutKey) {
            await this.nut.keyboard.type(nutKey);
            console.log(`[OS] Key pressed: ${key}`);
        } else if (key.length === 1) {
            await this.nut.keyboard.type(key);
            console.log(`[OS] Key typed: ${key}`);
        } else {
            console.warn("[OS] Unknown key:", key);
        }
    }

    async setVolume(level) {
        const percentage = Math.max(0, Math.min(100, Math.round(level * 100)));
        const platform = os.platform();
        let cmd = "";
        if (platform === "win32") {
            cmd = `powershell -NoProfile -Command "Add-Type -TypeDefinition @\\"\\nusing System; using System.Runtime.InteropServices;\\n[Guid(\\"5CDF2C82-841E-4546-9722-0CF74078229A\\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]\\ninterface IAudioEndpointVolume { int SetMasterVolumeLevelScalar(float fLevel, IntPtr pguidEventContext); }\\n[Guid(\\"D666063F-1587-4E43-81F1-B948E807363F\\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]\\ninterface IMMDevice { int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface); }\\n[Guid(\\"A95664D2-9614-4F35-A746-DE8DB63617E6\\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]\\ninterface IMMDeviceEnumerator { int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint); }\\npublic class VolumeControl { public static void SetVolume(int level) { var enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid(\\"BCDE0395-E52F-467C-8E3D-C4579291692E\\"))); IMMDevice device; enumerator.GetDefaultAudioEndpoint(0, 1, out device); Guid iid = new Guid(\\"5CDF2C82-841E-4546-9722-0CF74078229A\\"); object volumeObj; device.Activate(ref iid, 0, IntPtr.Zero, out volumeObj); var volume = (IAudioEndpointVolume)volumeObj; volume.SetMasterVolumeLevelScalar(level / 100f, IntPtr.Zero); } }\\n\\"@; [VolumeControl]::SetVolume(${percentage})"`;
        } else if (platform === "darwin") {
            cmd = `osascript -e "set volume output volume ${percentage}"`;
        } else {
            cmd = `pactl set-sink-volume @DEFAULT_SINK@ ${percentage}%`;
        }
        exec(cmd, (err) => {
            if (err) {
                console.warn("[OS] Volume command failed, trying media keys fallback");
                this.adjustVolumeViaKeys(percentage);
            } else {
                this.currentVolume = percentage;
                console.log(`[OS] Volume set to ${percentage}%`);
            }
        });
    }

    adjustVolumeViaKeys(targetPercentage) {
        if (!this.nut) return;
        const diff = targetPercentage - this.currentVolume;
        const steps = Math.abs(Math.round(diff / 2));
        const key = diff > 0 ? this.nut.Key.AudioVolumeUp : this.nut.Key.AudioVolumeDown;
        for (let i = 0; i < steps; i++) {
            setTimeout(() => {
                this.nut.keyboard.type(key).catch(() => {});
            }, i * 50);
        }
        this.currentVolume = targetPercentage;
    }

    async failsafe() {
        if (!this.initialized) return;
        await this.nut.mouse.setPosition(new this.nut.Point(0, 0));
        console.log("[OS] FAILSAFE: Cursor moved to (0,0)");
    }
}

module.exports = { OSController };
