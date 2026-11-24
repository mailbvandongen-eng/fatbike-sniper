// Alles wat het gevoel van camera, richten en schieten bepaalt, op één plek. Pas hier getallen aan en herlaad.
// Afstanden in meters, hoeken in radialen, tempo's in "per seconde" (hoger = strakker, lager = zachter).

/**
 * @typedef {Object} CameraStand
 * @property {number} afstand   hoe ver de camera achter je hangt
 * @property {number} hoogte    hoogte van het punt waar de camera omheen draait (schouderhoogte)
 * @property {number} schouder  hoe ver naar rechts: hoger = jij staat verder links in beeld, het midden blijft vrij
 * @property {number} demping   hoe snel de camera je volgt
 * @property {number} fov       beeldhoek in graden (kleiner = ingezoomd)
 */
/** De camera als je over straat loopt: gewoon, richtend (ADS) en sprintend. @type {Record<"lopen"|"richten"|"sprint", CameraStand>} */
export const CAMERA = {
  lopen: { afstand: 3.5, hoogte: 1.7, schouder: 0.78, demping: 13, fov: 55 },
  richten: { afstand: 1.75, hoogte: 1.62, schouder: 0.8, demping: 30, fov: 40 },
  sprint: { afstand: 4.0, hoogte: 1.7, schouder: 0.78, demping: 13, fov: 61 },
};
/** Botsen van de camera met muren, schuttingen, bomen en speeltoestellen. */
export const CAMERA_BOTSING = {
  marge: 0.3, // zo ver blijft de camera voor een obstakel
  bol: 0.22, // breedte van de "bol" om de camera: er gaan stralen links, rechts en boven langs
  minAfstand: 0.6,
  naarVoren: 20, // tempo waarmee de camera naar je toe schuift als er iets achter je staat
  terug: 5, // en waarmee hij daarna weer afstand neemt
  boomstam: 0.35, // dikte van een boomstam voor de camera
};
/** De camera bij je raam, per soort standplaats: [achter je, naar rechts, omhoog]. */
export const CAMERA_STAND = { balkon: [2.9, 0.95, 0.55], diep: [1.35, 0.7, 0.45], raam: [1.45, 0.6, 0.48], dak: [2.1, 0.8, 1.35], grond: [2.4, 0.8, 0.5] };
/** Kijken met je vinger: 1 = het beeld volgt je vinger precies. Ingezoomd en richtend gaat het vanzelf fijner (de beeldhoek telt mee). */
export const KIJKEN = { gevoeligheid: 1.05, omhoog: 0.45, omlaag: -0.7 };
/** Schieten. */
export const SCHOT = {
  herlaadGeweer: 1.1, // seconden tussen twee schoten bij het raam (grendel)
  herlaadPistool: 0.42, // en op straat
  terugslagGeweer: 1, terugslagPistool: 0.55, // hoe hard het beeld opveert
  flitsDuur: 0.07, // seconden dat het mondingsvuur te zien is
};
/** Bomen die pal voor je raam staan halen we weg, anders kijk je tegen blad aan: binnen deze afstand, in de kijkrichting. */
export const VRIJ_ZICHT = { afstand: 16, hoek: 0.35 };
