import GUI from 'lil-gui';

export class DebugGUI {
    constructor(devices, cableSystem, knobController) {
        this.gui = new GUI({ title: 'Настройка сцены (Debug)' });
        this.devices = devices;
        this.cableSystem = cableSystem;

        this.params = {
            deviceScale: 9, // Теперь по умолчанию 9x
            plugScale: 9,
            cableRadius: 0.1, // Увеличим и провод

            minAngleDeg: knobController ? knobController.minAngleDeg : -115,
            maxAngleDeg: knobController ? knobController.maxAngleDeg : 110,
            axis: knobController ? knobController.axis : 'y'
        };

        // ==========================================
        // БЛОК: РАЗМЕРЫ
        // ==========================================
        const sizeFolder = this.gui.addFolder('Размеры (Scale)');

        sizeFolder.add(this.params, 'deviceScale', 1, 20, 0.1)
            .name('Размер приборов')
            .onChange(val => {
                Object.values(this.devices).forEach(dev => {
                    if (dev && dev.model) dev.model.scale.setScalar(val);
                    else if (dev && dev.scale) dev.scale.setScalar(val); // Для динамика
                });
            });

        sizeFolder.add(this.params, 'plugScale', 1, 20, 0.1)
            .name('Размер штекеров')
            .onChange(val => {
                if (this.cableSystem && this.cableSystem.cableSystem) {
                    const plugs = this.cableSystem.cableSystem.getPlugs();
                    plugs.forEach(p => p.scale.setScalar(val));

                    // Обновляем коэффициент снэппинга (базовый был 3)
                    if (this.cableSystem.dragController && this.cableSystem.dragController.snapper) {
                        this.cableSystem.dragController.snapper.dynamicScale = val / 3.0;
                    }
                }
            });

        sizeFolder.add(this.params, 'cableRadius', 0.01, 0.3, 0.001)
            .name('Толщина провода')
            .onChange(val => {
                if (this.cableSystem && this.cableSystem.cableSystem && this.cableSystem.cableSystem.cable) {
                    this.cableSystem.cableSystem.cable.radius = val;
                }
            });

        // ==========================================
        // БЛОК: ПОЛОЖЕНИЕ ПРИБОРОВ
        // ==========================================
        const posFolder = this.gui.addFolder('Положение приборов');

        // Функция для добавления ползунков позиции
        const addPositionControls = (name, device, startPos) => {
            if (!device) return;

            // Если у устройства есть .model, берем его, иначе само устройство (динамик)
            const target = device.model ? device.model : device;

            const posParams = {
                x: target.position.x,
                y: target.position.y,
                z: target.position.z
            };

            const folder = posFolder.addFolder(name);
            folder.add(posParams, 'x', -30, 30, 0.1).name('X').onChange(v => target.position.x = v);
            folder.add(posParams, 'y', -5, 10, 0.1).name('Y').onChange(v => target.position.y = v);
            folder.add(posParams, 'z', -30, 30, 0.1).name('Z').onChange(v => target.position.z = v);
        };

        // Добавляем контролы для каждого прибора
        addPositionControls('Генератор', devices.generator);
        addPositionControls('Плата RLC', devices.rlcBoard);
        addPositionControls('Осциллограф', devices.oscilloscope);
        addPositionControls('Динамик', devices.speaker);

        // ==========================================
        // БЛОК: РУЧКИ
        // ==========================================
        if (knobController) {
            const knobFolder = this.gui.addFolder('Углы ручек');
            knobFolder.add(this.params, 'minAngleDeg', -180, 0, 1).name('Мин (MIN)').onChange(v => {
                knobController.minAngleDeg = v; knobController.updateLimits();
            });
            knobFolder.add(this.params, 'maxAngleDeg', 0, 180, 1).name('Макс (MAX)').onChange(v => {
                knobController.maxAngleDeg = v; knobController.updateLimits();
            });
            knobFolder.add(this.params, 'axis', ['x', 'y', 'z']).name('Ось').onChange(v => {
                knobController.axis = v;
            });
        }

        // ==========================================
        // КНОПКА ВЫВОДА
        // ==========================================
        this.gui.add({
            print: () => {
                console.log("=== НАСТРОЙКИ (СКОПИРУЙ В App.js) ===");
                console.log(`scale: ${this.params.deviceScale},`);

                const printPos = (name, dev) => {
                    if (!dev) return;
                    const t = dev.model ? dev.model : dev;
                    console.log(`${name}: { x: ${t.position.x.toFixed(1)}, y: ${t.position.y.toFixed(1)}, z: ${t.position.z.toFixed(1)} },`);
                };

                printPos('generator', devices.generator);
                printPos('rlcBoard', devices.rlcBoard);
                printPos('oscilloscope', devices.oscilloscope);
                printPos('speaker', devices.speaker);

                console.log("========================================");
                console.log(`plugScale = ${this.params.plugScale}; cableRadius = ${this.params.cableRadius};`);
            }
        }, 'print').name('📋 Вывести код в консоль');
    }
}