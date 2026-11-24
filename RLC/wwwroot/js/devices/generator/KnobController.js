export class KnobController {
    constructor() {
        this.active = null;
        this.startY = 0;
        this.startAngle = 0;
        this.speed = 0.015;
        this.axis = 'y';

        this.minAngleDeg = -180;
        this.maxAngleDeg = 90;

        this.updateLimits();

        // Добавили ручки осциллографа
        this.KNOB_NAMES = [
            'Frequency_Button', 'Voltage_Button', 'Freq_HZ_Button', 'Amplitude_Button',
            'Volts_Div_Knob', 'Sec_Div_Knob'
        ];
    }

    updateLimits() {
        this.min = this.minAngleDeg * Math.PI / 180;
        this.max = this.maxAngleDeg * Math.PI / 180;
    }

    isKnob(name) {
        return this.KNOB_NAMES.includes(name);
    }

    start(knob, event) {
        this.active = knob;
        this.startY = event.clientY;
        this.startAngle = knob.rotation[this.axis];
    }

    move(event) {
        if (!this.active) return false;
        let newAngle = this.startAngle + ((event.clientY - this.startY) * this.speed);
        newAngle = Math.max(this.min, Math.min(this.max, newAngle));
        this.active.rotation[this.axis] = newAngle;
        return true;
    }

    end() {
        this.active = null;
    }

    getNormalizedValue(knob) {
        if (!knob) return 0;
        const currentAngle = knob.rotation[this.axis];
        let val = (currentAngle - this.min) / (this.max - this.min);
        return Math.max(0, Math.min(1, val));
    }
}