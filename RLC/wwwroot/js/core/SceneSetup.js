import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const PANEL = 0x1c1f26;
const FLOOR = 0x23262e;
const GRID_MAJOR = 0x3c4452;
const GRID_MINOR = 0x2a303a;

export class SceneSetup {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(PANEL);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 4.5, 11);

        this.renderer = this.#buildRenderer();
        this.controls = this.#buildControls();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.#addEnvironment();
        this.#addLights();
        this.#addFloorAndGrid();

        window.addEventListener('resize', () => this.#onResize());
    }

    get canvas() { return this.renderer.domElement; }

    updateMouse(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    #buildRenderer() {
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setClearColor(PANEL, 1);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        return renderer;
    }

    #buildControls() {
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.enableDamping = true;
        controls.target.set(0, -0.5, 0);
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        return controls;
    }

    #addEnvironment() {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.7;
    }

    #addLights() {
        // заполняющий свет, чтобы корпуса не проваливались в силуэт на тёмном фоне
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
        this.scene.add(new THREE.HemisphereLight(0xd8dee8, 0x1c1f26, 0.45));

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
        dirLight.position.set(4, 9, 6);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(2048, 2048);
        dirLight.shadow.radius = 2;
        dirLight.shadow.bias = -0.00015;
        dirLight.shadow.normalBias = 0.02;
        const cam = dirLight.shadow.camera;
        cam.near = 1;
        cam.far = 22;
        cam.left = -7;
        cam.right = 7;
        cam.top = 7;
        cam.bottom = -7;
        this.scene.add(dirLight);
    }

    #addFloorAndGrid() {
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.96, metalness: 0 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -1.5;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const gridHelper = new THREE.GridHelper(100, 100, GRID_MAJOR, GRID_MINOR);
        gridHelper.position.y = -1.49;
        this.scene.add(gridHelper);
    }

    #onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}