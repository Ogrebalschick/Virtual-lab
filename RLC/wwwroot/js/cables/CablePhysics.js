import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const CABLE_SETTINGS = {
    radius: 0.2,
    radialSegments: 8,
    visualPoints: 15,
    // Насколько длинный провод может быть относительно прямого. Это потолок, не пружина.
    slackShort: 1.045,
    slackLong: 1.1,
    gravity: 0.14,
    smooth: 0.34,
    planePull: 0.14,
    stub: 0.45,
    lead: 1.15,
    endInset: 0.5,
    settleSteps: 28,
    collisionRadiusScale: 1.4,
};

const _t = new THREE.Vector3();
const _n = new THREE.Vector3();
const _b = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();

let sharedMaterial = null;
function getCableMaterial() {
    if (sharedMaterial) return sharedMaterial;
    const loader = new THREE.TextureLoader();
    const path = 'models/textures/';
    const colorMap = loader.load(path + 'metal_0040_color_1k.jpg');
    const normalMap = loader.load(path + 'metal_0040_normal_opengl_1k.jpg');
    const roughnessMap = loader.load(path + 'metal_0040_roughness_1k.jpg');
    const metalnessMap = loader.load(path + 'metal_0040_metallic_1k.jpg');
    for (const tex of [colorMap, normalMap, roughnessMap, metalnessMap]) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(0.3, 14);
        tex.rotation = 85 * Math.PI / 180;
        tex.anisotropy = 8;
    }
    colorMap.colorSpace = THREE.SRGBColorSpace;
    sharedMaterial = new THREE.MeshStandardMaterial({
        map: colorMap,
        normalMap,
        roughnessMap,
        metalnessMap,
        color: 0xffffff,
        roughness: 1.0,
        metalness: 1.0,
        side: THREE.DoubleSide,
    });
    return sharedMaterial;
}

let plugTemplatePromise = null;
function getPlugTemplate() {
    if (!plugTemplatePromise) {
        plugTemplatePromise = new GLTFLoader().loadAsync('models/Cable.glb').then((gltf) => {
            const raw = gltf.scene;
            raw.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            const box = new THREE.Box3().setFromObject(raw);
            raw.position.sub(box.getCenter(new THREE.Vector3()));
            raw.rotation.z = -Math.PI / 2;
            raw.rotateY(Math.PI);
            raw.updateMatrix();
            return raw;
        });
    }
    return plugTemplatePromise;
}

