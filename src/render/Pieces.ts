import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";

// Procedural 3D models for each piece kind. Built once as hidden templates and
// cloned per piece. Each is several primitives merged into one mesh.

function mat(scene: Scene, name: string, hex: string, opts: { alpha?: number; emissive?: number; spec?: number } = {}) {
  const m = new StandardMaterial(name, scene);
  const c = Color3.FromHexString(hex);
  m.diffuseColor = c;
  m.specularColor = new Color3(1, 1, 1).scale(opts.spec ?? 0.4);
  m.specularPower = 64;
  if (opts.alpha !== undefined) m.alpha = opts.alpha;
  if (opts.emissive) m.emissiveColor = c.scale(opts.emissive);
  return m;
}

function merge(name: string, parts: Mesh[]): Mesh {
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true)!;
  merged.name = name;
  return merged;
}

function bud(s: Scene): Mesh {
  const green = mat(s, "bud-green", "#3e9b3a", { spec: 0.15 });
  const dark = mat(s, "bud-dark", "#2b6e2a", { spec: 0.1 });
  const hair = mat(s, "bud-hair", "#e8862e", { emissive: 0.3 });
  const frost = mat(s, "bud-frost", "#eef7e6", { emissive: 0.4 });
  const parts: Mesh[] = [];
  const core = MeshBuilder.CreateIcoSphere("c", { radius: 0.26, subdivisions: 2, flat: true }, s);
  core.scaling = new Vector3(0.9, 1.25, 0.9);
  core.material = green;
  parts.push(core);
  const nubs: Array<[number, number, number]> = [[0.17, 0.12, 0], [-0.16, 0.05, 0.06], [0.04, -0.18, -0.15], [0, 0.26, 0.1], [-0.05, -0.05, 0.2]];
  nubs.forEach(([x, y, z], i) => {
    const n = MeshBuilder.CreateIcoSphere(`n${i}`, { radius: 0.13, subdivisions: 1, flat: true }, s);
    n.position = new Vector3(x, y, z);
    n.material = i % 2 ? dark : green;
    parts.push(n);
  });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const h = MeshBuilder.CreateCylinder(`h${i}`, { height: 0.16, diameter: 0.025, tessellation: 4 }, s);
    h.position = new Vector3(Math.cos(a) * 0.22, Math.sin(i * 1.7) * 0.2, Math.sin(a) * 0.22);
    h.rotation = new Vector3(a, 0, a * 0.7);
    h.material = hair;
    parts.push(h);
  }
  for (let i = 0; i < 6; i++) {
    const f = MeshBuilder.CreateSphere(`f${i}`, { diameter: 0.04, segments: 4 }, s);
    f.position = new Vector3(Math.cos(i * 2.1) * 0.27, Math.sin(i * 1.3) * 0.25, Math.sin(i * 2.1) * -0.27);
    f.material = frost;
    parts.push(f);
  }
  return merge("bud", parts);
}

function pipe(s: Scene): Mesh {
  const glass = mat(s, "pipe-glass", "#4fd2e8", { alpha: 0.7, spec: 1, emissive: 0.15 });
  const swirl = mat(s, "pipe-swirl", "#d94fe8", { emissive: 0.25 });
  const ash = mat(s, "pipe-ash", "#3d6b32");
  const bowl = MeshBuilder.CreateSphere("bowl", { diameter: 0.36, segments: 16 }, s);
  bowl.position.x = -0.16;
  bowl.material = glass;
  const stem = MeshBuilder.CreateCylinder("stem", { height: 0.56, diameterTop: 0.1, diameterBottom: 0.16, tessellation: 16 }, s);
  stem.rotation.z = Math.PI / 2;
  stem.position.x = 0.14;
  stem.material = glass;
  const band = MeshBuilder.CreateTorus("band", { diameter: 0.3, thickness: 0.05, tessellation: 20 }, s);
  band.rotation.z = Math.PI / 2;
  band.position.x = -0.16;
  band.material = swirl;
  const fill = MeshBuilder.CreateCylinder("fill", { height: 0.06, diameter: 0.18, tessellation: 12 }, s);
  fill.position = new Vector3(-0.16, 0.15, 0);
  fill.material = ash;
  return merge("pipe", [bowl, stem, band, fill]);
}

