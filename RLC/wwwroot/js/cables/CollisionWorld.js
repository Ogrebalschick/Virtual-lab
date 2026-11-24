import * as THREE from 'three';

export class CollisionWorld {
    constructor({ floorY = -1.5 } = {}) {
        this.floorY = floorY;
        this.colliders = [];
        this.debugOn = false;
        this.drapeMaxSize = 16;
        this.drapeMaxHeight = 8;
        this._a = new THREE.Vector3();
        this._b = new THREE.Vector3();
        this._push = new THREE.Vector3();
        this._local = new THREE.Vector3();
        this._pos = new THREE.Vector3();
        this._q = new THREE.Quaternion();
    }

    addObject(root, label = '', cableId = null) {
        if (!root) return;
        root.updateMatrixWorld(true);
        const quiet = cableId != null;
        const rootBox = new THREE.Box3().setFromObject(root);
        const rootSize = rootBox.getSize(new THREE.Vector3());
        const rootMax = Math.max(rootSize.x, rootSize.y, rootSize.z, 1e-6);
        const big = [];
        let added = 0;

        root.traverse((obj) => {
            if (!obj.isMesh || !obj.geometry) return;
            if (obj.userData.noCableCollide || obj.userData.isCable) return;
            obj.geometry.computeBoundingBox();
            const local = obj.geometry.boundingBox;
            if (!local || local.isEmpty()) return;
            const size = local.getSize(this._pos);
            if (size.x + size.y + size.z < 1e-6) return;
            this.colliders.push({
                mesh: obj,
                localBox: local.clone(),
                cableId,
                disabled: false,
                matrixWorld: new THREE.Matrix4(),
                invWorld: new THREE.Matrix4(),
                worldQuat: new THREE.Quaternion(),
                worldScale: new THREE.Vector3(1, 1, 1),
                absScale: new THREE.Vector3(1, 1, 1),
                worldBox: new THREE.Box3(),
                debugHelper: null,
            });
            added++;
            if (!quiet) {
                const world = new THREE.Box3().copy(local).applyMatrix4(obj.matrixWorld);
                const ws = world.getSize(new THREE.Vector3());
                if (Math.max(ws.x, ws.y, ws.z) > rootMax * 0.88) big.push(obj.name || 'mesh');
            }
        });

        if (quiet) return;
        console.log(`[collision] ${label || root.name || 'model'}: ${added} боксов`);
        if (added <= 1) console.warn(`[collision] ${label}: модель почти из одного меша.`);
        else if (big.length) console.warn(`[collision] ${label}: слишком крупный бокс у: ${big.join(', ')}`);
    }

    removeCable(cableId) {
        this.colliders = this.colliders.filter((col) => {
            if (col.cableId !== cableId) return true;
            col.debugHelper?.parent?.remove(col.debugHelper);
            return false;
        });
    }

    refresh() {
        for (let i = 0; i < this.colliders.length; i++) {
            const col = this.colliders[i];
            col.mesh.updateWorldMatrix(true, false);
            col.matrixWorld.copy(col.mesh.matrixWorld);
            if (Math.abs(col.matrixWorld.determinant()) < 1e-10) {
                col.disabled = true;
                continue;
            }
            col.invWorld.copy(col.matrixWorld).invert();
            col.matrixWorld.decompose(this._pos, col.worldQuat, col.worldScale);
            col.absScale.set(Math.abs(col.worldScale.x), Math.abs(col.worldScale.y), Math.abs(col.worldScale.z));
            col.disabled = col.absScale.x < 1e-8 || col.absScale.y < 1e-8 || col.absScale.z < 1e-8;
            if (!col.disabled) col.worldBox.copy(col.localBox).applyMatrix4(col.matrixWorld);
        }
    }

    resolve(moving, all = moving) {
        for (let i = 0; i < all.length; i++) all[i]._moves = false;
        for (let i = 0; i < moving.length; i++) moving[i]._moves = true;
        for (let i = 0; i < moving.length; i++) this.#solve(moving[i]);
        this.#separate(all);
        for (let i = 0; i < moving.length; i++) this.#solve(moving[i]);
    }

