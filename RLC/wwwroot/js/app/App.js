import { SceneSetup } from '../core/SceneSetup.js';
import { InputRouter } from '../core/InputRouter.js';
import { RenderLoop } from '../core/RenderLoop.js';
import { TerminalRegistry } from '../core/TerminalRegistry.js';
import { ModelLoader } from '../loaders/ModelLoader.js';
import { GeneratorDevice } from '../devices/generator/GeneratorDevice.js';
import { RLCBoard } from '../devices/rlc/RLCBoard.js';
import { OscilloscopeDevice } from '../devices/oscilloscope/OscilloscopeDevice.js';
import { CableManager } from '../cables/CableManager.js';
import { TerminalSelector } from '../cables/TerminalSelector.js';
import { STATIC_MODELS } from '../config/models.js';
import { resolveSnap } from '../config/snapPresets.js';
import { CollisionWorld } from '../cables/CollisionWorld.js';
import { SimulationManager } from './SimulationManager.js';

export class App {
    async boot() {
        const scene = new SceneSetup();
        const registry = new TerminalRegistry();
        const loader = new ModelLoader();
        const input = new InputRouter(scene);
        const loop = new RenderLoop(scene);

        const S = 18;

        // 1. Генератор
        const generator = new GeneratorDevice({
            scene: scene.scene, renderer: scene.renderer, camera: scene.camera,
            controls: scene.controls, registry, loader,
            position: { x: -35, y: -1.4, z: 0.0 },
        });
        await generator.load();
        generator.model.scale.setScalar(S);

        // 2. Плата RLC
        const rlcBoard = new RLCBoard({
            scene: scene.scene, renderer: scene.renderer, camera: scene.camera,
            controls: scene.controls, registry, loader,
            position: { x: 3.3, y: -1.0, z: 18.0 },
        });
        await rlcBoard.load();
        rlcBoard.model.scale.setScalar(S);

        // 3. Осциллограф
        const oscilloscope = new OscilloscopeDevice({
            scene: scene.scene, renderer: scene.renderer, camera: scene.camera,
            controls: scene.controls, registry, loader,
            position: { x: -1.4, y: -1.4, z: -11.6 },
        });
        await oscilloscope.load();
        oscilloscope.model.scale.setScalar(S);

        // 4. Динамик
        let speakerModel = null;
        const otherModels = STATIC_MODELS.filter(m => !m.path.includes('RLC') && !m.path.includes('Oscillator'));
        for (const cfg of otherModels) {
            const model = await loader.load(cfg);
            scene.scene.add(model);
            if (cfg.path.includes('Dynamic')) {
                speakerModel = model;
                speakerModel.position.set(25.3, -1.5, 0.0);
                speakerModel.scale.setScalar(S);
            }

            for (const t of cfg.terminals) {
                registry.registerMany(loader.findTerminals(model, t.names), resolveSnap(t.snap));
            }
        }

        // 5. Боксы коллизий. Только после scale и position: размер берётся из уже стоящей модели.
        const collisionWorld = new CollisionWorld({ floorY: -1.5, pinIgnoreRadius: 1.6 });
        collisionWorld.addObject(generator.model, 'Генератор');
        collisionWorld.addObject(rlcBoard.model, 'RLC');
        collisionWorld.addObject(oscilloscope.model, 'Осциллограф');
        if (speakerModel) collisionWorld.addObject(speakerModel, 'Динамик');

        // 6. Менеджер кабелей
        const cableManager = new CableManager({
            scene: scene.scene, camera: scene.camera, controls: scene.controls, registry,
            collisionWorld,
        });

        // 7. Селектор клемм
        const terminalSelector = new TerminalSelector(
            scene.scene, scene.camera, registry, cableManager
        );

        input.handlers = [cableManager, terminalSelector, generator, rlcBoard, oscilloscope];

        const simManager = new SimulationManager(generator, rlcBoard, oscilloscope, cableManager);

        loop.add(cableManager);
        loop.add(simManager);
        loop.start();

        document.body.appendChild(scene.canvas);
        window.devices = { generator, rlcBoard, cableManager, oscilloscope, simManager, collisionWorld };
        await cableManager.setupStandardCircuit();

        try {
            const { UIManager } = await import('../ui/UIManager.js');
            const ui = new UIManager({ generator, rlcBoard, oscilloscope, cableManager, simManager });
            ui.mount(document.body);
            window.devices.ui = ui;
        } catch (err) {
            console.error('Панель лаборатории не запустилась', err);
        }

        await Promise.race([
            loop.waitForFrame(),
            new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }
}