function bong(s: Scene): Mesh {
  const glass = mat(s, "bong-glass", "#9b5de5", { alpha: 0.65, spec: 1, emissive: 0.15 });
  const water = mat(s, "bong-water", "#5fd0c8", { alpha: 0.8, emissive: 0.2 });
  const metal = mat(s, "bong-metal", "#c9ccd1", { spec: 1 });
  const base = MeshBuilder.CreateSphere("base", { diameter: 0.46, segments: 16 }, s);
  base.scaling.y = 0.75;
  base.position.y = -0.24;
  base.material = glass;
  const wat = MeshBuilder.CreateSphere("water", { diameter: 0.38, segments: 12, slice: 0.5 }, s);
  wat.rotation.x = Math.PI;
  wat.scaling.y = 0.6;
  wat.position.y = -0.26;
  wat.material = water;
  const tube = MeshBuilder.CreateCylinder("tube", { height: 0.62, diameter: 0.18, tessellation: 16 }, s);
  tube.position.y = 0.16;
  tube.material = glass;
  const lip = MeshBuilder.CreateTorus("lip", { diameter: 0.2, thickness: 0.04, tessellation: 20 }, s);
  lip.position.y = 0.47;
  lip.material = glass;
  const down = MeshBuilder.CreateCylinder("down", { height: 0.26, diameter: 0.05, tessellation: 8 }, s);
  down.rotation.z = -0.9;
  down.position = new Vector3(0.18, -0.12, 0);
  down.material = metal;
  const slide = MeshBuilder.CreateCylinder("slide", { height: 0.08, diameterTop: 0.12, diameterBottom: 0.05, tessellation: 12 }, s);
  slide.position = new Vector3(0.28, -0.04, 0);
  slide.material = metal;
  return merge("bong", [base, wat, tube, lip, down, slide]);
}

function lighter(s: Scene): Mesh {
  const body = mat(s, "lighter-body", "#e2402a", { spec: 0.8 });
  const metal = mat(s, "lighter-metal", "#cfd3d8", { spec: 1 });
  const flame = mat(s, "lighter-flame", "#ffb13b", { emissive: 1, alpha: 0.9 });
  const b = MeshBuilder.CreateBox("body", { width: 0.32, height: 0.56, depth: 0.18 }, s);
  b.position.y = -0.06;
  b.material = body;
  const cap = MeshBuilder.CreateBox("cap", { width: 0.32, height: 0.12, depth: 0.18 }, s);
  cap.position.y = 0.28;
  cap.material = metal;
  const wheel = MeshBuilder.CreateCylinder("wheel", { height: 0.1, diameter: 0.1, tessellation: 12 }, s);
  wheel.rotation.x = Math.PI / 2;
  wheel.position = new Vector3(-0.06, 0.37, 0);
  wheel.material = metal;
  const f = MeshBuilder.CreateSphere("flame", { diameter: 0.1, segments: 8 }, s);
  f.scaling.y = 1.8;
  f.position = new Vector3(0.06, 0.45, 0);
  f.material = flame;
  return merge("lighter", [b, cap, wheel, f]);
}

function papers(s: Scene): Mesh {
  const paper = mat(s, "papers-paper", "#f3ead2", { spec: 0.1 });
  const cover = mat(s, "papers-cover", "#d9772b", { spec: 0.3 });
  const leaf = mat(s, "papers-leaf", "#3fbf4a", { emissive: 0.3 });
  const book = MeshBuilder.CreateBox("book", { width: 0.62, height: 0.4, depth: 0.08 }, s);
  book.material = cover;
  const sheet = MeshBuilder.CreateBox("sheet", { width: 0.56, height: 0.18, depth: 0.012 }, s);
  sheet.position = new Vector3(0, 0.24, -0.02);
  sheet.rotation.x = -0.25;
  sheet.material = paper;
  const logo = MeshBuilder.CreateDisc("logo", { radius: 0.09, tessellation: 5 }, s);
  logo.position = new Vector3(0, -0.02, -0.045);
  logo.material = leaf;
  return merge("papers", [book, sheet, logo]);
}

function jar(s: Scene): Mesh {
  const glass = mat(s, "jar-glass", "#e6f2f5", { alpha: 0.35, spec: 1 });
  const amber = mat(s, "jar-amber", "#f2b632", { emissive: 0.45, spec: 1 });
  const lid = mat(s, "jar-lid", "#1b1b1b", { spec: 0.6 });
  const g = MeshBuilder.CreateCylinder("glass", { height: 0.4, diameter: 0.48, tessellation: 24 }, s);
  g.material = glass;
  const a = MeshBuilder.CreateCylinder("amber", { height: 0.18, diameter: 0.4, tessellation: 24 }, s);
  a.position.y = -0.09;
  a.material = amber;
  const l = MeshBuilder.CreateCylinder("lid", { height: 0.1, diameter: 0.5, tessellation: 24 }, s);
  l.position.y = 0.25;
  l.material = lid;
  return merge("jar", [g, a, l]);
}

export function buildPieceTemplates(scene: Scene): Mesh[] {
  const builders = [bud, pipe, bong, lighter, papers, jar];
  return builders.map((b, kind) => {
    const m = b(scene);
    m.metadata = { kind };
    m.isVisible = false;
    m.isPickable = false;
    return m;
  });
}
