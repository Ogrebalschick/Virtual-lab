export class RLCPhysics {
    static calculate(f, R, L, C, Em) {
        const omega = 2 * Math.PI * f;
        const omega0 = 1 / Math.sqrt(L * C);
        const delta = R / (2 * L);

        const XL = omega * L;
        const XC = 1 / (omega * C);
        const X = XL - XC;

        const Z = Math.sqrt(R * R + X * X);
        const Im = Z > 0 ? Em / Z : 0;

        const UCm = Im * XC;
        const ULm = Im * XL;
        const URm = Im * R;
        const ULCm = Im * Math.abs(X);

        const psi = Math.atan2(2 * delta * omega, omega0 * omega0 - omega * omega);
        const psiLC = -Math.atan2(X * R, X * X);

        // Фазы для L и R (относительно ЭДС)
        // Ток отстает от ЭДС на phi. Напряжение на R совпадает с током.
        const phi = Math.atan2(X, R);
        const psiR = phi;
        // Напряжение на катушке опережает ток на 90 градусов (pi/2)
        const psiL = phi - Math.PI / 2;

        const Q = R > 0 ? (1 / R) * Math.sqrt(L / C) : 0;

        return { omega, omega0, XL, XC, Z, Im, UCm, ULCm, ULm, URm, psi, psiLC, psiR, psiL, phi, Q };
    }

    static calculateSweep(fStart, fEnd, pointsCount, R, L, C, Em) {
        const results = [];
        const step = (fEnd - fStart) / (pointsCount - 1);
        for (let i = 0; i < pointsCount; i++) {
            const f = fStart + i * step;
            const data = this.calculate(f, R, L, C, Em);
            results.push({
                f: f,
                UCm: data.UCm,
                ULCm: data.ULCm,
                psiDeg: data.psi * 180 / Math.PI
            });
        }
        return results;
    }
}