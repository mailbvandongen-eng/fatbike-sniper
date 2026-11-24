// De locaties van het spel. Coördinaten in Rijksdriehoek (RD New, meters).
// Het is één doorlopende wereld: je kunt van het ene level naar het andere lopen. Wat er in de wereld staat
// (gevels, vaste auto's) is daarom voor alle levels hetzelfde en staat in GEDEELD.
export const GEDEELD = {
  // Gevels die afwijken van de regel "stijl op bouwjaar", naar Google 3D-beelden van Bob (22-11-2026). Sleutel = BAG-pand.
  stijlPerPand: {
    "1916100000102052": "bruinwit", // blok achter de parkeerplaats, boven de Jumbo
    "1916100000098418": "geel", // blok aan de westkant
    "1916100000101520": "creme", // blok aan de oostkant, met zonneschermen
    "1916100000099002": "zeilschip", // 't Zeilschip
    "1916100000115288": "zeilschip",
  },
  // Rond de Van Steelaan: portiekflats van donkerbruine baksteen met witte erkers en balkons (naar een foto vanuit het raam)
  stijlGebieden: [{ midden: [84298, 454812], straal: 140, van: "bruinwit", naar: "portiek" }],
  // Haagbogen over het middenpad van de parkeerplaats op het Julianaplein; niet op het pad vlak voor flat Pleinzicht
  bogen: { bij: [84420, 454690], straal: 45, nietBij: [84415.9, 454737.4], nietStraal: 32 },
  // Vaste auto's op de vrije parkeerplekken het dichtst bij een punt (op verzoek van Bob: voor de deur aan de Van Steelaan)
  vasteAutos: [{ soort: "rav4", kleur: "#08080a", bij: [84276.85, 454838.53] }, { soort: "colt", kleur: "#a3151a", bij: [84276.85, 454838.53] }],
};
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
  },
  buskenhuet: {
    naam: "Busken Huethove, Zoetermeer",
    kort: "Busken Huethove",
    midden: [92872, 453160], // het ronde speeltuintje op het hofje
    straalGebouwen: 300,
    osmBbox: [52.0604, 4.4766, 52.0660, 4.4858],
    // Sluipschutter: rijtjeshuis uit 1976 met plat dak, op de hoek bij het speeltuintje; slaapkamer boven en het dak.
    flatPand: "0637100000128543",
    flat: "Hoekhuis",
    parterre: 2.75, // vloer van de slaapkamer
    uit: 1.1,
    verdieping: 1,
    verdiepingen: [[1, "Slaapkamer"]],
    kijkpunt: [92875, 453162], // het speeltuintje
    grond: "gras", // een hofje: gras tussen de paden, geen plein
    druk: 0.3, // en het is er rustig
  },
};
