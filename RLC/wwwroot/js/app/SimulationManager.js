import { RLCPhysics } from '../physics/RLCPhysics.js';

function cableBetween(cables, a, b) {
    return cables.some(c =>
        (c.term1?.name === a && c.term2?.name === b) ||
        (c.term1?.name === b && c.term2?.name === a)
    );
}

export class SimulationManager {
    constructor(generator, rlcBoard, oscilloscope, cableManager) {
        this.generator = generator;
        this.rlcBoard = rlcBoard;
        this.oscilloscope = oscilloscope;
        this.cableManager = cableManager;
        this.animationTime = 0;
        this.lastTime = performance.now();
        this.probeOverride = null;
        this.reading = null;
        this._oscFrame = 0;
    }

    getCH1Source() {
        return this.cableManager.cables.some(c =>
            c.term1?.name === 'CH1_INPUT' || c.term2?.name === 'CH1_INPUT'
        );
    }

    getCH2Source() {
        const cable = this.cableManager.cables.find(c =>
            c.term1?.name === 'CH2_INPUT' || c.term2?.name === 'CH2_INPUT'
        );
        if (!cable?.term1?.name || !cable?.term2?.name) return 'None';

        const otherTerm = cable.term1.name === 'CH2_INPUT' ? cable.term2.name : cable.term1.name;

        if (otherTerm.includes('L_Red_Clemma')) return 'L';
        if (otherTerm.includes('R_Red_Clemma')) return 'R';
        if (otherTerm.includes('C_Red_Clemma')) return 'C';
        if (otherTerm.includes('Output')) return 'LC';

        return 'None';
    }

    update() {
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        const isGenOn = this.generator.buttons?.isPowerOn;
        const hasCH1 = this.getCH1Source();
        const ch2Detected = this.getCH2Source();
        const ch2Source = this.probeOverride || ch2Detected;

        const f = this.generator.state.frequencyHz;
        const Em = isGenOn ? this.generator.state.amplitudeV : 0;
        const { R, L, C } = this.rlcBoard.state;

        const res = RLCPhysics.calculate(f, R, L, C, Em);

        let displayAmp = 0;
        let displayPhase = 0;
        let ch2Label = 'None';

        if (ch2Source === 'C') { displayAmp = res.UCm; displayPhase = res.psi; ch2Label = 'C'; }
        else if (ch2Source === 'L') { displayAmp = res.ULm; displayPhase = res.psiL; ch2Label = 'L'; }
        else if (ch2Source === 'R') { displayAmp = res.URm; displayPhase = res.psiR; ch2Label = 'R'; }
        else if (ch2Source === 'LC') { displayAmp = res.ULCm; displayPhase = res.psiLC; ch2Label = 'LC'; }
        else { ch2Label = ch2Source; }

        const cables = this.cableManager.cables;
        const speakerSignal = cableBetween(cables, 'Output_Red_Clemma', 'Red_Clemma');
        const speakerGround = cableBetween(cables, 'Output_Black_Clemma', 'Black_Clemma');
        const rlcToSpeaker = speakerSignal && speakerGround;

        const isCircuitValid = this.cableManager.isCircuitValid();

        if (this.generator.audio && isGenOn && isCircuitValid && rlcToSpeaker && Em > 0.1) {
            const maxCurrent = Em / 10;
            const currentRatio = res.Im / maxCurrent;
            const volumeLevel = Math.min(0.15, currentRatio * 0.15);
            this.generator.audio.setVolume(volumeLevel);
        } else if (this.generator.audio) {
            this.generator.audio.setVolume(0);
        }

        if (this.oscilloscope?.isRunning) {
            this.animationTime += dt * 3.0;
        }

        if (this.oscilloscope?.display) {
            this._oscFrame = (this._oscFrame + 1) % 3;
            if (this._oscFrame === 0) {
                const waveType = this.generator.buttons.activeWaveform;
                const voltsPerDiv = this.oscilloscope.getVoltsPerDiv();
                const periodsToShow = this.oscilloscope.getPeriodsToShow();
                this.oscilloscope.display.isRunning = this.oscilloscope.isRunning;
                this.oscilloscope.display.draw(
                    Em, displayAmp, displayPhase, f,
                    ch2Label,
                    hasCH1,
                    this.oscilloscope.showCH1,
                    this.oscilloscope.showCH2,
                    this.oscilloscope.showMeasurements,
                    this.animationTime, this.oscilloscope.autoScale,
                    voltsPerDiv, periodsToShow, waveType
                );
            }
        }

        this.reading = {
            isGenOn: !!isGenOn,
            hasCH1,
            ch2: ch2Label,
            ch2Detected,
            probeOverride: this.probeOverride,
            f, Em, R, L, C,
            UCm: res.UCm,
            ULm: res.ULm,
            URm: res.URm,
            ULCm: res.ULCm,
            Im: res.Im,
            Z: res.Z,
            XL: res.XL,
            XC: res.XC,
            psi: res.psi,
            psiLC: res.psiLC,
            Q: res.Q,
            isCircuitValid,
            speakerSignal,
            speakerGround,
            rlcToSpeaker,
            waveform: this.generator.buttons?.activeWaveform ?? null,
        };
    }
}