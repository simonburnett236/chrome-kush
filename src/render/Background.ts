import { Color3, Constants, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";

/** Animated backdrop: gradient wall, drifting light leaks, rising smoke rings. */
export class Background {
  private leaks: Array<{ mesh: Mesh; phase: number; speed: number; base: Vector3 }> = [];
  private rings: Array<{ mesh: Mesh; speed: number }> = [];
  private t = 0;

  constructor(scene: Scene, z = 6) {
    const wallTex = new DynamicTexture("wallTex", { width: 256, height: 512 }, scene, false);
    const ctx = wallTex.getContext() as CanvasRenderingContext2D;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#08311a");
    g.addColorStop(0.5, "#0f4a26");
    g.addColorStop(1, "#2a1a0c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 512, 2 + Math.random() * 30, 1);
    }
    wallTex.update();
    const wall = MeshBuilder.CreatePlane("wall", { width: 40, height: 60 }, scene);
    wall.position.z = z;
    const wallMat = new StandardMaterial("wallMat", scene);
    wallMat.diffuseTexture = wallTex;
    wallMat.emissiveTexture = wallTex;
    wallMat.disableLighting = true;
    wall.material = wallMat;
    wall.isPickable = false;

    const leakTex = new DynamicTexture("leakTex", { width: 128, height: 128 }, scene, false);
    const lctx = leakTex.getContext() as CanvasRenderingContext2D;
    const rg = lctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    lctx.fillStyle = rg;
    lctx.fillRect(0, 0, 128, 128);
    leakTex.hasAlpha = true;
    leakTex.update();
    const leakColors = ["#7fff6a", "#ffcf5a", "#b46aff"];
    leakColors.forEach((hex, i) => {
      const m = MeshBuilder.CreatePlane(`leak${i}`, { size: 9 }, scene);
      const lm = new StandardMaterial(`leakMat${i}`, scene);
      lm.diffuseTexture = leakTex;
      lm.opacityTexture = leakTex;
      lm.emissiveColor = Color3.FromHexString(hex);
      lm.disableLighting = true;
      lm.alpha = 0.18;
      lm.alphaMode = Constants.ALPHA_ADD;
      m.material = lm;
      m.isPickable = false;
      const base = new Vector3(-5 + i * 5, 3 - i * 3, z - 0.5);
      m.position = base.clone();
      this.leaks.push({ mesh: m, phase: i * 2, speed: 0.15 + i * 0.05, base });
    });

    const ringMat = new StandardMaterial("ringMatBg", scene);
    ringMat.emissiveColor = new Color3(0.9, 0.95, 0.9);
    ringMat.disableLighting = true;
    ringMat.alpha = 0.12;
    for (let i = 0; i < 7; i++) {
      const r = MeshBuilder.CreateTorus(`ring${i}`, { diameter: 1 + Math.random() * 1.5, thickness: 0.18, tessellation: 24 }, scene);
      r.material = ringMat;
      r.isPickable = false;
      r.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      r.position = new Vector3((Math.random() - 0.5) * 14, -12 + Math.random() * 24, z - 1);
      this.rings.push({ mesh: r, speed: 0.4 + Math.random() * 0.5 });
    }

    scene.onBeforeRenderObservable.add(() => this.update(scene.getEngine().getDeltaTime() / 1000));
  }

  private update(dt: number): void {
    this.t += dt;
    for (const l of this.leaks) {
      l.mesh.position.x = l.base.x + Math.sin(this.t * l.speed + l.phase) * 3;
      l.mesh.position.y = l.base.y + Math.cos(this.t * l.speed * 0.7 + l.phase) * 2;
    }
    for (const r of this.rings) {
      r.mesh.position.y += r.speed * dt;
      r.mesh.scaling.setAll(1 + (r.mesh.position.y + 12) * 0.03);
      if (r.mesh.position.y > 12) {
        r.mesh.position.y = -12;
        r.mesh.position.x = (Math.random() - 0.5) * 14;
      }
    }
  }
}
