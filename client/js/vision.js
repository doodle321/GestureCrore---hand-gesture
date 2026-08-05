import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export class VisionEngine {
    constructor() {
        this.handLandmarker = null;
        this.running = false;
        this.lastVideoTime = -1;
        this.results = null;
        this.onResults = null;
    }
    async initialize() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
            );
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });
            console.log("[Vision] HandLandmarker initialized");
            return true;
        } catch (err) {
            console.error("[Vision] Initialization failed:", err);
            throw err;
        }
    }
    start(videoElement, canvasElement, onResultsCallback) {
        if (!this.handLandmarker) throw new Error("HandLandmarker not initialized");
        this.running = true;
        this.onResults = onResultsCallback;
        const canvasCtx = canvasElement.getContext("2d");
        const predictWebcam = async () => {
            if (!this.running) return;
            if (videoElement.currentTime !== this.lastVideoTime) {
                this.lastVideoTime = videoElement.currentTime;
                const startTimeMs = performance.now();
                this.results = this.handLandmarker.detectForVideo(videoElement, startTimeMs);
                this.drawOverlay(canvasElement, canvasCtx, this.results);
                if (this.onResults && this.results.landmarks) {
                    this.onResults(this.results.landmarks);
                }
            }
            requestAnimationFrame(predictWebcam);
        };
        predictWebcam();
    }
    stop() { this.running = false; }
    drawOverlay(canvas, ctx, results) {
        const width = canvas.width; const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        if (!results || !results.landmarks || results.landmarks.length === 0) return;
        const landmarks = results.landmarks[0];
        const connections = [
            [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
            [0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],
            [0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]
        ];
        ctx.strokeStyle = "#00d4aa"; ctx.lineWidth = 2;
        for (const [start, end] of connections) {
            const a = landmarks[start]; const b = landmarks[end];
            ctx.beginPath(); ctx.moveTo(a.x * width, a.y * height);
            ctx.lineTo(b.x * width, b.y * height); ctx.stroke();
        }
        for (const lm of landmarks) {
            ctx.beginPath(); ctx.arc(lm.x * width, lm.y * height, 4, 0, 2 * Math.PI);
            ctx.fillStyle = "#00d4aa"; ctx.fill();
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.stroke();
        }
        const indexTip = landmarks[8];
        ctx.beginPath(); ctx.arc(indexTip.x * width, indexTip.y * height, 8, 0, 2 * Math.PI);
        ctx.fillStyle = "#ff6b6b"; ctx.fill();
    }
    resizeCanvas(videoElement, canvasElement) {
        canvasElement.width = videoElement.videoWidth || 1280;
        canvasElement.height = videoElement.videoHeight || 720;
    }
}
