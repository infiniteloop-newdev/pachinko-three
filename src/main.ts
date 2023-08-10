import {
    ArcRotateCamera,
    Color3,
    Color4,
    CreateBox,
    CreateSphere,
    CubeTexture,
    DeviceSourceManager,
    DeviceType,
    DirectionalLight,
    Engine,
    HavokPlugin,
    Mesh,
    Observable,
    PBRMetallicRoughnessMaterial,
    PhysicsAggregate,
    PhysicsShapeType,
    Scene,
    StandardMaterial,
    Vector3,
    WebGPUEngine,
} from '@babylonjs/core';
import seedrandom from 'seedrandom';
import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '../assets/HavokPhysics.wasm?url';

import "pepjs";

/**
 * キーボードやマウスなどのデバイスの接続を監視し、左クリック、中央クリック、右クリックなどの入力イベントを処理します。
 * また、このクラスは、Observable クラスを使用して、各入力イベントに対する観察者を登録することができます。
 */
class UserInputManager {
    public readonly deviceSourceManager: DeviceSourceManager;
    public readonly onLeftClickedObservable: Observable<null>;
    public readonly onCenterClickedObservable: Observable<null>;
    public readonly onRightClickedObservable: Observable<null>;

    public constructor(engine: Engine) {
        this.deviceSourceManager = new DeviceSourceManager(engine);
        this.onLeftClickedObservable = new Observable();
        this.onCenterClickedObservable = new Observable();
        this.onRightClickedObservable = new Observable();

        this.deviceSourceManager.onDeviceConnectedObservable.add((device) => {
            switch (device.deviceType) {
                case DeviceType.Keyboard:
                    device.onInputChangedObservable.add((keyboard) => {
                        if (keyboard.metaKey) {
                            return;
                        }

                        if (keyboard.type === 'keyup') {
                            switch (keyboard.code) {
                                case 'KeyA':
                                case 'ArrowLeft':
                                    this.onLeftClickedObservable.notifyObservers(null, undefined, keyboard, device);
                                    break;
                                case 'KeyS':
                                case 'KeyW':
                                case 'ArrowUp':
                                case 'ArrowDown':
                                    this.onCenterClickedObservable.notifyObservers(null, undefined, keyboard, device);
                                    break;
                                case 'KeyD':
                                case 'ArrowRight':
                                    this.onRightClickedObservable.notifyObservers(null, undefined, keyboard, device);
                                    break;
                            }
                        }
                    });
                    break;
                case DeviceType.Mouse:
                    break;
                case DeviceType.Touch:
                    break;
                default:
                    // TODO: implementation
                    return;
            }
        });
    }

    public dispose(): void {
        this.deviceSourceManager.dispose();
        this.onLeftClickedObservable.cancelAllCoroutines();
        this.onLeftClickedObservable.clear();
        this.onCenterClickedObservable.cancelAllCoroutines();
        this.onCenterClickedObservable.clear();
        this.onRightClickedObservable.cancelAllCoroutines();
        this.onRightClickedObservable.clear();
    }
}

