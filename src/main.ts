import {
    ArcRotateCamera,
    CreateGround,
    CreateSphere,
    DirectionalLight,
    Engine,
    HavokPlugin,
    PhysicsAggregate,
    PhysicsShapeType,
    Scene,
    Vector3,
    WebGPUEngine,
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '../assets/HavokPhysics.wasm?url';

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

        const sphere = CreateSphere('Sphere', {}, scene);
        sphere.position = new Vector3(0, 10, 0);
        new PhysicsAggregate(
            sphere,
            PhysicsShapeType.SPHERE,
            {
                mass: 1.0,
                restitution: 0.75,
            },
            scene
        );
        const ground = CreateGround('Ground', { width: 10, height: 10 }, scene);
        new PhysicsAggregate(
            ground,
            PhysicsShapeType.BOX,
            {
                mass: 0.0,
            },
            scene
        );

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
