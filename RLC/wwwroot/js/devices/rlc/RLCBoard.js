import * as THREE from 'three';
import { KnobController } from '../generator/KnobController.js'; // Переиспользуем контроллер ручек
import { resolveSnap } from '../../config/snapPresets.js';

export class RLCBoard {
    constructor({ scene, renderer, camera, controls, registry, loader, position }) {
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;
        this.controls = controls;
        this.registry = registry;
        this.loader = loader;
        this.position = position;

        // 1. СНАЧАЛА создаем контроллер
        this.knobs = new KnobController();

        // 2. ТЕПЕРЬ настраиваем его углы
        this.knobs.minAngleDeg = -140;
        this.knobs.maxAngleDeg = 145;
        this.knobs.updateLimits(); // <--- ОБЯЗАТЕЛЬНО применяем новые лимиты!

        this.model = null;
        this.rKnob = null;

        // Текущее физическое состояние (номиналы платы)
        this.state = {
            R: 50.0,
            L: 0.010,
            C: 0.000001
        };

        this.TERMINAL_NAMES = [
            'C_Black_Clemma', 'C_Red_Clemma',
            'Input_Black_Clemma', 'Input_Red_Clemma',
            'L_Black_Clemma', 'L_Red_Clemma',
            'Output_Black_Clemma', 'Output_Red_Clemma',
            'R_Black_Clemma', 'R_Red_Clemma'
        ];
    }

    async load() {
        this.model = await this.loader.load({
            path: 'models/RLC.glb',
            position: this.position,
            scale: 3,
        });
        this.scene.add(this.model);

        // Ищем ручку резистора. 
        // ВНИМАНИЕ: Возможно, в твоей 3D-модели она называется иначе! 
        // Если ручка не крутится, проверь её имя в Blender и поменяй здесь.
        this.rKnob = this.model.getObjectByName('Knob') || this.model.getObjectByName('Potentiometer');

        if (!this.rKnob) {
            console.warn("Внимание: Ручка резистора не найдена на RLC-плате! Проверь имя меша в Blender.");
        }

        // Сохраняем оригинальный emissive клемм
        this.TERMINAL_NAMES.forEach(name => {
            const term = this.model.getObjectByName(name);
            if (term) {
                term.traverse(child => {
                    if (child.isMesh && child.material) {
                        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
                        if (mat.emissive) {
                            child.userData.originalEmissive = mat.emissive.getHex();
                        }
                    }
                });
            }
        });

        // Регистрация клемм (если они не зарегистрированы через models.js)
        const terminals = this.loader.findTerminals(this.model, this.TERMINAL_NAMES);
        this.registry.registerMany(terminals, resolveSnap('rlc'));

        this.updateState();
    }

    updateState() {
        if (this.rLocked || !this.rKnob) return;
        const val = this.knobs.getNormalizedValue(this.rKnob);
        this.state.R = 10.0 + val * 990.0;
    }

    setResistance(ohms) {
        const R = Math.min(1000, Math.max(10, Number(ohms)));
        if (!Number.isFinite(R)) return this.state.R;
        this.rLocked = true;
        this.state.R = R;
        return R;
    }

    setLC({ L, C } = {}) {
        if (L > 0) this.state.L = L;
        if (C > 0) this.state.C = C;
    }

    onPointerDown(event, raycaster, mouse) {
        if (!this.model) return false;

        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObject(this.model, true);

        if (intersects.length > 0) {
            let clickedObj = intersects[0].object;
            let targetObj = null;

            while (clickedObj) {
                if (this.knobs.isKnob(clickedObj.name) || clickedObj === this.rKnob) {
                    targetObj = clickedObj;
                    break;
                }
                clickedObj = clickedObj.parent;
            }

            if (targetObj) {
                this.controls.enabled = false;
                this.rLocked = false;
                this.knobs.axis = 'z'; 
                this.knobs.speed = -0.015;
                this.knobs.start(targetObj, event);
                document.body.style.cursor = 'grabbing';
                return true;
            }
        }
        return false;
    }

    onPointerMove(event, raycaster, mouse) {
        if (!this.model) return false;

        if (this.knobs.active) {
            this.knobs.move(event);
            this.updateState(); // Пересчитываем R при вращении
            return true;
        }

        // Смена курсора
        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObject(this.model, true);
        if (intersects.length > 0) {
            let obj = intersects[0].object;
            while (obj) {
                if (this.knobs.isKnob(obj.name) || obj === this.rKnob) {
                    document.body.style.cursor = 'pointer';
                    return true;
                }
                obj = obj.parent;
            }
        }
        return false;
    }

    onPointerUp() {
        this.controls.enabled = true;
        this.knobs.end();
        document.body.style.cursor = 'default';
    }
}