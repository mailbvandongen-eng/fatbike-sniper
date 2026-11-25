// Bouwt de 3D-wereld uit data/<locatie>.json: gebouwen (3D BAG), grond (OSM), bomen, heggen, straatmeubilair, geparkeerde auto's.
import * as THREE from "three";
import { maakFiets, kies, tussen, plak, stuk, blok, buis, bol, M, V } from "./figuren.js";
import { parkeer, zetGeparkeerd } from "./autos.js";
import { VRIJ_ZICHT } from "./config.js";

// ---------- gevels ----------
// Eén textuur per stijl, 4 traveeën breed en 3 verdiepingen hoog, zodat niet elk raam hetzelfde is.
// Kleuren naar de foto's van De Julianabaan (Wikimedia Commons, 2016 en 2024) en de luchtfoto van PDOK.
const GEVEL = {
  jaren50: { b: 2.9, h: 2.8, steen: ["#7a3b22", "#84442a", "#6d341f", "#8a4a30"], voeg: "#b8a89a", raam: [1.35, 1.45], kozijn: "#f1ede4", latei: "#cfc8bb" },
  // donkerbruine baksteen met brede witte raambanden (Google 3D, rond het plein)
  bruinwit: { b: 3.0, h: 2.8, bruinwit: true },
  // portiekflat uit de jaren 50 (Van Steelaan): donkerbruine baksteen met witte kozijnen; om en om een witte erker met balkon
  portiek: { b: 3.2, h: 2.8, portiek: true },
  // crèmegeel met gele betonnen penanten (westkant)
  geel: { b: 3.0, h: 2.8, geel: true },
  // licht metselwerk met blauw-witte zonneschermen (oostkant, boven de winkels)
  creme: { b: 3.2, h: 2.8, creme: true },
  // 't Zeilschip: wit met balkons
  zeilschip: { b: 3.2, h: 2.9, zeilschip: true },
  galerij: { b: 3.6, h: 2.8, galerij: true },
  kop: { b: 3.0, h: 2.8, kop: true },
  winkel: { b: 5.0, h: 3.7, winkel: true },
  huis: { b: 2.7, h: 2.7, steen: ["#8e4630", "#9a5238", "#7f3d29"], voeg: "#c9b9a8", raam: [1.3, 1.35], kozijn: "#f5f3ee", latei: "#d8d2c6" },
  modern: { b: 3.4, h: 2.9, steen: ["#cbb999", "#d6c6a6", "#c2b08f"], voeg: "#e6dcc8", raam: [1.9, 1.7], kozijn: "#4a4d50", latei: "#bfb3a0" },
  // rijtjeshuis uit de jaren 70 met plat dak (Zoetermeer, naar Street View): donker roodbruine baksteen, witte kozijnen,
  // en een witte band tussen de verdiepingen
  jaren70: { b: 2.75, h: 2.7, steen: ["#6a4338", "#74493c", "#5f3b31", "#7a4f41"], voeg: "#8b766a", raam: [1.5, 1.35], kozijn: "#efece4", latei: "#6a4338", band: "#e9e6de" },
  nieuw: { b: 3.0, h: 3.0, steen: ["#4d423c", "#5a4b44", "#463c37"], voeg: "#6d625b", raam: [1.3, 2.1], kozijn: "#2b2b2b", latei: "#3a3330" },
};
const KOL = 4, LAAG = 3, PX = 48;
const toeval = (a) => a[(Math.random() * a.length) | 0];
function stenen(x, w, h, kleuren, voeg) {
  x.fillStyle = voeg; x.fillRect(0, 0, w, h);
  const sh = 0.065 * PX, sw = 0.21 * PX;
  for (let y = 0, r = 0; y < h; y += sh, r++) for (let i = r % 2 ? -sw / 2 : 0; i < w; i += sw) {
    x.fillStyle = toeval(kleuren); x.fillRect(i + 0.6, y + 0.6, sw - 1.2, sh - 1.2);
  }
}
function ruit(x, rx, ry, rw, rh, kozijn, licht) {
  x.fillStyle = kozijn; x.fillRect(rx - 3, ry - 3, rw + 6, rh + 6);
  const g = x.createLinearGradient(0, ry, 0, ry + rh);
  g.addColorStop(0, licht ? "#c9d6df" : "#a9bccb"); g.addColorStop(0.45, "#4c5c6a"); g.addColorStop(1, "#27303a");
  x.fillStyle = g; x.fillRect(rx, ry, rw, rh);
  // gordijn, lamp of plant
  const r = Math.random();
  if (r < 0.45) { x.globalAlpha = 0.55; x.fillStyle = toeval(["#e2d6bf", "#b8a58a", "#c96a50", "#efe9dd", "#8a9bb0"]); x.fillRect(rx, ry, rw * (0.15 + Math.random() * 0.3), rh); x.globalAlpha = 1; }
  else if (r < 0.55) { x.fillStyle = "#f3d58a88"; x.fillRect(rx + 2, ry + 2, rw - 4, rh - 4); }
  x.fillStyle = kozijn; x.fillRect(rx + rw / 2 - 2, ry, 4, rh); x.fillRect(rx, ry + rh * 0.32, rw, 3);
}
function gevelTextuur(st) {
  const c = document.createElement("canvas");
  const W = st.b * PX, H = st.h * PX;
  c.width = W * KOL; c.height = H * LAAG;
  const x = c.getContext("2d");
  for (let l = 0; l < LAAG; l++) for (let k = 0; k < KOL; k++) {
    x.save(); x.translate(k * W, l * H);
    if (st.galerij) {
      // galerijflat: ruw grijs beton, witte schotten, donkere ramen achter de galerij
      // canvas-boven = plafond, canvas-onder = vloer van de galerij
      x.fillStyle = "#5b636a"; x.fillRect(0, 0, W, H);
      ruit(x, 0.4 * PX, 0.16 * H, W * 0.5, 0.42 * H, "#ecebe7", Math.random() < 0.35);
      x.fillStyle = "#dcdad4"; x.fillRect(W * 0.7, 0.12 * H, 0.75 * PX, 0.62 * H); // voordeur
      x.fillStyle = "#b9b5ac"; x.fillRect(0, H - 1.1 * PX, W, 1.1 * PX); // borstwering van grindbeton
      for (let i = 0; i < 300; i++) { x.fillStyle = Math.random() < 0.5 ? "#a39f96" : "#cbc7be"; x.fillRect(Math.random() * W, H - Math.random() * 1.1 * PX, 1.6, 1.6); }
      x.fillStyle = "#d7d4cd"; x.fillRect(0, H - 1.14 * PX, W, 0.07 * PX);
      x.fillStyle = "#c9c6bf"; x.fillRect(0, 0, W, 0.1 * PX); // vloerrand van de galerij erboven
      x.fillStyle = "#f4f3f0"; x.fillRect(0, 0, 0.22 * PX, H); // wit schot
    } else if (st.bruinwit) {
      stenen(x, W, H, ["#4e3426", "#5a3b2b", "#47301f", "#553a2c"], "#7d6a5c");
      // witte raamband over bijna de hele breedte, met een witte borstwering-strook eronder
      x.fillStyle = "#f2f0ea"; x.fillRect(0, H * 0.2, W, H * 0.06);
      ruit(x, 0.18 * PX, H * 0.28, W - 0.36 * PX, H * 0.46, "#f4f2ed", Math.random() < 0.3);
      x.fillStyle = "#f4f2ed"; x.fillRect(0, H * 0.74, W, 4);
    } else if (st.portiek) {
      stenen(x, W, H, ["#4b3229", "#573a2e", "#412a21", "#5c3f32"], "#6b584d");
      if (k % 2) {
        // witte erker over de hele hoogte: groot raam, daaronder de witte borstwering van het balkon
        x.fillStyle = "#efede7"; x.fillRect(0.2 * PX, 0, W - 0.4 * PX, H);
        ruit(x, 0.32 * PX, H * 0.1, W - 0.64 * PX, H * 0.52, "#f7f6f2", Math.random() < 0.3);
        x.fillStyle = "#f7f6f2"; x.fillRect(0.12 * PX, H * 0.66, W - 0.24 * PX, H * 0.3); // balkon
        x.fillStyle = "#bdb9b0"; x.fillRect(0.12 * PX, H * 0.96, W - 0.24 * PX, 3);
        x.fillStyle = "#d5d2ca"; x.fillRect(0.12 * PX, H * 0.66, W - 0.24 * PX, 2);
      } else {
        // metselwerk met twee staande ramen in witte kozijnen
        for (const rx of [0.3, 1.75]) ruit(x, rx * PX, H * 0.2, 1.15 * PX, H * 0.5, "#f4f2ed", Math.random() < 0.3);
        x.fillStyle = "#d9d5cc"; for (const rx of [0.3, 1.75]) x.fillRect(rx * PX - 2, H * 0.7, 1.15 * PX + 4, 3); // waterslag
      }
    } else if (st.geel) {
      x.fillStyle = "#cdb36b"; x.fillRect(0, 0, W, H);
      ruit(x, 0.45 * PX, H * 0.26, W - 0.9 * PX, H * 0.5, "#f1ede2", Math.random() < 0.3);
      x.fillStyle = "#e0c56e"; x.fillRect(0, 0, 0.34 * PX, H); // gele penant
      x.fillStyle = "#b99d55"; x.fillRect(0.3 * PX, 0, 0.05 * PX, H);
      x.fillStyle = "#d9cfb8"; x.fillRect(0, H - 0.14 * PX, W, 0.14 * PX);
    } else if (st.creme) {
      x.fillStyle = "#e6dfcf"; x.fillRect(0, 0, W, H);
      ruit(x, 0.4 * PX, H * 0.3, W - 0.8 * PX, H * 0.45, "#ffffff", Math.random() < 0.3);
      // zonnescherm: blauw-wit gestreept, schuin boven het raam
      const zy = H * 0.12, zh = H * 0.2;
      for (let i = 0; i < W - 0.6 * PX; i += 0.22 * PX) { x.fillStyle = (i / (0.22 * PX)) % 2 < 1 ? "#2f5d9a" : "#f4f4f0"; x.fillRect(0.3 * PX + i, zy, 0.22 * PX, zh); }
      x.fillStyle = "#00000025"; x.fillRect(0.3 * PX, zy + zh, W - 0.6 * PX, H * 0.08);
    } else if (st.zeilschip) {
      x.fillStyle = "#eceae4"; x.fillRect(0, 0, W, H);
      ruit(x, 0.3 * PX, H * 0.12, W * 0.62, H * 0.62, "#dcdad4", Math.random() < 0.3);
      x.fillStyle = "#f7f6f2"; x.fillRect(0, H - 0.95 * PX, W, 0.95 * PX); // balkon
      x.fillStyle = "#c8c5bd"; x.fillRect(0, H - 0.97 * PX, W, 3);
      x.fillStyle = "#7fa0b8"; x.fillRect(W * 0.72, H * 0.12, W * 0.22, H * 0.62);
    } else if (st.kop) {
      // rode kopgevel van geprofileerde platen
      for (let i = 0; i < W; i += 6) { x.fillStyle = i % 12 ? "#8e2b22" : "#7a231c"; x.fillRect(i, 0, 6, H); }
      if ((k + l) % 3 === 0) ruit(x, W / 2 - 0.5 * PX, 0.3 * H, 1.0 * PX, 0.75 * PX, "#f1ede4", false);
    } else if (st.winkel) {
      // glazen winkelpui met lichte luifelband erboven
      const band = 1.15 * PX;
      x.fillStyle = "#e6dcc6"; x.fillRect(0, 0, W, band);
      x.fillStyle = "#cbbfa6"; x.fillRect(0, band - 6, W, 6);
      const g = x.createLinearGradient(0, band, 0, H);
      g.addColorStop(0, "#5e6d77"); g.addColorStop(0.6, "#8796a0"); g.addColorStop(1, "#aab6bd");
      x.fillStyle = g; x.fillRect(0, band, W, H - band);
      for (let i = 0; i < 9; i++) { x.fillStyle = toeval(["#c0392b", "#f0e6d2", "#2c6e9b", "#e9b949", "#7a9a5a", "#d26b8f", "#ffffff"]); x.globalAlpha = 0.55; x.fillRect(Math.random() * W, H - (0.5 + Math.random() * 1.6) * PX, 0.3 * PX, (0.3 + Math.random()) * PX); }
      x.globalAlpha = 1;
      x.fillStyle = "#2f3236"; for (const f of [0, 0.33, 0.66]) x.fillRect(f * W, band, 4, H - band);
      x.fillRect(0, H - 0.12 * PX, W, 0.12 * PX);
    } else {
      stenen(x, W, H, st.steen, st.voeg);
      const [rb, rh] = st.raam, rx = (st.b - rb) / 2 * PX, ry = (st.h - rh) / 2 * PX - 0.1 * PX;
      x.fillStyle = st.latei; x.fillRect(rx - 6, ry - 0.16 * PX, rb * PX + 12, 0.12 * PX);
      ruit(x, rx, ry, rb * PX, rh * PX, st.kozijn, Math.random() < 0.3);
      x.fillStyle = st.latei; x.fillRect(rx - 4, ry + rh * PX + 3, rb * PX + 8, 0.06 * PX);
    }
    if (st.band) { x.fillStyle = st.band; x.fillRect(0, 0, W, 0.085 * PX); }
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // v = hoogte in meters; canvas-onderkant = straatniveau
  t.repeat.set(1 / (st.b * KOL), 1 / (st.h * LAAG));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- winkelborden ----------
// Kleuren in de stijl van de echte borden (alleen de naam, geen logo's).
const BORD = {
  "Jumbo": ["#ffd200", "#111"], "Albert Heijn": ["#00a0e2", "#fff"], "HEMA": ["#ffffff", "#e3001b"], "Action": ["#0a4ea2", "#fff"],
  "Kruidvat": ["#e2001a", "#fff"], "Etos": ["#ffffff", "#d4021d"], "Blokker": ["#e30613", "#fff"], "Zeeman": ["#0094d9", "#fff"],
  "Bruna": ["#ffd200", "#00337f"], "Gall & Gall": ["#5c1631", "#fff"], "Pearle": ["#002d72", "#fff"], "Intertoys": ["#e30613", "#ffe600"],
  "Shoeby": ["#111111", "#fff"], "Street One": ["#ffffff", "#b5121b"], "Eye Wish": ["#111111", "#fff"], "Sport 2000": ["#e30613", "#fff"],
  "Pets Place": ["#00843d", "#fff"], "Bakker van Maanen": ["#6b3e1f", "#f5e6c8"], "McDonald's": ["#da291c", "#ffc72c"],
};
function maakBorden(winkels, scene) {
  const per = 2, rijen = Math.ceil(winkels.length / per), BW = 512, BH = 72;
  const c = document.createElement("canvas");
  c.width = BW * per; c.height = BH * rijen;
  const x = c.getContext("2d");
  const pos = [], uv = [], nor = [];
  winkels.forEach(([naam, px, pz, hoek, h], i) => { // h = hoogte onderkant bord
    const [bg, fg] = BORD[naam] ?? [toeval(["#2b2f36", "#f2efe8", "#1f3b5a", "#5a1f2b", "#264d36"]), null];
    const ux = (i % per) * BW, uy = Math.floor(i / per) * BH;
    x.fillStyle = bg; x.fillRect(ux, uy, BW, BH);
    x.fillStyle = fg ?? (["#f2efe8"].includes(bg) ? "#222" : "#fff");
    x.font = `800 ${BH * 0.62}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
    x.textAlign = "center"; x.textBaseline = "middle";
    const tw = Math.min(x.measureText(naam).width, BW - 24);
    x.fillText(naam, ux + BW / 2, uy + BH * 0.54, BW - 24);
    // plaatje op de gevel: breedte naar de lengte van de naam
    const groot = ["Jumbo", "Albert Heijn", "HEMA", "Action", "Kruidvat", "Blokker", "Zeeman"].includes(naam);
    const hoog = groot ? 1.05 : 0.75, breed = THREE.MathUtils.clamp((tw / BH) * hoog * 0.95, 1.6, groot ? 7 : 6.5);
    if (groot) h += 0.35;
    const u0 = (ux + BW / 2 - tw / 2 - 14) / c.width, u1 = (ux + BW / 2 + tw / 2 + 14) / c.width;
    const v0 = 1 - (uy + BH) / c.height, v1 = 1 - uy / c.height;
    const sx = Math.cos(hoek), sz = -Math.sin(hoek), nx = Math.sin(hoek), nz = Math.cos(hoek);
    const hw = breed / 2;
    const P = (a, b) => [px + sx * a, h + b, pz + sz * a];
    const hoeken = [P(-hw, 0), P(hw, 0), P(hw, hoog), P(-hw, 0), P(hw, hoog), P(-hw, hoog)];
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    hoeken.forEach((q, k) => { pos.push(...q); uv.push(...uvs[k]); nor.push(nx, 0, nz); });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 0.15, polygonOffset: true, polygonOffsetFactor: -2 }));
  scene.add(m);
}

// ---------- lage muurtjes, haagbogen en het boogje op Bon Appetit ----------
function maakMuurtjesEnBogen(d, scene, wereld) {
  const steen = [], groen = [], wit = [];
  for (const m of d.muurtjes ?? []) for (let i = 0; i < m.length - 1; i++) {
    const [a, b] = [m[i], m[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.2) continue;
    const hoek = Math.atan2(b[0] - a[0], b[1] - a[1]);
    blok(steen, 0.3, 1.0, L + 0.3, V((a[0] + b[0]) / 2, 0.5, (a[1] + b[1]) / 2), "#6e4a3c", [0, hoek, 0]);
    blok(steen, 0.38, 0.08, L + 0.38, V((a[0] + b[0]) / 2, 1.04, (a[1] + b[1]) / 2), "#a9a49a", [0, hoek, 0]);
  }
  // haagbogen: twee groene pilaren met een boog erover, dwars op het pad
  for (const [x, z, hoek, breed] of d.bogen ?? []) {
    const r = breed / 2 + 0.5;
    const g = new THREE.TorusGeometry(r, 0.32, 6, 14, Math.PI);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + (Math.random() - 0.5) * 0.06), p.getY(i) * (1 + (Math.random() - 0.5) * 0.06), p.getZ(i) * (1 + Math.random() * 0.15));
    g.computeVertexNormals();
    stuk(groen, g, "#4f7a2e", M(V(x, 1.9, z), [0, hoek, 0]));
    for (const k of [-1, 1]) blok(groen, 0.62, 1.9, 0.62, V(x + Math.cos(hoek) * k * r, 0.95, z - Math.sin(hoek) * k * r), "#47702a", [0, hoek, 0]);
  }
  if (d.dakboog) {
    const [x, z, h, hoek] = d.dakboog;
    stuk(wit, new THREE.TorusGeometry(2.4, 0.12, 6, 16, Math.PI), "#f6f6f2", M(V(x, h, z), [0, hoek, 0], [1, 0.6, 1]));
  }
  const maak = (bak, ruw) => {
    if (!bak.length) return;
    const m = new THREE.Mesh(plak(bak), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: ruw }));
    m.castShadow = m.receiveShadow = true;
    scene.add(m); wereld.botsers.push(m);
  };
  maak(steen, 0.9); maak(groen, 1); maak(wit, 0.4);
}

// ---------- glazen overkappingen boven de winkelstraten ----------
function maakOverkappingen(lijnen, scene) {
  const glas = [], staal = [];
  for (const l of lijnen) {
    if (l.s !== "overkapping") continue;
    for (let i = 0; i < l.p.length - 1; i++) {
      const [a, b] = [l.p[i], l.p[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.5) continue;
      const hoek = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const g = new THREE.CylinderGeometry(l.b / 2, l.b / 2, L, 10, 1, true, -Math.PI / 2, Math.PI);
      g.rotateX(-Math.PI / 2); g.scale(1, 0.35, 1); // halve buis: as langs z, boog naar boven
      g.rotateY(hoek); g.translate((a[0] + b[0]) / 2, 4.4, (a[1] + b[1]) / 2);
      stuk(glas, g, "#ffffff");
      for (let s = 0; s <= L; s += 5) {
        const px = a[0] + ((b[0] - a[0]) * s) / L, pz = a[1] + ((b[1] - a[1]) * s) / L;
        stuk(staal, new THREE.TorusGeometry(l.b / 2, 0.06, 4, 12, Math.PI), "#f4f4f2", M(V(px, 4.4, pz), [0, hoek, 0], [1, 0.35, 1]));
        for (const k of [-1, 1]) buis(staal, V(px + Math.cos(hoek) * k * l.b / 2, 0, pz - Math.sin(hoek) * k * l.b / 2), V(px + Math.cos(hoek) * k * l.b / 2, 4.4, pz - Math.sin(hoek) * k * l.b / 2), 0.07, "#f4f4f2", 0, 6);
      }
    }
  }
  if (!glas.length) return;
  const dak = new THREE.Mesh(plak(glas), new THREE.MeshStandardMaterial({ color: "#dbe7ec", transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  const frame = new THREE.Mesh(plak(staal), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }));
  frame.castShadow = true;
  scene.add(dak, frame);
}

// ---------- grond ----------
const GRONDKLEUR = {
  // naar de luchtfoto: straten en parkeerplaats van roodbruine klinkers, stoepen beige, fietspad rood asfalt
  basis: "#b5a88f", plein: "#cdb98e", stoep: "#d2be8f", weg: "#86645e", asfalt: "#4d4e52", parkeer: "#86604f", vak: "#5f5d5d", fietspad: "#93524c",
  gras: "#5f7f42", struik: "#3f5f2f", eiland: "#a59f93", speel: "#c4ad7f", speelgroen: "#5f9c7c",
  // BGT: de echte indeling van de grond
  b_gras: "#5f7f42", b_erf: "#75805a", b_open: "#9a9285", b_voetpad: "#b5af9f", b_klinker: "#86645e", b_parkeer: "#6d6a66", b_asfalt: "#4d4e52", b_fietspad: "#93524c", b_water: "#4c676c", fietsvlak: "#a9a196", tram: "#6d6a63", gebouw: "#3c3a37",
};
export function tekenGrond(d, midden, maat, px) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const x = c.getContext("2d");
  const s = px / maat, o = maat / 2;
  const P = ([a, b]) => [(a - midden[0] + o) * s, (b - midden[1] + o) * s];
  x.fillStyle = d.grond === "gras" ? GRONDKLEUR.gras : GRONDKLEUR.basis; x.fillRect(0, 0, px, px);
  // klinkers: fijne ruis
  const ruis = x.createImageData(px, px);
  for (let i = 0; i < ruis.data.length; i += 4) { const v = Math.random() * 30; ruis.data[i] = ruis.data[i + 1] = ruis.data[i + 2] = v; ruis.data[i + 3] = 40; }
  const vlak = (ring, kl) => { x.fillStyle = kl; x.beginPath(); ring.forEach((p, i) => x[i ? "lineTo" : "moveTo"](...P(p))); x.closePath(); x.fill(); };
  x.lineCap = x.lineJoin = "round";
  const lijn = (l, kl, b) => { x.strokeStyle = kl; x.lineWidth = b * s; x.beginPath(); l.p.forEach((p, i) => x[i ? "lineTo" : "moveTo"](...P(p))); x.stroke(); };
  const speelgroen = () => {
    // een speeltuintje met kunstgras heeft een rand van klinkers
    for (const v of d.vlakken) if (v.s === "speelgroen") { x.strokeStyle = "#8f887c"; x.lineWidth = 1.6 * s; x.beginPath(); v.r.forEach((p, i) => x[i ? "lineTo" : "moveTo"](...P(p))); x.closePath(); x.stroke(); vlak(v.r, GRONDKLEUR.speelgroen); }
  };
  if (d.vlakken.some((v) => v.s.startsWith("b_"))) {
    // de grond uit de grootschalige topografie (BGT): elk vlak zijn eigen kleur, alleen wat in beeld ligt
    for (const v of d.vlakken) {
      if (!v.s.startsWith("b_")) continue;
      if (!v.r.some((q) => Math.abs(q[0] - midden[0]) < o + 2 && Math.abs(q[1] - midden[1]) < o + 2) && Math.hypot(v.r[0][0] - midden[0], v.r[0][1] - midden[1]) > o * 1.6) continue;
      vlak(v.r, GRONDKLEUR[v.s]);
    }
    speelgroen();
  } else {
  speelgroen();
  for (const v of d.vlakken) if (["gras", "speel", "plein"].includes(v.s)) vlak(v.r, GRONDKLEUR[v.s]);
  const wegKleur = (l) => (l.asfalt ? GRONDKLEUR.asfalt : GRONDKLEUR.weg);
  for (const soort of ["stoep", "weg", "fietspad"]) for (const l of d.lijnen) if (l.s === soort) lijn(l, soort === "weg" ? GRONDKLEUR.stoep : GRONDKLEUR[soort], l.b + (soort === "weg" ? 3.2 : 0));
  // stoepen langs wegen eerst breder, dan de weg erover
  for (const l of d.lijnen) if (l.s === "weg") lijn(l, wegKleur(l), l.b);
  for (const v of d.vlakken) if (["parkeer", "eiland", "fietsvlak"].includes(v.s)) vlak(v.r, GRONDKLEUR[v.s]);
  for (const l of d.lijnen) if (l.gang) lijn(l, GRONDKLEUR.parkeer, l.b);
  for (const v of d.vlakken) if (v.s === "struik") vlak(v.r, GRONDKLEUR.struik);
  for (const l of d.lijnen) if (l.s === "fietspad") lijn(l, l.asfalt ? GRONDKLEUR.fietspad : "#9a5e55", l.b);
  }
  // gevallen blad onder de bomen (herfst en winter)
  if (d.seizoen === "winter") for (const [bx, bz] of d.bomen) {
    if (Math.abs(bx - midden[0]) > o + 5 || Math.abs(bz - midden[1]) > o + 5) continue;
    for (let i = 0; i < 46; i++) {
      const hoek = (bx * 12.9898 + bz * 78.233 + i * 2.399) % 6.283, r = 0.4 + (((bx * 7.1 + bz * 3.3 + i * 0.618) % 1) + 1) % 1 * 4.2;
      const [px2, py2] = P([bx + Math.cos(hoek) * r, bz + Math.sin(hoek) * r]);
      x.fillStyle = ["#b8742e", "#c98836", "#8f5a26", "#d49a44"][i % 4]; x.globalAlpha = 0.75;
      x.fillRect(px2, py2, Math.max(1.5, 0.16 * s), Math.max(1.5, 0.12 * s));
    }
  }
  x.globalAlpha = 1;
  // middenstrepen
  x.setLineDash([3 * s, 4 * s]);
  for (const l of d.lijnen) if (l.s === "weg" && l.asfalt && l.b >= 6) lijn(l, "#d8d6cc", 0.12);
  x.setLineDash([]);
  const fietspaden = d.lijnen.filter((l) => l.s === "fietspad");
  const afstLijn = (q, m) => {
    let best = 1e9;
    for (let i = 0; i < m.p.length - 1; i++) {
      const [a, b] = [m.p[i], m.p[i + 1]], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / L2));
      best = Math.min(best, Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dz * t));
    }
    return best;
  };
  // witte blokjes langs de randen van de fietspaden
  x.fillStyle = "#f1efe8";
  const blok = 0.32;
  for (const l of d.lijnen) if (l.s === "fietspad" && Math.hypot(l.p[0][0] - midden[0], l.p[0][1] - midden[1]) < maat) for (let i = 0; i < l.p.length - 1; i++) {
    const [a, b] = [l.p[i], l.p[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
    for (const k of [-1, 1]) for (let t = 0.3; t < L; t += 0.75) {
      // alleen aan de buitenrand: ligt er aan deze kant nog een fietspad (andere rijrichting), dan is dit het midden
      const buiten = [a[0] + dx * t - dz * k * (l.b / 2 + 0.6), a[1] + dz * t + dx * k * (l.b / 2 + 0.6)];
      if (fietspaden.some((m) => m !== l && afstLijn(buiten, m) < m.b / 2 + 0.2)) continue;
      // op de grens van het rood, half erover: zo lees je ze als rand
      const [px, pz] = P([a[0] + dx * t - dz * k * (l.b / 2 + 0.05), a[1] + dz * t + dx * k * (l.b / 2 + 0.05)]);
      x.fillRect(px - (blok * s) / 2, pz - (blok * s) / 2, blok * s, blok * s);
    }
  }
  // oversteken: zebra (strepen), dambord (parkeergangen) of blokken (fietspad)
  for (const [soort, ox, oz, hoek, breed] of d.oversteken ?? []) {
    const fx = Math.sin(hoek), fz = Math.cos(hoek), zx = fz, zz = -fx; // f = langs de weg, z = dwars
    const vak = (a, b, w, h, kl) => {
      x.fillStyle = kl; x.beginPath();
      [[a, b], [a + w, b], [a + w, b + h], [a, b + h]].forEach(([u, v], i) => x[i ? "lineTo" : "moveTo"](...P([ox + fx * u + zx * v, oz + fz * u + zz * v])));
      x.fill();
    };
    const half = breed / 2 + 0.3;
    if (soort === "zebra") for (let v = -half; v < half; v += 1.0) vak(-1.5, v, 3, 0.5, "#f1efe8");
    else if (soort === "dambord") for (let u = -1.5, i = 0; u < 1.5; u += 0.5, i++) for (let v = -half, j = 0; v < half; v += 0.5, j++) vak(u, v, 0.5, 0.5, (i + j) % 2 ? "#f1efe8" : "#2b2b2b");
    else for (const u of [-1.1, 1.1]) for (let v = -half; v < half; v += 0.75) vak(u - 0.15, v, 0.3, 0.3, "#f1efe8");
  }
  // trambaan: een strook gras met per spoor twee stalen rails
  for (const l of d.lijnen) if (l.s === "tram") lijn(l, GRONDKLEUR.gras, 4.2);
  for (const l of d.lijnen) if (l.s === "tram") {
    for (const k of [-0.72, 0.72]) {
      x.strokeStyle = "#5d5a55"; x.lineWidth = Math.max(1, 0.09 * s); x.beginPath();
      l.p.forEach((p, i) => {
        const q = l.p[Math.min(i + 1, l.p.length - 1)], r = l.p[Math.max(i - 1, 0)];
        const dx = q[0] - r[0], dz = q[1] - r[1], L = Math.hypot(dx, dz) || 1;
        x[i ? "lineTo" : "moveTo"](...P([p[0] - (dz / L) * k, p[1] + (dx / L) * k]));
      });
      x.stroke();
    }
  }
  // parkeervakken: witte lijnen links en rechts van elke haakse plek
  for (const v of d.vlakken) if (v.s === "vak" || v.s === "strook") vlak(v.r, GRONDKLEUR.parkeer);
  // de vakken zelf zijn van grijze stenen, met lichte strepen ertussen
  x.strokeStyle = "#cfc9c0"; x.lineWidth = Math.max(1, 0.1 * s);
  for (const [px, pz, h, haaks] of d.plekken) {
    const fx = Math.sin(h), fz = Math.cos(h), zx = fz, zz = -fx;
    const lw = haaks ? 1.22 : 1.05, ll = haaks ? 2.45 : 2.75;
    const q = [[-lw, -ll], [lw, -ll], [lw, ll], [-lw, ll]].map(([a, b]) => P([px + zx * a + fx * b, pz + zz * a + fz * b]));
    x.fillStyle = GRONDKLEUR.vak; x.beginPath(); q.forEach((p, i) => x[i ? "lineTo" : "moveTo"](...p)); x.closePath(); x.fill(); x.stroke();
  }
  for (const v of d.voetafdrukken) vlak(v.ring, GRONDKLEUR.gebouw);
  // ruis erover
  const r2 = document.createElement("canvas"); r2.width = r2.height = px; r2.getContext("2d").putImageData(ruis, 0, 0);
  x.globalCompositeOperation = "multiply"; x.globalAlpha = 0.25; x.drawImage(r2, 0, 0);
  x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Een kale boom (winter): stam met takken in twee lagen, als één geometrie van 1 m hoog. */
function kaleBoom() {
  const bak = [];
  const tak = (a, b, r) => buis(bak, a, b, r, "#3f362e", 0, 4);
  tak(V(0, 0, 0), V(0, 0.55, 0), 0.03);
  for (let i = 0; i < 6; i++) {
    const h = 0.4 + i * 0.07, hoek = i * 2.4 + Math.random() * 0.5, uit = 0.18 + Math.random() * 0.1;
    const a = V(0, h, 0), b = V(Math.cos(hoek) * uit, h + 0.25 + Math.random() * 0.12, Math.sin(hoek) * uit);
    tak(a, b, 0.012);
    for (let j = 0; j < 3; j++) {
      const h2 = hoek + (j - 1) * 0.7;
      tak(b, b.clone().add(V(Math.cos(h2) * 0.1, 0.1 + Math.random() * 0.1, Math.sin(h2) * 0.1)), 0.005);
    }
  }
  tak(V(0, 0.55, 0), V(0.02, 0.95, 0.01), 0.012);
  // het laatste blad hangt er nog aan: oranje en bruin, in plukken rond de takken
  const blad = new THREE.TetrahedronGeometry(0.02);
  for (let i = 0; i < 150; i++) {
    const hoek = Math.random() * 6.283, uit = 0.08 + Math.random() * 0.3, h = 0.52 + Math.random() * 0.48;
    stuk(bak, blad, kies(["#c8792b", "#d98a2f", "#b5641f", "#e0a03a", "#9a5a22"]), M(V(Math.cos(hoek) * uit, h, Math.sin(hoek) * uit), [Math.random() * 3, Math.random() * 3, 0], [1 + Math.random(), 0.5, 1 + Math.random()]));
  }
  return plak(bak);
}

// ---------- structuur op de grond: klinkers op straat, tegels op de stoep ----------
// De grondtekening is te grof voor losse stenen (8 cm per beeldpunt). Daarom een klein, herhalend patroon dat de
// kleur van de grond per steen iets lichter of donkerder maakt: R = klinkers (21 x 10,5 cm, halfsteens), G = stoeptegels
// (30 x 30 cm), B = grove vlekken. De shader kiest op de kleur van de grond: gras en asfalt krijgen geen stenen.
let steenKaart = null;
function maakSteenKaart() {
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d"), im = x.createImageData(N, N), D = im.data;
  const rnd = (i, j, k) => { const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
  // grove vlekken: 16 x 16 willekeurige waarden, vloeiend ertussen (herhalend)
  const vlek = (u, v) => {
    const fu = u * 16, fv = v * 16, i = Math.floor(fu), j = Math.floor(fv), a = fu - i, b = fv - j, s = (t) => t * t * (3 - 2 * t);
    const g = (p, q) => rnd(((p % 16) + 16) % 16, ((q % 16) + 16) % 16, 3);
    return (g(i, j) * (1 - s(a)) + g(i + 1, j) * s(a)) * (1 - s(b)) + (g(i, j + 1) * (1 - s(a)) + g(i + 1, j + 1) * s(a)) * s(b);
  };
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    // klinkers: 4 stenen breed, 8 rijen hoog, om en om een halve steen verschoven
    const rij = Math.floor(py / 32), sx = (px + (rij % 2) * 32) % N, kol = Math.floor(sx / 64);
    const voeg = sx % 64 < 2 || py % 32 < 2;
    const steen = voeg ? 0.3 : 0.4 + 0.2 * rnd(kol, rij, 1) + 0.03 * rnd(px, py, 5);
    // tegels: 3 x 3
    const T = N / 3, tv = px % T < 1.6 || py % T < 1.6;
    const tegel = tv ? 0.36 : 0.46 + 0.08 * rnd(Math.floor(px / T), Math.floor(py / T), 2) + 0.02 * rnd(px, py, 6);
    const o = (py * N + px) * 4;
    D[o] = steen * 255; D[o + 1] = tegel * 255; D[o + 2] = vlek(px / N, py / N) * 255; D[o + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
  return t;
}
function steenPatroon(mat) {
  steenKaart ??= maakSteenKaart();
  const G = natuur.grond;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.steenKaart = { value: steenKaart };
    if (G) for (const [n, t] of Object.entries(G)) sh.uniforms[`t_${n}`] = { value: t };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vGrondXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGrondXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
    const soort = `
        vec3 g0 = diffuseColor.rgb; float mx = max(g0.r, max(g0.g, g0.b)); float lum = dot(g0, vec3(0.3, 0.59, 0.11));
        float gras = step(g0.b * 1.25, g0.g) * step(g0.r * 0.86, g0.g);
        float asfalt = 1.0 - smoothstep(0.085, 0.105, mx);
        float rood = smoothstep(0.52, 0.62, (g0.r - g0.g) / max(g0.r, 0.001));
        float vlek = texture2D(steenKaart, vGrondXZ / 11.0).b;`;
    // met foto's van echte grond: gras, klinkers, stoeptegels en asfalt. De foto geeft de structuur, onze kaart de kleur.
    const echt = `#include <map_fragment>
      {${soort}
        vec3 tG = texture2D(t_gras, vGrondXZ / 2.0).rgb * texture2D(t_gras, vGrondXZ / 9.7).rgb * 4.0;
        vec3 tA = texture2D(t_asfalt, vGrondXZ / 3.0).rgb * texture2D(t_asfalt, vGrondXZ / 13.0).rgb * 4.0;
        vec3 tK = texture2D(t_klinker, vGrondXZ / 2.0).rgb * 2.0;
        vec3 tT = texture2D(t_tegel, vGrondXZ / 1.85).rgb * 2.0;
        vec3 det = mix(tK, tT, smoothstep(0.3, 0.4, lum));
        det = mix(det, tA, max(asfalt, rood));
        det = mix(det, tG, gras);
        diffuseColor.rgb *= det * (0.88 + 0.24 * vlek);
      }`;
    const getekend = `#include <map_fragment>
      {${soort}
        float steen = texture2D(steenKaart, vGrondXZ / 0.84).r;
        float tegel = texture2D(steenKaart, vGrondXZ / 0.9).g;
        float d = mix(steen, tegel, smoothstep(0.3, 0.4, lum));
        float s = (1.0 - gras) * (1.0 - asfalt) * (1.0 - rood);
        float korrel = texture2D(steenKaart, vGrondXZ / 0.37).b;
        diffuseColor.rgb *= mix(1.0, d * 2.0, s) * (0.84 + 0.32 * vlek) * mix(1.0, 0.86 + 0.28 * korrel, max(asfalt, rood) * (1.0 - gras));
      }`;
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D steenKaart;\n" + (G ? "uniform sampler2D t_gras, t_klinker, t_tegel, t_asfalt;\n" : "") + "varying vec2 vGrondXZ;")
      .replace("#include <map_fragment>", G ? echt : getekend);
  };
  return mat;
}

// ---------- blad op de heggen: lichte en donkere vlekjes in plaats van één egale kleur ----------
let bladKaart = null;
function bladPatroon(mat) {
  if (!bladKaart) {
    const N = 128, c = document.createElement("canvas"); c.width = c.height = N;
    const x = c.getContext("2d");
    x.fillStyle = "#7a7a7a"; x.fillRect(0, 0, N, N);
    // veel kleine blaadjes: donkere gaten en lichte toppen (herhalend over de rand)
    for (let i = 0; i < 900; i++) {
      const px = Math.random() * N, py = Math.random() * N, r = 1.6 + Math.random() * 3.4, v = Math.random();
      x.fillStyle = v < 0.45 ? `rgba(20,20,20,${0.35 + Math.random() * 0.4})` : `rgba(235,235,235,${0.25 + Math.random() * 0.4})`;
      for (const ox of [0, N, -N]) for (const oy of [0, N, -N]) { x.beginPath(); x.ellipse(px + ox, py + oy, r, r * 0.6, Math.random() * 3, 0, 6.3); x.fill(); }
    }
    bladKaart = new THREE.CanvasTexture(c);
    bladKaart.wrapS = bladKaart.wrapT = THREE.RepeatWrapping; bladKaart.colorSpace = THREE.NoColorSpace;
  }
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.bladKaart = { value: bladKaart };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vBladPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBladPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D bladKaart;\nvarying vec3 vBladPos;")
      .replace("#include <color_fragment>", `#include <color_fragment>
      {
        // drie richtingen door elkaar, zodat zijkanten en bovenkant allemaal blad hebben
        float b1 = texture2D(bladKaart, vBladPos.xz / 2.3).r, b2 = texture2D(bladKaart, vec2(vBladPos.x + vBladPos.z, vBladPos.y * 1.3) / 2.3).r;
        float b3 = texture2D(bladKaart, vBladPos.xz / 9.0).r, b4 = texture2D(bladKaart, vec2(vBladPos.x - vBladPos.z, vBladPos.y) / 6.0).r;
        float blad = b1 * 0.5 + b2 * 0.5;
        diffuseColor.rgb *= (0.3 + 1.5 * blad) * (0.55 + 0.9 * b3 * b4 * 2.0);
        // lichtere, gelere toppen en bruine, kale plekken
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.35, 1.25, 0.7), smoothstep(0.5, 0.75, blad) * 0.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.06, 0.035), smoothstep(0.42, 0.25, blad) * 0.55);
      }`);
  };
  return mat;
}

// ---------- echte bomen (Sketchfab, CC BY 4.0) en grondtexturen (Poly Haven, CC0); zie tools/natuur ----------
const natuur = { boom: null, kaal: null, grond: null };
export async function laadNatuur() {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import("../lib/three-addons.js"), import("../lib/meshopt_decoder.mjs")]);
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), v = window.VERSIE ?? "", T = new THREE.TextureLoader();
  const boom = async (n) => {
    const g = (await L.loadAsync(`assets/natuur/${n}.glb?v=${v}`)).scene; g.updateMatrixWorld(true);
    let mesh = null; g.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    const b = new THREE.Box3().setFromObject(mesh), mat = mesh.material;
    Object.assign(mat, { transparent: false, alphaTest: 0.5, depthWrite: true, side: THREE.DoubleSide, metalness: 0, roughness: 1 });
    // schaduw met de vorm van het blad (niet van de vierkante vlakjes)
    const diepte = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: 0.5 });
    natuur[n] = { geo: mesh.geometry, mat, diepte, m: mesh.matrixWorld.clone(), licht: n === "boom" ? 2.4 : 1.5, hoog: b.max.y - b.min.y, voet: b.min.y, mx: (b.min.x + b.max.x) / 2, mz: (b.min.z + b.max.z) / 2 };
  };
  const tex = (n) => new Promise((ok) => T.load(`assets/grond/${n}.jpg?v=${v}`, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; ok(t); }, undefined, () => ok(null)));
  const [, , gras, klinker, tegel, asfalt] = await Promise.all([boom("boom"), boom("kaal"), tex("gras"), tex("klinker"), tex("tegel"), tex("asfalt")]);
  if (gras && klinker && tegel && asfalt) natuur.grond = { gras, klinker, tegel, asfalt };
}
/** Zet bomen neer als kopieën van één model. lijst = [x, z, hoogte, kleur?]. */
function plantBomen(scene, model, lijst, breed = 1) {
  if (!lijst.length) return;
  const im = new THREE.InstancedMesh(model.geo, model.mat, lijst.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), kl = new THREE.Color();
  lijst.forEach(([x, z, h, kleur], i) => {
    const s = h / model.hoog; q.setFromEuler(new THREE.Euler(0, (x * 12.9898 + z * 78.233) % 6.283, 0));
    m4.compose(V(x, 0, z), q, V(s * breed, s, s * breed)).multiply(new THREE.Matrix4().makeTranslation(-model.mx, -model.voet, -model.mz)).multiply(model.m);
    im.setMatrixAt(i, m4); im.setColorAt(i, kl.set(kleur ?? "#ffffff").multiplyScalar(model.licht ?? 1));
  });
  im.castShadow = true; im.customDepthMaterial = model.diepte; im.frustumCulled = false;
  scene.add(im);
}

// ---------- speeltoestel (Sketchfab, CC BY 4.0; zie tools/speel) ----------
let speeltoestel = null;
export async function laadSpeeltoestel() {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import("../lib/three-addons.js"), import("../lib/meshopt_decoder.mjs")]);
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`assets/speel/toestel.glb?v=${window.VERSIE ?? ""}`);
  g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material.transparent) Object.assign(o.material, { transparent: false, alphaTest: 0.5, depthWrite: true, side: THREE.DoubleSide }); } });
  speeltoestel = g.scene;
}

export function bouwWereld(d, scene) {
  const wereld = { botsers: [], statisch: [], gevels: [], rond: [] };
  // speeltuintjes: het toestel in het midden, passend binnen de rand
  if (speeltoestel) for (const [x, z, straal] of d.speeltuinen ?? []) {
    if (Math.hypot(x, z) > 300 || straal < 3) continue;
    // houten toren met glijbaan en schommels, in het noordelijke deel van de cirkel (zoals op de luchtfoto)
    const t = speeltoestel.clone(), maat = Math.min(1.15, straal / 7);
    const tx = x - straal * 0.12, tz = z - straal * 0.38;
    t.position.set(tx, 0, tz); t.rotation.y = 0.5; t.scale.setScalar(maat);
    t.updateMatrixWorld(true);
    scene.add(t); t.traverse((o) => { if (o.isMesh) wereld.botsers.push(o); });
    wereld.rond.push([tx, tz, 1.5 * maat]);
  }
  // gebouwen
  for (const [stijl, m] of Object.entries(d.muren)) {
    if (!m.pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(m.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(m.uv, 2));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: gevelTextuur(GEVEL[stijl]), roughness: 0.85 });
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh); wereld.botsers.push(mesh);
  }
  for (const [soort, m] of Object.entries(d.daken)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(m.pos, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: soort === "pannen" ? "#b8532e" : "#6a6863", roughness: 0.95 }));
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh); wereld.botsers.push(mesh);
  }
  // grond: groot (680 m) en fijn (170 m rond de parkeerplaats)
  // de verre grond grof (1024), het plein zelf fijn (2048)
  if (d.seizoen === "winter") Object.assign(GRONDKLEUR, { gras: "#7c7650", struik: "#4c5236", basis: "#aaa49a" });
  for (const [maat, px, y] of [[680, 1024, -0.02], [170, 2048, 0]]) {
    const t = tekenGrond(d, [0, 0], maat, px);
    const g = new THREE.PlaneGeometry(maat, maat);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, steenPatroon(new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, polygonOffset: y === 0, polygonOffsetFactor: -1 })));
    mesh.position.y = y;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (y === 0) wereld.grond = mesh;
  }
  // stoepranden: lage randen langs wegen in het speelgebied zijn te duur; we laten ze weg.

  maakBorden(d.winkels ?? [], scene);
  maakMuurtjesEnBogen(d, scene, wereld);
  maakOverkappingen(d.lijnen, scene);

  // bomen (instanced): stam + twee kruinen
  // bomen pal voor je raam laten we weg: anders kijk je tegen blad aan in plaats van op het plein (VRIJ_ZICHT in config.js)
  const ramen = (d.standplaatsen ?? []).filter((st) => st.soort !== "grond");
  const inZicht = (b) => ramen.some((st) => { const dx = b[0] - st.pos[0], dz = b[1] - st.pos[2], l = Math.hypot(dx, dz) || 1; return l < VRIJ_ZICHT.afstand && (dx * st.normaal[0] + dz * st.normaal[1]) / l > VRIJ_ZICHT.hoek; });
  let bomen = d.bomen.filter((b) => Math.hypot(b[0], b[1]) < 300 && !inZicht(b));
  const alleBomen = bomen;
  // dichtbij: echte boommodellen (hoogstens 170); verder weg de eenvoudige
  const echt = natuur.boom ? alleBomen.map((b) => [b, Math.hypot(b[0], b[1])]).filter(([, a]) => a < 110).sort((p, q) => p[1] - q[1]).slice(0, 170).map(([b]) => b) : [];
  if (echt.length) {
    const set = new Set(echt), rnd = (b, k) => { const v = Math.sin(b[0] * 127.1 + b[1] * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
    const H = (b) => Math.max(6, Math.min(b[2], 14)) * (0.9 + rnd(b, 1) * 0.3);
    if (d.seizoen === "winter") {
      // late herfst: de helft is kaal, de rest heeft nog bruin en oranje blad
      plantBomen(scene, natuur.kaal, echt.filter((b) => rnd(b, 2) < 0.5).map((b) => [b[0], b[1], H(b) * 0.9]), 1.1);
      plantBomen(scene, natuur.boom, echt.filter((b) => rnd(b, 2) >= 0.5).map((b) => [b[0], b[1], H(b), ["#d98a3a", "#c9742c", "#b5642a", "#e0a04a"][(rnd(b, 3) * 4) | 0]]));
    } else plantBomen(scene, natuur.boom, echt.map((b) => [b[0], b[1], H(b), ["#ffffff", "#e9f2d8", "#d6e6c4", "#f3f0d0"][(rnd(b, 3) * 4) | 0]]));
    bomen = alleBomen.filter((b) => !set.has(b));
  }
  if (d.seizoen === "winter") {
    // kale bomen: één geometrie, per boom geschaald en gedraaid
    const kaal = new THREE.InstancedMesh(kaleBoom(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), bomen.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    bomen.forEach(([x, z, h], i) => {
      h = Math.max(6, Math.min(h, 14));
      q.setFromEuler(new THREE.Euler(0, Math.random() * 6.3, 0));
      kaal.setMatrixAt(i, m4.compose(V(x, 0, z), q, V(h * (0.8 + Math.random() * 0.4), h, h * (0.8 + Math.random() * 0.4))));
    });
    kaal.castShadow = true;
    scene.add(kaal);
    wereld.bomen = alleBomen;
  } else {
  const stam = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: "#4e3d2e", roughness: 1 }), bomen.length);
  const kruinGeo = new THREE.IcosahedronGeometry(1, 1);
  const p = kruinGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = 0.88 + Math.random() * 0.2; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.9, p.getZ(i) * f); }
  kruinGeo.computeVertexNormals();
  const kruin = new THREE.InstancedMesh(kruinGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 }), bomen.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), kl = new THREE.Color();
  bomen.forEach(([x, z, h], i) => {
    h = Math.max(5, Math.min(h, 14));
    stam.setMatrixAt(i, m4.compose(V(x, 0, z), q, V(0.8, h * 0.72, 0.8)));
    const r = h * 0.2;
    for (let k = 0; k < 2; k++) {
      q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
      kruin.setMatrixAt(i * 2 + k, m4.compose(V(x + tussen(-0.5, 0.5), h * (0.72 + k * 0.14), z + tussen(-0.5, 0.5)), q, V(r * (1 - k * 0.3), r * (0.9 - k * 0.2), r * (1 - k * 0.3))));
      kruin.setColorAt(i * 2 + k, kl.setHSL(0.2 + Math.random() * 0.07, 0.35 + Math.random() * 0.15, 0.22 + Math.random() * 0.1));
    }
  });
  q.identity();
  stam.castShadow = kruin.castShadow = true;
  scene.add(stam, kruin);
  wereld.bomen = alleBomen;
  }

  // heggen en perken
  const hegBak = [];
  for (const h of d.heggen) {
    if (h.r && h.r.length > 2) {
      const vorm = new THREE.Shape(h.r.map(([x, z]) => new THREE.Vector2(x, -z)));
      // een smalle strook (tussen fietspad en parkeervakken) is lage beplanting onder de bomen, geen heg
      let opp = 0, omtrek = 0;
      for (let i = 0; i < h.r.length - 1; i++) { opp += h.r[i][0] * h.r[i + 1][1] - h.r[i + 1][0] * h.r[i][1]; omtrek += Math.hypot(h.r[i + 1][0] - h.r[i][0], h.r[i + 1][1] - h.r[i][1]); }
      const smal = Math.abs(opp) / Math.max(1, omtrek) < 1.8;
      const g = new THREE.ExtrudeGeometry(vorm, { depth: smal ? 0.28 : h.h, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      stuk(hegBak, g, smal ? (d.seizoen === "winter" ? kies(["#5c5a30", "#665c2e", "#55552f"]) : "#4a6a30") : kies(["#3c5a2c", "#456631", "#36522a"]));
    } else if (h.l) for (let i = 0; i < h.l.length - 1; i++) {
      const [a, b] = [h.l[i], h.l[i + 1]];
      buis(hegBak, V(a[0], 0.6, a[1]), V(b[0], 0.6, b[1]), 0.45, "#3f5e2e", 0, 4);
    }
  }
  // schuttingen en heggen om de tuinen (BGT): hout 1,8 m, heg 1,5 m, muur of hek 1 m
  const houtBak = [];
  for (const [ax, az, bx, bz, soort] of d.schuttingen ?? []) {
    if (Math.hypot(ax, az) > 200) continue;
    const L = Math.hypot(bx - ax, bz - az), hoek = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (soort === "heg") blok(hegBak, 0.55, 1.5, L + 0.3, V(mx, 0.75, mz), kies(["#3c5a2c", "#456631", "#36522a"]), [0, hoek, 0]);
    else if (soort === "hout") {
      blok(houtBak, 0.05, 1.8, L, V(mx, 0.9, mz), kies(["#7a5a3c", "#6f5136", "#836343", "#74573b"]), [0, hoek, 0]);
      blok(houtBak, 0.1, 1.9, 0.1, V(ax, 0.95, az), "#5b4330");
    } else if (soort === "muur") blok(houtBak, 0.22, 1.1, L, V(mx, 0.55, mz), "#6e4a3c", [0, hoek, 0]);
    else { blok(houtBak, 0.04, 0.06, L, V(mx, 1.0, mz), "#4a4d50", [0, hoek, 0]); blok(houtBak, 0.04, 0.06, L, V(mx, 0.5, mz), "#4a4d50", [0, hoek, 0]); blok(houtBak, 0.06, 1.05, 0.06, V(ax, 0.52, az), "#4a4d50"); }
  }
  if (houtBak.length) {
    const sch = new THREE.Mesh(plak(houtBak), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    sch.castShadow = sch.receiveShadow = true;
    scene.add(sch); wereld.botsers.push(sch);
  }
  if (hegBak.length) {
    const heg = new THREE.Mesh(plak(hegBak), bladPatroon(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
    heg.castShadow = heg.receiveShadow = true;
    wereld.heg = heg; // voor de camera: die mag niet in een heg hangen
    scene.add(heg);
  }

  // straatmeubilair
  const meubel = [];
  wereld.rekken = [];
  for (const [soort, x, z, n] of d.dingen) {
    if (soort === "paal") buis(meubel, V(x, 0, z), V(x, 0.9, z), 0.06, "#3a3a3a", 0, 6);
    else if (soort === "bak") { buis(meubel, V(x, 0, z), V(x, 0.85, z), 0.22, "#2f4a3a", 0, 8); }
    else if (soort === "bank") { blok(meubel, 1.8, 0.08, 0.45, V(x, 0.45, z), "#7a5a3c"); blok(meubel, 1.8, 0.4, 0.06, V(x, 0.7, z - 0.22), "#7a5a3c"); blok(meubel, 1.6, 0.45, 0.35, V(x, 0.22, z), "#333"); }
    else if (soort === "container") blok(meubel, 1.3, 1.6, 1.3, V(x, 0.8, z), kies(["#5a6a52", "#7a7a7a", "#4a5a6a"]));
    else if (soort === "rek") wereld.rekken.push({ x, z, n: Math.min(n, 14) });
  }
  if (meubel.length) {
    const mm = new THREE.Mesh(plak(meubel), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    mm.castShadow = true;
    scene.add(mm);
  }

  // geparkeerde auto's in de vakken
  wereld.geparkeerd = [];
  for (const [x, z, hoek, haaks] of d.plekken) {
    if (Math.random() < 0.28) continue;
    // haaks: meestal met de neus het vak in
    const draai = hoek + (haaks ? (Math.random() < 0.75 ? 0 : Math.PI) : Math.random() < 0.5 ? Math.PI : 0) + tussen(-0.05, 0.05);
    wereld.geparkeerd.push(parkeer(x + tussen(-0.15, 0.15), z + tussen(-0.15, 0.15), draai, haaks));
  }
  // vaste auto's op vaste plekken (per level), langs de stoep met de neus in de rijrichting
  for (const [x, z, hoek, haaks, soort, kleur] of d.vasteAutos ?? []) wereld.geparkeerd.push(parkeer(x, z, hoek, haaks, soort, kleur));
  const autosBij = zetGeparkeerd(wereld.geparkeerd, scene);
  // De wereld schuift met je mee: de scherpe grond (170 m) en de getekende auto's liggen rond het punt waar je bent.
  let ac = null, gc = [0, 0];
  wereld.bij = (x, z, direct = false) => {
    if (!ac || Math.hypot(x - ac[0], z - ac[1]) > 20) { ac = [x, z]; autosBij(x, z); }
    if (Math.hypot(x - gc[0], z - gc[1]) > (direct ? 1 : 58)) { // het scherpe stuk is 170 m: ruim voor de rand opnieuw tekenen
      gc = [x, z];
      const oud = wereld.grond.material.map;
      wereld.grond.material.map = tekenGrond(d, gc, 170, 2048);
      wereld.grond.position.set(x, 0, z);
      oud.dispose();
    }
  };
  wereld.bij(0, 0);
  /** De geparkeerde auto's opnieuw tekenen (er is er een weggereden). */
  wereld.autosOpnieuw = () => { if (ac) autosBij(ac[0], ac[1]); };
  return wereld;
}

/** Fietsen in de rekken (stilstaand, wel raakbaar). */
export function zetFietsenInRekken(wereld, scene, voegToe) {
  for (const r of wereld.rekken) {
    if (Math.hypot(r.x, r.z) > 170) continue; // fietsen in rekken alleen rond het level zelf (ze worden samengevoegd tot één vorm)
    const hoek = Math.random() * Math.PI;
    const dx = Math.cos(hoek), dz = Math.sin(hoek);
    for (let i = 0; i < r.n; i++) {
      if (Math.random() < 0.35) continue;
      // dichtbij het echte model, ver weg het lichte
      const f = maakFiets(Math.random() < 0.25 ? "ebike" : "fiets", { licht: Math.hypot(r.x, r.z) > 45 });
      const s = (i - r.n / 2) * 0.6;
      f.position.set(r.x + dx * s, 0, r.z + dz * s);
      f.rotation.y = hoek + Math.PI / 2 + (i % 2 ? Math.PI : 0) + tussen(-0.1, 0.1);
      scene.add(f);
      voegToe(f);
    }
  }
}

/** Voegt stilstaande figuren samen tot één mesh per materiaal (veel minder draw calls).
 *  De losse objecten blijven bestaan buiten de scène, voor het raken. */
export function bevries(objecten, scene) {
  const perMat = new Map();
  for (const o of objecten) {
    o.updateMatrixWorld(true);
    o.traverse((m) => {
      if (!m.isMesh) return;
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!perMat.has(m.material)) perMat.set(m.material, []);
      perMat.get(m.material).push({ g, bot: 0 });
    });
    scene.remove(o);
  }
  for (const [mat, bak] of perMat) {
    const mesh = new THREE.Mesh(plak(bak), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
