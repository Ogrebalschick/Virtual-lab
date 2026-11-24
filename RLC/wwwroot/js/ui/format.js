export function num(v, d = 2) {
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function formatHz(v) {
    if (!Number.isFinite(v)) return '—';
    if (Math.abs(v) >= 10000) return `${num(v / 1000, 2)} кГц`;
    return `${num(v, v >= 100 ? 1 : 2)} Гц`;
}

export function formatV(v) {
    if (!Number.isFinite(v)) return '—';
    return `${num(v, Math.abs(v) >= 10 ? 2 : 3)} В`;
}

export function formatOhm(v) {
    if (!Number.isFinite(v)) return '—';
    return `${num(v, Math.abs(v) >= 100 ? 1 : 2)} Ом`;
}

export function parseNum(raw) {
    return Number(String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.'));
}

export function inputNum(v, d = 4) {
    if (!Number.isFinite(v)) return '';
    const p = 10 ** d;
    return String(Math.round(v * p) / p);
}

export function csvNum(v) {
    if (!Number.isFinite(v)) return '';
    return String(Math.round(v * 10000) / 10000).replace('.', ',');
}

export function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}