import { RLCPhysics } from '../physics/RLCPhysics.js';
import { formatHz, formatOhm, formatV, inputNum, num } from './format.js';
import { f0Of, qTheory, speakerLinks } from './analysis.js';
import { ensureKatexCss, html, renderMath } from './katexView.js';
import { panelTemplate } from './panelTemplate.js';
import { capturePoint, deletePoint, exportCsv, persist, printReport, renderPoints, resetJournal, restore } from './journal.js';
import { clearSaved, curvesFor, drawChart, ensureChart, renderSweepTable, saveSweep, updateCompare } from './charts.js';
import { applyLC, assemble, calcQ1, calcQ2, findResonance, powerOn, setProbe, setR, sweep, takeLive, useDfHint } from './experiments.js';

export class UIManager {
    constructor({ generator, rlcBoard, oscilloscope, cableManager, simManager }) {
        this.generator = generator;
        this.rlc = rlcBoard;
        this.scope = oscilloscope;
        this.cableManager = cableManager;
        this.sim = simManager;
        this.savedSweeps = [];
        this.latest = { C: null, LC: null };
        this.points = [];
        this.resonance = null;
        this.conclusion = '';
        this.showPhase = true;
        this.busy = false;
        this._cancel = false;
        this._timer = 0;
        this._dfHint = null;
        this._savedTab = 'guide';
        this.charts = { C: null, LC: null };
        this._drawToken = { C: 0, LC: 0 };
        this.root = null;
        this.printRoot = null;
        this.nodes = {};
    }

    mount(parent = document.body) {
        this.unmount();
        this.injectCss();
        this.root = document.createElement('aside');
        this.root.id = 'ui-panel';
        this.root.innerHTML = panelTemplate();
        parent.appendChild(this.root);
        this.printRoot = document.createElement('div');
        this.printRoot.id = 'lab-print';
        parent.appendChild(this.printRoot);
        this.cacheNodes();
        this.bind();
        restore(this);
        this.nodes.l.value = inputNum(this.rlc.state.L * 1e3, 3);
        this.nodes.c.value = inputNum(this.rlc.state.C * 1e6, 4);
        this.switchTab(this._savedTab || 'guide');
        this.refresh();
        renderMath(this.root);
        renderPoints(this);
        this._timer = window.setInterval(() => this.refresh(), 100);
        ensureChart()
            .then(() => { this.draw('C'); this.draw('LC'); })
            .catch((err) => {
                console.warn(err);
                this.setStatus('Chart.js не загрузился — таблицы прогона всё равно заполняются.');
            });
    }

    unmount() {
        window.clearInterval(this._timer);
        this.charts.C?.destroy();
        this.charts.LC?.destroy();
        document.getElementById('ui-panel')?.remove();
        document.getElementById('lab-print')?.remove();
    }

