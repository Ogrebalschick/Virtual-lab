export class InputRouter {
    constructor(scene) {
        this.scene = scene;
        this.handlers = [];
        this.#attach();
    }

    register(handler) {
        this.handlers.push(handler);
        return this;
    }

    #attach() {
        const canvas = this.scene.canvas;

        // Отключаем стандартное меню браузера по правой кнопке мыши
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        canvas.addEventListener('pointerdown', (e) => {
            this.scene.updateMouse(e);
            for (const h of this.handlers) {
                if (h.onPointerDown?.(e, this.scene.raycaster, this.scene.mouse)) return;
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            this.scene.updateMouse(e);
            for (const h of this.handlers) {
                if (h.onPointerMove?.(e, this.scene.raycaster, this.scene.mouse)) return;
            }
            document.body.style.cursor = 'default';
        });

        window.addEventListener('pointerup', () => {
            this.handlers.forEach((h) => h.onPointerUp?.());
        });
    }
}