class App {
    public constructor(private readonly engine: Engine, havok: any) {
        const scene = new Scene(this.engine);
        scene.clearColor = new Color4(100 / 255, 149 / 255, 237 / 255, 1);
        const havokPlugin = new HavokPlugin(true, havok);
        scene.enablePhysics(new Vector3(0, -9.8, 0), havokPlugin);

        const camera = new ArcRotateCamera(
            'MainCamera',
            Math.PI / 16,
            Math.PI / 4.2,
            40,
            Vector3.Zero(),
            scene
        );
        // camera.attachControl(true);
        camera.useAutoRotationBehavior = false;
        new DirectionalLight('MainLight', new Vector3(-1, -0.5, 1).normalize(), scene);

        // from https://playground.babylonjs.com/#2FDQT5#2313
        const ballMaterial = new PBRMetallicRoughnessMaterial('BallMat', scene);

        ballMaterial.baseColor = new Color3(1.0, 0.766, 0.336);
        ballMaterial.metallic = 1.0;
        ballMaterial.roughness = 0.1;
        ballMaterial.environmentTexture = CubeTexture.CreateFromPrefilteredData('https://playground.babylonjs.com/textures/environment.dds', scene);

        function spawnSphere(position: Vector3) {
            let sphere: Mesh | null = CreateSphere('Sphere', {}, scene);
            sphere.position = position;
            sphere.material = ballMaterial;
            const aggregate = new PhysicsAggregate(
                sphere,
                PhysicsShapeType.SPHERE,
                {
                    mass: 0.7,
                    restitution: 0.7,
                },
                scene
            );
            aggregate.body.applyForce(new Vector3(Math.random() * 10, -1, Math.random() * 5), Vector3.Zero());

            const observer = scene.onBeforeRenderObservable.add(() => {
                if (sphere && sphere.position.y < -25) {
                    sphere.dispose();
                    sphere = null;
                    scene.onBeforeRenderObservable.remove(observer);
                }
            });
        }

        const seed = Math.random();
        const prng = seedrandom(seed.toString());
        console.log('seed is ', seed);
        createWalls(scene);
        createPins(scene, prng);
        createGoalPins(scene, new Vector3(0, -13, 0));
        createGoalPins(scene, new Vector3(0, -13, -3.2));
        createGoalPins(scene, new Vector3(0, -13, 3.2));

        const userInputManager = new UserInputManager(engine);
        userInputManager.onLeftClickedObservable.add(() => {
            spawnSphere(new Vector3(-19, 4, 6.6));
        });
        userInputManager.onCenterClickedObservable.add(() => {
            spawnSphere(new Vector3(-19, 4, 0));
        });
        userInputManager.onRightClickedObservable.add(() => {
            spawnSphere(new Vector3(-19, 4, -6.6));
        });

        this.engine.runRenderLoop(() => {
            scene.render();
        });
        window.addEventListener('resize', () => {
            engine.resize();
        });
        this.engine.onDisposeObservable.addOnce(() => {
            userInputManager.dispose();
        });
    }

    public static async createAsync(canvas: HTMLCanvasElement): Promise<App> {
        const havok = await HavokPhysics({
            locateFile: () => havokWasmUrl,
        });
        if (await WebGPUEngine.IsSupportedAsync) {
            const engine = new WebGPUEngine(canvas, {
                adaptToDeviceRatio: true,
                antialias: true,
            });
            await engine.initAsync();
            return new App(engine, havok);
        } else if (Engine.IsSupported) {
            return new App(
                new Engine(canvas, true, {
                    adaptToDeviceRatio: true,
                    antialias: true,
                    disableWebGL2Support: false,
                }),
                havok
            );
        }
        throw new Error('Engine cannot be created.');
    }
}

window.addEventListener('load', () => {
    const canvas = document.getElementById(
        'renderCanvas'
    ) as HTMLCanvasElement | null;
    if (!canvas) {
        throw new Error('Undefined #renderCanvas');
    }

    App.createAsync(canvas);
});

