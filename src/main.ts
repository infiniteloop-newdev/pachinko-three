import {
    ArcRotateCamera,
    Color3,
    Color4,
    CreateBox,
    CreateGround,
    CreateSphere,
    DeviceSourceManager,
    DeviceType,
    DirectionalLight,
    Engine,
    HavokPlugin,
    Mesh,
    Observable,
    PBRMaterial,
    PhysicsAggregate,
    PhysicsShapeType,
    Plane,
    RefractionTexture,
    Scene,
    StandardMaterial,
    Vector3,
    WebGPUEngine,
} from '@babylonjs/core';
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

        function spawnSphere(position: Vector3) {
            let sphere: Mesh | null = CreateSphere('Sphere', {}, scene);
            sphere.position = position;
            sphere.scaling = new Vector3(0.5, 0.5, 0.5);
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

        const backgroundWall = CreateBox('BackgroundWall', { height: 30, depth: 1, width: 1 });
        backgroundWall.scaling.z = 10;
        backgroundWall.position.x = -1;
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

        const userInputManager = new UserInputManager(engine);
        userInputManager.onLeftClickedObservable.add(() => {
            spawnSphere(new Vector3(0, 15, -3));
        });
        userInputManager.onCenterClickedObservable.add(() => {
            spawnSphere(new Vector3(0, 15, 0));
        });
        userInputManager.onRightClickedObservable.add(() => {
            spawnSphere(new Vector3(0, 15, 3));
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
