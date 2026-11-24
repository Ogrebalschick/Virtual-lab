export class CircuitValidator {
    constructor() { this.currentConnections = []; }

    updateConnections(cables) {
        this.currentConnections = cables.map(c => [c.term1.name, c.term2.name]);
    }

    isCircuitClosed() {
        const hasWire = (a, b) => this.currentConnections.some(c =>
            (c[0] === a && c[1] === b) || (c[1] === a && c[0] === b)
        );

        // 1. Генератор -> RLC (Плюс и Минус)
        const genOut = hasWire('Red_Left_Clemma', 'Input_Red_Clemma');
        const genGnd = hasWire('Black_Clemma_Right', 'Input_Black_Clemma');

        // 2. RLC -> Динамик (Плюс и МИНУС)
        const rlcOut = hasWire('Output_Red_Clemma', 'Red_Clemma');
        const rlcGnd = hasWire('Output_Black_Clemma', 'Black_Clemma'); // <--- ДОБАВЛЕНО

        return genOut && genGnd && rlcOut && rlcGnd;
    }
}