function buildTubeGeometry(tubularSegments, radialSegments) {
    const rings = tubularSegments + 1;
    const stride = radialSegments + 1;
    const bodyVerts = rings * stride;
    const positions = new Float32Array((bodyVerts + 2) * 3);
    const normals = new Float32Array((bodyVerts + 2) * 3);
    const uvs = new Float32Array((bodyVerts + 2) * 2);
    const indices = new Uint32Array(tubularSegments * radialSegments * 6 + radialSegments * 6);

    let k = 0;
    for (let i = 0; i < tubularSegments; i++) {
        for (let j = 0; j < radialSegments; j++) {
            const a = i * stride + j;
            const b = (i + 1) * stride + j;
            indices[k++] = a; indices[k++] = b; indices[k++] = a + 1;
            indices[k++] = b; indices[k++] = b + 1; indices[k++] = a + 1;
        }
    }
    const c0 = bodyVerts;
    const c1 = bodyVerts + 1;
    for (let j = 0; j < radialSegments; j++) {
        indices[k++] = c0; indices[k++] = j + 1; indices[k++] = j;
        const ring = tubularSegments * stride;
        indices[k++] = c1; indices[k++] = ring + j; indices[k++] = ring + j + 1;
    }

    let u = 0;
    for (let i = 0; i < rings; i++) {
        for (let j = 0; j < stride; j++) {
            uvs[u++] = i / tubularSegments;
            uvs[u++] = j / radialSegments;
        }
    }
    uvs[u++] = 0.5; uvs[u++] = 0.5;
    uvs[u++] = 0.5; uvs[u++] = 0.5;

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    const norAttr = new THREE.BufferAttribute(normals, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    norAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('normal', norAttr);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    return geometry;
}

function updateTube(geometry, points, radius, radialSegments) {
    const n = points.length;
    const stride = radialSegments + 1;
    const pos = geometry.attributes.position.array;
    const nrm = geometry.attributes.normal.array;

    _t.subVectors(points[1], points[0]);
    if (_t.lengthSq() < 1e-10) _t.set(0, 1, 0);
    else _t.normalize();
    _n.crossVectors(_t, _axis.set(0, 1, 0));
    if (_n.lengthSq() < 1e-6) _n.crossVectors(_t, _axis.set(1, 0, 0));
    _n.normalize();

    let ptr = 0;
    let nptr = 0;
    const writeRing = (p, tangent, normal) => {
        _b.crossVectors(tangent, normal).normalize();
        normal.crossVectors(_b, tangent).normalize();
        for (let j = 0; j <= radialSegments; j++) {
            const v = (j / radialSegments) * Math.PI * 2;
            const cx = Math.cos(v);
            const sy = Math.sin(v);
            const nx = cx * normal.x + sy * _b.x;
            const ny = cx * normal.y + sy * _b.y;
            const nz = cx * normal.z + sy * _b.z;
            pos[ptr++] = p.x + nx * radius;
            pos[ptr++] = p.y + ny * radius;
            pos[ptr++] = p.z + nz * radius;
            nrm[nptr++] = nx;
            nrm[nptr++] = ny;
            nrm[nptr++] = nz;
        }
    };

    let prevT = _t.clone();
    writeRing(points[0], prevT, _n);
    for (let i = 1; i < n; i++) {
        if (i === n - 1) _t.subVectors(points[n - 1], points[n - 2]);
        else _t.subVectors(points[i + 1], points[i - 1]);
        if (_t.lengthSq() < 1e-10) _t.copy(prevT);
        else _t.normalize();

        _axis.crossVectors(prevT, _t);
        const s = _axis.length();
        if (s > 1e-6) {
            _axis.multiplyScalar(1 / s);
            _q.setFromAxisAngle(_axis, Math.atan2(s, prevT.dot(_t)));
            _n.applyQuaternion(_q);
        }
        _n.addScaledVector(_t, -_n.dot(_t));
        if (_n.lengthSq() < 1e-8) {
            _n.crossVectors(_t, _axis.set(0, 1, 0));
            if (_n.lengthSq() < 1e-8) _n.crossVectors(_t, _axis.set(1, 0, 0));
        }
        _n.normalize();
        writeRing(points[i], _t, _n);
        prevT.copy(_t);
    }

    const c0 = n * stride * 3;
    const a = points[0];
    const e = points[n - 1];
    _t.subVectors(points[0], points[1]);
    if (_t.lengthSq() < 1e-10) _t.set(0, -1, 0);
    else _t.normalize();
    pos[c0] = a.x; pos[c0 + 1] = a.y; pos[c0 + 2] = a.z;
    nrm[c0] = _t.x; nrm[c0 + 1] = _t.y; nrm[c0 + 2] = _t.z;
    _t.subVectors(points[n - 1], points[n - 2]);
    if (_t.lengthSq() < 1e-10) _t.set(0, 1, 0);
    else _t.normalize();
    pos[c0 + 3] = e.x; pos[c0 + 4] = e.y; pos[c0 + 5] = e.z;
    nrm[c0 + 3] = _t.x; nrm[c0 + 4] = _t.y; nrm[c0 + 5] = _t.z;

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
}

function removeFolds(points) {
    if (points.length < 3) return points;
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const prev = out[out.length - 1];
        const p = points[i];
        const next = points[i + 1];
        const ax = p.x - prev.x, ay = p.y - prev.y, az = p.z - prev.z;
        const bx = next.x - p.x, by = next.y - p.y, bz = next.z - p.z;
        if (ax * bx + ay * by + az * bz < 0) continue;
        out.push(p);
    }
    out.push(points[points.length - 1]);
    return out;
}

