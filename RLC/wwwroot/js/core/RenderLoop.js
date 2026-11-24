export class RenderLoop {
    constructor(scene) { this.scene = scene; this.updatables = []; }

    add(obj) { this.updatables.push(obj); return this; }
    start() {
        const loop = () => {
            requestAnimationFrame(loop);
            this.updatables.forEach((u) => u.update?.(0.016));
            this.scene.controls.update();
            this.scene.renderer.render(this.scene.scene, this.scene.camera);
        };
        loop();
    }
}