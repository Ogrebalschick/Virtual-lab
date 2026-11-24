import * as THREE from 'three';
import { OscilloscopeDisplay } from './OscilloscopeDisplay.js';
import { KnobController } from '../generator/KnobController.js';
import { resolveSnap } from '../../config/snapPresets.js';

const BUTTONS = [
    'Power_Button',
    'Run_Stop_Button',
    'Measure_Button',
    'Auto_Set_Button',
    'Vertical_CH1_Button',
    'Vertical_CH2_Button',
];

export class OscilloscopeDevice {
    constructor({ scene, renderer, camera, controls, registry, loader, position }) {
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;
        this.controls = controls;
        this.registry = registry;
        this.loader = loader;
        this.position = position;

        this.model = null;
        this.display = null;
        this.knobs = new KnobController();

        this.knobs.minAngleDeg = -205;
        this.knobs.maxAngleDeg = 90;
        this.knobs.updateLimits();

        this.isPowered = true;
        this.showCH1 = true;
        this.showCH2 = true;
        this.showLC = false;
        this.isRunning = true;
        this.showMeasurements = false;
        this.autoScale = true;

        this.voltsDivKnob = null;
        this.secDivKnob = null;

        this.TERMINAL_NAMES = ['CH1_INPUT', 'CH2_INPUT', 'TRIG_INPUT'];
    }

    async load() {
        this.model = await this.loader.load({
            path: 'models/Oscillator.glb',
            position: this.position,
            scale: 18,
        });
        this.scene.add(this.model);

        this.display = new OscilloscopeDisplay(this.model);

        this.voltsDivKnob = this.model.getObjectByName('Volts_Div_Knob');
        this.secDivKnob = this.model.getObjectByName('Sec_Div_Knob');

        if (!this.voltsDivKnob) console.warn('Ручка Volts_Div_Knob не найдена!');
        if (!this.secDivKnob) console.warn('Ручка Sec_Div_Knob не найдена!');
        if (!this.model.getObjectByName('Power_Button')) console.warn('Кнопка Power_Button не найдена!');

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

        const terminals = this.loader.findTerminals(this.model, this.TERMINAL_NAMES);
        this.registry.registerMany(terminals, resolveSnap('oscilloscope'));
    }

    getVoltsPerDiv() {
        if (!this.voltsDivKnob) return 10;
        const val = this.knobs.getNormalizedValue(this.voltsDivKnob);
        return 0.1 + val * 19.9;
    }

    getPeriodsToShow() {
        if (!this.secDivKnob) return 2;
        const val = this.knobs.getNormalizedValue(this.secDivKnob);
        return 0.5 + val * 9.5;
    }

    onPointerDown(event, raycaster, mouse) {
        if (!this.model) return false;

        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObject(this.model, true);
        if (intersects.length === 0) return false;

        let clickedObj = intersects[0].object;
        let targetObj = null;
        while (clickedObj) {
            if (clickedObj.name && (this.knobs.isKnob(clickedObj.name) || BUTTONS.includes(clickedObj.name))) {
                targetObj = clickedObj;
                break;
            }
            clickedObj = clickedObj.parent;
        }
        if (!targetObj) return false;

        if (targetObj.name === 'Power_Button') {
            this.isPowered = !this.isPowered;
            this.display?.setPower(this.isPowered);
            if (!this.isPowered && this.knobs.active) {
                this.controls.enabled = true;
                this.knobs.end();
                document.body.style.cursor = 'default';
            }
            return true;
        }

        if (!this.isPowered) return true;

        if (this.knobs.isKnob(targetObj.name)) {
            this.controls.enabled = false;
            this.knobs.axis = 'y';
            this.knobs.speed = 0.015;
            this.knobs.start(targetObj, event);
            document.body.style.cursor = 'grabbing';
            return true;
        }

        const btnName = targetObj.name;
        if (btnName === 'Run_Stop_Button') this.isRunning = !this.isRunning;
        if (btnName === 'Measure_Button') this.showMeasurements = !this.showMeasurements;
        if (btnName === 'Auto_Set_Button') this.autoScale = !this.autoScale;
        if (btnName === 'Vertical_CH1_Button') this.showCH1 = !this.showCH1;
        if (btnName === 'Vertical_CH2_Button') {
            if (this.showCH2 && !this.showLC) this.showLC = true;
            else if (this.showCH2 && this.showLC) this.showCH2 = false;
            else { this.showCH2 = true; this.showLC = false; }
        }
        return true;
    }

    onPointerMove(event, raycaster, mouse) {
        if (!this.model) return false;

        if (this.knobs.active) {
            if (!this.isPowered) return false;
            return this.knobs.move(event);
        }

        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObject(this.model, true);
        if (intersects.length === 0) return false;

        let obj = intersects[0].object;
        while (obj) {
            const usable = obj.name === 'Power_Button'
                || (this.isPowered && (this.knobs.isKnob(obj.name) || BUTTONS.includes(obj.name)));
            if (usable) {
                document.body.style.cursor = 'pointer';
                return true;
            }
            obj = obj.parent;
        }
        return false;
    }

    onPointerUp() {
        if (this.knobs.active) {
            this.controls.enabled = true;
            this.knobs.end();
            document.body.style.cursor = 'default';
        }
    }
}