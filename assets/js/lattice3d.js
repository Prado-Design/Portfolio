/* Home hero: the lattice as a real 3D wireframe, with an optional 3D model at its centre.
 *
 * The lattice is a block of see-through planes: a stack of horizontal planes crossed by two
 * perpendicular sets of vertical planes (for 8 page columns: 5 floors, 3 + 3 walls), drawn as
 * white borders (floors are outlines only) and the lines where walls cross, with circles on
 * the horizontal planes at the crossings. It is viewed with an
 * orthographic camera (no perspective, like the original artwork) turned 45° and pitched so
 * that horizontal edges rise 0.489 column per column, exactly as in the 2D design. Every vertical edge
 * is snapped to the device pixel of the page's background column line it sits on.
 *
 * Model: set data-model on .lattice to a .glb / .gltf / .stl / .obj file, e.g.
 *   <div class="lattice" data-model="/assets/models/ovul.glb"></div>
 * Dragging side to side (or the left/right arrow keys) spins only the model, through full turns,
 * with a short coast; the grid itself stays fixed.
 * On localhost you can also drop a model file onto the lattice
 * or open /?model=/path/to/file.glb (or ?model=demo) to preview it.
 *
 * If WebGL or the module fails, the 2D lattice drawn by main.js stays in place.
 */
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const SLOPE = 0.489; // rise per column measured from the artwork = sin(camera pitch)
const PITCH = Math.asin(SLOPE);
const LINE_COLOR = 0x333333; // matches the 2D lattice: white at 20% over black
const MODEL_FILL = 0.28; // model's bounding sphere radius as a share of the smaller side
const FLOAT_LIFT = 0.3; // how far the floating part starts above its seat, as a share of the model's height
const DRACO_PATH = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/";
const COLORWAY_HOLD_S = 3.5; // how long each colourway shows before the next fades in
const COLORWAY_FADE_S = 1.2;

const host = document.querySelector(".lattice");
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
if (host) init().catch((err) => console.warn("[lattice3d] keeping the 2D lattice:", err));

