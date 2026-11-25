// De magie van de tovenares: bevriezen (en omduwen: het standbeeld valt, breekt in stukken en klikt later weer in elkaar).
// Niemand raakt gewond: wie ontdooit staat op en rent weg.
import * as THREE from "three";

const beelden = [];
const v = new THREE.Vector3();
const SOORT = (naam) => (/head|neck/.test(naam) ? "hoofd" : /upper_arm|forearm|hand|f_|thumb|palm/.test(naam) ? (naam.endsWith("L") ? "armL" : "armR") : /thigh|shin|foot|toe/.test(naam) ? (naam.endsWith("L") ? "beenL" : "beenR") : "romp");

/**
 * Maakt van iemand in zijn huidige houding een standbeeld van ijs dat uit losse stukken bestaat (romp, hoofd, armen, benen).
 * De punten van het lijf worden één keer uitgerekend in de houding van dit moment en verdeeld naar het bot waar ze aan hangen.
 */
function maakBeeld(wie) {
  const m = wie.m, mesh = m.hoog; m.detail(true, false);
  wie.groep.updateMatrixWorld(true); mesh.skeleton.update();
  const geo = mesh.geometry, P = geo.attributes.position, U = geo.attributes.uv, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, idx = geo.index;
  const wereld = new Float32Array(P.count * 3), soort = new Array(P.count), botten = mesh.skeleton.bones;
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i); mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld).sub(wie.pos).toArray(wereld, i * 3);
    let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; best = SI.getComponent(i, k); } }
    soort[i] = SOORT(botten[best]?.name ?? "");
  }
  const mat = mesh.material.clone(); Object.assign(mat, { roughness: 0.12, metalness: 0.1, emissive: new THREE.Color("#2a6fa8"), emissiveIntensity: 0.45 }); mat.color.set("#bfe6ff");
  const groep = new THREE.Group(); groep.position.copy(wie.pos);
  const delen = [], n = idx ? idx.count : P.count, hoek = (k) => (idx ? idx.getX(k) : k);
  for (const s of ["romp", "hoofd", "armL", "armR", "beenL", "beenR"]) {
    const pos = [], uv = [];
    for (let k = 0; k < n; k += 3) {
      const a = hoek(k); if (soort[a] !== s) continue;
      for (let j = 0; j < 3; j++) { const q = hoek(k + j); pos.push(wereld[q * 3], wereld[q * 3 + 1], wereld[q * 3 + 2]); if (U) uv.push(U.getX(q), U.getY(q)); }
    }
    if (!pos.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); if (uv.length) g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z); g.computeVertexNormals();
    const stuk = new THREE.Mesh(g, mat); stuk.position.copy(c); stuk.castShadow = true; groep.add(stuk);
    delen.push({ stuk, soort: s, rust: c.clone(), v: new THREE.Vector3(), w: new THREE.Vector3() });
  }
  return { groep, delen };
}

