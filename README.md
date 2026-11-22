# Fatbike Sniper

Een sluipschuttersspel in de browser. Je staat op het balkon van de 4e verdieping van flat Pleinzicht aan het Koningin Julianaplein in Voorburg. Onder je ligt de parkeerplaats, met de Jumbo erachter. Je schiet elke ronde alle fatbikes kapot, zonder mensen, gewone fietsen of auto's te raken.

- Een **band** raken: de band klapt, de fatbike glijdt onderuit en de berijders vliegen eraf. Ze staan op, schudden boos hun vuist naar de flat en lopen weg.
- De **accu** raken: die ontploft en de fatbike brandt uit.
- Een **mens** raken: de kogel scheert langs, de persoon schrikt en jij krijgt een fout. Na 3 fouten ben je af.
- Door de **kijker** zie je 1× tot 14×. Het vizier beweegt mee met je adem, dus houd je adem in voor een stil vizier. Dat gaat maar 5 seconden.
- De kogel vliegt echt: hij doet er even over en zakt een beetje. Bij een rijdende fatbike moet je dus voorhouden.
- Met ▲▼ wissel je van standplaats: de 1e, 4e en 7e verdieping en het dak van Pleinzicht, of op de grond achter een van drie muurtjes. Op de grond gluur je over de rand. Met de kijker kom je omhoog, en blijf je te lang staan, dan word je gezien: mensen wijzen naar je en fatbikes gaan er hard vandoor.
- Elke ronde komen er meer fatbikes en rijden ze harder. Je score en sterren hangen af van tijd, kogels en fouten.

## De echte plek

| Wat | Bron |
|---|---|
| Gebouwen, met echte hoogtes en daken | [3D BAG](https://3dbag.nl) (CC BY 4.0), LOD 2.2 tot 230 m, daarbuiten LOD 1.2 |
| Straten, fietspaden, stoepen, bomen, heggen, bankjes, fietsenrekken | [OpenStreetMap](https://www.openstreetmap.org) (ODbL) |
| Parkeerplekken | Berekend uit de parkeergangen en -vakken in OSM |
| Gevelstijl | Gekozen op bouwjaar (BAG), hoogte en functie |
| Kleuren | Afgekeken van de PDOK-luchtfoto (klinkers, glazen overkappingen) en van foto's van De Julianabaan op Wikimedia Commons (galerijflat met rode kopgevels, winkelpuien). De foto's zelf zitten niet in het spel. |
| Winkelborden | Winkels met hun naam uit OSM, op de dichtstbijzijnde gevel |
| Wie waar loopt en rijdt | Het netwerk van wegen en paden uit OSM. Fatbikes mogen overal rijden, ook op de stoep. |

Mensen, fietsen, fatbikes en auto's worden in code opgebouwd (`src/figuren.js`). Elke mens is één SkinnedMesh met 12 botten. Geluid wordt met de Web Audio API gemaakt. Er zijn geen bestanden van derden nodig, behalve three.js (MIT) in `lib/`.

## Werken aan het spel

```
node tools/haal.mjs julianaplein    # ruwe gegevens ophalen naar data/ruw/ (niet in git)
node tools/bouw.mjs julianaplein    # wereld bouwen naar data/julianaplein.json
node tools/kijk.cjs /tmp/shots [telefoon]   # spel testen in Chromium en foto's maken
node tools/close.cjs /tmp/close     # figuren van dichtbij bekijken
node tools/views.cjs /tmp/views     # vaste standpunten: Jumbo, Pleinzicht, winkels, overkapping
node tools/standen.cjs /tmp/standen # alle standplaatsen via ▲▼ en het gezien worden op de grond
```

De testscripts openen het spel zonder webserver: de bestanden komen rechtstreeks van schijf. Ze gebruiken playwright-core uit `/root/tools/pw` en `/usr/bin/chromium` met swiftshader. Dat draait op ongeveer 1 beeld per seconde, dus de scripts wachten op toestanden en niet op vaste tijden.

Een nieuwe locatie toevoegen: zet hem in `tools/locaties.mjs`, met het midden in RD-coördinaten, de naam van de flat en de verdieping. Draai daarna `haal` en `bouw`.

## Verversen op de telefoon

Een app op het beginscherm van de iPhone toont vaak nog de oude pagina. Daarom:

- `tools/versie.mjs` berekent een versie (hash van alle spelbestanden) en zet die in `versie.json` en `index.html`. Elk bestand wordt opgehaald met `?v=<versie>`. Het script draait vanzelf vóór elke commit via `.git/hooks/pre-commit`; zet die hook opnieuw neer na een verse clone.
- Bij het openen, en elke keer dat het spel weer naar voren komt, vraagt het spel `versie.json` op zonder cache. Is de versie anders, dan laadt het zichzelf opnieuw. Dat gebeurt nooit midden in een ronde.
- Onder de Begin-knop staat van wanneer de versie is.
