# Fatbike Sniper

Een sluipschuttersspel in de browser. Je staat op het balkon van de 4e verdieping van flat Pleinzicht aan het Koningin Julianaplein in Voorburg. Onder je ligt de parkeerplaats, met de Jumbo erachter. Je schiet elke ronde alle fatbikes kapot, zonder mensen, gewone fietsen of auto's te raken.

- Een **band** raken: de band klapt, de fatbike glijdt onderuit en de berijders vliegen eraf. Ze staan op, schudden boos hun vuist naar de flat en lopen weg.
- De **accu** raken: die ontploft en de fatbike brandt uit.
- Een **mens** raken: de kogel scheert langs, de persoon schrikt en jij krijgt een fout (rood kruisje in het vizier; er staat nergens tekst in beeld). Na 3 fouten ben je af.
- Je ziet jezelf van achteren op het balkon. Door de **kijker** (tot 40×) kijk je door het vizier; dat is stabiel, met alleen een rustige ademhaling. Staat het vizier op een fatbike, dan draait het een beetje met hem mee.
- De kogel vliegt echt: hij doet er even over en zakt een beetje. Bij een rijdende fatbike moet je dus voorhouden.
- Met ▲▼ wissel je van standplaats: de 1e, 4e en 7e verdieping en het dak van Pleinzicht, of op de grond achter een van drie muurtjes. Op de grond zit je gehurkt achter het muurtje; met de kijker kom je omhoog.
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

Fietsen, fatbikes en auto's worden in code opgebouwd (`src/figuren.js`).

**Mensen** (`tools/mensen/`, `assets/mensen/`):
- lijf, kleding, haar en huid uit [MakeHuman](http://www.makehumancommunity.org) (CC0), gebouwd in Blender met `tools/mensen/mens.py` (alleen de gegevens, geen MakeHuman-code); 13 mensen + jij (`mensen.json`), elk met één textuur en een lichte versie voor ver weg;
- bewegingen uit de [Universal Animation Library](https://quaternius.com) 1 en 2 van Quaternius (CC0): lopen, rennen, fietsen, zitten, bellen, praten, vallen, opstaan …; `bewegingen.py` zet ze op één skelet;
- `tools/mensen/bouw.sh` bouwt alles opnieuw en maakt het klein met meshopt (decoder: `lib/meshopt_decoder.mjs`, MIT). Geluid wordt met de Web Audio API gemaakt. Er zijn geen bestanden van derden nodig, behalve three.js (MIT) in `lib/`.

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

## Fietsen en winkelwagen

Echte modellen van Sketchfab (CC BY 4.0, naamsvermelding verplicht):
- fatbike: [OUXI V8 fatbike](https://sketchfab.com/3d-models/38ffc8e49c4d4133a150d913a13764ed) door GokuSSJB
- fiets en e-bike: [Dutch Bicycle](https://sketchfab.com/3d-models/1967bfe65c164c589351985e7becc8b8) door Fairyflosslord7
- winkelwagen: [Shopping Cart](https://sketchfab.com/3d-models/b96f896453b240ae804d0399f1faf027) door adrianxy

`tools/fietsen/bouw.sh` haalt ze op en maakt er spelmodellen van (`fiets.py`): echte maat, losse draaiende wielen, het frame in een vervangbare kleur, minder driehoeken. De afmetingen (wielen, handvatten, zadel) staan in `assets/fietsen/*.json`. Fietsen ver weg in de rekken gebruiken een licht model.

## Levels

- **Julianaplein** (`julianaplein`): rondes, geen klok, beperkt aantal kogels.
- **Bonus: Van Steelaan** (`steelaan`): portiekflat met verhoogd parterre aan de tramlijn, woonkamer, 1e en 2e verdieping; winter (kale bomen). Zoveel mogelijk fatbikes in 3 minuten; ze rijden kriskras over straat, fietspad en tramrails; een fout kost 10 seconden.

Kiezen op het startscherm (onthouden in de browser) of met `?level=steelaan`. Een nieuw level: zet het in `tools/locaties.mjs` (pand, raam, verdiepingen, kijkpunt, modus, seizoen), draai `haal` en `bouw`, en voeg het toe aan `LEVELS` in `src/main.js` en aan `#levels` in `index.html`. Testen: `node tools/bonus.cjs`.

## Auto's

Echte modellen van Sketchfab (CC BY 4.0), verwerkt met `tools/autos/bouw.sh` (`auto.py`: maat, losse wielen, lichte versie voor ver weg):
- hatchback: [1999 Allerauto Wolf](https://sketchfab.com/3d-models/92766c632ee14d21ab8aef3bf5c89f15) door NNXST
- kleine auto en sedan: [Low Poly Small car](https://sketchfab.com/3d-models/ebe7c5e98a7448b5abb2eaf0cb22b766) en [Low-Poly Sedan car](https://sketchfab.com/3d-models/aeb2699532b4402e8b75ec8888b800b9) door scailman
- bestelbus: [Van](https://sketchfab.com/3d-models/5e8a68c6585c4cf3b764ef7e82ef9a78) door VertexVendingMac

Alleen in het bonuslevel, op vaste plekken voor de deur (`vasteAutos` in `tools/locaties.mjs`):
- zwarte Toyota RAV4: [2021 Toyota RAV4 Hybrid](https://sketchfab.com/3d-models/de74fe4e98004c92b1103947597d1b53) door tonielpro520 (CC BY 4.0), zwart gespoten met zwarte velgen
- rode Mitsubishi Colt: [Mitsubishi Colt 2004](https://sketchfab.com/3d-models/eb488d59a4ea4afd869ceaec991b43eb) door tutusho (Sketchfab Standard-licentie), met getinte ruiten achter

De modellen zijn verkleind met meshopt; daardoor zijn de getallen in het bestand gehele waarden met een eigen schaal. `src/autos.js` leest ze punt voor punt uit en gebruikt de wielassen uit het json-bestand.

Geparkeerde auto's zijn kopieën van hetzelfde model (`InstancedMesh`, `src/autos.js`), elk met een eigen lakkleur. Rijdende auto's hebben draaiende wielen en een bestuurder.

## Lopen

Met het loop-icoon linksboven ga je de straat op (derde persoon, geen kijker), zoals bij GTA op de telefoon:
- links je duim neerzetten: daar verschijnt de stuurknuppel (ver duwen = rennen); op de pc WASD;
- rechts slepen = rondkijken; de camera draait vanzelf achter je aan als je loopt;
- de kleine knop wisselt het wapen (pc: 1/2/3 of Tab), de grote knop gebruikt het:
  - **pistool**: schieten zonder kijker; staat het kruisje bijna op een fatbike, dan gaat het schot naar zijn band;
  - **vuisten**: een fatbiker van zijn fiets slaan (hij rent weg); bij een ander geeft het ruzie;
  - **mes**: alleen voor banden: de band van een fatbike lek steken.
- Loop je tegen iemand op, dan krijg je ruzie; soms haalt hij uit en ga je even neer. Gebouwen, muurtjes en geparkeerde auto's houden je tegen. Rijdende auto's remmen voor je; schiet je op een rijdende auto of sla je ertegen, dan komt de bestuurder op je af en rijdt hij je omver. Er raakt niemand gewond: iedereen staat weer op.

Alle aanraakbediening loopt via touch-events per vinger (`sleepbaar` in `src/main.js`), zodat lopen, kijken en schieten tegelijk kunnen. Testen: `node tools/loop.cjs`.
