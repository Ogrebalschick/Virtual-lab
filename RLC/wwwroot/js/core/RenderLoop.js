export class RenderLoop {
    constructor(scene) {
        this.scene = scene;
        this.updatables = [];
        this._frameWaiters = [];
    }

    add(obj) { this.updatables.push(obj); return this; }

    waitForFrame() {
        return new Promise((resolve) => this._frameWaiters.push(resolve));
    }

    start() {
        const loop = () => {
            requestAnimationFrame(loop);
            try {
                this.updatables.forEach((u) => u.update?.(0.016));
                this.scene.controls.update();
                this.scene.renderer.render(this.scene.scene, this.scene.camera);
            } finally {
                if (this._frameWaiters.length) {
                    const waiters = this._frameWaiters.splice(0);
                    waiters.forEach((w) => w());
                }
            }
        };
        loop();
    }
}