export function maakMagie({ scene, geluid, fx }) {
  /** Bevries iemand: hij wordt een standbeeld van ijs en blijft zo staan tot hij ontdooit (of tot je hem omduwt). */
  function bevries(wie) {
    if (!wie.m?.hoog || wie.worp || wie.groep?.visible === false) return false;
    const b = { wie, t: 0, fase: "staat", ...maakBeeld(wie), hoek: 0 };
    wie.groep.visible = false; wie.worp = { fase: "ijs" }; wie.ruzieT = 0; wie.dreigt = false;
    scene.add(b.groep); beelden.push(b);
    geluid.glas(); for (let i = 0; i < 8; i++) fx.deeltje(wie.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 1.7, (Math.random() - 0.5) * 0.6)), { leven: 0.6, kleur: "#d6f1ff", r0: 0.05, r1: 0.5, v: new THREE.Vector3(0, 0.5, 0) });
    return true;
  }
  /** Duw een standbeeld om, van je af. */
  function duwOm(b, van) {
    if (b.fase !== "staat") return;
    const dx = b.wie.pos.x - van.x, dz = b.wie.pos.z - van.z, d = Math.hypot(dx, dz) || 1;
    b.fase = "valt"; b.t = 0; b.dir = new THREE.Vector3(dx / d, 0, dz / d); b.as = new THREE.Vector3(dz / d, 0, -dx / d);
    geluid.zwiep(0.8);
  }
  function stap(dt, speler) {
    for (const b of [...beelden]) {
      b.t += dt;
      if (b.fase === "staat") {
        if (speler && Math.hypot(speler.x - b.wie.pos.x, speler.z - b.wie.pos.z) < 0.85) duwOm(b, speler); // ertegenaan lopen = omduwen
        else if (b.t > 9) klaar(b, false); // vanzelf ontdooid: hij schrikt en rent weg
      } else if (b.fase === "valt") {
        // als een standbeeld: stijf om zijn voeten kantelen, steeds sneller
        b.hoek = Math.min(Math.PI / 2, (b.t / 0.6) ** 2 * (Math.PI / 2));
        b.groep.quaternion.setFromAxisAngle(b.as, b.hoek);
        if (b.hoek >= Math.PI / 2) {
          // de klap: armen, benen en hoofd breken af en schuiven een eindje weg
          b.fase = "stuk"; b.t = 0; geluid.glas(); geluid.bonk(); geluid.stomp(0.8);
          // (in de ruimte van het gekantelde beeld is "omhoog" de richting -dir, y loopt langs het lijf en as is opzij)
          b.op = new THREE.Vector3(-b.dir.x, 0, -b.dir.z);
          for (const d of b.delen) if (d.soort !== "romp") { d.v.copy(b.as).multiplyScalar((Math.random() - 0.5) * 2.6).add(new THREE.Vector3(0, (Math.random() - 0.5) * 2.2, 0)).addScaledVector(b.op, 0.5 + Math.random() * 0.6); d.w.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9); }
          for (let i = 0; i < 10; i++) fx.brok(b.wie.pos.clone().addScaledVector(b.dir, 0.4 + Math.random() * 1.2).setY(0.15), "#cfeaff", 0.04, new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3));
        }
      } else if (b.fase === "stuk") {
        for (const d of b.delen) {
          if (d.soort === "romp") continue;
          d.stuk.position.addScaledVector(d.v, dt); d.stuk.rotation.x += d.w.x * dt; d.stuk.rotation.y += d.w.y * dt; d.stuk.rotation.z += d.w.z * dt;
          const rem = Math.exp(-dt * 4); d.v.multiplyScalar(rem); d.w.multiplyScalar(rem);
          d.v.addScaledVector(b.op, -dt * 3.5);
          const h = d.stuk.position.dot(b.op) - d.rust.dot(b.op); if (h < 0) { d.stuk.position.addScaledVector(b.op, -h); d.v.addScaledVector(b.op, -Math.min(0, d.v.dot(b.op))); } // niet door de grond
        }
        if (b.t > 3.2) { b.fase = "heel"; b.t = 0; for (const d of b.delen) { d.van = d.stuk.position.clone(); d.q = d.stuk.quaternion.clone(); } }
      } else if (b.fase === "heel") {
        // ontdooien: de stukken schuiven terug en klikken vast, een voor een
        b.delen.forEach((d, i) => {
          if (d.soort === "romp") return;
          const k = THREE.MathUtils.clamp((b.t - i * 0.12) / 0.3, 0, 1), e = k * k * (3 - 2 * k);
          d.stuk.position.lerpVectors(d.van, d.rust, e); d.stuk.quaternion.slerpQuaternions(d.q, new THREE.Quaternion(), e);
          if (k >= 1 && !d.klik) { d.klik = true; geluid.tik(1); }
        });
        if (b.t > 1.3) klaar(b, true);
      }
    }
  }
  /** Het beeld wordt weer een mens: liggend (dan staat hij op en rent weg) of staand (dan rent hij meteen). */
  function klaar(b, ligt) {
    const wie = b.wie; scene.remove(b.groep); beelden.splice(beelden.indexOf(b), 1);
    wie.groep.visible = true; wie.m.detail(true, false);
    if (ligt) {
      wie.pos.addScaledVector(b.dir, 0.9); wie.richting = Math.atan2(-b.dir.x, -b.dir.z);
      wie.worp = { fase: "ligt", t: 0, y: 0, vx: b.dir.x, vz: b.dir.z, ren: true };
      wie.m.zet("liggen", 1, "eind");
    } else { wie.worp = null; wie.ruzieKoel = 20; wie.schrikken?.(); }
  }
  return { bevries, stap, beelden, duwOm, isBevroren: (wie) => wie.worp?.fase === "ijs" };
}
