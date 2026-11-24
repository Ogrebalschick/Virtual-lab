import * as THREE from 'three';
import { createCable } from './CablePhysics.js';
import { TerminalSnapper } from './TerminalSnapper.js';
import { PlugDragController } from './PlugDragController.js';

export class CableSystem {
    constructor({ scene, camera, controls, registry }) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.registry = registry;

        this.snapper = new TerminalSnapper();
        this.dragController = new PlugDragController(camera, controls, this.snapper);

        this.cableSystem = null;
    }

    load() {
        this.cableSystem = createCable(this.scene, 'models/Cable.glb');
        if (this.cableSystem && this.cableSystem.cable) {
            this.cableSystem.cable.setStartPosition(new THREE.Vector3(-6.0, 0, 3.0));
        }
    }

    onPointerDown(event, raycaster, mouse) {
        if (!this.cableSystem) return false;
        return this.dragController.onPointerDown(event, raycaster, mouse, this.cableSystem.getPlugs(), this.registry.all());
    }

    onPointerMove(event, raycaster, mouse) {
        if (!this.cableSystem) return false;
        if (this.dragController.draggedPlug) {
            return this.dragController.onPointerMove(event, raycaster, mouse, this.cableSystem.getPlugs(), this.cableSystem.cable, this.registry.all());
        }
        return false;
    }

    onPointerUp() {
        if (!this.cableSystem) return;
        const plugs = this.cableSystem.getPlugs();
        const cablePhysics = this.cableSystem.cable;
        this.dragController.finishDrag(plugs, cablePhysics);
    }

    update() {
        if (!this.cableSystem || !this.cableSystem.cable) return;

        const plugs = this.cableSystem.getPlugs();
        if (plugs.length !== 2 || !plugs[0] || !plugs[1]) return;

        if (plugs[0].userData.snappedTo) {
            this.snapper.applySnapTransform(plugs[0], plugs[0].userData.snappedTo);
            const attachPos = this.snapper.getCableAttachPosition(plugs[0]);
            this.cableSystem.cable.setStartPosition(attachPos);

            const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(plugs[0].quaternion).normalize();
            this.cableSystem.cable.startTargetDir = dir.negate();
        } else {
            if (plugs[0].userData.isManuallyRotated) {
                const d = new THREE.Vector3();
                plugs[0].getWorldDirection(d);
                this.cableSystem.cable.startTargetDir = d.clone().negate();
            } else {
                this.cableSystem.cable.startTargetDir = null;
            }
        }

        if (plugs[1].userData.snappedTo) {
            this.snapper.applySnapTransform(plugs[1], plugs[1].userData.snappedTo);
            const attachPos = this.snapper.getCableAttachPosition(plugs[1]);
            this.cableSystem.cable.setEndPosition(attachPos);

            const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(plugs[1].quaternion).normalize();
            this.cableSystem.cable.endTargetDir = dir.negate();
        } else {
            if (plugs[1].userData.isManuallyRotated) {
                const d = new THREE.Vector3();
                plugs[1].getWorldDirection(d);
                this.cableSystem.cable.endTargetDir = d.clone().negate();
            } else {
                this.cableSystem.cable.endTargetDir = null;
            }
        }

        this.cableSystem.cable.update(0.016);

        if (!plugs[0].userData.snappedTo) {
            plugs[0].position.copy(this.cableSystem.cable.points[0]);
            if (this.dragController.draggedPlug !== plugs[0] && !plugs[0].userData.isManuallyRotated) {
                const pStartNext = this.cableSystem.cable.points[1];
                const dirStart = this.cableSystem.cable.points[0].clone().sub(pStartNext).normalize();
                plugs[0].lookAt(this.cableSystem.cable.points[0].clone().add(dirStart));
            }
        }

        if (!plugs[1].userData.snappedTo) {
            const pEnd = this.cableSystem.cable.points[this.cableSystem.cable.points.length - 1];
            plugs[1].position.copy(pEnd);
            if (this.dragController.draggedPlug !== plugs[1] && !plugs[1].userData.isManuallyRotated) {
                const pEndPrev = this.cableSystem.cable.points[this.cableSystem.cable.points.length - 2];
                const dirEnd = pEnd.clone().sub(pEndPrev).normalize();
                plugs[1].lookAt(pEnd.clone().add(dirEnd));
            }
        }
    }
}