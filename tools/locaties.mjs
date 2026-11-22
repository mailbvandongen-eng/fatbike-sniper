// De locaties van het spel. Coördinaten in Rijksdriehoek (RD New, meters).
export const LOCATIES = {
  julianaplein: {
    naam: "Koningin Julianaplein, Voorburg",
    midden: [84420, 454690], // de parkeerplaats
    straalGebouwen: 330,
    osmBbox: [52.0738, 4.3540, 52.0780, 4.3615], // zuid, west, noord, oost
    // Sluipschutter: flat Pleinzicht, 4e verdieping, kijkt naar het zuiden over de parkeerplaats naar de Jumbo.
    flat: "Pleinzicht",
    verdieping: 4,
    jumbo: [84450.0, 454639.8],
    // Gevels die afwijken van de regel "stijl op bouwjaar", naar Google 3D-beelden van Bob (22-11-2026). Sleutel = BAG-pand.
    stijlPerPand: {
      "1916100000102052": "bruinwit", // blok achter de parkeerplaats, boven de Jumbo
      "1916100000098418": "geel", // blok aan de westkant
      "1916100000101520": "creme", // blok aan de oostkant, met zonneschermen
      "1916100000099002": "zeilschip", // 't Zeilschip
      "1916100000115288": "zeilschip",
    },
  },
};