function createWalls(scene: Scene): void {
    const wallMaterial = new StandardMaterial('WallMat', scene);
    wallMaterial.diffuseColor = new Color3(1.0, 0.5, 0.5);
    const backgroundWall = CreateBox('BackgroundWall', { height: 40, depth: 1, width: 0.1 });
    backgroundWall.rotation.z = Math.PI / 2.2;
    backgroundWall.scaling.z = 20;
    backgroundWall.material = wallMaterial;
    new PhysicsAggregate(
        backgroundWall,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const leftWall = CreateBox('LeftWall', { height: 12, depth: 1, width: 10 });
    leftWall.scaling.x = 4;
    leftWall.scaling.z = 0.5;
    leftWall.position.z = -10;
    leftWall.material = wallMaterial;
    new PhysicsAggregate(
        leftWall,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const rightWall = CreateBox('RightWall', { height: 12, depth: 1, width: 10 });
    rightWall.scaling.x = 4;
    rightWall.scaling.z = 0.5;
    rightWall.position.z = 10;
    rightWall.material = wallMaterial;
    new PhysicsAggregate(
        rightWall,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const frontGlass = CreateBox('FrontGlass', { height: 40, depth: 1, width: 0.1 });
    frontGlass.rotation.z = Math.PI / 2.2;
    frontGlass.scaling.z = 20;
    frontGlass.position.y = 3;
    const frontGlassMaterial = wallMaterial.clone('FrontGlassMat');
    frontGlassMaterial.alpha = 0.2;
    frontGlass.material = frontGlassMaterial;
    new PhysicsAggregate(
        frontGlass,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const wall1 = CreateBox('Wall1', { height: 12, depth: 1, width: 1 });
    wall1.scaling.z = 0.1;
    wall1.scaling.x = 40;
    wall1.position.z = -3.33;
    wall1.material = wallMaterial;
    new PhysicsAggregate(
        wall1,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const wall2 = CreateBox('Wall2', { height: 12, depth: 1, width: 1 });
    wall2.scaling.z = 0.1;
    wall2.scaling.x = 40;
    wall2.position.z = 3.33;
    wall2.material = wallMaterial;
    new PhysicsAggregate(
        wall2,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
}

/**
 * Returns a random number between the specified range.
 * @param {seedrandom.PRNG} prng - The seeded pseudo-random number generator.
 * @param {number} from - The minimum value of the range.
 * @param {number} to - The maximum value of the range.
 * @returns {number} A random number between the specified range.
 */
function getRandomFromTo(prng: seedrandom.PRNG, from: number, to: number): number {
    return (prng.double() * (to - from)) + from;
}

/**
 * Creates a set of pins in the scene using a base sphere mesh and random positions.
 * @param scene - The scene to add the pins to.
 * @param prng - The pseudorandom number generator to use for generating random positions.
 */
function createPins(scene: Scene, prng: seedrandom.PRNG): void {
    const count = 70;

    const baseSphere = CreateSphere('BaseSphere', {}, scene);
    baseSphere.scaling = new Vector3(0.2, 0.2, 0.2);
    baseSphere.setEnabled(false);

    for (let i = 0; i < count; i++) {
        const instance = baseSphere.createInstance(`pin${i}`);
        instance.setEnabled(true);
        const x = getRandomFromTo(prng, -20, 20);
        const y = (40 - x) * 0.145 - 5;
        const z = getRandomFromTo(prng, -10, 10);
        instance.position = new Vector3(x, y, z);
        new PhysicsAggregate(
            instance,
            PhysicsShapeType.SPHERE,
            {
                mass: 0.0,
                restitution: 0.8,
            },
        );
    }
}

function createGoalPins(scene: Scene, centerPos: Vector3): void {
    const baseSphere = CreateSphere('BaseSphere', {}, scene);
    baseSphere.scaling = new Vector3(0.2, 0.2, 0.2);
    baseSphere.setEnabled(false);

    const goal = [
        { x: 0, y: 0.5, z: 0.35 },
        { x: 0, y: 0.8, z: 0.3 },
        { x: 0, y: 1.1, z: 0.25 },
        { x: 0, y: 0.5, z: -0.35 },
        { x: 0, y: 0.8, z: -0.3 },
        { x: 0, y: 1.1, z: -0.25 },
    ];

    goal.forEach((pos, i) => {
        const instance = baseSphere.createInstance(`goalPin${i}`);
        instance.setEnabled(true);
        instance.position = new Vector3(
            centerPos.x + pos.x,
            centerPos.y + pos.y,
            centerPos.z + pos.z,
        );
        new PhysicsAggregate(
            instance,
            PhysicsShapeType.SPHERE,
            {
                mass: 0.0,
                restitution: 0.9,
            },
        );
    });
}