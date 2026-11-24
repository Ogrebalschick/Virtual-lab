import * as THREE from 'three';

export class PlugDragController {
    constructor(camera, controls, snapper) {
        this.camera = camera;
        this.controls = controls;
        this.snapper = snapper;

        this.draggedPlug = null;
        this.dragPlane = new THREE.Plane();
        this.dragOffset = new THREE.Vector3();
        this.intersectionPoint = new THREE.Vector3();

        this.isRotatingPlug = false;
        this.plugStartMouseX = 0;
        this.plugStartMouseY = 0;
        this.startQuat = new THREE.Quaternion();
        this.hoveredTerminal = null;
    }

    onPointerDown(event, raycaster, mouse, plugs, terminals) {
        if (!plugs || plugs.length === 0) return false;

        raycaster.setFromCamera(mouse, this.camera);
        const plugIntersects = raycaster.intersectObjects(plugs, true);

        if (plugIntersects.length === 0) return false;

        let clickedObj = plugIntersects[0].object;
        while (clickedObj.parent && !plugs.includes(clickedObj)) {
            clickedObj = clickedObj.parent;
        }

        this.draggedPlug = clickedObj;
        this.controls.enabled = false;

        if (this.draggedPlug.userData.snappedTo) {
            this.draggedPlug.userData.snappedTo = null;
            this.draggedPlug.userData.isManuallyRotated = false;
            if (this.hoveredTerminal) {
                this.snapper.setHighlight(this.hoveredTerminal, false);
                this.hoveredTerminal = null;
            }
        }

        this.isRotatingPlug = event.shiftKey;

        if (this.isRotatingPlug) {
            document.body.style.cursor = 'move';
            this.plugStartMouseX = event.clientX;
            this.plugStartMouseY = event.clientY;
            this.startQuat.copy(this.draggedPlug.quaternion);
            this.draggedPlug.userData.isManuallyRotated = true;
        } else {
            document.body.style.cursor = 'grabbing';
            const cameraDirection = this.camera.getWorldDirection(new THREE.Vector3());
            this.dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, this.draggedPlug.position);
            raycaster.ray.intersectPlane(this.dragPlane, this.intersectionPoint);
            this.dragOffset.copy(this.intersectionPoint).sub(this.draggedPlug.position);
        }
        return true;
    }

    onPointerMove(event, raycaster, mouse, plugs, cablePhysics, terminals) {
        if (!this.draggedPlug) return false;

        raycaster.setFromCamera(mouse, this.camera);

        if (this.isRotatingPlug) {
            const deltaX = event.clientX - this.plugStartMouseX;
            const deltaY = event.clientY - this.plugStartMouseY;

            const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.01);
            const qZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), deltaX * 0.01);
            const q = qX.multiply(qZ);
            this.draggedPlug.quaternion.copy(this.startQuat).premultiply(q);
        } else {
            raycaster.ray.intersectPlane(this.dragPlane, this.intersectionPoint);
            if (this.intersectionPoint) {
                const newPos = this.intersectionPoint.clone().sub(this.dragOffset);

                if (this.draggedPlug === plugs[0]) cablePhysics.setStartPosition(newPos);
                else if (this.draggedPlug === plugs[1]) cablePhysics.setEndPosition(newPos);

                const closestTerm = this.snapper.getClosestTerminal(raycaster, terminals);

                if (this.hoveredTerminal !== closestTerm) {
                    if (this.hoveredTerminal) this.snapper.setHighlight(this.hoveredTerminal, false);
                    this.hoveredTerminal = closestTerm;
                    if (this.hoveredTerminal) this.snapper.setHighlight(this.hoveredTerminal, true);
                }
            }
        }
        return true;
    }

    finishDrag(plugs, cablePhysics) {
        if (this.draggedPlug && this.hoveredTerminal) {
            this.draggedPlug.userData.snappedTo = this.hoveredTerminal;
            this.draggedPlug.userData.isManuallyRotated = true;

            this.snapper.applySnapTransform(this.draggedPlug, this.hoveredTerminal);

            const attachPos = this.snapper.getCableAttachPosition(this.draggedPlug);
            if (this.draggedPlug === plugs[0]) cablePhysics.setStartPosition(attachPos);
            if (this.draggedPlug === plugs[1]) cablePhysics.setEndPosition(attachPos);

            this.snapper.setHighlight(this.hoveredTerminal, false);
            this.hoveredTerminal = null;
        }
        this.draggedPlug = null;
        this.isRotatingPlug = false;
        this.controls.enabled = true;
        document.body.style.cursor = 'default';
    }
}