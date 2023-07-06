import {
    ArcRotateCamera,
    Color3,
    Color4,
    CreateBox,
    CreateGround,
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
    Plane,
    RefractionTexture,
    Scene,
    StandardMaterial,
    Vector3,
    WebGPUEngine,
} from '@babylonjs/core';
import seedrandom from 'seedrandom';
import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '../assets/HavokPhysics.wasm?url';

import "pepjs";

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
            0.1,
            Math.PI / 2.2,
            40,
            Vector3.Zero(),
            scene
        );
        // camera.useAutoRotationBehavior = true;
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
            sphere.scaling = new Vector3(0.5, 0.5, 0.5);
            sphere.material = ballMaterial;
            const aggregate = new PhysicsAggregate(
                sphere,
                PhysicsShapeType.SPHERE,
                {
                    mass: 0.5,
                    restitution: 0.6,
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
        createWalls(scene);
        createPins(scene, prng);

        const userInputManager = new UserInputManager(engine);
        userInputManager.onLeftClickedObservable.add(() => {
            spawnSphere(new Vector3(0, 14, -3));
        });
        userInputManager.onCenterClickedObservable.add(() => {
            spawnSphere(new Vector3(0, 14, 0));
        });
        userInputManager.onRightClickedObservable.add(() => {
            spawnSphere(new Vector3(0, 14, 3));
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

    const ground = CreateGround('Ground', { width: 2, height: 10 }, scene);
    ground.position.y = -15;
    new PhysicsAggregate(
        ground,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene
    );

    const wallMaterial = new StandardMaterial('WallMat', scene);
    wallMaterial.diffuseColor = new Color3(1.0, 0.5, 0.5);
    const backgroundWall = CreateBox('BackgroundWall', { height: 30, depth: 1, width: 1 });
    backgroundWall.scaling.z = 10;
    backgroundWall.position.x = -1;
    backgroundWall.material = wallMaterial;
    new PhysicsAggregate(
        backgroundWall,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const leftWall = CreateBox('LeftWall', { height: 30, depth: 1, width: 1 });
    leftWall.scaling.z = 0.5;
    leftWall.scaling.x = 2;
    leftWall.position.z = -5;
    leftWall.material = wallMaterial;
    new PhysicsAggregate(
        leftWall,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const rightWall = CreateBox('RightWall', { height: 30, depth: 1, width: 1 });
    rightWall.scaling.z = 0.5;
    rightWall.scaling.x = 2;
    rightWall.position.z = 5;
    rightWall.material = wallMaterial;
    new PhysicsAggregate(
        rightWall,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const frontGlass = CreateBox('FrontGlass', { height: 30, depth: 1, width: 1 });
    frontGlass.scaling.z = 9.5;
    frontGlass.position.x = 0.5;
    new PhysicsAggregate(
        frontGlass,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const wall1 = CreateBox('Wall1', { height: 30, depth: 1, width: 1 });
    wall1.scaling.z = 0.1;
    wall1.scaling.x = 2;
    wall1.position.z = -1.5;
    wall1.material = wallMaterial;
    new PhysicsAggregate(
        wall1,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const wall2 = CreateBox('Wall2', { height: 30, depth: 1, width: 1 });
    wall2.scaling.z = 0.1;
    wall2.scaling.x = 2;
    wall2.position.z = 1.5;
    wall2.material = wallMaterial;
    new PhysicsAggregate(
        wall2,
        PhysicsShapeType.BOX,
        {
            mass: 0.0,
        },
        scene,
    );
    const refractionMaterial = new StandardMaterial("refraction", scene);
    refractionMaterial.diffuseColor = new Color3(1, 1, 1);
    const refractionTexture = new RefractionTexture("refraction", 1024, scene, true);
    refractionTexture.refractionPlane = new Plane(0, 0, -1, 0);
    refractionTexture.renderList = [backgroundWall, leftWall, rightWall];
    refractionTexture.depth = 5;
    refractionMaterial.refractionTexture = refractionTexture;
    refractionMaterial.indexOfRefraction = 0.5;
    refractionMaterial.alpha = 0.5;
    frontGlass.material = refractionMaterial;
}

function getRandomVector3(prng: seedrandom.PRNG, rangeX: number, rangeY: number, rangeZ: number): Vector3 {
    return new Vector3(
        (prng.double() * (rangeX / 2)) - rangeX / 2,
        (prng.double() * (rangeY / 2)) - rangeY / 2,
        (prng.double() * (rangeZ / 2)) - rangeZ / 2,
    );
}

function createPins(scene: Scene, prng: seedrandom.PRNG): void {
    const count = (prng.double() * 10.0);

    const baseSphere = CreateSphere('BaseSphere', {}, scene);
    baseSphere.scaling = new Vector3(0.2, 0.2, 0.2);
    baseSphere.setEnabled(false);

    for (let i = 0; i < count; i++) {
        const instance = baseSphere.createInstance(`pin${i}`);
        instance.setEnabled(true);
        instance.position = getRandomVector3(prng, 10, 10, 0);
        new PhysicsAggregate(
            instance,
            PhysicsShapeType.SPHERE,
            {
                mass: 0.0,
                restitution: 1,
            },
        );
    }
}