async function init() {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1); // the drawing buffer is sized to exact device pixels below
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "lattice-canvas";
  host.append(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-1, 2, 1.5);
  scene.add(key);
  // grid and model live in one group, in the same fixed projection
  const world = new THREE.Group();
  scene.add(world);

  // fixed camera: yaw 45°, pitched down; 1 world unit = 1 CSS pixel on screen
  const camera = new THREE.OrthographicCamera();
  camera.rotation.order = "YXZ";
  camera.rotation.set(-PITCH, Math.PI / 4, 0);
  camera.updateMatrixWorld();
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  camera.position.copy(back).multiplyScalar(5000);
  camera.near = 1;
  camera.far = 10000;

  const lineMat = new LineMaterial({ color: LINE_COLOR, linewidth: 1, worldUnits: false });
  lineMat.toneMapped = false;
  let lattice = null;
  let view = null; // current layout numbers, kept for model fitting and debugging

  const build = () => {
    const box = host.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const dpr = devicePixelRatio || 1;
    const W = box.width, H = box.height;
    // the canvas occupies exactly these device pixels once the browser snaps its box
    const devL = Math.round(box.left * dpr), devT = Math.round(box.top * dpr);
    const devW = Math.round((box.left + W) * dpr) - devL;
    const devH = Math.round((box.top + H) * dpr) - devT;
    renderer.setSize(devW, devH, false);
    lineMat.resolution.set(devW, devH);
    const kx = devW / W; // canvas pixels per CSS pixel horizontally

    camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2;
    camera.updateProjectionMatrix();

    const cols = [...document.querySelectorAll(".columns span")].filter((s) => s.offsetParent).length || 8;
    const cw = W / cols;
    const a = cw * Math.SQRT2; // cell width: one cell along a horizontal axis moves one column
    const hv = 2 * cw * Math.tan(PITCH); // floor-to-floor height: 2 rises on screen, as in the artwork
    const ring = Math.min(6, Math.max(3, cw * 0.035));

    // where the page's 1px column borders land, in canvas pixels (left borders; the last
    // line is the right border of the last column), as the browser rounds them
    const bw = Math.max(1, Math.floor(dpr + 1e-6));
    const boxDev = box.left * dpr;
    const snapX = (x) => {
      const m = Math.round(x / cw);
      if (m < 0 || m > cols) return x; // off-canvas lines need no snapping
      let col = Math.round(m * cw * dpr + boxDev) - Math.round(boxDev);
      if (m === cols) col -= bw;
      return (col + bw / 2) / kx;
    };
    const screenX = (p) => W / 2 + p.dot(right);
    const screenY = (p) => H / 2 - p.dot(up);
    const shifted = (p, from) => p.clone().addScaledVector(right, snapX(screenX(from)) - screenX(from));

    // The block: N×N cells of floor (N = half the column count), N+1 stacked horizontal planes,
    // and N-1 vertical planes each way. Every horizontal plane carries a full grid of lines
    // (its border plus where the vertical planes cut it); vertical lines stand wherever vertical
    // planes cross each other or meet a floor's edge, i.e. every grid point except the 4 corners.
    // Lines are split at every crossing so each intersection is a snapped vertex.
    const N = cols / 2;
    const P = (u, v, L) => new THREE.Vector3((u - N / 2) * a, (L - N / 2) * hv, (v - N / 2) * a);
    const corner = (u, v) => (u === 0 || u === N) && (v === 0 || v === N);
    const seg = [];
    const push = (p, q) => seg.push(p.x, p.y, p.z, q.x, q.y, q.z);
    const line = (p, q) => push(shifted(p, p), shifted(q, q));
    for (let L = 0; L <= N; L++) {
      // horizontal planes: border only (no grid); the walls' own top and bottom borders
      // lie on the first and last floor
      const rows = L === 0 || L === N ? [...Array(N + 1).keys()] : [0, N];
      for (const i of rows) for (let j = 0; j < N; j++) {
        line(P(i, j, L), P(i, j + 1, L)); // along v
        line(P(j, i, L), P(j + 1, i, L)); // along u
      }
    }
    for (let u = 0; u <= N; u++) for (let v = 0; v <= N; v++) {
      if (corner(u, v)) continue;
      for (let L = 0; L < N; L++) line(P(u, v, L), P(u, v, L + 1));
      // circles lying on each horizontal plane at the intersection points
      for (let L = 0; L <= N; L++) {
        const c = P(u, v, L);
        const SEG = 28;
        let prev = null;
        for (let k = 0; k <= SEG; k++) {
          const t = (k / SEG) * Math.PI * 2;
          const q = shifted(new THREE.Vector3(c.x + ring * Math.cos(t), c.y, c.z + ring * Math.sin(t)), c);
          if (prev) push(prev, q);
          prev = q;
        }
      }
    }
    const geo = new LineSegmentsGeometry();
    geo.setPositions(seg);
    lineMat.linewidth = bw;
    if (lattice) { world.remove(lattice); lattice.geometry.dispose(); }
    lattice = new LineSegments2(geo, lineMat);
    world.add(lattice);
    view = { W, H, dpr, cols, cw, devW, devH, bw, segments: seg.length / 6 };
    fitModel();
    render();
  };

  /* ---------- model ---------- */
  const spin = new THREE.Group(); // holds the model, scaled to fit; aligned with the grid's axes
  world.add(spin);
  let model = null, modelRadius = 1;
  // optional floating parts (data-float-part="Lid", or several: "Tablet, Pen"): lifted at the top of the
  // page, lowered onto their modelled positions as the visitor scrolls the grid toward the middle of the
  // screen. data-float-lift sets how high they start, as a share of the model's height (default FLOAT_LIFT).
  let floatParts = [], floatLift = 0, floatStart = 0, floatEnd = 1;
  const floatProgress = () => {
    const t = Math.max(0, Math.min(1, (scrollY - floatStart) / (floatEnd - floatStart)));
    return t * t * (3 - 2 * t);
  };
  const measureFloat = () => {
    const r = host.getBoundingClientRect();
    // starts lowering when the grid's top enters the viewport (or at the top of the page if it is
    // already in view) and is seated once the grid's centre reaches the middle (at least 240px later)
    const top = r.top + scrollY;
    floatStart = Math.max(0, top - innerHeight);
    floatEnd = Math.max(floatStart + 240, top + r.height / 2 - innerHeight / 2);
  };
  const applyFloat = () => {
    const lift = floatLift * (1 - floatProgress());
    for (const f of floatParts) f.part.position.y = f.baseY + lift;
  };

  const fitModel = () => {
    if (!model || !view) return;
    spin.scale.setScalar((Math.min(view.W, view.H) * MODEL_FILL) / modelRadius);
  };

  const setModel = (obj) => {
    if (model) { spin.remove(model); dispose(model); }
    const bounds = new THREE.Box3().setFromObject(obj);
    const centre = bounds.getCenter(new THREE.Vector3());
    // data-seat="plane": the model stands on the grid's middle horizontal plane instead of straddling it
    if (host.dataset.seat === "plane") centre.y = bounds.min.y;
    obj.position.sub(centre);
    modelRadius = bounds.getBoundingSphere(new THREE.Sphere()).radius || 1;
    model = obj;
    floatParts = (host.dataset.floatPart || "").split(",").map((n) => obj.getObjectByName(n.trim()))
      .filter(Boolean).map((part) => ({ part, baseY: part.position.y }));
    if (floatParts.length) {
      floatLift = (bounds.max.y - bounds.min.y) * (parseFloat(host.dataset.floatLift) || FLOAT_LIFT);
      measureFloat();
    }
    spin.add(model);
    rotY = 0;
    fitModel();
    setupColorways();
    setupCallouts();
    host.classList.add("has-model");
    host.removeAttribute("aria-hidden");
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "3D model. Drag, or use the arrow keys, to rotate.");
    startLoop();
  };

  const load = async (url, name = url) => {
    const ext = name.split("?")[0].split(".").pop().toLowerCase();
    const fill = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.55, metalness: 0.05 });
    if (url === "demo") {
      return setModel(new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.32, 220, 32), fill));
    }
    if (ext === "glb" || ext === "gltf") {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const { DRACOLoader } = await import("three/addons/loaders/DRACOLoader.js");
      const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO_PATH));
      const gltf = await loader.loadAsync(url);
      return setModel(gltf.scene);
    }
    if (ext === "stl") {
      const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
      const geo = await new STLLoader().loadAsync(url);
      geo.computeVertexNormals(); // some CAD exporters write zero normals; STL facets are flat anyway
      return setModel(new THREE.Mesh(geo, geo.hasColors ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }) : fill));
    }
    if (ext === "obj") {
      const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
      const obj = await new OBJLoader().loadAsync(url);
      obj.traverse((m) => { if (m.isMesh) m.material = fill; });
      return setModel(obj);
    }
    throw new Error(`unsupported model format: .${ext}`);
  };

  /* ---------- callouts ---------- */
  // optional <ul class="callouts"> inside .lattice; each <li> names a part (data-part), a point on it in
  // the part's own coordinates (data-at="x y z"), and where its leader turns into the label (data-elbow, in
  // eighths of the grid width from the grid's centre; class="left" puts the label on the left). Each
  // frame the point is projected to the screen and joined to its label by a leader line, so the
  // callouts follow the model as it spins and lowers into place.
  const CALLOUT_TAIL = 0.53; // length of a leader's horizontal run, in eighths of the grid width
  const SVG_NS = "http://www.w3.org/2000/svg";
  const calloutItems = [...host.querySelectorAll(".callouts > li")];
  let callouts = [];
  const calloutLayer = calloutItems.length ? document.createElement("div") : null;
  if (calloutLayer) {
    calloutLayer.className = "callout-lines";
    calloutLayer.setAttribute("aria-hidden", "true");
    calloutLayer.innerHTML = `<svg xmlns="${SVG_NS}"></svg>`;
    host.append(calloutLayer);
  }
  const setupCallouts = () => {
    const svg = calloutLayer?.firstChild;
    if (!svg) return;
    svg.replaceChildren();
    callouts = calloutItems.map((li) => {
      const part = model.getObjectByName(li.dataset.part);
      if (!part) return null;
      const g = document.createElementNS(SVG_NS, "g");
      g.innerHTML = '<path/><ellipse class="ring"/><ellipse class="dot"/>';
      svg.append(g);
      return {
        li, part, g, left: li.classList.contains("left"),
        at: new THREE.Vector3(...li.dataset.at.trim().split(/\s+/).map(Number)),
        elbow: li.dataset.elbow.trim().split(/\s+/).map(Number),
      };
    }).filter(Boolean);
    host.classList.toggle("has-callouts", callouts.length > 0);
  };
  const placeCallouts = () => {
    if (!callouts.length || !view) return;
    const { W, H } = view;
    const u = W / 8;
    host.style.setProperty("--callout-unit", `${u}px`);
    // shown once the floating parts have (nearly) settled, so the leaders don't swing about mid-flight
    const p = floatParts.length ? floatProgress() : 1;
    host.style.setProperty("--callout-shown", Math.max(0, Math.min(1, (p - 0.75) / 0.25)).toFixed(3));
    const v = new THREE.Vector3();
    for (const c of callouts) {
      v.copy(c.at);
      c.part.localToWorld(v).project(camera);
      const ax = (v.x + 1) * W / 2, ay = (1 - v.y) * H / 2;
      const ex = W / 2 + c.elbow[0] * u, ey = H / 2 + c.elbow[1] * u;
      const tx = ex + (c.left ? -1 : 1) * CALLOUT_TAIL * u;
      c.g.firstChild.setAttribute("d", `M${ax},${ay}L${ex},${ey}H${tx}`);
      for (const [el, r] of [[c.g.children[1], 0.081], [c.g.children[2], 0.03]]) {
        // a circle lying flat on the grid's horizontal planes, as the lattice draws its nodes
        el.setAttribute("cx", ax); el.setAttribute("cy", ay);
        el.setAttribute("rx", r * u); el.setAttribute("ry", r * u * SLOPE);
      }
      c.li.style.top = `${ey}px`;
      if (c.left) { c.li.style.right = `${W - tx}px`; c.li.style.left = ""; }
      else { c.li.style.left = `${tx}px`; c.li.style.right = ""; }
    }
  };

  /* ---------- colourways ---------- */
  // optional (data-colorway-material="Anodized Aluminium" data-colorways="#7a7a7a, #34453f, …"): that
  // material cross-fades through the colours in turn while the grid is on screen
  let colorway = null;
  const setupColorways = () => {
    if (colorway) clearTimeout(colorway.timer);
    colorway = null;
    const name = host.dataset.colorwayMaterial;
    const colors = (host.dataset.colorways || "").split(",").map((c) => c.trim()).filter(Boolean).map((c) => new THREE.Color(c));
    const mats = new Set();
    model.traverse((m) => { if (m.isMesh) [].concat(m.material).forEach((mat) => { if (mat.name === name) mats.add(mat); }); });
    if (!mats.size || colors.length < 2) return;
    mats.forEach((mat) => mat.color.copy(colors[0]));
    colorway = { mats: [...mats], colors, index: 0, from: new THREE.Color(), start: null, due: false, timer: 0 };
    scheduleColorway();
  };
  const scheduleColorway = () => {
    clearTimeout(colorway.timer);
    colorway.timer = setTimeout(nextColorway, COLORWAY_HOLD_S * 1000);
  };
  const nextColorway = () => {
    if (!visible) { colorway.due = true; return; } // picked up again when the grid scrolls back into view
    colorway.due = false;
    colorway.index = (colorway.index + 1) % colorway.colors.length;
    colorway.from.copy(colorway.mats[0].color);
    colorway.start = performance.now();
    startLoop();
  };
  // advances a fade in progress; returns true while it is still running
  const updateColorway = (now) => {
    if (!colorway || colorway.start === null) return false;
    const k = reduced ? 1 : Math.min(1, (now - colorway.start) / (COLORWAY_FADE_S * 1000));
    const e = k * k * (3 - 2 * k);
    colorway.mats.forEach((mat) => mat.color.copy(colorway.from).lerp(colorway.colors[colorway.index], e));
    if (k < 1) return true;
    colorway.start = null;
    scheduleColorway();
    return false;
  };

  /* ---------- turning: side to side spins the model (unlimited); the grid stays fixed ---------- */
  let rotY = 0, spinVel = 0, dragging = false, lastX = 0;
  const qSpin = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const clamp = (v, m) => Math.max(-m, Math.min(m, v));
  const SPIN_PER_PX = 0.01; // model spin, radians per dragged pixel
  const COAST_S = 0.35; // how long the spin keeps coasting after release (time constant, seconds)

  canvas.addEventListener("pointerdown", (e) => {
    if (!model) return;
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    host.classList.add("is-dragging");
    startLoop();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const turn = (e.clientX - lastX) * SPIN_PER_PX;
    rotY += turn;
    spinVel = clamp(turn * 60, 6); // radians/second for the coast, capped so a flick stays calm
    lastX = e.clientX;
  });
  const release = () => { dragging = false; host.classList.remove("is-dragging"); };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step || !model) return;
    e.preventDefault();
    rotY += step * Math.PI / 12; // 15° per press
    render();
  });

  const render = () => {
    applyFloat();
    qSpin.setFromAxisAngle(Y, rotY); // spin the model about the grid's vertical axis
    spin.quaternion.copy(qSpin);
    renderer.render(scene, camera);
    placeCallouts(); // after rendering, so the parts' world matrices are current
  };

  let running = false, visible = true, lastT = 0;
  const tick = (t) => {
    if (!running) return;
    const dt = lastT ? Math.min(0.25, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    const fading = updateColorway(performance.now());
    if (!dragging) {
      // the model's spin coasts to a stop and stays where it ends up
      rotY += spinVel * dt;
      spinVel = reduced ? 0 : spinVel * Math.exp(-dt / COAST_S);
      if (Math.abs(spinVel) < 1e-3) spinVel = 0;
      if (!spinVel && !fading) running = false;
    }
    render();
    if (running) requestAnimationFrame(tick);
  };
  const startLoop = () => { if (!running && visible) { running = true; lastT = 0; requestAnimationFrame(tick); } };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!visible) running = false;
    else if (colorway?.due) nextColorway();
    else if (colorway?.start != null) startLoop(); // finish a fade that was cut off by scrolling away
  }).observe(host);

  /* ---------- layout ---------- */
  new ResizeObserver(() => build()).observe(host);
  addEventListener("resize", build);
  addEventListener("resize", measureFloat);
  let floatQueued = false;
  addEventListener("scroll", () => {
    if (!floatParts.length || running || floatQueued) return; // a running loop renders it anyway
    floatQueued = true;
    requestAnimationFrame(() => { floatQueued = false; render(); });
  }, { passive: true });
  build();
  void canvas.offsetWidth; // apply the starting opacity so the cross-fade runs
  host.classList.add("is-3d");

  /* ---------- model source ---------- */
  const param = isLocal && new URLSearchParams(location.search).get("model");
  const src = param || host.dataset.model;
  if (src) await load(src);

  if (isLocal) {
    // local preview: drop a model file onto the lattice (it stays in this browser tab)
    host.addEventListener("dragover", (e) => { e.preventDefault(); host.classList.add("is-dropping"); });
    host.addEventListener("dragleave", () => host.classList.remove("is-dropping"));
    host.addEventListener("drop", (e) => {
      e.preventDefault();
      host.classList.remove("is-dropping");
      const file = e.dataTransfer.files[0];
      if (file) load(URL.createObjectURL(file), file.name).catch((err) => console.warn("[lattice3d]", err));
    });
    window.__lattice3d = {
      renderer, render, view: () => view, load, rotation: () => ({ rotY }),
      model: () => model, floatInfo: () => ({ parts: floatParts.map((f) => f.part.name), floatLift, floatStart, floatEnd, progress: floatProgress() }),
      // turn the model to a spin angle (radians)
      pose: (y) => { rotY = y; spinVel = 0; render(); },
    };
  }
}

function dispose(obj) {
  obj.traverse((m) => {
    m.geometry?.dispose();
    [].concat(m.material || []).forEach((mat) => mat.dispose());
  });
}