    toggleDebug() {
        if (this.debugOn) this.hideDebug();
        else this.showDebug();
    }

    showDebug() {
        this.hideDebug();
        this.debugOn = true;
        for (const col of this.colliders) {
            const helper = new THREE.Box3Helper(col.localBox, col.cableId ? 0x33aaff : 0xff2bd6);
            helper.raycast = () => { };
            helper.frustumCulled = false;
            col.mesh.add(helper);
            col.debugHelper = helper;
        }
    }

    hideDebug() {
        for (const col of this.colliders) {
            col.debugHelper?.parent?.remove(col.debugHelper);
            col.debugHelper = null;
        }
        this.debugOn = false;
    }

    #solve(cable) {
        const pts = cable.points;
        const n = pts.length;
        const limit = this.floorY + cable.radius;
        for (let i = 1; i < n - 1; i++) {
            if (pts[i].y < limit) pts[i].y = limit;
        }
        this.#support(cable);
        for (let i = 1; i < n - 1; i++) this.#pushPoint(cable, i);
        for (let i = 0; i < n - 1; i++) this.#pushSegment(cable, i);
    }

    // Обе клеммы выше детали — провод лежит на ней. Так плата держит перемычку, а генератор нет.
    #support(cable) {
        const pts = cable.points;
        const n = pts.length;
        const y0 = pts[0].y;
        const y1 = pts[n - 1].y;
        for (let i = 1; i < n - 1; i++) {
            const p = pts[i];
            let top = -Infinity;
            for (let c = 0; c < this.colliders.length; c++) {
                const col = this.colliders[c];
                if (col.disabled || col.cableId === cable.id) continue;
                const b = col.worldBox;
                if (y0 < b.max.y - 0.55 || y1 < b.max.y - 0.55) continue;
                if (p.x < b.min.x - 0.05 || p.x > b.max.x + 0.05) continue;
                if (p.z < b.min.z - 0.05 || p.z > b.max.z + 0.05) continue;
                const face = b.max.y + cable.radius + 0.02;
                if (face > top) top = face;
            }
            if (top > -Infinity && p.y < top) p.y += Math.min(top - p.y, 1.4);
        }
    }

    #pushPoint(cable, index) {
        const p = cable.points[index];
        for (let c = 0; c < this.colliders.length; c++) {
            const col = this.colliders[c];
            if (col.disabled || col.cableId === cable.id) continue;
            if (p.x < col.worldBox.min.x - cable.collisionRadius || p.x > col.worldBox.max.x + cable.collisionRadius) continue;
            if (p.y < col.worldBox.min.y - cable.collisionRadius || p.y > col.worldBox.max.y + cable.collisionRadius) continue;
            if (p.z < col.worldBox.min.z - cable.collisionRadius || p.z > col.worldBox.max.z + cable.collisionRadius) continue;
            if (!this.#inside(p, col, cable.collisionRadius)) continue;
            if (this.#ownsPin(col, cable, index <= 2 ? 0 : index >= cable.points.length - 3 ? 1 : -1)) {
                if (this.#extrude(cable, index, col)) continue;
            }
            this.#exitSide(cable, index, col);
        }
    }

    #pushSegment(cable, index) {
        const p1 = cable.points[index];
        const p2 = cable.points[index + 1];
        this._b.copy(p1).lerp(p2, 0.5);
        const mid = this._b;
        for (let c = 0; c < this.colliders.length; c++) {
            const col = this.colliders[c];
            if (col.disabled || col.cableId === cable.id) continue;
            if (!this.#aabbHit(p1, p2, col.worldBox, cable.collisionRadius)) continue;
            if (!this.#inside(mid, col, cable.collisionRadius)) continue;
            const i0 = index === 0 ? index + 1 : index;
            const i1 = index + 1 === cable.points.length - 1 ? index : index + 1;
            this.#exitSide(cable, i0, col);
            if (i1 !== i0) this.#exitSide(cable, i1, col);
        }
    }

    #exitSide(cable, index, col) {
        const p = cable.points[index];
        const local = this._a.copy(p).applyMatrix4(col.invWorld);
        const r = cable.collisionRadius;
        const minX = col.localBox.min.x - r / col.absScale.x;
        const maxX = col.localBox.max.x + r / col.absScale.x;
        const minY = col.localBox.min.y - r / col.absScale.y;
        const maxY = col.localBox.max.y + r / col.absScale.y;
        const minZ = col.localBox.min.z - r / col.absScale.z;
        const maxZ = col.localBox.max.z + r / col.absScale.z;
        const gaps = [
            local.x - minX, maxX - local.x,
            local.y - minY, maxY - local.y,
            local.z - minZ, maxZ - local.z,
        ];
        let best = -1;
        let bestScore = Infinity;
        for (let f = 0; f < 6; f++) {
            if (gaps[f] < -1e-4) continue;
            const lx = f === 0 ? -1 : f === 1 ? 1 : 0;
            const ly = f === 2 ? -1 : f === 3 ? 1 : 0;
            const lz = f === 4 ? -1 : f === 5 ? 1 : 0;
            this._local.set(lx, ly, lz);
            this._push.copy(this._local).multiply(col.worldScale).applyQuaternion(col.worldQuat);
            const worldGap = Math.hypot(
                (f < 2 ? gaps[f] : 0) * col.absScale.x,
                (f >= 2 && f < 4 ? gaps[f] : 0) * col.absScale.y,
                (f >= 4 ? gaps[f] : 0) * col.absScale.z
            );
            const ny = this._push.y / (this._push.length() || 1);
            // Сбоку, не на крышу и не под днище. Крыша только у опоры в #support.
            let score = worldGap;
            if (ny > 0.55) score *= 5;
            if (ny < -0.55) score *= 6;
            if (score < bestScore) {
                bestScore = score;
                best = f;
            }
        }
        if (best < 0) return;
        const lx = best === 0 ? -gaps[0] : best === 1 ? gaps[1] : 0;
        const ly = best === 2 ? -gaps[2] : best === 3 ? gaps[3] : 0;
        const lz = best === 4 ? -gaps[4] : best === 5 ? gaps[5] : 0;
        this._local.set(lx, ly, lz);
        this._push.copy(this._local).multiply(col.worldScale).applyQuaternion(col.worldQuat);
        this.#nudge(cable, index, this._push.x, this._push.y, this._push.z, 0.03);
    }

    #extrude(cable, index, col) {
        const fromStart = index < cable.points.length / 2;
        const dir = fromStart ? cable.startTargetDir : cable.endTargetDir;
        if (dir.lengthSq() < 1e-8) return false;
        this._dirPick(col, cable.points[fromStart ? 0 : cable.points.length - 1], dir);
        const p = cable.points[index];
        for (let s = 1; s <= 14; s++) {
            const d = s * 0.18;
            this._b.set(p.x + this._push.x * d, p.y + this._push.y * d, p.z + this._push.z * d);
            if (!this.#inside(this._b, col, cable.collisionRadius)) {
                this.#nudge(cable, index, this._push.x * (d + 0.04), this._push.y * (d + 0.04), this._push.z * (d + 0.04), 0);
                return true;
            }
        }
        return false;
    }

    _dirPick(col, pin, dir) {
        this._push.copy(dir).normalize();
        const forward = this._a.copy(pin).addScaledVector(this._push, 0.8);
        const back = this._b.copy(pin).addScaledVector(this._push, -0.8);
        const fIn = this.#inside(forward, col, 0);
        const bIn = this.#inside(back, col, 0);
        if (fIn && !bIn) this._push.multiplyScalar(-1);
    }

    #ownsPin(col, cable, which) {
        if (which < 0) return false;
        const pin = which === 0 ? cable.points[0] : cable.points[cable.points.length - 1];
        const b = col.worldBox;
        const m = 0.45;
        return pin.x > b.min.x - m && pin.x < b.max.x + m
            && pin.y > b.min.y - m && pin.y < b.max.y + m
            && pin.z > b.min.z - m && pin.z < b.max.z + m;
    }

    #nudge(cable, index, x, y, z, slop) {
        const n = cable.points.length;
        if (index <= 0 || index >= n - 1) return;
        const len = Math.hypot(x, y, z);
        if (len < 1e-6) return;
        const extra = slop / len;
        let sx = x * (1 + extra);
        let sy = y * (1 + extra);
        let sz = z * (1 + extra);
        const cap = 1.6;
        const mag = Math.hypot(sx, sy, sz);
        if (mag > cap) {
            const k = cap / mag;
            sx *= k; sy *= k; sz *= k;
        }
        const p = cable.points[index];
        p.x += sx; p.y += sy; p.z += sz;
    }

    #inside(point, col, radius) {
        const local = point === this._a ? this._local.copy(point).applyMatrix4(col.invWorld) : this._a.copy(point).applyMatrix4(col.invWorld);
        const box = col.localBox;
        return local.x >= box.min.x - radius / col.absScale.x
            && local.x <= box.max.x + radius / col.absScale.x
            && local.y >= box.min.y - radius / col.absScale.y
            && local.y <= box.max.y + radius / col.absScale.y
            && local.z >= box.min.z - radius / col.absScale.z
            && local.z <= box.max.z + radius / col.absScale.z;
    }

    #aabbHit(p1, p2, box, pad) {
        if (Math.max(p1.x, p2.x) < box.min.x - pad || Math.min(p1.x, p2.x) > box.max.x + pad) return false;
        if (Math.max(p1.y, p2.y) < box.min.y - pad || Math.min(p1.y, p2.y) > box.max.y + pad) return false;
        if (Math.max(p1.z, p2.z) < box.min.z - pad || Math.min(p1.z, p2.z) > box.max.z + pad) return false;
        return true;
    }

    #separate(cables) {
        for (let ai = 0; ai < cables.length; ai++) {
            for (let bi = ai; bi < cables.length; bi++) {
                const ca = cables[ai];
                const cb = cables[bi];
                if (!ca._moves && !cb._moves) continue;
                const same = ca === cb;
                const minDist = ca.radius + cb.radius + 0.05;
                const minDist2 = minDist * minDist;
                for (let i = 1; i < ca.points.length - 1; i++) {
                    const j0 = same ? i + 2 : 1;
                    const p = ca.points[i];
                    for (let j = j0; j < cb.points.length - 1; j++) {
                        const q = cb.points[j];
                        let dx = p.x - q.x;
                        let dy = p.y - q.y;
                        let dz = p.z - q.z;
                        const d2 = dx * dx + dy * dy + dz * dz;
                        if (d2 >= minDist2 || d2 < 1e-8) continue;
                        const dist = Math.sqrt(d2);
                        const pen = (minDist - dist) * 0.55;
                        const inv = pen / dist;
                        dx *= inv; dy *= inv * 0.2; dz *= inv;
                        if (ca._moves) { p.x += dx; p.y += dy; p.z += dz; }
                        if (cb._moves && !same) { q.x -= dx; q.y -= dy; q.z -= dz; }
                    }
                }
            }
        }
    }

    drapeOver(cable) {
        const pts = cable.visualPoints;
        const n = pts?.length ?? 0;
        if (n < 6) return;

        const ox = new Float32Array(n);
        const oy = new Float32Array(n);
        const oz = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            ox[i] = pts[i].x;
            oy[i] = pts[i].y;
            oz[i] = pts[i].z;
        }

        const locked = new Uint8Array(n);
        const protect2 = 1.7 * 1.7;
        for (let i = 0; i < n; i++) {
            if (i < 3 || i > n - 4) locked[i] = 1;
            else if (this.#nearPoint(pts[i], cable.pinStart, protect2)) locked[i] = 1;
            else if (this.#nearPoint(pts[i], cable.pinEnd, protect2)) locked[i] = 1;
        }

        const boxes = [];
        for (let i = 0; i < this.colliders.length; i++) {
            const col = this.colliders[i];
            if (col.disabled || col.cableId != null) continue;
            const box = col.worldBox;
            const sx = box.max.x - box.min.x;
            const sy = box.max.y - box.min.y;
            const sz = box.max.z - box.min.z;
            const wide = Math.max(sx, sz);
            if (sy < 0.55 || wide < 0.9) continue;
            if (wide > 10) continue;
            if (sy < 0.9 && wide > 5) continue;
            if (!this.#hitsBox(pts, box, cable.radius)) continue;
            boxes.push(box);
        }
        if (!boxes.length) return;

        const side = this.#cableSide(cable, boxes);
        const moved = new Uint8Array(n);
        for (let b = 0; b < boxes.length; b++) {
            this.#shiftOffBox(pts, locked, moved, boxes[b], cable, side.x, side.z);
        }
        this.#easeMoved(pts, locked, moved);
        for (let b = 0; b < boxes.length; b++) {
            this.#shiftOffBox(pts, locked, moved, boxes[b], cable, side.x, side.z);
        }

        if (this.#curveWorse(pts, ox, oy, oz)) {
            for (let i = 0; i < n; i++) {
                pts[i].x = ox[i];
                pts[i].y = oy[i];
                pts[i].z = oz[i];
            }
        }
    }

    #cableSide(cable, boxes) {
        const dx = cable.pinEnd.x - cable.pinStart.x;
        const dz = cable.pinEnd.z - cable.pinStart.z;
        const len = Math.hypot(dx, dz) || 1;
        let x = -dz / len;
        let z = dx / len;
        let cx = 0;
        let cz = 0;
        for (let i = 0; i < boxes.length; i++) {
            cx += (boxes[i].min.x + boxes[i].max.x) * 0.5;
            cz += (boxes[i].min.z + boxes[i].max.z) * 0.5;
        }
        cx /= boxes.length;
        cz /= boxes.length;
        const mid = ((cable.pinStart.x + cable.pinEnd.x) * 0.5 - cx) * x
            + ((cable.pinStart.z + cable.pinEnd.z) * 0.5 - cz) * z;
        if (mid < -0.05 || (Math.abs(mid) <= 0.05 && cable.id % 2)) {
            x = -x;
            z = -z;
        }
        return { x, z };
    }

    // Сдвиг, не проекция на окружность: все точки одной детали уходят в одну сторону.
    #shiftOffBox(pts, locked, moved, box, cable, sx, sz) {
        const pad = cable.radius + 0.16;
        const minX = box.min.x - pad;
        const maxX = box.max.x + pad;
        const minZ = box.min.z - pad;
        const maxZ = box.max.z + pad;
        const cap = 6;

        for (let i = 0; i < pts.length; i++) {
            if (locked[i]) continue;
            const p = pts[i];
            if (p.y < box.min.y - 0.7 || p.y > box.max.y + pad + 0.4) continue;
            if (p.x <= minX || p.x >= maxX || p.z <= minZ || p.z >= maxZ) continue;

            const exits = [
                { d: p.x - minX, x: -(p.x - minX) - 0.08, z: 0 },
                { d: maxX - p.x, x: (maxX - p.x) + 0.08, z: 0 },
                { d: p.z - minZ, x: 0, z: -(p.z - minZ) - 0.08 },
                { d: maxZ - p.z, x: 0, z: (maxZ - p.z) + 0.08 },
            ];
            let best = null;
            let bestScore = Infinity;
            for (let k = 0; k < 4; k++) {
                const e = exits[k];
                if (e.d > cap) continue;
                const el = Math.hypot(e.x, e.z) || 1;
                const align = (e.x * sx + e.z * sz) / el;
                const score = e.d * (align > 0.25 ? 0.72 : align < -0.25 ? 1.45 : 1);
                if (score < bestScore) {
                    bestScore = score;
                    best = e;
                }
            }
            if (!best) continue;
            p.x += best.x;
            p.z += best.z;
            moved[i] = 1;
        }
    }

    #easeMoved(pts, locked, moved) {
        const n = pts.length;
        const xs = new Float32Array(n);
        const zs = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            xs[i] = pts[i].x;
            zs[i] = pts[i].z;
        }
        for (let i = 1; i < n - 1; i++) {
            if (locked[i] || (!moved[i] && !moved[i - 1] && !moved[i + 1])) continue;
            pts[i].x = xs[i] * 0.5 + (xs[i - 1] + xs[i + 1]) * 0.25;
            pts[i].z = zs[i] * 0.5 + (zs[i - 1] + zs[i + 1]) * 0.25;
        }
    }

    #curveWorse(pts, ox, oy, oz) {
        let oldLen = 0;
        let newLen = 0;
        for (let i = 1; i < pts.length; i++) {
            oldLen += Math.hypot(ox[i] - ox[i - 1], oy[i] - oy[i - 1], oz[i] - oz[i - 1]);
            newLen += pts[i].distanceTo(pts[i - 1]);
            const ax = pts[i].x - pts[i - 1].x;
            const ay = pts[i].y - pts[i - 1].y;
            const az = pts[i].z - pts[i - 1].z;
            const la = Math.hypot(ax, ay, az);
            if (la < 1e-4) return true;
            if (i < pts.length - 1) {
                const bx = pts[i + 1].x - pts[i].x;
                const by = pts[i + 1].y - pts[i].y;
                const bz = pts[i + 1].z - pts[i].z;
                const lb = Math.hypot(bx, by, bz);
                if (lb > 1e-4 && (ax * bx + ay * by + az * bz) / (la * lb) < 0.1) return true;
            }
            if (Math.hypot(pts[i].x - ox[i], pts[i].z - oz[i]) > 7) return true;
        }
        return newLen > oldLen * 1.28 + 0.4;
    }

    #hitsBox(pts, box, pad) {
        const minX = box.min.x - pad;
        const maxX = box.max.x + pad;
        const minY = box.min.y - pad;
        const maxY = box.max.y + pad;
        const minZ = box.min.z - pad;
        const maxZ = box.max.z + pad;
        const span = { t0: 0, t1: 1 };
        for (let i = 0; i < pts.length - 1; i++) {
            const p = pts[i];
            const q = pts[i + 1];
            if (Math.max(p.y, q.y) < minY || Math.min(p.y, q.y) > maxY) continue;
            span.t0 = 0;
            span.t1 = 1;
            if (!this.#clipAxis(p.x, q.x - p.x, minX, maxX, span)) continue;
            if (!this.#clipAxis(p.z, q.z - p.z, minZ, maxZ, span)) continue;
            if (span.t0 <= span.t1) return true;
        }
        return false;
    }

    #polylineHits(pts, box, pad) {
        const minX = box.min.x - pad, maxX = box.max.x + pad;
        const minY = box.min.y - pad, maxY = box.max.y + pad;
        const minZ = box.min.z - pad, maxZ = box.max.z + pad;
        const span = { t0: 0, t1: 1 };
        for (let i = 0; i < pts.length - 1; i++) {
            const p = pts[i];
            const q = pts[i + 1];
            if (Math.max(p.y, q.y) < minY || Math.min(p.y, q.y) > maxY) continue;
            span.t0 = 0;
            span.t1 = 1;
            if (!this.#clipAxis(p.x, q.x - p.x, minX, maxX, span)) continue;
            if (!this.#clipAxis(p.z, q.z - p.z, minZ, maxZ, span)) continue;
            if (span.t0 <= span.t1) return true;
        }
        return false;
    }

    #pinInside(p, box) {
        const m = 0.08;
        return p.x > box.min.x + m && p.x < box.max.x - m
            && p.y > box.min.y + m && p.y < box.max.y - m
            && p.z > box.min.z + m && p.z < box.max.z - m;
    }

    #xzDist(p, box) {
        const dx = p.x < box.min.x ? box.min.x - p.x : p.x > box.max.x ? p.x - box.max.x : 0;
        const dz = p.z < box.min.z ? box.min.z - p.z : p.z > box.max.z ? p.z - box.max.z : 0;
        return Math.hypot(dx, dz);
    }

    #nearPoint(p, q, r2) {
        const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
        return dx * dx + dy * dy + dz * dz < r2;
    }

    #clipAxis(p, d, min, max, span) {
        if (Math.abs(d) < 1e-9) return p >= min && p <= max;
        let t0 = (min - p) / d;
        let t1 = (max - p) / d;
        if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
        if (t0 > span.t0) span.t0 = t0;
        if (t1 < span.t1) span.t1 = t1;
        return span.t0 <= span.t1;
    }

}