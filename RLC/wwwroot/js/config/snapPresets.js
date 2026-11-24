import * as THREE from 'three';

const deg = (d) => (d * Math.PI) / 180;

export const SNAP_PRESETS = {
    generator: { offset: [0, 0.082 * 3, 0], rot: [90, 0, 0] }, // дефолт
    speaker: { offset: [0, 0.17, 0], rot: [90, 0, 0] },
    oscilloscope: { offset: [0, 0.2, 0], rot: [90, 0, 0] },
    rlc: { offset: [0, 0, -0.2], rot: [0, 0, 0] },
};

export function resolveSnap(preset) {
    const p = SNAP_PRESETS[preset] ?? SNAP_PRESETS.generator;
    return {
        offset: new THREE.Vector3(...p.offset),
        rotation: new THREE.Euler(deg(p.rot[0]), deg(p.rot[1]), deg(p.rot[2]), 'XYZ'),
    };
}