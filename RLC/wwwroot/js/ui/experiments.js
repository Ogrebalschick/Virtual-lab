import { RLCPhysics } from '../physics/RLCPhysics.js';
import { esc, formatHz, formatOhm, formatV, inputNum, num, parseNum } from './format.js';
import { f0Of, findPeak, fResAnalytic, halfWidth, PROBE, qTheory, sleep } from './analysis.js';
import { html, mathHTML } from './katexView.js';
import { capturePoint, persist } from './journal.js';
import { computeSweep, drawChart, renderSweepTable, updateCompare } from './charts.js';

export function arm(ui) {
    const g = ui.generator;
    if (typeof g.ensurePowerOn === 'function') g.ensurePowerOn();
    else if (g.buttons && !g.buttons.isPowerOn) {
        g.buttons.isPowerOn = true;
        g.updateDisplayValues?.();
    }
    if (!(g.state.amplitudeV > 0.05)) {
        if (typeof g.setAmplitudeV === 'function') g.setAmplitudeV(2);
        else g.state.amplitudeV = 2;
    }
    try { g.audio?.init?.(); } catch (err) { console.warn(err); }
    return g.state.amplitudeV;
}

export function powerOn(ui) {
    const em = arm(ui);
    ui.setStatus(em > 0.05
        ? `Генератор включён, εm = ${formatV(em)}. Если 3D-кнопка питания не зажглась, физика уже считает его включённым.`
        : 'Не удалось задать амплитуду. Пришли ButtonController.js.');
}

export function findResonance(ui) {
    const Em = arm(ui);
    if (!(Em > 0.05)) {
        ui.setStatus('Амплитуда нулевая. Включи генератор или нажми «Включить генератор, 2 В» во вкладке заочника.');
        return;
    }
    ui.withBusy(async () => {
        const { R, L, C } = ui.rlc.state;
        const f0 = f0Of(L, C);
        if (!(f0 > 0)) { ui.setStatus('L и C должны быть больше нуля.'); return; }
        const ucAt = (f) => RLCPhysics.calculate(f, R, L, C, Em).UCm;
        const lo = Math.max(1, f0 * 0.25);
        const hi = f0 * 1.75;
        let peak = findPeak(ucAt, lo, hi, 500);
        if (peak.atEdge) {
            ui.setStatus('Пик UC не выражен: затухание слишком большое. Поставь R = 10…50 Ом.');
            return;
        }
        const step = (hi - lo) / 500;
        peak = findPeak(ucAt, Math.max(1, peak.f - 2 * step), peak.f + 2 * step, 80);
        const row = RLCPhysics.calculate(peak.f, R, L, C, Em);
        const analytic = fResAnalytic(R, L, C);
        const dense = [];
        for (let i = 0; i < 801; i++) {
            const f = f0 * 0.2 + (f0 * 2.2 - f0 * 0.2) * i / 800;
            dense.push({ f, y: RLCPhysics.calculate(f, R, L, C, Em).UCm });
        }
        const width = halfWidth(dense, peak.f, row.UCm / Math.SQRT2);
        ui._dfHint = width;
        ui.resonance = { f: peak.f, uc: row.UCm, em: Em, psi: row.psi, R, L, C, f0, analytic, width };
        if (typeof ui.generator.setFrequencyHz === 'function') ui.generator.setFrequencyHz(peak.f);
        else ui.setStatus('Нет setFrequencyHz — добавь правку GeneratorDevice, иначе генератор не встанет на резонанс.');
        const err = (peak.f - f0) / f0 * 100;
        ui.nodes.res.hidden = false;
        ui.nodes.resF.textContent = formatHz(peak.f);
        ui.nodes.resF0.textContent = formatHz(f0);
        ui.nodes.resErr.textContent = `${num(err, 2)} %`;
        ui.nodes.resUc.textContent = formatV(row.UCm);
        ui.nodes.resPhi.textContent = `${num(row.psi * 180 / Math.PI, 1)}°`;
        const bits = [];
        if (analytic) bits.push(`Формула ${mathHTML(String.raw`\omega_{\text{рез}}=\sqrt{\omega_0^2-2\delta^2}`, 'ω рез')} даёт ${esc(formatHz(analytic))}.`);
        bits.push(Math.abs(peak.f - f0) / f0 > 0.02
            ? `Максимум тока и громкости ближе к ${mathHTML(String.raw`f_0`, 'f₀')}, максимум ${mathHTML(String.raw`U_C`, 'U_C')} — к найденной частоте. При малом затухании они почти совпадают.`
            : `Сдвиг фаз между ЭДС и ${mathHTML(String.raw`U_C`, 'U_C')} на резонансе должен быть около ${mathHTML(String.raw`90^\circ`, '90°')}.`);
        html(ui.nodes.resNote, bits.join(' '));
        ui.nodes.inUc.value = inputNum(row.UCm, 4);
        ui.nodes.inEm.value = inputNum(Em, 4);
        html(ui.nodes.dfHint, width
            ? `Уровень ${mathHTML(String.raw`U_C^{\text{рез}}/\sqrt{2}`, '0,707·U_C рез')} = ${esc(formatV(width.level))}.<br>Подсказка модели: ${mathHTML(String.raw`f_1`, 'f₁')} = ${esc(formatHz(width.fL))}, ${mathHTML(String.raw`f_2`, 'f₂')} = ${esc(formatHz(width.fR))}, ${mathHTML(String.raw`\Delta f`, 'Δf')} = ${esc(formatHz(width.df))}.`
            : 'Кривая не опустилась до 0,707 от максимума. Уменьши R или сними Δf с графика вручную.');
        capturePoint(ui, 'автопоиск');
        persist(ui);
        ui.setStatus(`Резонанс UC: ${formatHz(peak.f)}. Генератор оставлен на этой частоте. Q₁ посчитай кнопкой — поля уже заполнены.`);
    });
}

