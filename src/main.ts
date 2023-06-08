import {
    ArcRotateCamera,
    CreateGround,
    CreateSphere,
    DirectionalLight,
    Engine,
    HavokPlugin,
    Mesh,
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

class App {
    public constructor(private readonly engine: Engine, havok: any) {
        const scene = new Scene(this.engine);
        const havokPlugin = new HavokPlugin(true, havok);
        scene.enablePhysics(new Vector3(0, -9.8, 0), havokPlugin);

        new ArcRotateCamera(
            'MainCamera',
            0,
            Math.PI / 4,
            20,
            Vector3.Zero(),
            scene
        );
        new DirectionalLight('MainLight', new Vector3(0.1, -0.5, 0.2), scene);

        function spawnSphere() {
            let sphere: Mesh|null = CreateSphere('Sphere', {}, scene);
            sphere.position = new Vector3(0, 10, 0);
            const aggregate = new PhysicsAggregate(
                sphere,
                PhysicsShapeType.SPHERE,
                {
                    mass: 2.0,
                    restitution: 0.75,
                },
                scene
            );
            aggregate.body.applyForce(new Vector3(Math.random() * 10, -1, Math.random() * 5), Vector3.Zero());

            const observer = scene.onBeforeRenderObservable.add(() => {
                if (sphere && sphere.position.y < -2) {
                    sphere.dispose();
                    sphere = null;
                    scene.onBeforeRenderObservable.remove(observer);
                }
            });
        }

        const ground = CreateGround('Ground', { width: 10, height: 10 }, scene);
        new PhysicsAggregate(
            ground,
            PhysicsShapeType.BOX,
            {
                mass: 0.0,
            },
            scene
        );

        scene.onPointerObservable.add((eventData) => {
            if (eventData.type === PointerEventTypes.POINTERUP) {
                spawnSphere();
            }
        });

        this.engine.runRenderLoop(() => {
            scene.render();
        });
        window.addEventListener('resize', () => {
            engine.resize();
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
