import {
    ArcRotateCamera,
    Color4,
    CreateGround,
    CreateSphere,
    DeviceSourceManager,
    DeviceType,
    DirectionalLight,
    Engine,
    HavokPlugin,
    Mesh,
    Observable,
    PhysicsAggregate,
    PhysicsShapeType,
    PointerEventTypes,
    Scene,
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

        new ArcRotateCamera(
            'MainCamera',
            0,
            Math.PI / 2.2,
            40,
            Vector3.Zero(),
            scene
        );
        new DirectionalLight('MainLight', new Vector3(0.1, -0.5, 0.2), scene);

        function spawnSphere(position: Vector3) {
            let sphere: Mesh | null = CreateSphere('Sphere', {}, scene);
            sphere.position = position;
            const aggregate = new PhysicsAggregate(
                sphere,
                PhysicsShapeType.SPHERE,
                {
                    mass: 1.0,
                    restitution: 0.75,
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
