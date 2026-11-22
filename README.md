# Fatbike Sniper

Een sluipschuttersspel in de browser. Je staat op het balkon van de 4e verdieping van flat Pleinzicht aan het Koningin Julianaplein in Voorburg. Onder je ligt de parkeerplaats, met de Jumbo erachter. Je schiet elke ronde alle fatbikes kapot, zonder mensen, gewone fietsen of auto's te raken.

- Een **band** raken: de band klapt, de fatbike glijdt onderuit en de berijders vliegen eraf. Ze staan op, schudden boos hun vuist naar de flat en lopen weg.
- De **accu** raken: die ontploft en de fatbike brandt uit.
- Een **mens** raken: de kogel scheert langs, de persoon schrikt en jij krijgt een fout. Na 3 fouten ben je af.
- Door de **kijker** zie je 1× tot 14×. Het vizier beweegt mee met je adem, dus houd je adem in voor een stil vizier. Dat gaat maar 5 seconden.
- De kogel vliegt echt: hij doet er even over en zakt een beetje. Bij een rijdende fatbike moet je dus voorhouden.
- Elke ronde komen er meer fatbikes en rijden ze harder. Je score en sterren hangen af van tijd, kogels en fouten.

## De echte plek

| Wat | Bron |
|---|---|
| Gebouwen, met echte hoogtes en daken | [3D BAG](https://3dbag.nl) (CC BY 4.0), LOD 2.2 tot 230 m, daarbuiten LOD 1.2 |
| Straten, fietspaden, stoepen, bomen, heggen, bankjes, fietsenrekken | [OpenStreetMap](https://www.openstreetmap.org) (ODbL) |
| Parkeerplekken | Berekend uit de parkeergangen en -vakken in OSM |
| Wie waar loopt en rijdt | Het netwerk van wegen en paden uit OSM. Fatbikes mogen overal rijden, ook op de stoep. |

Mensen, fietsen, fatbikes en auto's worden in code opgebouwd (`src/figuren.js`). Elke mens is één SkinnedMesh met 12 botten. Geluid wordt met de Web Audio API gemaakt. Er zijn geen bestanden van derden nodig, behalve three.js (MIT) in `lib/`.

## Werken aan het spel

```
node tools/haal.mjs julianaplein    # ruwe gegevens ophalen naar data/ruw/ (niet in git)
node tools/bouw.mjs julianaplein    # wereld bouwen naar data/julianaplein.json
node tools/kijk.cjs /tmp/shots [telefoon]   # spel testen in Chromium en foto's maken
node tools/close.cjs /tmp/close     # figuren van dichtbij bekijken
```

De testscripts openen het spel zonder webserver: de bestanden komen rechtstreeks van schijf. Ze gebruiken playwright-core uit `/root/tools/pw` en `/usr/bin/chromium` met swiftshader. Dat draait op ongeveer 1 beeld per seconde, dus de scripts wachten op toestanden en niet op vaste tijden.

Een nieuwe locatie toevoegen: zet hem in `tools/locaties.mjs`, met het midden in RD-coördinaten, de naam van de flat en de verdieping. Draai daarna `haal` en `bouw`.
