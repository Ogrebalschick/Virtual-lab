import * as THREE from 'three';

export class GeneratorDisplay {
    constructor(model) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 256;
        this.canvas.height = 512;
        this.ctx = this.canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        const screenMesh = model.getObjectByName('Screen');

        if (screenMesh) {
            if (Array.isArray(screenMesh.material)) {
                screenMesh.material = screenMesh.material[0].clone();
            } else {
                screenMesh.material = screenMesh.material.clone();
            }

            screenMesh.material.map = this.texture;
            screenMesh.material.emissive = new THREE.Color(0xffffff);
            screenMesh.material.emissiveMap = this.texture;
            screenMesh.material.emissiveIntensity = 1.5;
            screenMesh.material.roughness = 0.2;
            screenMesh.material.metalness = 0.1;
            screenMesh.material.side = THREE.DoubleSide;
            screenMesh.material.depthTest = true;
            screenMesh.renderOrder = 0;
            screenMesh.material.polygonOffset = true;
            screenMesh.material.polygonOffsetFactor = -1;
            screenMesh.material.polygonOffsetUnits = -1;
            screenMesh.material.needsUpdate = true;

            // При инициализации сразу тушим экран (так как по умолчанию питание выключено)
            this.turnOff();
        }
    }

    // НОВЫЙ МЕТОД: полное выключение экрана
    turnOff() {
        if (!this.ctx || !this.texture) return;
        this.ctx.fillStyle = '#050505'; // Темный цвет (выключенный экран)
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.texture.needsUpdate = true;
    }

    updateFrequency(freqHz, isKHz) {
        let text = "";
        if (isKHz) {
            // Отображаем в кГц (например, 10.00k)
            text = (freqHz / 1000).toFixed(2) + "k";
        } else {
            // Отображаем в Гц (например, 10000)
            if (freqHz < 10) {
                text = freqHz.toFixed(1);
            } else {
                text = freqHz.toFixed(0);
            }
        }
        this.updateText(text);
    }

    updateText(text) {
        if (!this.ctx || !this.texture) return;

        const ctx = this.ctx;
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();

        const dispOffsetX = -80;
        const dispOffsetY = 0;
        const dispScale = 0.8;
        const dispRotation = -90 * Math.PI / 180;

        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.translate(dispOffsetX, dispOffsetY);
        ctx.scale(dispScale, dispScale);
        ctx.rotate(dispRotation);

        ctx.font = 'bold 80px "Courier New", monospace';
        ctx.fillStyle = '#ff1111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20;

        ctx.fillText(text, 0, 0);
        ctx.restore();
        this.texture.needsUpdate = true;
    }
}