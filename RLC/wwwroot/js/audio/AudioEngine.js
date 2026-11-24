export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.osc = null;
        this.gain = null;
        this.compressor = null;
        this.filter = null; // Фильтр для сглаживания резких звуков
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.osc = this.ctx.createOscillator();
            this.gain = this.ctx.createGain();

            // 1. ДОБАВЛЯЕМ КОМПРЕССОР (защита от перегруза на резонансе)
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.value = -24; // Порог, после которого начинается сжатие
            this.compressor.knee.value = 30;
            this.compressor.ratio.value = 12;
            this.compressor.attack.value = 0.003;
            this.compressor.release.value = 0.25;

            // 2. ДОБАВЛЯЕМ ФИЛЬТР НИЗКИХ ЧАСТОТ (чтобы квадратная волна не пищала)
            this.filter = this.ctx.createBiquadFilter();
            this.filter.type = 'lowpass';
            this.filter.frequency.value = 3000; // Срезаем всё, что выше 3 кГц
            this.filter.Q.value = 0.5;

            this.osc.type = 'sine';

            // Цепочка: Осциллятор -> Громкость -> Фильтр -> Компрессор -> Динамики
            this.osc.connect(this.gain);
            this.gain.connect(this.filter);
            this.filter.connect(this.compressor);
            this.compressor.connect(this.ctx.destination);

            this.osc.start();
            this.gain.gain.value = 0;
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setFrequency(freq) {
        if (this.osc && this.ctx) {
            // Ограничиваем частоту, чтобы не выходить за пределы слышимости
            const safeFreq = Math.max(20, Math.min(freq, 15000));
            this.osc.frequency.setTargetAtTime(safeFreq, this.ctx.currentTime, 0.05);
        }
    }

    setVolume(vol) {
        if (this.gain && this.ctx) {
            // Опустил максимальную громкость с 0.3 до 0.15 (стало в 2 раза тише и комфортнее)
            const safeVol = Math.max(0, Math.min(0.15, vol));
            this.gain.gain.setTargetAtTime(safeVol, this.ctx.currentTime, 0.05);
        }
    }

    stop() {
        this.setVolume(0);
    }

    setWaveform(waveformName) {
        if (!this.osc) return;

        if (waveformName === 'Square_Wave_New') {
            this.osc.type = 'square';
        } else if (waveformName === 'Triangle_Wave_New') {
            this.osc.type = 'triangle';
        } else {
            this.osc.type = 'sine'; // По умолчанию
        }
    }
}