import {
  ArcRotateCamera,
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

const NODES = 60;

/** 3D level-select map: a winding trail of level stones. Drag to scroll, tap to play. */
export class MapView {
  readonly scene: Scene;
  private camera: ArcRotateCamera;
  private nodes: Mesh[] = [];
  private mats: Record<"done" | "current" | "locked", StandardMaterial>;
  private downY = 0;
  private downTarget = 0;
  private dragging = false;
  private moved = false;
  private t = 0;
  onSelectLevel: (index: number) => void = () => {};
  unlockedIndex = 0;

  constructor(engine: Engine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.04, 0.14, 0.08, 1);
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new Color3(0.04, 0.14, 0.08);
    this.scene.fogStart = 18;
    this.scene.fogEnd = 34;

    this.camera = new ArcRotateCamera("mapCam", -Math.PI / 2, 0.85, 16, Vector3.Zero(), this.scene);
    this.camera.fov = 0.9;
    const light = new HemisphericLight("mapLight", new Vector3(0.3, 1, -0.4), this.scene);
    light.intensity = 1.0;
    light.groundColor = new Color3(0.15, 0.25, 0.15);

    const ground = MeshBuilder.CreateGround("mapGround", { width: 30, height: NODES * 2.4 + 40 }, this.scene);
    ground.position.z = NODES * 1.2;
    const gm = new StandardMaterial("groundMat", this.scene);
    gm.diffuseColor = Color3.FromHexString("#1e5a2c");
    gm.specularColor = Color3.Black();
    ground.material = gm;
    ground.isPickable = false;

    const mk = (hex: string, emissive = 0) => {
      const m = new StandardMaterial(`node-${hex}`, this.scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
      return m;
    };
    this.mats = { done: mk("#e9c46a", 0.25), current: mk("#7fff6a", 0.5), locked: mk("#5d6b60") };

    const pathMat = new StandardMaterial("pathMat", this.scene);
    pathMat.diffuseColor = Color3.FromHexString("#8a6a3c");
    pathMat.specularColor = Color3.Black();
    const leafMat = new StandardMaterial("leafMat", this.scene);
    leafMat.diffuseColor = Color3.FromHexString("#2f8a3a");

    for (let i = 0; i < NODES; i++) {
      const pos = this.nodePos(i);
      if (i > 0) {
        const prev = this.nodePos(i - 1);
        for (let k = 1; k < 4; k++) {
          const dot = MeshBuilder.CreateCylinder(`path${i}-${k}`, { height: 0.06, diameter: 0.35, tessellation: 10 }, this.scene);
          dot.position = Vector3.Lerp(prev, pos, k / 4);
          dot.material = pathMat;
          dot.isPickable = false;
        }
      }
      const node = MeshBuilder.CreateCylinder(`node${i}`, { height: 0.35, diameter: 1.3, tessellation: 28 }, this.scene);
      node.position = pos;
      node.metadata = { index: i };
      this.nodes.push(node);

      const label = MeshBuilder.CreatePlane(`label${i}`, { size: 0.9 }, this.scene);
      const tex = new DynamicTexture(`labelTex${i}`, { width: 128, height: 128 }, this.scene, false);
      tex.hasAlpha = true;
      tex.drawText(String(i + 1), null, 88, "bold 72px Trebuchet MS", "#1b1b1b", "transparent", true);
      const lm = new StandardMaterial(`labelMat${i}`, this.scene);
      lm.diffuseTexture = tex;
      lm.emissiveColor = Color3.White();
      lm.useAlphaFromDiffuseTexture = true;
      lm.disableLighting = true;
      label.material = lm;
      label.rotation.x = Math.PI / 2;
      label.position = pos.add(new Vector3(0, 0.19, 0));
      label.isPickable = false;

      // Decorative plants either side of the trail.
      if (i % 2 === 0) {
        const side = pos.x > 0 ? -1 : 1;
        const plant = MeshBuilder.CreateCylinder(`plant${i}`, { height: 1.2 + (i % 3) * 0.3, diameterTop: 0, diameterBottom: 0.8, tessellation: 7 }, this.scene);
        plant.position = new Vector3(pos.x + side * (3 + (i % 3)), 0.6, pos.z + 0.6);
        plant.material = leafMat;
        plant.isPickable = false;
      }
    }

    this.scene.onBeforeRenderObservable.add(() => {
      this.t += this.scene.getEngine().getDeltaTime() / 1000;
      const cur = this.nodes[this.unlockedIndex];
      if (cur) cur.position.y = this.nodePos(this.unlockedIndex).y + Math.sin(this.t * 3) * 0.08;
    });
    this.setupInput();
  }

  private nodePos(i: number): Vector3 {
    return new Vector3(Math.sin(i * 0.8) * 2.6, 0.18, i * 2.4);
  }

  private setupInput(): void {
    this.scene.onPointerObservable.add((info) => {
      const e = info.event as PointerEvent;
      if (info.type === PointerEventTypes.POINTERDOWN) {
        this.dragging = true;
        this.moved = false;
        this.downY = e.clientY;
        this.downTarget = this.camera.target.z;
      } else if (info.type === PointerEventTypes.POINTERMOVE && this.dragging) {
        const dy = e.clientY - this.downY;
        if (Math.abs(dy) > 8) this.moved = true;
        this.setTargetZ(this.downTarget + dy * 0.03);
      } else if (info.type === PointerEventTypes.POINTERUP) {
        this.dragging = false;
        if (this.moved) return;
        const hit = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (m) => m.metadata?.index !== undefined);
        const idx = hit?.pickedMesh?.metadata?.index as number | undefined;
        if (idx !== undefined && idx <= this.unlockedIndex) this.onSelectLevel(idx);
      }
    });
  }

  private setTargetZ(z: number): void {
    this.camera.target = new Vector3(0, 0, Math.max(0, Math.min(NODES * 2.4, z)));
  }

  /** Refresh node colors and focus the camera on the current level. */
  refresh(unlockedIndex: number): void {
    this.unlockedIndex = Math.min(unlockedIndex, NODES - 1);
    this.nodes.forEach((n, i) => {
      n.material = i < this.unlockedIndex ? this.mats.done : i === this.unlockedIndex ? this.mats.current : this.mats.locked;
      n.position.y = this.nodePos(i).y;
    });
    this.setTargetZ(this.nodePos(this.unlockedIndex).z + 2);
  }
}
