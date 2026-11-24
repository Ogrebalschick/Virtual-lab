import { RLCPhysics } from '../physics/RLCPhysics.js';
import { formatHz, num } from './format.js';
import { CHART_URL, COLORS, f0Of, halfWidth, isSweep } from './analysis.js';

let chartPromise = null;
let ChartCtor = null;

export function ensureChart() {
    if (ChartCtor) return Promise.resolve(ChartCtor);
    if (!chartPromise) {
        chartPromise = import(CHART_URL).then((mod) => {
            ChartCtor = mod.Chart ?? mod.default;
            if (!ChartCtor) throw new Error('Chart.js: нет экспорта Chart');
            return ChartCtor;
        }).catch((err) => {
            chartPromise = null;
            throw err;
        });
    }
    return chartPromise;
}

export function computeSweep(ui, mode, R, L, C, Em) {
    const f0 = f0Of(L, C);
    const n = 81;
    const fStart = f0 * 0.5;
    const fEnd = f0 * 1.5;
    const points = [];
    for (let i = 0; i < n; i++) {
        const f = fStart + (fEnd - fStart) * i / (n - 1);
        const row = RLCPhysics.calculate(f, R, L, C, Em);
        points.push({
            f, UCm: row.UCm, ULCm: row.ULCm,
            psiDeg: row.psi * 180 / Math.PI,
            psiLCDeg: row.psiLC * 180 / Math.PI,
        });
    }
    let peak = points[0];
    for (const p of points) {
        if (mode === 'LC' ? p.ULCm < peak.ULCm : p.UCm > peak.UCm) peak = p;
    }
    let width = null;
    if (mode === 'C') {
        const dense = [];
        for (let i = 0; i < 801; i++) {
            const f = f0 * 0.2 + (f0 * 2 - f0 * 0.2) * i / 800;
            dense.push({ f, y: RLCPhysics.calculate(f, R, L, C, Em).UCm });
        }
        let best = dense[0];
        for (const d of dense) if (d.y > best.y) best = d;
        width = halfWidth(dense, best.f, best.y / Math.SQRT2);
        if (width) ui._dfHint = width;
    }
    return { mode, R, L, C, Em, f0, points, peak, width };
}

export function curvesFor(ui, mode) {
    const saved = ui.savedSweeps.filter((s) => isSweep(s) && s.mode === mode);
    const latest = ui.latest[mode];
    if (latest && !saved.includes(latest)) return saved.concat(latest);
    return saved.length ? saved : (latest ? [latest] : []);
}

export function updateCompare(ui) {
    const curves = ui.savedSweeps.filter((s) => s.mode === 'C' && s.width?.df);
    if (curves.length < 2) {
        ui.nodes.compare.textContent = ui.latest.C
            ? 'Сохрани эту кривую, поставь другое R и сними вторую — они лягут на один график.'
            : '';
        return;
    }
    const sorted = [...curves].sort((a, b) => a.R - b.R);
    const a = sorted[0];
    const b = sorted[sorted.length - 1];
    let text = `R = ${num(a.R, 0)} Ом: пик ${formatV(a.peak.UCm)}, Δf ≈ ${num(a.width.df, 0)} Гц. R = ${num(b.R, 0)} Ом: пик ${formatV(b.peak.UCm)}, Δf ≈ ${num(b.width.df, 0)} Гц.`;
    if (a.R < b.R && a.peak.UCm > b.peak.UCm && a.width.df < b.width.df) {
        text += ' Большему R соответствует более низкий и широкий пик.';
    }
    ui.nodes.compare.textContent = text;
}

function formatV(v) {
    return Number.isFinite(v) ? `${num(v, Math.abs(v) >= 10 ? 2 : 3)} В` : '—';
}

