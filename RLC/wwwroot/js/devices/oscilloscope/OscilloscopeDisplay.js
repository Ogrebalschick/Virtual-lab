import * as THREE from 'three';

export class OscilloscopeDisplay {
    constructor(model) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 800;
        this.canvas.height = 480;
        this.ctx = this.canvas.getContext('2d');
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.isPowered = true;
        this.screenMaterial = null;

        const screenMesh = model.getObjectByName('Screen');
        if (screenMesh) {
            screenMesh.material = (Array.isArray(screenMesh.material) ? screenMesh.material[0] : screenMesh.material).clone();
            screenMesh.material.map = this.texture;
            screenMesh.material.emissive = new THREE.Color(0xffffff);
            screenMesh.material.emissiveMap = this.texture;
            screenMesh.material.emissiveIntensity = 1.2;
            screenMesh.material.needsUpdate = true;
            this.screenMaterial = screenMesh.material;
        }
    }

    setPower(on) {
        this.isPowered = on;
        if (this.screenMaterial) {
            this.screenMaterial.emissiveIntensity = on ? 1.2 : 0;
            this.screenMaterial.needsUpdate = true;
        }
        if (!on) this.#blank();
    }

    #blank() {
        if (!this.ctx || !this.texture) return;
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.texture.needsUpdate = true;
    }

    getWaveValue(waveType, radPhase) {
        let norm = (radPhase / (2 * Math.PI)) % 1;
        if (norm < 0) norm += 1;
        if (waveType === 'Square_Wave_New') return norm < 0.5 ? 1 : -1;
        if (waveType === 'Triangle_Wave_New') {
            if (norm < 0.25) return norm * 4;
            else if (norm < 0.75) return 2 - norm * 4;
            else return norm * 4 - 4;
        }
        return Math.cos(radPhase);
    }

    // ДОБАВЛЕН showCH1
    draw(Em, UCm, psi, freq, ch2Label, hasCH1, showCH1, showCH2, showMeasurements, time, autoScale, voltsPerDiv, periodsToShow, waveType = 'Sine_Wave') {
        if (!this.ctx || !this.texture) return;

        if (!this.isPowered) {
            this.#blank();
            return;
        }

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        this.drawGrid(ctx, w, h);

        // Теперь showCH1 берется из аргумента
        const isCH1Connected = hasCH1 && showCH1;
        const isCH2Connected = ch2Label !== 'None' && showCH2;

        if (!isCH1Connected && !isCH2Connected) {
            ctx.fillStyle = '#ff3333';
            ctx.font = 'bold 30px monospace';
            ctx.textAlign = 'center';
            ctx.fillText("NO SIGNAL", w / 2, h / 2 - 10);
            ctx.font = '18px monospace';
            ctx.fillText("Check INPUT connections", w / 2, h / 2 + 25);
            ctx.textAlign = 'left';
            this.texture.needsUpdate = true;
            return;
        }

        let scaleY = 0;
        if (autoScale) {
            const maxAmp = Math.max(isCH1Connected ? Em : 0, isCH2Connected ? UCm : 0);
            scaleY = (h * 0.4) / (maxAmp > 0.1 ? maxAmp : 1);
        } else {
            scaleY = (h * 0.5) / (voltsPerDiv * 4);
        }

        const T = 1 / (freq > 1 ? freq : 1);

        if (isCH1Connected) {
            ctx.beginPath();
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 10;

            for (let x = 0; x <= w; x++) {
                const t = (x / w) * periodsToShow * T;
                const phaseRad = 2 * Math.PI * freq * t - time;
                const value = Em * this.getWaveValue(waveType, phaseRad);
                const y = h / 2 - value * scaleY;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            if (Em > 0) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.setLineDash([5, 5]);
                ctx.moveTo(w / (periodsToShow * 2), 0);
                ctx.lineTo(w / (periodsToShow * 2), h);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        if (isCH2Connected) {
            ctx.beginPath();
            ctx.strokeStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';

            for (let x = 0; x <= w; x++) {
                const t = (x / w) * periodsToShow * T;
                const phaseRad = 2 * Math.PI * freq * t - psi - time;
                const value = UCm * this.getWaveValue(waveType, phaseRad);
                const y = h / 2 - value * scaleY;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.font = '20px monospace';

        if (showMeasurements) {
            if (isCH1Connected) {
                ctx.fillStyle = '#ffff00';
                ctx.fillText(`CH1: ${Em.toFixed(2)} V`, 20, 30);
            }
            if (isCH2Connected) {
                ctx.fillStyle = '#00ffff';
                ctx.fillText(`CH2: ${UCm.toFixed(2)} V (${ch2Label})`, 20, isCH1Connected ? 60 : 30);
                ctx.fillText(`Phase: ${(psi * 180 / Math.PI).toFixed(1)}°`, 20, isCH1Connected ? 90 : 60);
            }
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Time: ${(T * 1000).toFixed(2)} ms`, w - 200, 30);
        ctx.fillText(`Freq: ${freq.toFixed(1)} Hz`, w - 200, 60);
        ctx.fillText(`Auto: ${autoScale ? 'ON' : 'OFF'}`, w - 200, 90);

        if (!autoScale) {
            ctx.fillText(`V/div: ${voltsPerDiv.toFixed(1)}`, w - 200, 120);
        }

        if (this.isRunning === false) {
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 30px monospace';
            ctx.fillText("STOP", w / 2 - 40, h - 30);
        }

        this.texture.needsUpdate = true;
    }

    drawGrid(ctx, w, h) {
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 1;
        for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo((w / 10) * i, 0); ctx.lineTo((w / 10) * i, h); ctx.stroke(); }
        for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, (h / 8) * i); ctx.lineTo(w, (h / 8) * i); ctx.stroke(); }
        ctx.strokeStyle = '#444444';
        ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    }
}