    injectCss() {
        ensureKatexCss();
        if (document.querySelector('link[data-rlc-ui]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/ui-panel.css';
        link.dataset.rlcUi = '1';
        document.head.appendChild(link);
    }

    cacheNodes() {
        const q = (id) => this.root.querySelector(id);
        this.nodes = {
            bar: q('#lab-bar'),
            status: q('#lab-status'),
            wave: q('#lab-wave'),
            f: q('#lab-f'),
            fLock: q('#lab-f-lock'),
            em: q('#lab-em'),
            uc: q('#lab-uc'),
            phi: q('#lab-phi'),
            ulc: q('#lab-ulc'),
            r: q('#lab-r'),
            rLock: q('#lab-r-lock'),
            f0: q('#lab-f0'),
            q: q('#lab-q'),
            chipGen: q('#lab-chip-gen'),
            chipCircuit: q('#lab-chip-circuit'),
            chipSpk: q('#lab-chip-spk'),
            chipCh1: q('#lab-chip-ch1'),
            chipCh2: q('#lab-chip-ch2'),
            res: q('#lab-res'),
            resF: q('#lab-res-f'),
            resF0: q('#lab-res-f0'),
            resErr: q('#lab-res-err'),
            resUc: q('#lab-res-uc'),
            resPhi: q('#lab-res-phi'),
            resNote: q('#lab-res-note'),
            inUc: q('#lab-in-uc'),
            inEm: q('#lab-in-em'),
            inDf: q('#lab-in-df'),
            q1: q('#lab-q1'),
            q1Note: q('#lab-q1-note'),
            q2: q('#lab-q2'),
            q2Note: q('#lab-q2-note'),
            dfHint: q('#lab-df-hint'),
            points: q('#lab-points'),
            compare: q('#lab-compare'),
            lcNote: q('#lab-lc-note'),
            tableC: q('#lab-table-c'),
            tableLc: q('#lab-table-lc'),
            chartC: q('#lab-chart-c'),
            chartLc: q('#lab-chart-lc'),
            inR: q('#lab-in-r'),
            l: q('#lab-l'),
            c: q('#lab-c'),
            conclusion: q('#lab-conclusion'),
            wires: q('#lab-wires'),
        };
    }

    bind() {
        this.root.addEventListener('click', (event) => {
            const tab = event.target.closest('[data-tab]');
            if (tab && this.root.contains(tab)) {
                this.switchTab(tab.dataset.tab);
                return;
            }
            const btn = event.target.closest('[data-act]');
            if (!btn) return;
            const act = btn.dataset.act;
            if (this.busy && act !== 'cancel' && act !== 'collapse') return;
            this.onAction(act, btn);
        });
        this.root.addEventListener('wheel', (event) => event.stopPropagation(), { capture: true });
        this.root.addEventListener('change', (event) => {
            if (event.target === this.nodes.l || event.target === this.nodes.c) applyLC(this);
            if (event.target.classList.contains('js-phase')) {
                this.showPhase = event.target.checked;
                this.root.querySelectorAll('.js-phase').forEach((el) => { el.checked = this.showPhase; });
                this.draw('C');
                this.draw('LC');
                this.persist();
            }
        });
        this.nodes.conclusion.addEventListener('input', () => {
            this.conclusion = this.nodes.conclusion.value;
            this.persist();
        });
    }

    onAction(act, btn) {
        if (act === 'collapse') {
            this.root.classList.toggle('is-collapsed');
            btn.textContent = this.root.classList.contains('is-collapsed') ? 'Открыть' : 'Свернуть';
            return;
        }
        if (act === 'cancel') { this._cancel = true; return; }
        if (act === 'find-resonance') findResonance(this);
        else if (act === 'capture') capturePoint(this, 'ручная');
        else if (act === 'take-live') takeLive(this);
        else if (act === 'q1') calcQ1(this);
        else if (act === 'q2') calcQ2(this);
        else if (act === 'use-df') useDfHint(this);
        else if (act === 'sweep-c') sweep(this, 'C');
        else if (act === 'sweep-lc') sweep(this, 'LC');
        else if (act === 'save-c') saveSweep(this, 'C');
        else if (act === 'clear-c') clearSaved(this, 'C');
        else if (act === 'probe-lc') setProbe(this, 'LC');
        else if (act === 'probe-c') setProbe(this, 'C');
        else if (act === 'assemble') assemble(this);
        else if (act === 'power') powerOn(this);
        else if (act === 'set-r') setR(this, Number(btn.dataset.r));
        else if (act === 'apply-r') setR(this, Number(String(this.nodes.inR.value).replace(',', '.')));
        else if (act === 'csv') exportCsv(this);
        else if (act === 'print') printReport(this);
        else if (act === 'reset-journal') resetJournal(this);
        else if (act.startsWith('del-point')) deletePoint(this, Number(btn.dataset.i));
    }

    switchTab(id) {
        this._savedTab = id;
        if (!this.busy) this.setStatus('');
        this.root.querySelectorAll('[data-tab]').forEach((btn) => {
            btn.setAttribute('aria-selected', String(btn.dataset.tab === id));
        });
        this.root.querySelectorAll('[data-panel]').forEach((panel) => {
            panel.hidden = panel.dataset.panel !== id;
        });
        try { localStorage.setItem('rlc-lab25-tab', id); } catch { /* журнал необязателен */ }
        const mode = id === 'exp3' ? 'LC' : id === 'exp2' ? 'C' : null;
        if (mode) requestAnimationFrame(() => this.charts[mode]?.resize());
    }

    setStatus(text) {
        this.nodes.status.textContent = text || '';
    }

    setProgress(t) {
        this.nodes.bar.style.width = `${Math.round(Math.min(1, Math.max(0, t)) * 100)}%`;
    }

    async withBusy(fn) {
        if (this.busy) return;
        this.busy = true;
        this._cancel = false;
        this.root.classList.add('is-busy');
        try {
            await fn();
        } catch (err) {
            console.error(err);
            this.setStatus(err?.message || 'Ошибка операции');
        } finally {
            this.busy = false;
            this._cancel = false;
            this.root.classList.remove('is-busy');
            this.setProgress(0);
        }
    }

    snapshot() {
        const live = this.sim.reading;
        if (live) return live;
        const isGenOn = !!this.generator.buttons?.isPowerOn;
        const f = this.generator.state?.frequencyHz ?? 0;
        const Em = isGenOn ? (this.generator.state?.amplitudeV ?? 0) : 0;
        const { R, L, C } = this.rlc.state;
        const res = (f > 0 && L > 0 && C > 0)
            ? RLCPhysics.calculate(f, R, L, C, Em)
            : {};
        return { isGenOn, f, Em, R, L, C, ...res, waveform: this.generator.buttons?.activeWaveform ?? null };
    }

    refresh() {
        const s = this.snapshot();
        const f0 = f0Of(s.L, s.C);
        this.nodes.f.textContent = formatHz(s.f);
        this.nodes.em.textContent = formatV(s.Em);
        this.nodes.uc.textContent = formatV(s.UCm);
        this.nodes.phi.textContent = (s.Em > 0.05 && Number.isFinite(s.psi))
            ? `${num(s.psi * 180 / Math.PI, 1)}°`
            : '—';
        this.nodes.ulc.textContent = formatV(s.ULCm);
        this.nodes.r.textContent = formatOhm(s.R);
        this.nodes.f0.textContent = formatHz(f0);
        this.nodes.q.textContent = num(qTheory(s.R, s.L, s.C), 2);
        this.nodes.fLock.hidden = !this.generator.freqLocked;
        this.nodes.rLock.hidden = !this.rlc.rLocked;

        const valid = !!this.cableManager.isCircuitValid?.();
        const sp = speakerLinks(this.cableManager.cables);
        const ch1 = typeof this.sim.getCH1Source === 'function' ? this.sim.getCH1Source() : false;
        const detected = typeof this.sim.getCH2Source === 'function' ? this.sim.getCH2Source() : 'None';
        const ch2 = this.sim.probeOverride || detected;
        const spText = sp.ok
            ? 'Динамик подключён'
            : sp.signal ? 'Динамик: нет земли'
                : sp.ground ? 'Динамик: нет сигнала'
                    : 'Динамик не подключён';

        this.chip(this.nodes.chipGen, s.isGenOn ? `Генератор ${formatV(s.Em)}` : 'Генератор выкл', s.isGenOn);
        this.chip(this.nodes.chipCircuit, valid ? 'Цепь собрана' : 'Цепь не собрана', valid);
        this.chip(this.nodes.chipSpk, spText, sp.ok);
        this.chip(this.nodes.chipCh1, ch1 ? 'CH1: ЭДС' : 'CH1: нет', !!ch1);
        const logical = !!this.sim.probeOverride;
        this.chip(this.nodes.chipCh2, `CH2: ${ch2}${logical ? ' (логич.)' : ''}`, ch2 !== 'None');

        const wave = this.generator.buttons?.activeWaveform;
        const odd = typeof wave === 'string' && /square|triangle|saw|rect|pulse|меандр/i.test(wave);
        this.nodes.wave.hidden = !odd;
        if (odd) this.nodes.wave.textContent = `Сейчас форма «${wave}». Формулы АЧХ и Q — для синуса.`;

        const wires = (this.cableManager.cables || [])
            .map((c) => `${c.term1?.name ?? '?'} → ${c.term2?.name ?? '?'}`)
            .join('\n') || 'Проводов нет.';
        if (this.nodes.wires.textContent !== wires) this.nodes.wires.textContent = wires;
    }

    chip(el, text, ok) {
        el.textContent = text;
        el.classList.toggle('is-ok', !!ok);
        el.classList.toggle('is-bad', !ok);
    }

    persist() { persist(this); }
    draw(mode) { return drawChart(this, mode); }
    curvesFor(mode) { return curvesFor(this, mode); }
    renderSweepTable(mode) { renderSweepTable(this, mode); }
    updateCompare() { updateCompare(this); }
    html(el, markup) { html(el, markup); }
}