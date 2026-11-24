import * as THREE from 'three';
import { GeneratorDisplay } from './GeneratorDisplay.js';
import { KnobController } from './KnobController.js';
import { ButtonController } from './ButtonController.js';
import { resolveSnap } from '../../config/snapPresets.js';
import { AudioEngine } from '../../audio/AudioEngine.js'; // Проверь путь!

export class GeneratorDevice {
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
        this.buttons = null;

        this.audio = new AudioEngine(); 

        // Ссылки на все 4 ручки
        this.freqKnob = null;
        this.voltKnob = null;
        this.freqFineKnob = null;
        this.amplitudeKnob = null;

        // Текущее физическое состояние прибора
        this.state = {
            frequencyHz: 1000, // Итоговая частота
            amplitudeV: 0.0,   // Итоговое напряжение (по умолчанию 0, так как питание выключено)
        };

        this.freqLocked = false;
        this.ampLocked = false;
        this._lockedFreq = 1000;
        this._lockedAmp = 2;

        this.TERMINAL_NAMES = ['Red_Left_Clemma', 'Red_Right_Clemma', 'Black_Clemma_Left', 'Black_Clemma_Right'];
    }

    async load() {
        this.model = await this.loader.load({
            path: 'models/Generator.glb',
            position: this.position,
            scale: 3,
        });
        this.scene.add(this.model);

        this.display = new GeneratorDisplay(this.model);
        this.buttons = new ButtonController(this.model);

        // Находим все ручки по их именам в 3D-модели
        this.freqKnob = this.model.getObjectByName('Frequency_Button');
        this.voltKnob = this.model.getObjectByName('Voltage_Button');
        this.freqFineKnob = this.model.getObjectByName('Freq_HZ_Button');
        this.amplitudeKnob = this.model.getObjectByName('Amplitude_Button'); // SET AMPLITUDE

        // Загрузка текстуры для кнопок
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load('models/textures/Base_Button_2.jpg', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.flipY = false;
            this.buttons.setActiveTexture(tex);
        });

        // Сохраняем оригинальные текстуры
        this.model.traverse((child) => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (mat.map && mat.userData.originalMap === undefined) {
                        mat.userData.originalMap = mat.map;
                    }
                });
            }
        });

        // Сохраняем оригинальный цвет клемм для подсветки
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
        this.registry.registerMany(terminals, resolveSnap('generator'));

        // Первичный расчет значений (проверит питание и либо включит, либо выключит экран)
        this.updateDisplayValues();
    }

    updateDisplayValues() {
        if (!this.buttons) return;

        if (!this.buttons.isPowerOn) {
            this.state.amplitudeV = 0;
            this.display.turnOff();
            this.audio.stop();
            return;
        }

        if (this.freqLocked) {
            this.state.frequencyHz = this._lockedFreq;
        } else if (this.freqKnob) {
            const freqVal = this.knobs.getNormalizedValue(this.freqKnob);
            let baseFreq = Math.pow(10, (1.0 - freqVal) * 5.0);
            if (this.freqFineKnob) {
                const fineVal = this.knobs.getNormalizedValue(this.freqFineKnob);
                const fineMultiplier = 0.9 + (1.0 - fineVal) * 0.2;
                baseFreq = baseFreq * fineMultiplier;
            }
            this.state.frequencyHz = baseFreq;
        }

        if (this.ampLocked) {
            this.state.amplitudeV = this._lockedAmp;
        } else {
            let maxVoltage = 10.0;
            let amplitudeMultiplier = 1.0;
            if (this.voltKnob) {
                const voltVal = this.knobs.getNormalizedValue(this.voltKnob);
                maxVoltage = 1.0 + (1.0 - voltVal) * 9.0;
            }
            if (this.amplitudeKnob) {
                const ampVal = this.knobs.getNormalizedValue(this.amplitudeKnob);
                amplitudeMultiplier = 1.0 - ampVal;
            }
            this.state.amplitudeV = maxVoltage * amplitudeMultiplier;
        }

        this.display.turnOn?.();
        this.display.updateFrequency(this.state.frequencyHz, this.buttons.displayInKHz);
        if (this.audio) {
            this.audio.setFrequency(this.state.frequencyHz);
            this.audio.setWaveform(this.buttons.activeWaveform);
        }
    }

    setFrequencyHz(hz) {
        const f = Math.min(100000, Math.max(1, Number(hz)));
        if (!Number.isFinite(f)) return this.state.frequencyHz;
        this.freqLocked = true;
        this._lockedFreq = f;
        this.state.frequencyHz = f;
        if (this.buttons?.isPowerOn) this.updateDisplayValues();
        return f;
    }

    setAmplitudeV(volts) {
        const v = Math.min(10, Math.max(0, Number(volts)));
        if (!Number.isFinite(v)) return this.state.amplitudeV;
        this.ampLocked = true;
        this._lockedAmp = v;
        if (this.buttons && !this.buttons.isPowerOn) this.buttons.isPowerOn = true;
        this.state.amplitudeV = v;
        this.updateDisplayValues();
        return this.state.amplitudeV;
    }

    ensurePowerOn() {
        if (!this.buttons) return false;
        if (!this.buttons.isPowerOn) this.buttons.isPowerOn = true;
        this.updateDisplayValues();
        if (this.state.amplitudeV < 0.05) this.setAmplitudeV(2);
        try { this.audio?.init(); } catch (err) { console.warn(err); }
        return this.state.amplitudeV > 0.05;
    }

    onPointerDown(event, raycaster, mouse) {
        if (!this.model) return false;

        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObject(this.model, true);

        if (intersects.length > 0) {
            let clickedObj = intersects[0].object;
            let targetObj = null;

            while (clickedObj) {
                const name = clickedObj.name;
                if (this.knobs.isKnob(name) || this.buttons.isButton(name)) {
                    targetObj = clickedObj;
                    break;
                }
                clickedObj = clickedObj.parent;
            }

            if (targetObj) {
                this.controls.enabled = false;

                this.audio.init(); 

                if (this.knobs.isKnob(targetObj.name)) {
                    if (targetObj.name === 'Frequency_Button' || targetObj.name === 'Freq_HZ_Button') {
                        this.freqLocked = false;
                    }
                    if (targetObj.name === 'Voltage_Button' || targetObj.name === 'Amplitude_Button') {
                        this.ampLocked = false;
                    }
                    this.knobs.start(targetObj, event);
                    document.body.style.cursor = 'grabbing';
                } else {
                    this.buttons.handle(targetObj);
                    this.updateDisplayValues(); // При нажатии на кнопку (включая Power) обновляем состояние
                }
                return true;
            }
        }
        return false;
    }

    onPointerMove(event, raycaster, mouse) {
        if (!this.model) return false;

        if (this.knobs.active) {
            this.knobs.move(event);
            this.updateDisplayValues(); // Обновляем расчеты при каждом движении мыши
            return true;
        }

        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObject(this.model, true);
        if (intersects.length > 0) {
            let obj = intersects[0].object;
            while (obj) {
                const name = obj.name;
                if (this.knobs.isKnob(name) || this.buttons.isButton(name)) {
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