export class CablePhysics {
    constructor(scene, startPos, endPos) {
        this.scene = scene;
        this.radius = CABLE_SETTINGS.radius;
        this.collisionRadius = this.radius * CABLE_SETTINGS.collisionRadiusScale;
        this.radialSegments = CABLE_SETTINGS.radialSegments;
        this.floorY = -1.5;
        this.useWorldCollision = false;
        this.id = 0;
        this.asleep = false;
        this.quiet = 0;
        this._syncFrame = 0;
        this.endInset = CABLE_SETTINGS.endInset;

        const straight = Math.max(startPos.distanceTo(endPos), 0.5);
        this.segments = Math.max(4, Math.min(12, Math.round(straight / 2.8)));
        this.restLength = straight * this.#slack(straight) / this.segments;
        this.maxSegment = this.restLength;

        this.points = [];
        for (let i = 0; i <= this.segments; i++) {
            const t = i / this.segments;
            const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
            pos.y -= Math.sin(t * Math.PI) * Math.min(straight * 0.035, 1.2);
            this.points.push(pos);
        }
        this.pinStart = startPos.clone();
        this.pinEnd = endPos.clone();
        this.startTargetDir = new THREE.Vector3();
        this.endTargetDir = new THREE.Vector3();
        this._dir = new THREE.Vector3();
        this._target = new THREE.Vector3();
        this._controls = [];

        this.visualPoints = Array.from({ length: CABLE_SETTINGS.visualPoints }, () => new THREE.Vector3());
        this.geometry = buildTubeGeometry(this.visualPoints.length - 1, this.radialSegments);
        this.mesh = new THREE.Mesh(this.geometry, getCableMaterial());
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData.isCable = true;
        this.scene.add(this.mesh);
        this.syncMesh();
    }

