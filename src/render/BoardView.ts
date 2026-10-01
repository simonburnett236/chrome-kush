import {
  ArcRotateCamera,
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PointLight,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Board, ClearedPiece, Pos } from "../game/Board";
import { PIECE_KINDS, PIECE_SPACING } from "../config";

type Tween = (dtMs: number) => boolean;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Babylon.js renderer for the board. Owns meshes, animation, smoke and input.
 * Game rules live in Board/GameSession; this class only draws and reports taps.
 */
export class BoardView {
  readonly engine: Engine;
  readonly scene: Scene;
  private camera: ArcRotateCamera;
  private templates: Mesh[] = [];
  private pieceMeshes = new Map<number, Mesh>();
  private tileMeshes: Mesh[] = [];
  private lockMeshes = new Map<string, Mesh>();
  private pickPlane!: Mesh;
  private tweens: Tween[] = [];
  private smokeTexture: DynamicTexture;
  private size = 8;
  private selected: Pos | null = null;
  private dragStart: Pos | null = null;
  private selectRing: Mesh;

  /** Set by the game: called when the player tries to swap two cells. */
  onSwapRequest: (a: Pos, b: Pos) => void = () => {};
  /** Set by the game: return false to ignore input (animating, game over). */
  canInteract: (p: Pos) => boolean = () => true;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true }, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.04, 0.12, 0.07, 1);

    this.camera = new ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 2 + 0.28, 14, Vector3.Zero(), this.scene);
    this.camera.fov = 0.8;

    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, -0.6), this.scene);
    hemi.intensity = 0.85;
    hemi.groundColor = new Color3(0.1, 0.2, 0.12);
    const point = new PointLight("key", new Vector3(-4, 6, -8), this.scene);
    point.intensity = 0.6;

    this.smokeTexture = this.makeSmokeTexture();
    this.buildTemplates();

    this.selectRing = MeshBuilder.CreateTorus("select", { diameter: 0.95, thickness: 0.06, tessellation: 32 }, this.scene);
    this.selectRing.rotation.x = Math.PI / 2;
    const ringMat = new StandardMaterial("ringMat", this.scene);
    ringMat.emissiveColor = new Color3(1, 0.85, 0.3);
    ringMat.disableLighting = true;
    this.selectRing.material = ringMat;
    this.selectRing.isVisible = false;
    this.selectRing.isPickable = false;

    this.scene.onBeforeRenderObservable.add(() => {
      const dt = this.engine.getDeltaTime();
      this.tweens = this.tweens.filter((tw) => !tw(dt));
      for (const m of this.pieceMeshes.values()) m.rotation.y += dt * 0.0009;
    });

    this.setupInput();
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", () => this.resize());
  }

  // ---------- setup ----------

  private makeSmokeTexture(): DynamicTexture {
    const tex = new DynamicTexture("smokeTex", { width: 64, height: 64 }, this.scene, false);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.5, "rgba(230,230,230,0.35)");
    g.addColorStop(1, "rgba(200,200,200,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    tex.hasAlpha = true;
    tex.update();
    return tex;
  }

  private material(name: string, hex: string, alpha = 1): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.5, 0.5, 0.5);
    m.specularPower = 48;
    m.alpha = alpha;
    return m;
  }

  /** Placeholder 3D shapes for each piece kind. Phase 2 swaps in real models. */
  private buildTemplates(): void {
    const s = this.scene;
    const make: Array<() => Mesh> = [
      () => MeshBuilder.CreateIcoSphere("bud", { radius: 0.36, subdivisions: 1, flat: true }, s),
      () => MeshBuilder.CreateTorus("pipe", { diameter: 0.55, thickness: 0.17, tessellation: 24 }, s),
      () => MeshBuilder.CreateCylinder("bong", { height: 0.78, diameterTop: 0.22, diameterBottom: 0.5, tessellation: 20 }, s),
      () => MeshBuilder.CreateBox("lighter", { width: 0.36, height: 0.68, depth: 0.22 }, s),
      () => MeshBuilder.CreateBox("papers", { width: 0.68, height: 0.44, depth: 0.07 }, s),
      () => MeshBuilder.CreateCylinder("jar", { height: 0.46, diameter: 0.52, tessellation: 24 }, s),
    ];
    PIECE_KINDS.forEach((kind, i) => {
      const mesh = make[i]();
      if (i === 1) mesh.rotation.x = Math.PI / 2.4;
      mesh.material = this.material(`mat-${kind.name}`, kind.color, i === 1 ? 0.85 : 1);
      mesh.isVisible = false;
      mesh.isPickable = false;
      this.templates.push(mesh);
    });
  }

  private setupInput(): void {
    this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERDOWN) {
        const p = this.pickCell();
        if (!p || !this.canInteract(p)) return;
        this.dragStart = p;
        if (this.selected && (Math.abs(this.selected.r - p.r) + Math.abs(this.selected.c - p.c) === 1)) {
          const a = this.selected;
          this.setSelected(null);
          this.dragStart = null;
          this.onSwapRequest(a, p);
        } else {
          this.setSelected(p);
        }
      } else if (info.type === PointerEventTypes.POINTERMOVE && this.dragStart) {
        const p = this.pickCell();
        if (!p) return;
        const a = this.dragStart;
        if (Math.abs(a.r - p.r) + Math.abs(a.c - p.c) === 1) {
          this.dragStart = null;
          this.setSelected(null);
          this.onSwapRequest(a, p);
        }
      } else if (info.type === PointerEventTypes.POINTERUP) {
        this.dragStart = null;
      }
    });
  }

  private pickCell(): Pos | null {
    const hit = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (m) => m === this.pickPlane);
    if (!hit?.hit || !hit.pickedPoint) return null;
    const half = (this.size - 1) / 2;
    const c = Math.round(hit.pickedPoint.x / PIECE_SPACING + half);
    const r = Math.round(half - hit.pickedPoint.y / PIECE_SPACING);
    if (r < 0 || c < 0 || r >= this.size || c >= this.size) return null;
    return { r, c };
  }

  private setSelected(p: Pos | null): void {
    this.selected = p;
    if (!p) {
      this.selectRing.isVisible = false;
      return;
    }
    this.selectRing.position = this.cellPos(p.r, p.c).add(new Vector3(0, 0, -0.05));
    this.selectRing.isVisible = true;
  }

  private cellPos(r: number, c: number): Vector3 {
    const half = (this.size - 1) / 2;
    return new Vector3((c - half) * PIECE_SPACING, (half - r) * PIECE_SPACING, 0);
  }

  resize(): void {
    this.engine.resize();
    const aspect = this.engine.getAspectRatio(this.camera);
    const t = Math.tan(this.camera.fov / 2);
    const boardW = this.size * PIECE_SPACING + 0.6;
    // HUD covers roughly the top and bottom 40% of the screen in portrait.
    const boardH = (this.size * PIECE_SPACING + 0.6) / 0.6;
    const distH = boardH / 2 / t;
    const distW = boardW / 2 / (t * aspect);
    this.camera.radius = Math.max(distH, distW) * 1.05;
  }

  // ---------- board building / syncing ----------

  /** Rebuild everything for a new level. */
  build(board: Board): void {
    this.size = board.size;
    for (const m of this.pieceMeshes.values()) m.dispose();
    this.pieceMeshes.clear();
    this.tileMeshes.forEach((m) => m.dispose());
    this.tileMeshes = [];
    for (const m of this.lockMeshes.values()) m.dispose();
    this.lockMeshes.clear();
    this.pickPlane?.dispose();
    this.setSelected(null);

    const tileA = this.material("tileA", "#1d4a2a", 0.9);
    const tileB = this.material("tileB", "#163d22", 0.9);
    tileA.specularColor = tileB.specularColor = new Color3(0.05, 0.05, 0.05);
    for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        if (!board.cells[r][c].active) continue;
        const tile = MeshBuilder.CreateBox(`tile-${r}-${c}`, { width: 0.96, height: 0.96, depth: 0.08 }, this.scene);
        tile.position = this.cellPos(r, c).add(new Vector3(0, 0, 0.45));
        tile.material = (r + c) % 2 ? tileA : tileB;
        tile.isPickable = false;
        this.tileMeshes.push(tile);
      }
    }

    this.pickPlane = MeshBuilder.CreatePlane("pick", { size: board.size * PIECE_SPACING + 2 }, this.scene);
    this.pickPlane.position.z = 0.3;
    this.pickPlane.visibility = 0;

    this.resize();
    for (let r = 0; r < board.size; r++)
      for (let c = 0; c < board.size; c++) {
        const p = board.cells[r][c].piece;
        if (p) this.pieceMeshes.set(p.id, this.spawnMesh(p.kind, this.cellPos(r, c)));
      }
    this.syncLocks(board);
  }

  private spawnMesh(kind: number, pos: Vector3): Mesh {
    const t = this.templates[kind];
    const m = t.clone(`piece-${kind}`)!;
    m.isVisible = true;
    m.isPickable = false;
    m.position = pos.clone();
    m.rotation.y = Math.random() * Math.PI * 2;
    return m;
  }

  private syncLocks(board: Board): void {
    const mat = this.material("lockMat", "#9aa3a8", 0.45);
    for (let r = 0; r < board.size; r++)
      for (let c = 0; c < board.size; c++) {
        const key = `${r},${c}`;
        const locked = board.cells[r][c].locked;
        const existing = this.lockMeshes.get(key);
        if (locked && !existing) {
          const cage = MeshBuilder.CreateBox(`lock-${key}`, { size: 0.9 }, this.scene);
          cage.position = this.cellPos(r, c);
          cage.material = mat;
          cage.enableEdgesRendering();
          cage.edgesWidth = 3;
          cage.edgesColor = new Color4(0.85, 0.85, 0.9, 1);
          cage.isPickable = false;
          this.lockMeshes.set(key, cage);
        } else if (!locked && existing) {
          existing.dispose();
          this.lockMeshes.delete(key);
        }
      }
  }

  private animate(ms: number, step: (t: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let elapsed = 0;
      this.tweens.push((dt) => {
        elapsed += dt;
        const t = Math.min(1, elapsed / ms);
        step(easeOutCubic(t));
        if (t >= 1) {
          resolve();
          return true;
        }
        return false;
      });
    });
  }

  private moveMesh(mesh: Mesh, to: Vector3, ms: number): Promise<void> {
    const from = mesh.position.clone();
    return this.animate(ms, (t) => (mesh.position = Vector3.Lerp(from, to, t)));
  }

  /** Move every piece mesh to its board position; new pieces drop in from above. */
  async sync(board: Board, ms = 240): Promise<void> {
    const jobs: Promise<void>[] = [];
    const newPerColumn = new Array(board.size).fill(0);
    for (let r = board.size - 1; r >= 0; r--)
      for (let c = 0; c < board.size; c++) {
        const p = board.cells[r][c].piece;
        if (!p) continue;
        const target = this.cellPos(r, c);
        let mesh = this.pieceMeshes.get(p.id);
        if (!mesh) {
          newPerColumn[c]++;
          const start = this.cellPos(-newPerColumn[c], c);
          mesh = this.spawnMesh(p.kind, start);
          this.pieceMeshes.set(p.id, mesh);
          mesh.scaling.setAll(1);
        } else if (mesh.name !== `piece-${p.kind}`) {
          // Kind changed (fallback shuffle) - replace mesh in place.
          const replacement = this.spawnMesh(p.kind, mesh.position);
          mesh.dispose();
          mesh = replacement;
          this.pieceMeshes.set(p.id, mesh);
        }
        if (!mesh.position.equalsWithEpsilon(target, 0.001)) {
          const dist = Vector3.Distance(mesh.position, target);
          jobs.push(this.moveMesh(mesh, target, ms + dist * 40));
        }
      }
    this.syncLocks(board);
    await Promise.all(jobs);
  }

  /** Shrink matched pieces into a puff of smoke. */
  async animateClear(cleared: ClearedPiece[]): Promise<void> {
    const jobs = cleared.map(({ piece }) => {
      const mesh = this.pieceMeshes.get(piece.id);
      if (!mesh) return Promise.resolve();
      this.pieceMeshes.delete(piece.id);
      this.puff(mesh.position);
      return this.animate(220, (t) => mesh.scaling.setAll(1 - t)).then(() => mesh.dispose());
    });
    await Promise.all(jobs);
  }

  /** Swap two meshes and swap back (the move was not allowed). */
  async animateInvalid(board: Board, a: Pos, b: Pos): Promise<void> {
    const pa = board.cells[a.r][a.c].piece;
    const pb = board.cells[b.r][b.c].piece;
    const ma = pa && this.pieceMeshes.get(pa.id);
    const mb = pb && this.pieceMeshes.get(pb.id);
    if (!ma || !mb) return;
    const posA = this.cellPos(a.r, a.c);
    const posB = this.cellPos(b.r, b.c);
    await Promise.all([this.moveMesh(ma, posB, 140), this.moveMesh(mb, posA, 140)]);
    await Promise.all([this.moveMesh(ma, posA, 140), this.moveMesh(mb, posB, 140)]);
  }

  private puff(at: Vector3): void {
    const ps = new ParticleSystem("smoke", 40, this.scene);
    ps.particleTexture = this.smokeTexture;
    ps.emitter = at.clone();
    ps.minEmitBox = new Vector3(-0.2, -0.2, -0.1);
    ps.maxEmitBox = new Vector3(0.2, 0.2, 0.1);
    ps.color1 = new Color4(1, 1, 1, 0.65);
    ps.color2 = new Color4(0.78, 0.78, 0.78, 0.5);
    ps.colorDead = new Color4(0.6, 0.6, 0.6, 0);
    ps.minSize = 0.3;
    ps.maxSize = 0.85;
    ps.minLifeTime = 0.5;
    ps.maxLifeTime = 1.1;
    ps.emitRate = 0;
    ps.manualEmitCount = 22;
    ps.direction1 = new Vector3(-0.4, 1, -0.3);
    ps.direction2 = new Vector3(0.4, 1.6, -0.6);
    ps.minEmitPower = 0.4;
    ps.maxEmitPower = 1.0;
    ps.gravity = new Vector3(0, 0.6, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
    // Dispose manually so the shared smoke texture is not destroyed.
    window.setTimeout(() => ps.dispose(false), 1800);
  }
}
