export const STORAGE_KEY = 'rlc-lab25-v1';
export const CHART_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.6/auto/+esm';
export const PROBE = { C: 'C_Red_Clemma', LC: 'Output_Red_Clemma' };
export const COLORS = ['#5ce1ff', '#c4a1ff', '#ffc14d', '#5ddeaf', '#ff8d8d'];

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function f0Of(L, C) {
    if (!(L > 0) || !(C > 0)) return NaN;
    return 1 / (2 * Math.PI * Math.sqrt(L * C));
}

export function qTheory(R, L, C) {
    if (!(R > 0) || !(L > 0) || !(C > 0)) return NaN;
    return Math.sqrt(L / C) / R;
}

export function fResAnalytic(R, L, C) {
    if (!(R > 0) || !(L > 0) || !(C > 0)) return null;
    const w0 = 1 / Math.sqrt(L * C);
    const delta = R / (2 * L);
    const disc = w0 * w0 - 2 * delta * delta;
    return disc > 0 ? Math.sqrt(disc) / (2 * Math.PI) : null;
}

export function findPeak(fn, a, b, n) {
    let bestI = 0;
    let bestY = -Infinity;
    const xs = new Array(n + 1);
    const ys = new Array(n + 1);
    for (let i = 0; i <= n; i++) {
        xs[i] = a + (b - a) * i / n;
        ys[i] = fn(xs[i]);
        if (ys[i] > bestY) {
            bestY = ys[i];
            bestI = i;
        }
    }
    let f = xs[bestI];
    if (bestI > 0 && bestI < n) {
        const y0 = ys[bestI - 1];
        const y1 = ys[bestI];
        const y2 = ys[bestI + 1];
        const denom = y0 - 2 * y1 + y2;
        if (denom !== 0) {
            const delta = 0.5 * (y0 - y2) / denom;
            if (delta > -1 && delta < 1) f = xs[bestI] + delta * (xs[1] - xs[0]);
        }
    }
    return { f, y: fn(f), atEdge: bestI === 0 || bestI === n };
}

export function halfWidth(samples, fPeak, level) {
    let iPeak = 0;
    for (let i = 1; i < samples.length; i++) {
        if (Math.abs(samples[i].f - fPeak) < Math.abs(samples[iPeak].f - fPeak)) iPeak = i;
    }
    const cross = (i, j) => {
        const a = samples[i];
        const b = samples[j];
        if (a.y === level) return a.f;
        const dy = b.y - a.y;
        if (dy === 0) return null;
        if ((a.y - level) * (b.y - level) > 0) return null;
        const t = (level - a.y) / dy;
        if (t < 0 || t > 1) return null;
        return a.f + t * (b.f - a.f);
    };
    let fL = null;
    let fR = null;
    for (let i = iPeak; i > 0; i--) {
        const f = cross(i - 1, i);
        if (f != null) { fL = f; break; }
    }
    for (let i = iPeak; i < samples.length - 1; i++) {
        const f = cross(i, i + 1);
        if (f != null) { fR = f; break; }
    }
    if (fL == null || fR == null) return null;
    return { fL, fR, df: fR - fL, level };
}

export function isSweep(s) {
    return s && (s.mode === 'C' || s.mode === 'LC') && Array.isArray(s.points) && s.points.length > 1;
}

export function speakerLinks(cables) {
    const has = (a, b) => (cables || []).some((c) =>
        (c.term1?.name === a && c.term2?.name === b)
        || (c.term1?.name === b && c.term2?.name === a));
    const signal = has('Output_Red_Clemma', 'Red_Clemma');
    const ground = has('Output_Black_Clemma', 'Black_Clemma');
    return { signal, ground, ok: signal && ground };
}