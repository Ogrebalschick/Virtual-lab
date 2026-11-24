import * as THREE from 'three';

export class TerminalSelector {
    constructor(scene, camera, registry, cableManager) {
        this.scene = scene;
        this.camera = camera;
        this.registry = registry;
        this.cableManager = cableManager;

        this.firstSelected = null;
    }

    onPointerDown(event, raycaster, mouse) {
        // Игнорируем правую кнопку мыши (она для удаления)
        if (event.button === 2) return false;

        raycaster.setFromCamera(mouse, this.camera);
        const terminals = this.registry.all();
        const intersects = raycaster.intersectObjects(terminals, true);

        if (intersects.length > 0) {
            // Ищем корневой объект клеммы
            let clickedTerm = intersects[0].object;
            while (clickedTerm && !terminals.includes(clickedTerm)) {
                clickedTerm = clickedTerm.parent;
            }

            if (clickedTerm) {
                this.handleTerminalClick(clickedTerm);
                return true; // Клик обработан, останавливаем передачу события
            }
        }

        // ФИКС: Если кликнули мимо клемм, и до этого была выбрана клемма — сбрасываем выбор
        if (this.firstSelected) {
            this.registry.setHighlight(this.firstSelected, false);
            this.firstSelected = null;
            document.body.style.cursor = 'default';
            console.log("Выделение клеммы отменено.");
        }

        return false; // Возвращаем false, чтобы клик мог обработаться камерой или кнопками приборов
    }

    handleTerminalClick(terminal) {
        if (!this.firstSelected) {
            // Первый клик
            this.firstSelected = terminal;
            this.registry.setHighlight(terminal, true); // Желтая подсветка
            document.body.style.cursor = 'crosshair';
        } else {
            // Второй клик
            if (this.firstSelected === terminal) {
                // Кликнули по той же клемме - отмена
                this.registry.setHighlight(terminal, false);
                this.firstSelected = null;
                document.body.style.cursor = 'default';
            } else {
                // Создаем провод
                this.cableManager.createCableBetween(this.firstSelected, terminal);

                // Сброс выделения
                this.registry.setHighlight(this.firstSelected, false);
                this.firstSelected = null;
                document.body.style.cursor = 'default';
            }
        }
    }
}