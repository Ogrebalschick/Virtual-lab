import { csvNum, esc, formatHz, formatOhm, formatV, num } from './format.js';
import { f0Of, isSweep, qTheory, STORAGE_KEY } from './analysis.js';

export function renderPoints(ui) {
    ui.nodes.points.innerHTML = ui.points.map((p, i) => `
<tr>
  <td>${i + 1}</td><td>${num(p.f, 1)}</td><td>${num(p.Em, 3)}</td><td>${num(p.Uc, 3)}</td>
  <td>${num(p.phi, 1)}</td><td>${num(p.R, 1)}</td><td>${esc(p.ch2)}</td>
  <td><button type="button" data-act="del-point" data-i="${i}">убрать</button></td>
</tr>`).join('') || '<tr><td colspan="8">Пока пусто. Найди резонанс или зафиксируй точку вручную.</td></tr>';
}

export function capturePoint(ui, note) {
    const s = ui.snapshot();
    if (!(s.Em > 0)) {
        ui.setStatus('Точка не записана: εm = 0.');
        return;
    }
    ui.points.push({
        f: s.f, Em: s.Em, Uc: s.UCm, Ulc: s.ULCm,
        phi: Number.isFinite(s.psi) ? s.psi * 180 / Math.PI : NaN,
        R: s.R, L: s.L, C: s.C,
        ch2: ui.sim.probeOverride || ui.sim.getCH2Source?.() || '—',
        note,
    });
    if (ui.points.length > 60) ui.points.shift();
    renderPoints(ui);
    persist(ui);
    if (note === 'ручная') ui.setStatus('Точка записана в журнал.');
}

export function deletePoint(ui, index) {
    if (!Number.isInteger(index) || index < 0 || index >= ui.points.length) return;
    ui.points.splice(index, 1);
    renderPoints(ui);
    persist(ui);
}

export function exportCsv(ui) {
    const lines = ['Точки', 'n;f_Hz;Em_V;Uc_V;Ulc_V;phi_deg;R_ohm;L_H;C_F;ch2;note'];
    ui.points.forEach((p, i) => {
        lines.push([i + 1, csvNum(p.f), csvNum(p.Em), csvNum(p.Uc), csvNum(p.Ulc), csvNum(p.phi), csvNum(p.R), csvNum(p.L), csvNum(p.C), p.ch2, p.note].join(';'));
    });
    for (const curve of ui.curvesFor('C').concat(ui.curvesFor('LC'))) {
        lines.push('', `Прогон ${curve.mode};R=${csvNum(curve.R)};L=${csvNum(curve.L)};C=${csvNum(curve.C)};Em=${csvNum(curve.Em)}`);
        lines.push('f_Hz;Uc_V;Ulc_V;phiC_deg;phiLC_deg');
        for (const p of curve.points) lines.push([csvNum(p.f), csvNum(p.UCm), csvNum(p.ULCm), csvNum(p.psiDeg), csvNum(p.psiLCDeg)].join(';'));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rlc-lab25.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}

export function printReport(ui) {
    const s = ui.snapshot();
    const f0 = f0Of(s.L, s.C);
    const res = ui.resonance;
    const img = (mode) => {
        const url = ui.charts[mode]?.toBase64Image?.();
        return url ? `<img alt="График ${mode}" src="${url}" />` : '';
    };
    const pointRows = ui.points.map((p, i) =>
        `<tr><td>${i + 1}</td><td>${num(p.f, 1)}</td><td>${num(p.Em, 3)}</td><td>${num(p.Uc, 3)}</td><td>${num(p.phi, 1)}</td><td>${num(p.R, 1)}</td><td>${esc(p.note)}</td></tr>`).join('');
    ui.printRoot.innerHTML = `
<h1>Лабораторная работа №25. Вынужденные колебания в RLC-контуре</h1>
<p>${esc(new Date().toLocaleString('ru-RU'))}</p>
<h2>Параметры</h2>
<p>R = ${formatOhm(s.R)}, L = ${num(s.L * 1e3, 3)} мГн, C = ${num(s.C * 1e6, 4)} мкФ, εm = ${formatV(s.Em)}.</p>
<p>f0 = 1 / (2π√(LC)) = ${formatHz(f0)}. Q теор = (1/R)√(L/C) = ${num(qTheory(s.R, s.L, s.C), 3)}.</p>
<h2>Резонанс</h2>
<p>${res ? `f рез = ${formatHz(res.f)}, UC рез = ${formatV(res.uc)}, εm = ${formatV(res.em)}, φC = ${num((res.psi || 0) * 180 / Math.PI, 1)}°.` : 'Автопоиск резонанса не выполнялся.'}</p>
<p>Q₁ = ${esc(ui.nodes.q1.textContent)}, Q₂ = ${esc(ui.nodes.q2.textContent)}.</p>
<h2>Журнал</h2>
<table><thead><tr><th>№</th><th>f, Гц</th><th>εm</th><th>UC</th><th>φ, °</th><th>R</th><th>заметка</th></tr></thead><tbody>${pointRows || '<tr><td colspan="7">Нет точек</td></tr>'}</tbody></table>
<h2>АЧХ UC</h2>${img('C')}<p>${esc(ui.nodes.compare.textContent)}</p>
<h2>АЧХ ULC</h2>${img('LC')}<p>${esc(ui.nodes.lcNote.textContent)}</p>
<h2>Вывод</h2><p>${esc(ui.conclusion) || 'Вывод не заполнен.'}</p>`;
    window.print();
}

export function resetJournal(ui) {
    ui.points = [];
    ui.savedSweeps = [];
    ui.latest = { C: null, LC: null };
    ui.resonance = null;
    ui.conclusion = '';
    ui._dfHint = null;
    ui.nodes.conclusion.value = '';
    ui.nodes.q1.textContent = '—';
    ui.nodes.q2.textContent = '—';
    ui.nodes.q1Note.textContent = '';
    ui.nodes.q2Note.textContent = '';
    ui.nodes.res.hidden = true;
    renderPoints(ui);
    ui.renderSweepTable('C');
    ui.renderSweepTable('LC');
    ui.updateCompare();
    ui.charts.C?.destroy();
    ui.charts.LC?.destroy();
    ui.charts.C = null;
    ui.charts.LC = null;
    persist(ui);
    ui.setStatus('Журнал очищен. Приборы не сброшены.');
}

export function persist(ui) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            v: 1, points: ui.points, savedSweeps: ui.savedSweeps, latest: ui.latest,
            resonance: ui.resonance, conclusion: ui.conclusion, showPhase: ui.showPhase, dfHint: ui._dfHint,
        }));
    } catch { /* приватный режим */ }
}