export function takeLive(ui) {
    const s = ui.snapshot();
    if (!(s.Em > 0)) { ui.setStatus('Нечего брать: генератор выключен или εm = 0.'); return; }
    ui.nodes.inUc.value = inputNum(s.UCm, 4);
    ui.nodes.inEm.value = inputNum(s.Em, 4);
    ui.setStatus('В поля Q₁ записаны текущие UC и εm.');
}

export function calcQ1(ui) {
    const uc = parseNum(ui.nodes.inUc.value);
    const em = parseNum(ui.nodes.inEm.value);
    if (!(uc >= 0) || !(em > 0)) { ui.setStatus('Для Q₁ нужны UC рез и εm > 0.'); return; }
    const q = uc / em;
    ui.nodes.q1.textContent = num(q, 3);
    const s = ui.snapshot();
    const theory = qTheory(s.R, s.L, s.C);
    const err = Number.isFinite(theory) && theory !== 0 ? (q - theory) / theory * 100 : NaN;
    ui.nodes.q1Note.textContent = Number.isFinite(err)
        ? `Q теор = (1/R)√(L/C) = ${num(theory, 3)}. Расхождение ${num(err, 1)} %. Это не ошибка округления: максимум UC лежит чуть ниже f0, а формула через R, L, C относится к ω0.`
        : '';
    ui.resonance = { ...(ui.resonance || {}), q1: q, uc, em };
    persist(ui);
}

export function useDfHint(ui) {
    if (!ui._dfHint) { ui.setStatus('Подсказки ещё нет. Сначала найди резонанс или сними АЧХ.'); return; }
    ui.nodes.inDf.value = inputNum(ui._dfHint.df, 2);
}

export function calcQ2(ui) {
    const df = parseNum(ui.nodes.inDf.value);
    if (!(df > 0)) { ui.setStatus('Введи Δf больше нуля.'); return; }
    const fRes = ui.resonance?.f;
    const f0 = ui.resonance?.f0 ?? f0Of(ui.rlc.state.L, ui.rlc.state.C);
    const f = fRes || f0;
    if (!(f > 0)) return;
    const q = f / df;
    ui.nodes.q2.textContent = num(q, 3);
    const alt = f0 > 0 ? f0 / df : NaN;
    ui.nodes.q2Note.textContent = fRes
        ? `Q₂ = f рез / Δf = ${num(q, 3)}. Для сравнения f0 теор / Δf = ${num(alt, 3)}.`
        : `Резонанс ещё не зафиксирован, поэтому взята f0 теор: Q₂ = ${num(q, 3)}.`;
    ui.resonance = { ...(ui.resonance || {}), q2: q, df };
    persist(ui);
}

function restoreFreq(ui, prevF, prevLock) {
    const g = ui.generator;
    if (prevLock && typeof g.setFrequencyHz === 'function') g.setFrequencyHz(prevF);
    else if (typeof g.updateDisplayValues === 'function') {
        g.freqLocked = false;
        g.updateDisplayValues();
    }
}

