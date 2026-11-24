import * as THREE from 'three';

export class TerminalSnapper {
    constructor() {
        this.SNAP_OFFSET = new THREE.Vector3(0, 0.082 * 3, 0);
        this.SNAP_ROT_X = 90 * Math.PI / 180;
        this.SNAP_ROT_Y = 0;
        this.SNAP_ROT_Z = 0;
        this.CABLE_OFFSET = new THREE.Vector3(0, 0, 0);

        // Коэффициент 6 (потому что 18 / 3 = 6) для правильного втыкания
        this.dynamicScale = 6.0;
    }

    getClosestTerminal(raycaster, terminals) {
        if (!terminals || terminals.length === 0) return null;
        const termIntersects = raycaster.intersectObjects(terminals, true);

        if (termIntersects.length > 0) {
            let obj = termIntersects[0].object;
            while (obj && !terminals.includes(obj)) obj = obj.parent;
            return obj;
        }
        return null;
    }

    applySnapTransform(plug, terminal) {
        const termPos = new THREE.Vector3();
        const termQuat = new THREE.Quaternion();
        terminal.getWorldPosition(termPos);
        terminal.getWorldQuaternion(termQuat);

        const baseOffset = terminal.userData.snapOffset || this.SNAP_OFFSET;
        const offset = baseOffset.clone().multiplyScalar(this.dynamicScale);

        const rotX = terminal.userData.snapRot ? terminal.userData.snapRot.x : this.SNAP_ROT_X;
        const rotY = terminal.userData.snapRot ? terminal.userData.snapRot.y : this.SNAP_ROT_Y;
        const rotZ = terminal.userData.snapRot ? terminal.userData.snapRot.z : this.SNAP_ROT_Z;

        plug.position.copy(termPos.clone().add(offset.clone().applyQuaternion(termQuat)));

        const fixRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'XYZ'));
        plug.quaternion.copy(termQuat).multiply(fixRotation);
    }

    setHighlight(terminal, isHighlighted) {
        if (!terminal) return;
        terminal.traverse(child => {
            if (child.isMesh && child.material) {
                const mat = Array.isArray(child.material) ? child.material[0] : child.material;
                if (mat.emissive) {
                    mat.emissive.setHex(isHighlighted ? 0xffff00 : (child.userData.originalEmissive || 0x000000));
                }
            }
        });
    }

    getCableAttachPosition(plug) {
        return plug.position.clone().add(this.CABLE_OFFSET.clone().applyQuaternion(plug.quaternion));
    }
}