    #slack(straight) {
        if (straight < 8) return CABLE_SETTINGS.slackShort;
        if (straight < 18) return (CABLE_SETTINGS.slackShort + CABLE_SETTINGS.slackLong) * 0.5;
        return CABLE_SETTINGS.slackLong;
    }

    setStartPosition(v) {
        this.pinStart.copy(v);
        this.points[0].copy(v);
    }

    setEndPosition(v) {
        this.pinEnd.copy(v);
        this.points[this.points.length - 1].copy(v);
    }

    wake() {
        this.asleep = false;
        this.quiet = 0;
    }

    relaxStep() {
        this.pinEnds();
        this.#pullToSpan();
        this.#gravity();
        this.#limitStretch();
        this.applyStub();
        this.smooth(CABLE_SETTINGS.smooth);
        this.#killSpikes();
        this.pinEnds();
        this.applyStub();
    }

    pinEnds() {
        this.points[0].copy(this.pinStart);
        this.points[this.points.length - 1].copy(this.pinEnd);
    }

    applyStub() {
        const len = Math.min(Math.max(this.restLength * 0.85, 0.45), 1.25);
        const s = CABLE_SETTINGS.stub;
        if (this.startTargetDir.lengthSq() > 1e-8) {
            this._dir.copy(this.startTargetDir).normalize();
            this._target.copy(this.points[0]).addScaledVector(this._dir, len);
            this.points[1].lerp(this._target, s);
        }
        if (this.endTargetDir.lengthSq() > 1e-8) {
            const last = this.points.length - 1;
            this._dir.copy(this.endTargetDir).normalize();
            this._target.copy(this.points[last]).addScaledVector(this._dir, len);
            this.points[last - 1].lerp(this._target, s);
        }
    }

    smooth(amount) {
        const pts = this.points;
        const n = pts.length;
        if (n < 5 || amount <= 0) return;
        const copy = this._controls;
        while (copy.length < n) copy.push(new THREE.Vector3());
        for (let i = 0; i < n; i++) copy[i].copy(pts[i]);
        for (let i = 2; i < n - 2; i++) {
            const p = pts[i];
            const m = copy[i];
            const a = copy[i - 1];
            const b = copy[i + 1];
            p.x = m.x + ((a.x + b.x) * 0.5 - m.x) * amount;
            p.y = m.y + ((a.y + b.y) * 0.5 - m.y) * amount;
            p.z = m.z + ((a.z + b.z) * 0.5 - m.z) * amount;
        }
    }

    syncMesh() {
        this._syncFrame = (this._syncFrame + 1) % 2;
        if (this._syncFrame !== 0) return;
        this.#buildVisual();
        this.conformVisual?.(this);
        updateTube(this.geometry, this.visualPoints, this.radius, this.radialSegments);
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.geometry.dispose();
    }

    #pullToSpan() {
        const ax = this.pinEnd.x - this.pinStart.x;
        const az = this.pinEnd.z - this.pinStart.z;
        const len2 = ax * ax + az * az;
        if (len2 < 0.25) return;
        const k = CABLE_SETTINGS.planePull;
        const pts = this.points;
        for (let i = 2; i < pts.length - 2; i++) {
            const p = pts[i];
            const t = Math.min(1, Math.max(0, ((p.x - this.pinStart.x) * ax + (p.z - this.pinStart.z) * az) / len2));
            p.x += (this.pinStart.x + ax * t - p.x) * k;
            p.z += (this.pinStart.z + az * t - p.z) * k;
        }
    }

    #gravity() {
        const floor = this.floorY + this.radius;
        const g = CABLE_SETTINGS.gravity;
        const pts = this.points;
        for (let i = 1; i < pts.length - 1; i++) {
            const p = pts[i];
            if (p.y > floor) p.y = Math.max(floor, p.y - g);
        }
    }

    // Только не даём сегменту растянуться. Короче — можно: лишнюю длину нечем распирать в змею.
    #limitStretch() {
        const pts = this.points;
        const maxLen = this.maxSegment * 1.08;
        for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dz = p2.z - p1.z;
                const dist = Math.hypot(dx, dy, dz);
                if (dist <= maxLen || dist < 1e-6) continue;
                const diff = (dist - maxLen) / dist;
                let w1 = i === 0 ? 0 : 0.5;
                let w2 = i + 1 === pts.length - 1 ? 0 : 0.5;
                const sum = w1 + w2;
                if (!sum) continue;
                w1 /= sum; w2 /= sum;
                if (w1) { p1.x += dx * diff * w1; p1.y += dy * diff * w1; p1.z += dz * diff * w1; }
                if (w2) { p2.x -= dx * diff * w2; p2.y -= dy * diff * w2; p2.z -= dz * diff * w2; }
            }
        }
    }

    #killSpikes() {
        const pts = this.points;
        const minDot = Math.cos(42 * Math.PI / 180);
        for (let i = 1; i < pts.length - 1; i++) {
            const a = pts[i - 1];
            const p = pts[i];
            const b = pts[i + 1];
            const v1x = p.x - a.x, v1y = p.y - a.y, v1z = p.z - a.z;
            const v2x = b.x - p.x, v2y = b.y - p.y, v2z = b.z - p.z;
            const l1 = Math.hypot(v1x, v1y, v1z);
            const l2 = Math.hypot(v2x, v2y, v2z);
            if (l1 < 1e-5 || l2 < 1e-5) continue;
            if ((v1x * v2x + v1y * v2y + v1z * v2z) / (l1 * l2) >= minDot) continue;
            p.x += ((a.x + b.x) * 0.5 - p.x) * 0.7;
            p.y += ((a.y + b.y) * 0.5 - p.y) * 0.7;
            p.z += ((a.z + b.z) * 0.5 - p.z) * 0.7;
        }
    }

    #buildVisual() {
        const span = Math.max(this.pinStart.distanceTo(this.pinEnd), 0.5);
        const lead = Math.min(CABLE_SETTINGS.lead, span * 0.2);
        const inset = Math.min(this.endInset, Math.max(0.2, lead * 0.4));
        const controls = [];

        if (this.startTargetDir.lengthSq() > 1e-8) {
            this._dir.copy(this.startTargetDir).normalize();
            controls.push(this.pinStart.clone().addScaledVector(this._dir, -inset));
            controls.push(this.pinStart.clone().addScaledVector(this._dir, lead * 0.45));
            controls.push(this.pinStart.clone().addScaledVector(this._dir, lead));
        } else {
            controls.push(this.pinStart.clone());
        }

        for (let i = 1; i < this.points.length - 1; i++) {
            const p = this.points[i];
            if (p.distanceTo(this.pinStart) < lead * 0.9) continue;
            if (p.distanceTo(this.pinEnd) < lead * 0.9) continue;
            controls.push(p.clone());
        }

        if (this.endTargetDir.lengthSq() > 1e-8) {
            this._dir.copy(this.endTargetDir).normalize();
            controls.push(this.pinEnd.clone().addScaledVector(this._dir, lead));
            controls.push(this.pinEnd.clone().addScaledVector(this._dir, lead * 0.45));
            controls.push(this.pinEnd.clone().addScaledVector(this._dir, -inset));
        } else {
            controls.push(this.pinEnd.clone());
        }

        this.#resample(this.#chaikin(removeFolds(controls)), this.visualPoints);
    }

    #chaikin(points) {
        if (points.length < 3) return points;
        const out = [points[0]];
        for (let i = 0; i < points.length - 1; i++) {
            out.push(points[i].clone().lerp(points[i + 1], 0.25));
            out.push(points[i].clone().lerp(points[i + 1], 0.75));
        }
        out.push(points[points.length - 1]);
        return out;
    }

    #resample(controls, out) {
        const n = out.length;
        if (controls.length < 2) {
            for (let i = 0; i < n; i++) out[i].copy(controls[0] || this.pinStart);
            return;
        }
        const lens = [0];
        let total = 0;
        for (let i = 1; i < controls.length; i++) {
            total += controls[i].distanceTo(controls[i - 1]);
            lens.push(total);
        }
        if (total < 1e-6) {
            for (let i = 0; i < n; i++) out[i].copy(controls[0]);
            return;
        }
        let seg = 0;
        for (let i = 0; i < n; i++) {
            const d = (i / (n - 1)) * total;
            while (seg < lens.length - 2 && lens[seg + 1] < d) seg++;
            const span = lens[seg + 1] - lens[seg];
            const t = span < 1e-8 ? 0 : (d - lens[seg]) / span;
            out[i].lerpVectors(controls[seg], controls[seg + 1], t);
        }
    }
}

