export class TerminalRegistry {
    constructor() {
        this.entries = new Map();
    }

    register(object, snap) {
        this.entries.set(object, snap);
        if (snap) {
            // Переносим настройки из пресета прямо в userData клеммы
            object.userData.snapOffset = snap.offset;
            object.userData.snapRot = {
                x: snap.rotation.x,
                y: snap.rotation.y,
                z: snap.rotation.z
            };
        }
    }

    registerMany(objects, snap) {
        objects.forEach((o) => this.register(o, snap));
    }

    all() {
        return [...this.entries.keys()];
    }

    snapFor(object) {
        return this.entries.get(object);
    }

    // ДОБАВЛЕННЫЙ МЕТОД ДЛЯ ПОДСВЕТКИ
    setHighlight(object, isHighlighted) {
        if (!object) return;

        object.traverse((child) => {
            if (child.isMesh && child.material) {
                const mat = Array.isArray(child.material) ? child.material[0] : child.material;
                if (mat.emissive) {
                    mat.emissive.setHex(
                        isHighlighted ? 0xffff00 : (child.userData.originalEmissive || 0x000000)
                    );
                }
            }
        });
    }
}