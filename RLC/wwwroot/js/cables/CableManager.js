import * as THREE from 'three';
import { createCable, CABLE_SETTINGS } from './CablePhysics.js';
import { CircuitValidator } from './CircuitValidator.js';

export class CableManager {
    constructor({ scene, camera, controls, registry, collisionWorld = null }) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.registry = registry;
        this.collisionWorld = collisionWorld;
        this.cables = [];
        this.validator = new CircuitValidator();
        this._id = 0;
        this._list = [];
    }

    async createCableBetween(term1, term2, options = {}) {
        if (!term1 || !term2) {
            console.warn('Не удалось создать провод: одна из клемм не найдена в сцене.');
            return null;
        }
        const isTerm1Used = this.cables.some(c => c.term1 === term1 || c.term2 === term1);
        const isTerm2Used = this.cables.some(c => c.term1 === term2 || c.term2 === term2);
        if ((isTerm1Used && !options.allow1) || (isTerm2Used && !options.allow2)) {
            console.warn(`ОШИБКА: Клемма ${isTerm1Used && !options.allow1 ? term1.name : term2.name} уже занята!`);
            return null;
        }

        const snap1 = this.getSnapData(term1);
        const snap2 = this.getSnapData(term2);
        if (options.offset2) snap2.pos.add(options.offset2);
        const { cable, plug1, plug2 } = await createCable(this.scene, snap1.pos, snap2.pos, snap1, snap2);
        cable.id = ++this._id;
        cable.useWorldCollision = !!this.collisionWorld;
        cable.conformVisual = (c) => this.collisionWorld?.drapeOver(c);
        const entry = { cable, plug1, plug2, term1, term2 };
        this.cables.push(entry);

        if (this.collisionWorld) {
            this.collisionWorld.addObject(plug1, '', cable.id);
            this.collisionWorld.addObject(plug2, '', cable.id);
            this.#settleOne(cable);
        } else {
            cable.syncMesh();
            cable.asleep = true;
        }
        this.validator.updateConnections(this.cables);
        return entry;
    }

    clearAll() {
        while (this.cables.length) this.removeCable(0);
    }

    findTerminal(name) {
        return this.registry.all().find(t => t.name === name) || null;
    }

    async setCH2Probe(targetName) {
        const ch2 = this.findTerminal('CH2_INPUT');
        const target = this.findTerminal(targetName);
        if (!ch2 || !target) {
            return { ok: false, reason: !ch2 ? 'нет CH2_INPUT' : `нет ${targetName}` };
        }
        const idx = this.cables.findIndex(c => c.term1 === ch2 || c.term2 === ch2);
        if (idx !== -1) this.removeCable(idx);
        const occupied = this.cables.some(c => c.term1 === target || c.term2 === target);
        const created = await this.createCableBetween(ch2, target, {
            allow2: occupied,
            offset2: occupied ? new THREE.Vector3(2.2, 3.2, 0) : undefined,
        });
        return { ok: !!created, shared: occupied };
    }

    getSnapData(terminal) {
        const pos = new THREE.Vector3();
        terminal.getWorldPosition(pos);
        const snap = this.registry.snapFor(terminal) || {
            offset: new THREE.Vector3(0, 0.082 * 3, 0),
            rotation: new THREE.Euler(90 * Math.PI / 180, 0, 0),
        };
        return { terminal, pos, offset: snap.offset, rotation: snap.rotation };
    }

    async setupStandardCircuit() {
        const allTerms = this.registry.all();
        const find = (name) => {
            const term = allTerms.find(t => t.name === name);
            if (!term) console.warn(`ВНИМАНИЕ: Клемма "${name}" не найдена в 3D-модели!`);
            return term;
        };
        await this.createCableBetween(find('Red_Left_Clemma'), find('Input_Red_Clemma'));
        await this.createCableBetween(find('Black_Clemma_Right'), find('Input_Black_Clemma'));
        await this.createCableBetween(find('Output_Red_Clemma'), find('Red_Clemma'));
        await this.createCableBetween(find('Output_Black_Clemma'), find('Black_Clemma'));
        await this.createCableBetween(find('Red_Right_Clemma'), find('CH1_INPUT'));
        await this.createCableBetween(find('C_Red_Clemma'), find('CH2_INPUT'));
        this.settleAll();
        console.log('Попытка сборки стандартной схемы завершена.');
    }

    onPointerDown(event, raycaster, mouse) {
        if (event.button !== 2) return false;
        raycaster.setFromCamera(mouse, this.camera);
        const hits = raycaster.intersectObjects(this.cables.map(c => c.cable.mesh), false);
        if (!hits.length) return false;
        const index = this.cables.findIndex(c => c.cable.mesh === hits[0].object);
        if (index === -1) return false;
        this.removeCable(index);
        return true;
    }

    removeCable(index) {
        const c = this.cables[index];
        this.collisionWorld?.removeCable(c.cable.id);
        c.cable.dispose();
        this.scene.remove(c.plug1);
        this.scene.remove(c.plug2);
        this.cables.splice(index, 1);
        this.validator.updateConnections(this.cables);
    }

    update() {
        if (!this.cables.length) return;
        let awake = false;
        for (let i = 0; i < this.cables.length; i++) {
            const c = this.cables[i];
            const moved = c.plug1.position.distanceToSquared(c.cable.pinStart) > 1e-8
                || c.plug2.position.distanceToSquared(c.cable.pinEnd) > 1e-8;
            if (moved) c.cable.wake();
            this.#syncEnds(c);
            if (!c.cable.asleep) awake = true;
        }
        if (!awake) return;

        this.collisionWorld?.refresh();
        const list = this._list;
        list.length = 0;
        for (let i = 0; i < this.cables.length; i++) {
            if (!this.cables[i].cable.asleep) list.push(this.cables[i].cable);
        }
        const all = this.cables.map(c => c.cable);
        for (let k = 0; k < 4; k++) {
            for (let i = 0; i < list.length; i++) list[i].relaxStep();
            this.collisionWorld?.resolve(list, all);
        }
        for (let i = 0; i < list.length; i++) {
            const cable = list[i];
            cable.syncMesh();
            cable.quiet++;
            if (cable.quiet > 6) cable.asleep = true;
        }
    }

    isCircuitValid() {
        return this.validator.isCircuitClosed();
    }

    settleAll() {
        if (!this.cables.length) return;
        const all = this.cables.map(c => c.cable);
        for (let i = 0; i < all.length; i++) {
            this.#syncEnds(this.cables[i]);
            all[i].wake();
        }
        this.collisionWorld?.refresh();
        const steps = CABLE_SETTINGS.settleSteps;
        for (let k = 0; k < steps; k++) {
            for (let i = 0; i < all.length; i++) all[i].relaxStep();
            this.collisionWorld?.resolve(all, all);
        }
        for (let i = 0; i < all.length; i++) {
            all[i].syncMesh();
            all[i].asleep = true;
        }
    }

    #settleOne(cable) {
        const all = this.cables.map(c => c.cable);
        const item = this.cables.find(c => c.cable === cable);
        if (item) this.#syncEnds(item);
        this.collisionWorld.refresh();
        for (let k = 0; k < 16; k++) {
            cable.relaxStep();
            this.collisionWorld.resolve([cable], all);
        }
        cable.syncMesh();
        cable.asleep = true;
    }

    #syncEnds(c) {
        c.cable.setStartPosition(c.plug1.position);
        c.cable.setEndPosition(c.plug2.position);
        c.cable.startTargetDir.set(0, 0, 1).applyQuaternion(c.plug1.quaternion).negate();
        c.cable.endTargetDir.set(0, 0, 1).applyQuaternion(c.plug2.quaternion).negate();
    }
}