import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelLoader {
    constructor() { this.loader = new GLTFLoader(); }

    async load({ path, scale = 18, position, floorY = -1.5 }) { // <-- scale теперь 18 по умолчанию
        const gltf = await this.loader.loadAsync(path);
        const model = gltf.scene;
        model.scale.setScalar(scale);

        model.traverse((c) => {
            if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });

        const box = new THREE.Box3().setFromObject(model);

        // Если позиция Y передана явно (как в App.js), используем её. 
        // Иначе ставим на пол.
        const posY = position.y !== undefined ? position.y : (floorY - box.min.y);

        model.position.set(position.x, posY, position.z);
        return model;
    }

    findTerminals(model, names) {
        return names
            .map((n) => model.getObjectByName(n))
            .filter(Boolean); // можно ещё console.warn для отсутствующих
    }
}