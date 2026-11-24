// Het spel op straat: gezocht worden (handhaving en politie komen achter je aan) en missies.
// Losgekoppeld van de hoofdlus: main.js geeft bij het starten door wat hier nodig is (ctx) en roept stap() elk beeld aan.
import * as THREE from "three";
import { Agent, Fietser } from "./verkeer.js";
import { kies, tussen } from "./figuren.js";

/**
 * ctx: { scene, reizigers, loop, spel, graaf, data, geluid, $, vrij(x, z), zichtVrij(a, b), naarBinnen(), melding(soort), tekenHud(), weg(r) }
 */
export function maakStraat(ctx) {
  const { scene, reizigers, loop, spel, geluid, $ } = ctx;
  const S = { hitte: 0, gezienT: 0, gezien: false, sireneT: 0, missie: null, aanbod: null, aanbodT: 4, volgnr: +(localStorage.getItem("fbs-missies") ?? 0), gepakt: false };

  // ================= gezocht =================
  const sterren = () => Math.min(3, Math.floor(S.hitte));
  const agenten = () => reizigers.filter((r) => r.soort === "agent" && !r.afdruipen);
  /** Iets strafbaars gedaan (alleen op straat telt het). */
  S.strafbaar = (n) => {
    if (!loop.aan || S.gepakt) return;
    const voor = sterren();
    S.hitte = Math.min(3.99, S.hitte + n);
    if (sterren() > voor) { S.gezienT = 0; geluid.fout(); }
  };
  function stapGezocht(dt) {
    const n = sterren(), ag = agenten();
    S.gezien = ag.some((a) => a.ziet);
    if (n >= 1) {
      // genoeg achtervolgers voor dit niveau: 1 ster twee handhavers, daarboven politie
      const nodig = [0, 2, 3, 5][n];
      if (ag.length < nodig && (S.spawnT = (S.spawnT ?? 0) - dt) <= 0) {
        S.spawnT = 1.5;
        const k = ctx.graaf.startKnoop(4, 55, 35), [x, z] = ctx.graaf.k[k];
        if (ctx.vrij(x, z)) reizigers.push(new Agent(ctx.graaf, scene, x, z, n >= 2 ? "agent" : "handhaver"));
      }
      // uit het zicht: na een paar tellen zakt het niveau, een ster per zeven tellen
      S.gezienT = S.gezien ? 0 : S.gezienT + dt;
      if (S.gezienT > 5) S.hitte -= dt / 7;
      if (S.hitte < 1) { S.hitte = 0; for (const a of ag) a.afdruipen = true; geluid.goed(); }
      if (n >= 2 && S.gezien && (S.sireneT -= dt) <= 0) { S.sireneT = 2.6; geluid.sirene(0.8); }
    } else if (S.hitte > 0) S.hitte = Math.max(0, S.hitte - dt / 25); // kleine dingen vergeet men vanzelf
    // de sterren in beeld
    const el = $("#sterren");
    el.hidden = S.hitte < 1;
    if (!el.hidden) {
      el.innerHTML = [0, 1, 2].map((i) => `<i class="${i < n ? "aan" : ""}">★</i>`).join("");
      el.classList.toggle("kwijt", S.gezienT > 5);
    }
  }
  /** Een agent heeft je te pakken: terug naar je raam, punten kwijt, missie mislukt. */
  S.aangehouden = () => {
    if (S.gepakt || !loop.aan) return;
    S.gepakt = true;
    geluid.fout();
    spel.rondeScore = Math.max(0, spel.rondeScore - 250);
    document.body.classList.add("gepakt");
    if (S.missie) eindeMissie(false);
    ctx.naarBinnen();
    setTimeout(() => { document.body.classList.remove("gepakt"); S.reset(false); ctx.tekenHud(); }, 1500);
  };
  /** Mag je nu naar binnen? Niet als ze je op dit moment zien. */
  S.magNaarBinnen = () => !(sterren() >= 1 && S.gezien);
  /** Naar binnen gegaan of een nieuwe ronde: alles op straat stopt. */
  S.reset = (ookMissie = true) => {
    S.hitte = 0; S.gezienT = 0; S.gepakt = false;
    for (const r of [...reizigers]) if (r.soort === "agent") ctx.weg(r);
    $("#sterren").hidden = true;
    if (ookMissie) { if (S.missie) eindeMissie(false, true); zetAanbod(null); S.aanbodT = 4; }
  };

  // ================= missies =================
  // Drie soorten, om de beurt: een hangplek opruimen, banden lek steken voor de tijd om is, een vluchter stoppen.
  const SOORTEN = ["hangplek", "banden", "achtervolging"];
  const baken = (kleur) => {
    const g = new THREE.Group();
    const straal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 9, 20, 1, true), new THREE.MeshBasicMaterial({ color: kleur, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    straal.position.y = 4.5;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 6, 28), new THREE.MeshBasicMaterial({ color: kleur }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
    g.add(straal, ring); g.visible = false; scene.add(g);
    return g;
  };
  const startBaken = baken("#ffc83d"), doelBaken = baken("#ff5a3d");
  const pijlGeo = new THREE.ConeGeometry(0.22, 0.5, 4), pijlMat = new THREE.MeshBasicMaterial({ color: "#ff5a3d" });
  const pijlen = [];
  function zetAanbod(a) { S.aanbod = a; startBaken.visible = !!a; if (a) startBaken.position.set(a.start[0], 0, a.start[1]); }
  /** Een vrije plek op een pad, tussen min en max meter van (x, z). */
  function plekBij(x, z, min, max) {
    for (let i = 0; i < 60; i++) {
      const h = Math.random() * 6.3, r = tussen(min, max), k = ctx.graaf.dichtbij(x + Math.cos(h) * r, z + Math.sin(h) * r, 4), [px, pz] = ctx.graaf.k[k];
      const d = Math.hypot(px - x, pz - z);
      if (d >= min * 0.7 && d <= max * 1.3 && ctx.vrij(px, pz)) return [px, pz];
    }
    return null;
  }
  function nieuwAanbod() {
    const soort = SOORTEN[S.volgnr % SOORTEN.length], p = loop.pos;
    const start = plekBij(p.x, p.z, 22, 42);
    if (!start) return;
    // waar het gebeurt: een hangplek of fietsenrek in de buurt, anders een vrije plek
    const hang = (spel.hangplekken ?? []).map((h) => [h.x, h.z]).filter((h) => { const d = Math.hypot(h[0] - start[0], h[1] - start[1]); return d > 25 && d < 110; });
    const rekken = ctx.data.dingen.filter((d) => d[0] === "rek").map((d) => [d[1], d[2]]).filter((h) => { const d = Math.hypot(h[0] - start[0], h[1] - start[1]); return d > 20 && d < 110; });
    const bij = soort === "hangplek" ? (hang.length ? kies(hang) : null) : soort === "banden" ? (rekken.length ? kies(rekken) : null) : null;
    // vlak bij die plek; lukt dat niet, dan een vrije plek verderop
    const plek = (bij && (plekBij(bij[0], bij[1], 2, 9) ?? (ctx.vrij(bij[0], bij[1]) ? bij : null)))
      ?? plekBij(start[0], start[1], soort === "achtervolging" ? 12 : 35, soort === "achtervolging" ? 18 : 60);
    if (!plek) return;
    zetAanbod({ soort, start, plek });
  }
  /** Een fatbike als doelwit van de missie, op een vaste plek. */
  function doelFiets(x, z, richting, leeg) {
    const f = new Fietser(ctx.graaf, scene, "fatbike", spel.ronde);
    f.missie = true; f.wacht = 1e6;
    f.pos.set(x, 0, z); f.pad.copy(f.pos); f.richting = richting;
    f.van = ctx.graaf.dichtbij(x, z, 8);
    const v = ctx.graaf.volgende(-1, f.van, 8, 2); if (v) { f.naar = v.n; f.breed = v.breed; f.t = 0; }
    if (leeg) {
      // geparkeerd: niemand erop
      for (const m of f.berijders) f.groep.remove(m.object);
      f.berijders = []; f.raak = f.raak.filter((r) => r.deel !== "mens"); f.schrikken = () => {};
    }
    f.groep.position.copy(f.pos); f.groep.rotation.y = richting;
    reizigers.push(f);
    return f;
  }
  /** Een vrije plek binnen een paar meter van (x, z), niet boven op een ander doelwit. */
  function los(x, z, bezet) {
    for (let r = 1.2; r < 9; r += 0.6) for (let k = 0; k < 8; k++) {
      const h = Math.random() * 6.3, qx = x + Math.cos(h) * r, qz = z + Math.sin(h) * r;
      if (ctx.vrij(qx, qz) && bezet.every((f) => Math.hypot(f.pos.x - qx, f.pos.z - qz) > 1.4)) return [qx, qz];
    }
    return [x, z];
  }
  function beginMissie() {
    const a = S.aanbod; zetAanbod(null);
    const M = (S.missie = { soort: a.soort, plek: a.plek, doelen: [], klaar: 0, tijd: null });
    const [px, pz] = a.plek;
    if (a.soort === "hangplek") {
      // drie fatbikes die op hun telefoon staan te kijken; raak je er één, dan gaan de anderen ervandoor
      for (let i = 0; i < 3; i++) { const q = los(px, pz, M.doelen); M.doelen.push(doelFiets(q[0], q[1], Math.random() * 6.3, false)); }
    } else if (a.soort === "banden") {
      // vier geparkeerde fatbikes op een rij: steek de banden lek voor de tijd om is
      const h = Math.random() * 6.3;
      for (let i = 0; i < 4; i++) {
        let x = px + Math.cos(h) * (i - 1.5) * 1.1, z = pz + Math.sin(h) * (i - 1.5) * 1.1;
        if (!ctx.vrij(x, z) || M.doelen.some((f) => Math.hypot(f.pos.x - x, f.pos.z - z) < 0.9)) [x, z] = los(px, pz, M.doelen);
        M.doelen.push(doelFiets(x, z, h + Math.PI / 2, true));
      }
      M.tijd = 80;
    } else {
      // een vluchter: rijdt kriskras door de buurt en stopt nergens voor
      const f = doelFiets(px, pz, 0, false);
      const pt = [];
      for (const l of ctx.data.lijnen) if (["weg", "fietspad", "stoep"].includes(l.s)) for (const q of l.p) if (Math.hypot(q[0] - px, q[1] - pz) < 110 && ctx.vrij(q[0], q[1])) pt.push(q);
      f.vrij = pt.length > 8 ? pt : null; f.wacht = 0; f.geenStop = true; f.schrikken = () => {};
      f.v = f.vBasis = 4.4;
      M.doelen.push(f); M.tijd = 110;
    }
    M.n = M.doelen.length;
    doelBaken.visible = a.soort !== "achtervolging"; doelBaken.position.set(px, 0, pz);
    geluid.goed();
    tekenMissie();
  }
  function eindeMissie(gelukt, stil = false) {
    const M = S.missie; if (!M) return;
    S.missie = null; doelBaken.visible = false;
    for (const f of M.doelen) if (f.toestand === "rijden") ctx.weg(f); // wat er nog staat of rijdt, verdwijnt
    for (const p of pijlen) p.visible = false;
    if (gelukt) {
      spel.rondeScore += 500 + (M.tijd ? Math.round(M.tijd) * 5 : 0);
      if (isFinite(spel.kogels)) spel.kogels += 4;
      localStorage.setItem("fbs-missies", ++S.volgnr);
      geluid.goed(); setTimeout(() => geluid.goed(), 260);
    } else if (!stil) geluid.fout();
    S.aanbodT = gelukt ? 5 : 3;
    tekenMissie(gelukt ? "gelukt" : stil ? "" : "mislukt");
    ctx.tekenHud();
  }
  /** Een doelwit van de missie is uitgeschakeld (aangeroepen vanuit fatbikeGeraakt). */
  S.doelGeraakt = (f) => {
    const M = S.missie; if (!M || !M.doelen.includes(f)) return;
    M.klaar++;
    // bij de hangplek: de rest schrikt en gaat ervandoor
    if (M.soort === "hangplek") for (const g of M.doelen) if (g !== f && g.toestand === "rijden") { g.wacht = 0; g.vlucht = 10; }
    if (M.klaar >= M.n) eindeMissie(true); else tekenMissie();
  };
  const ICOON = {
    fb: '<i class="fb"></i>',
    mes: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3c-6 1-11 5-13 10l3 3c5-2 9-7 10-13zM7 14l-4 4 3 3 4-4z"/></svg>',
    snel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17l5-5-5-5M12 17l5-5-5-5"/></svg>',
  };
  function tekenMissie(uitslag = "") {
    const el = $("#missie"), M = S.missie;
    if (!M) {
      // even de uitslag laten zien (groen of rood), dan weg
      el.className = `pil ${uitslag}`;
      if (uitslag) setTimeout(() => { if (!S.missie) el.hidden = true; }, 1600); else el.hidden = true;
      return;
    }
    el.hidden = false; el.className = "pil";
    const t = M.tijd === null ? "" : `<b class="${M.tijd < 15 ? "krap" : ""}">${Math.floor(Math.max(0, M.tijd) / 60)}:${String(Math.ceil(Math.max(0, M.tijd)) % 60).padStart(2, "0")}</b>`;
    el.innerHTML = `${M.soort === "banden" ? ICOON.mes : M.soort === "achtervolging" ? ICOON.snel : ""}${ICOON.fb}<span>${M.klaar}/${M.n}</span>${t}`;
  }
  function stapMissie(dt, tijd) {
    if (spel.modus === "bonus") return; // het bonuslevel heeft zijn eigen klok
    const M = S.missie;
    if (!M) {
      // een nieuwe missie aanbieden: een geel baken; loop erin om te beginnen
      if (!S.aanbod && (S.aanbodT -= dt) <= 0) { S.aanbodT = 2; nieuwAanbod(); }
      if (S.aanbod) {
        const d = Math.hypot(S.aanbod.start[0] - loop.pos.x, S.aanbod.start[1] - loop.pos.z);
        startBaken.children[1].scale.setScalar(1 + 0.12 * Math.sin(tijd * 4));
        if (d < 1.5) beginMissie();
        else if (d > 140) zetAanbod(null); // te ver weggelopen: een nieuwe dichterbij
      }
      return;
    }
    if (M.tijd !== null) {
      const voor = Math.ceil(M.tijd);
      M.tijd -= dt;
      if (Math.ceil(M.tijd) !== voor) tekenMissie();
      if (M.tijd <= 0) return eindeMissie(false);
    }
    // een pijl boven elk doelwit dat nog staat of rijdt
    let i = 0;
    for (const f of M.doelen) {
      if (f.toestand !== "rijden") continue;
      if (!pijlen[i]) { pijlen[i] = new THREE.Mesh(pijlGeo, pijlMat); scene.add(pijlen[i]); }
      const p = pijlen[i];
      p.visible = true; p.rotation.x = Math.PI; p.rotation.y = tijd * 2;
      p.position.set(f.pos.x, 2.5 + 0.12 * Math.sin(tijd * 5 + i), f.pos.z);
      i++;
    }
    for (; i < pijlen.length; i++) pijlen[i].visible = false;
    if (doelBaken.visible && Math.hypot(M.plek[0] - loop.pos.x, M.plek[1] - loop.pos.z) < 9) doelBaken.visible = false; // je bent er
  }

  S.stap = (dt, tijd) => {
    if (!loop.aan || !spel.bezig) return;
    stapGezocht(dt);
    stapMissie(dt, tijd);
  };
  /** Voor de radar: [x, z, soort] met soort = start | doel | agent. */
  S.radar = () => {
    const uit = [];
    if (S.aanbod) uit.push([...S.aanbod.start, "start"]);
    if (S.missie && doelBaken.visible) uit.push([...S.missie.plek, "doel"]);
    for (const r of reizigers) if (r.soort === "agent" && !r.afdruipen) uit.push([r.pos.x, r.pos.z, "agent"]);
    return uit;
  };
  S.sterren = sterren;
  return S;
}
