import * as THREE from 'three';

const KEPT_MAPS = [
    'roughnessMap',
    'metalnessMap',
    'normalMap',
    'aoMap',
    'bumpMap',
    'displacementMap',
    'alphaMap',
    'lightMap',
    'emissiveMap',
    'specularIntensityMap',
    'specularColorMap',
    'clearcoatMap',
    'clearcoatNormalMap',
    'clearcoatRoughnessMap',
];

export class ButtonController {
    constructor(model) {
        this.model = model;
        this.isPowerOn = false;
        this.isTextureLoaded = false;
        this.activeBtnTexture = null;

        // СОСТОЯНИЯ
        this.displayInKHz = false;
        this.activeWaveform = 'Sine_Wave';    // Реально работающая волна
        this.selectedWaveform = 'Sine_Wave';  // Только что выбранная кнопка (до нажатия SELECT)
        this.selectModeActive = false;

        this.POWER_SOCKET_NAME = 'Retopo_Black_ON_BUTTON_OFF';
        this.POWER_ON_NAME = 'Retopo_ON_OFF_BUTTON_ON';
        this.POWER_OFF_NAME = 'Retopo_ON_OFF_BUTTON_OFF';
        this.SELECT_BUTTON_NAME = 'Select_Button';

        this.WAVEFORM_NAMES = ['Sine_Wave', 'Square_Wave_New', 'Triangle_Wave_New'];
        this.FREQ_RANGE_NAMES = ['HZ_BUTTON_NEW', 'KHZ_BUTTON_NEW'];

        this.powerBtnOn = model.getObjectByName(this.POWER_ON_NAME);
        this.powerBtnOff = model.getObjectByName(this.POWER_OFF_NAME);

        if (this.powerBtnOn && this.powerBtnOff) {
            this.powerBtnOn.visible = false;
            this.powerBtnOff.visible = true;
        }
    }


    isButton(name) {
        return this.WAVEFORM_NAMES.includes(name) ||
            this.FREQ_RANGE_NAMES.includes(name) ||
            name === this.POWER_SOCKET_NAME ||
            name === this.POWER_ON_NAME ||
            name === this.POWER_OFF_NAME ||
            name === this.SELECT_BUTTON_NAME;
    }

    handle(buttonObj) {
        const btnName = buttonObj.name;
        console.log(`Нажата кнопка: ${btnName}`);

        // Обработка кнопки SELECT (Подтверждение выбора)
        if (btnName === this.SELECT_BUTTON_NAME) {
            // Применяем выбранную волну к активной
            this.activeWaveform = this.selectedWaveform;
            console.log(`SELECT нажат! Применена форма волны: ${this.activeWaveform}`);
            return;
        }

        // Питание
        if (btnName === this.POWER_SOCKET_NAME || btnName === this.POWER_ON_NAME || btnName === this.POWER_OFF_NAME) {
            this.isPowerOn = !this.isPowerOn;
            if (this.powerBtnOn && this.powerBtnOff) {
                this.powerBtnOn.visible = this.isPowerOn;
                this.powerBtnOff.visible = !this.isPowerOn;
            }
            return;
        }

        // Выбор формы волны (ТОЛЬКО предварительный выбор)
        if (this.WAVEFORM_NAMES.includes(btnName)) {
            this.selectedWaveform = btnName;
            this.#setActiveButtonInGroup(btnName, this.WAVEFORM_NAMES); // Подсвечиваем выбранную кнопку
            console.log(`Выбрана (ожидает SELECT): ${btnName}`);
            return;
        }

        // Формат отображения (Hz / kHz)
        if (this.FREQ_RANGE_NAMES.includes(btnName)) {
            this.displayInKHz = (btnName === 'KHZ_BUTTON_NEW');
            this.#setActiveButtonInGroup(btnName, this.FREQ_RANGE_NAMES);
            return;
        }
    }



    setActiveTexture(tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        this.activeBtnTexture = tex;
        this.isTextureLoaded = true;
        this.#setActiveButtonInGroup(this.activeWaveform, this.WAVEFORM_NAMES);
        this.#setActiveButtonInGroup('HZ_BUTTON_NEW', this.FREQ_RANGE_NAMES);
    }

    #ownMaterial(child) {
        if (child.userData._btnMat) return child.userData._btnMat;

        const src = Array.isArray(child.material) ? child.material[0] : child.material;
        if (!src) return null;

        const mat = src.clone();
        mat.map = src.map || null;
        if (src.color) mat.color.copy(src.color);
        if ('roughness' in src) mat.roughness = src.roughness;
        if ('metalness' in src) mat.metalness = src.metalness;
        if ('ior' in src) mat.ior = src.ior;
        if ('specularIntensity' in src) mat.specularIntensity = src.specularIntensity;

        const kept = {};
        for (const key of KEPT_MAPS) {
            if (key in src) {
                mat[key] = src[key] || null;
                kept[key] = src[key] || null;
            }
        }

        child.userData._btnMat = mat;
        child.userData._baseMap = src.map || null;
        child.userData._keptMaps = kept;

        if (Array.isArray(child.material)) child.material[0] = mat;
        else child.material = mat;
        return mat;
    }

    #applyBaseColor(child, map) {
        const mat = this.#ownMaterial(child);
        if (!mat) return;

        const src = child.userData._baseMap;
        if (map) {
            map.colorSpace = THREE.SRGBColorSpace;
            map.flipY = false;
            if (src) {
                map.wrapS = src.wrapS;
                map.wrapT = src.wrapT;
                map.repeat.copy(src.repeat);
                map.offset.copy(src.offset);
                map.rotation = src.rotation;
                map.channel = src.channel;
                map.anisotropy = src.anisotropy;
            }
            mat.map = map;
        } else {
            mat.map = src;
        }

        const kept = child.userData._keptMaps;
        for (const key in kept) mat[key] = kept[key];
        mat.needsUpdate = true;
    }

    #setActiveButtonInGroup(activeBtnName, groupArray) {
        if (!this.isTextureLoaded || !this.activeBtnTexture) return;

        for (const name of groupArray) {
            const btn = this.model.getObjectByName(name);
            if (!btn) continue;

            btn.traverse((child) => {
                if (!child.isMesh || !child.material) return;
                const hasUVs = child.geometry?.attributes?.uv;
                if (!hasUVs) return;
                this.#applyBaseColor(
                    child,
                    name === activeBtnName ? this.activeBtnTexture : null
                );
            });
        }
    }


}