export function restore(ui) {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (!raw || raw.v !== 1) return;
        ui.points = Array.isArray(raw.points) ? raw.points : [];
        ui.savedSweeps = Array.isArray(raw.savedSweeps) ? raw.savedSweeps.filter(isSweep) : [];
        ui.latest = {
            C: isSweep(raw.latest?.C) ? raw.latest.C : null,
            LC: isSweep(raw.latest?.LC) ? raw.latest.LC : null,
        };
        ui.resonance = raw.resonance || null;
        ui.conclusion = typeof raw.conclusion === 'string' ? raw.conclusion : '';
        ui.showPhase = raw.showPhase !== false;
        ui._dfHint = raw.dfHint || null;
        ui.nodes.conclusion.value = ui.conclusion;
        ui.root.querySelectorAll('.js-phase').forEach((el) => { el.checked = ui.showPhase; });
        if (ui.resonance?.f) {
            ui.nodes.res.hidden = false;
            ui.nodes.resF.textContent = formatHz(ui.resonance.f);
            ui.nodes.resF0.textContent = formatHz(ui.resonance.f0);
            ui.nodes.resUc.textContent = formatV(ui.resonance.uc);
            ui.nodes.resPhi.textContent = `${num((ui.resonance.psi || 0) * 180 / Math.PI, 1)}°`;
            const err = ui.resonance.f0 ? (ui.resonance.f - ui.resonance.f0) / ui.resonance.f0 * 100 : NaN;
            ui.nodes.resErr.textContent = Number.isFinite(err) ? `${num(err, 2)} %` : '—';
        }
        if (ui.resonance?.q1) ui.nodes.q1.textContent = num(ui.resonance.q1, 3);
        if (ui.resonance?.q2) ui.nodes.q2.textContent = num(ui.resonance.q2, 3);
        ui.renderSweepTable('C');
        ui.renderSweepTable('LC');
        ui.updateCompare();
        const tab = localStorage.getItem('rlc-lab25-tab');
        if (tab) ui._savedTab = tab;
    } catch { /* битый журнал */ }
}