export function renderSweepTable(ui, mode) {
    const host = mode === 'LC' ? ui.nodes.tableLc : ui.nodes.tableC;
    const curve = ui.latest[mode];
    if (!curve) { host.innerHTML = ''; return; }
    const rows = curve.points.map((p) =>
        `<tr><td>${num(p.f, 1)}</td><td>${num(p.UCm, 3)}</td><td>${num(p.ULCm, 3)}</td><td>${num(p.psiDeg, 1)}</td><td>${num(p.psiLCDeg, 1)}</td></tr>`).join('');
    host.innerHTML = `<table><thead><tr><th>f, Гц</th><th>UC, В</th><th>ULC, В</th><th>φC, °</th><th>φLC, °</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export async function drawChart(ui, mode) {
    const token = ++ui._drawToken[mode];
    const canvas = mode === 'LC' ? ui.nodes.chartLc : ui.nodes.chartC;
    const curves = curvesFor(ui, mode);
    if (!curves.length || !canvas) return;
    let Chart;
    try { Chart = await ensureChart(); } catch { return; }
    if (token !== ui._drawToken[mode]) return;
    ui.charts[mode]?.destroy();
    const yKey = mode === 'LC' ? 'ULCm' : 'UCm';
    const phaseKey = mode === 'LC' ? 'psiLCDeg' : 'psiDeg';
    const datasets = curves.map((curve, i) => ({
        label: `${mode === 'LC' ? 'ULC' : 'UC'}, R = ${num(curve.R, 0)} Ом`,
        data: curve.points.map((p) => ({ x: p.f, y: p[yKey] })),
        borderColor: COLORS[i % COLORS.length],
        backgroundColor: COLORS[i % COLORS.length],
        yAxisID: 'y', tension: 0, pointRadius: 0, borderWidth: 2,
    }));
    const latest = ui.latest[mode];
    if (ui.showPhase && latest) {
        datasets.push({
            label: mode === 'LC' ? 'φLC' : 'φC',
            data: latest.points.map((p) => ({ x: p.f, y: p[phaseKey] })),
            borderColor: '#ffc14d', yAxisID: 'y1', tension: 0, pointRadius: 0, borderDash: [5, 4], borderWidth: 1.5,
        });
    }
    if (latest) {
        const yMax = Math.max(...latest.points.map((p) => p[yKey]), 0.1);
        datasets.push({
            label: 'f0',
            data: [{ x: latest.f0, y: 0 }, { x: latest.f0, y: yMax }],
            borderColor: 'rgba(255,255,255,0.45)', yAxisID: 'y', pointRadius: 0, borderDash: [2, 4], borderWidth: 1,
        });
    }
    ui.charts[mode] = new Chart(canvas, {
        type: 'line',
        data: { datasets },
        plugins: [{
            id: 'labBg',
            beforeDraw(chart) {
                const { ctx } = chart;
                ctx.save();
                ctx.fillStyle = '#10151f';
                ctx.fillRect(0, 0, chart.width, chart.height);
                ctx.restore();
            },
        }],
        options: {
            color: '#c5d0de', animation: false, responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        title: (items) => `f = ${formatHz(items[0]?.parsed?.x)}`,
                        label: (item) => `${item.dataset.label}: ${num(item.parsed.y, 3)}`,
                    },
                },
            },
            scales: {
                x: { type: 'linear', title: { display: true, text: 'f, Гц' }, grid: { color: 'rgba(255,255,255,0.06)' } },
                y: { beginAtZero: true, title: { display: true, text: 'U, В' }, grid: { color: 'rgba(255,255,255,0.06)' } },
                y1: {
                    position: 'right', display: ui.showPhase,
                    min: mode === 'C' ? 0 : undefined, max: mode === 'C' ? 180 : undefined,
                    title: { display: true, text: mode === 'C' ? 'φC, °' : 'φLC, °' },
                    grid: { drawOnChartArea: false },
                },
            },
        },
    });
    if (mode === 'LC' && latest) {
        ui.nodes.lcNote.textContent = `Минимум ULC = ${formatV(latest.peak.ULCm)} при ${formatHz(latest.peak.f)}. f0 этого прогона — ${formatHz(latest.f0)}. В идеальной модели минимум ровно на f0 и равен нулю.`;
    }
}

export function saveSweep(ui, mode) {
    const curve = ui.latest[mode];
    if (!curve) { ui.setStatus('Сначала сними кривую.'); return; }
    ui.savedSweeps.push(curve);
    ui.savedSweeps = ui.savedSweeps.filter(isSweep).slice(-6);
    updateCompare(ui);
    drawChart(ui, mode);
    ui.persist();
    ui.setStatus(`Кривая R = ${num(curve.R, 1)} Ом сохранена для наложения. Поставь другое R и сними ещё раз.`);
}

export function clearSaved(ui, mode) {
    ui.savedSweeps = ui.savedSweeps.filter((s) => s.mode !== mode);
    updateCompare(ui);
    drawChart(ui, mode);
    ui.persist();
}