export function sweep(ui, mode) {
    const Em = arm(ui);
    if (!(Em > 0.05)) { ui.setStatus('Для прогона нужна ненулевая амплитуда.'); return; }
    const { R, L, C } = ui.rlc.state;
    if (!(f0Of(L, C) > 0)) { ui.setStatus('Сначала задай положительные L и C.'); return; }
    const curve = computeSweep(ui, mode, R, L, C, Em);
    const prevF = ui.generator.state.frequencyHz;
    const prevLock = !!ui.generator.freqLocked;
    ui.withBusy(async () => {
        const preview = curve.points.filter((_, i) => i % 4 === 0);
        if (typeof ui.generator.setFrequencyHz === 'function') {
            for (let i = 0; i < preview.length; i++) {
                if (ui._cancel) {
                    restoreFreq(ui, prevF, prevLock);
                    ui.setStatus('Снятие остановлено. Кривая не записана.');
                    return;
                }
                ui.generator.setFrequencyHz(preview[i].f);
                ui.setProgress((i + 1) / preview.length);
                await sleep(45);
            }
        }
        restoreFreq(ui, prevF, prevLock);
        ui.latest[mode] = curve;
        renderSweepTable(ui, mode);
        updateCompare(ui);
        await drawChart(ui, mode);
        persist(ui);
        ui.setStatus(`Снята кривая ${mode === 'LC' ? 'ULC' : 'UC'} при R = ${num(R, 1)} Ом. Частота генератора возвращена.`);
    });
}

export async function setProbe(ui, mode) {
    const target = mode === 'LC' ? PROBE.LC : PROBE.C;
    const wasValid = !!ui.cableManager.isCircuitValid?.();
    if (typeof ui.cableManager.setCH2Probe !== 'function') {
        ui.sim.probeOverride = mode;
        ui.setStatus('В CableManager нет setCH2Probe. Экран переключён логически — добавь правку, если щуп должен переехать в 3D.');
        return;
    }
    await ui.withBusy(async () => {
        const result = await ui.cableManager.setCH2Probe(target);
        const stillValid = !!ui.cableManager.isCircuitValid?.();
        if (result?.ok && wasValid && !stillValid && mode === 'LC') {
            await ui.cableManager.setCH2Probe(PROBE.C);
            ui.sim.probeOverride = 'LC';
            ui.setStatus('Лишний провод размыкал проверку цепи, щуп возвращён на C. Экран CH2 всё равно показывает ULC.');
            return;
        }
        if (result?.ok) {
            ui.sim.probeOverride = null;
            ui.setStatus(mode === 'LC'
                ? 'CH2 на выходе LC. Если клемма была занята динамиком, вторая вилка чуть выше — смещение в CableManager.setCH2Probe.'
                : 'CH2 снова на конденсаторе.');
            return;
        }
        ui.sim.probeOverride = mode;
        ui.setStatus(`Провод не переставился (${result?.reason || 'клемма не найдена'}). Экран переключён логически на ${mode}.`);
    });
}

export async function assemble(ui) {
    await ui.withBusy(async () => {
        if (typeof ui.cableManager.clearAll === 'function') ui.cableManager.clearAll();
        else while (ui.cableManager.cables.length) ui.cableManager.removeCable(0);
        await ui.cableManager.setupStandardCircuit();
        ui.sim.probeOverride = null;
        const n = ui.cableManager.cables.length;
        const ok = !!ui.cableManager.isCircuitValid?.();
        ui.setStatus(ok
            ? `Схема собрана, проводов: ${n}.`
            : `Сборка закончилась, проводов: ${n}, но цепь не замкнута. Проверь имена клемм в консоли.`);
    });
}

export function setR(ui, ohms) {
    if (!Number.isFinite(ohms)) { ui.setStatus('Введи сопротивление числом.'); return; }
    const R = Math.min(1000, Math.max(10, ohms));
    if (typeof ui.rlc.setResistance === 'function') ui.rlc.setResistance(R);
    else ui.rlc.state.R = R;
    const { L, C } = ui.rlc.state;
    ui.setStatus(Math.abs(R - ohms) > 0.05
        ? `Диапазон ручки 10…1000 Ом, поставлено ${formatOhm(R)}.`
        : `R = ${formatOhm(R)}. Q теор ≈ ${num(qTheory(R, L, C), 2)}. Если повернуть ручку на плате, значение снова возьмётся с неё.`);
}

export function applyLC(ui) {
    const L = parseNum(ui.nodes.l.value) * 1e-3;
    const C = parseNum(ui.nodes.c.value) * 1e-6;
    if (!(L > 0) || !(C > 0)) { ui.setStatus('L и C должны быть больше нуля.'); return; }
    if (typeof ui.rlc.setLC === 'function') ui.rlc.setLC({ L, C });
    else { ui.rlc.state.L = L; ui.rlc.state.C = C; }
    ui.setStatus(`L = ${num(L * 1e3, 2)} мГн, C = ${num(C * 1e6, 3)} мкФ, f0 = ${formatHz(f0Of(L, C))}.`);
}