// De locaties van het spel. Coördinaten in Rijksdriehoek (RD New, meters).
export const LOCATIES = {
  julianaplein: {
    naam: "Koningin Julianaplein, Voorburg",
    midden: [84420, 454690], // de parkeerplaats
    straalGebouwen: 330,
    osmBbox: [52.0738, 4.3540, 52.0780, 4.3615], // zuid, west, noord, oost
    // Sluipschutter: flat Pleinzicht, 4e verdieping, kijkt naar het zuiden over de parkeerplaats naar de Jumbo.
    kort: "Julianaplein",
    flat: "Pleinzicht",
    verdieping: 4,
    kijkpunt: [84450.0, 454639.8], // de Jumbo
    muurplekken: [[-36, -12, "Achter het muurtje bij Bon Appetit"], [24, 44, "Achter het muurtje bij de Jumbo"], [44, -3, "Achter de muur aan de oostkant"]],
    // Gevels die afwijken van de regel "stijl op bouwjaar", naar Google 3D-beelden van Bob (22-11-2026). Sleutel = BAG-pand.
    stijlPerPand: {
      "1916100000102052": "bruinwit", // blok achter de parkeerplaats, boven de Jumbo
      "1916100000098418": "geel", // blok aan de westkant
      "1916100000101520": "creme", // blok aan de oostkant, met zonneschermen
      "1916100000099002": "zeilschip", // 't Zeilschip
      "1916100000115288": "zeilschip",
    },
  },
  steelaan: {
    naam: "Monseigneur van Steelaan, Voorburg",
    kort: "Van Steelaan",
    midden: [84298, 454812], // midden op de straat met de tramlijn
    straalGebouwen: 300,
    osmBbox: [52.0745, 4.3515, 52.0800, 4.3605],
    // Sluipschutter: portiekflat uit 1958 met verhoogd parterre (halve trap op, kelders eronder); woonkamer, 1e en 2e verdieping.
    flatPand: "1916100000099379",
    raam: [84275.3, 454836.7],
    parterre: 1.25,
    uit: 1.6, // op het balkon aan de voorkant, met ruimte voor de camera achter je
    verdieping: 1,
    verdiepingen: [[1, "Woonkamer"], [2, "1e verdieping"], [3, "2e verdieping"]],
    dak: false,
    kijkpunt: [84305, 454800], // over de tramlijn naar de overkant
    modus: "bonus", // zoveel mogelijk fatbikes in de tijd
    tijd: 180,
    seizoen: "winter",
    // vaste auto's op de plekken het dichtst bij de voordeur (op verzoek van Bob)
    vasteAutos: [{ soort: "rav4", kleur: "#08080a" }, { soort: "colt", kleur: "#a3151a" }],
    standaardStijl: "portiek", // lichte portiekflats met witte balkons (Google 3D-beeld van Bob)
  },
};