export async function createCable(scene, startPos, endPos, snapDataStart, snapDataEnd) {
    const template = await getPlugTemplate();
    const plug1 = new THREE.Group();
    plug1.add(template.clone(true));
    plug1.position.copy(startPos);
    plug1.scale.set(18, 18, 18);
    scene.add(plug1);

    const plug2 = new THREE.Group();
    plug2.add(template.clone(true));
    plug2.position.copy(endPos);
    plug2.scale.set(18, 18, 18);
    scene.add(plug2);

    if (snapDataStart) applySnap(plug1, snapDataStart);
    if (snapDataEnd) applySnap(plug2, snapDataEnd);

    const cable = new CablePhysics(scene, plug1.position, plug2.position);
    return { cable, plug1, plug2 };
}

function applySnap(plug, snapData) {
    const termPos = new THREE.Vector3();
    const termQuat = new THREE.Quaternion();
    snapData.terminal.getWorldPosition(termPos);
    snapData.terminal.getWorldQuaternion(termQuat);
    const offset = snapData.offset.clone().multiplyScalar(6);
    plug.position.copy(termPos).add(offset.applyQuaternion(termQuat));
    const fixRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        snapData.rotation.x, snapData.rotation.y, snapData.rotation.z, 'XYZ'
    ));
    plug.quaternion.copy(termQuat).multiply(fixRotation);
}