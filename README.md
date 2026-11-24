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

Fatbikers dragen meestal een zwarte hoodie met de capuchon op (`hoodie` in `src/mensen.js`). Wie achterop zit, zit strak achter de bestuurder en houdt hem vast.

## Levels

- **Julianaplein** (`julianaplein`): rondes, geen klok, beperkt aantal kogels.
- **Bonus: Van Steelaan** (`steelaan`): portiekflat met verhoogd parterre aan de tramlijn, woonkamer, 1e en 2e verdieping; winter (kale bomen). Zoveel mogelijk fatbikes in 3 minuten; ze rijden kriskras over straat, fietspad en tramrails; een fout kost 10 seconden.

Kiezen op het startscherm (onthouden in de browser) of met `?level=steelaan`. Een nieuw level: zet het in `tools/locaties.mjs` (pand, raam, verdiepingen, kijkpunt, modus, seizoen), draai `haal` en `bouw`, en voeg het toe aan `LEVELS` in `src/main.js` en aan `#levels` in `index.html`. Testen: `node tools/bonus.cjs`.

- **Busken Huethove** (`buskenhuet`, Zoetermeer): een hofje met rijtjeshuizen uit 1976 (plat dak, stijl `jaren70`) rond een rond speeltuintje met kunstgras. Je schiet vanuit de slaapkamer van het hoekhuis of vanaf het dak. Gewone rondes. Het is er rustig (`druk: 0.3`) en de grond is gras (`grond: "gras"`). Fatbikes hangen bij het speeltuintje. Het speeltoestel is [Low Poly Kids Playground](https://sketchfab.com/3d-models/61c6f6f70db14bbb89ecdfa04b99bbc6) door 99.Miles (CC BY 4.0), verwerkt met `tools/speel/bouw.sh`. Dit level ligt 9 km van de andere twee en is een eigen wereld.

## Auto's

Echte modellen van Sketchfab (CC BY 4.0), verwerkt met `tools/autos/bouw.sh` (`auto.py`: maat, losse wielen, lichte versie voor ver weg):
- hatchback: [1999 Allerauto Wolf](https://sketchfab.com/3d-models/92766c632ee14d21ab8aef3bf5c89f15) door NNXST
- kleine auto en sedan: [Low Poly Small car](https://sketchfab.com/3d-models/ebe7c5e98a7448b5abb2eaf0cb22b766) en [Low-Poly Sedan car](https://sketchfab.com/3d-models/aeb2699532b4402e8b75ec8888b800b9) door scailman
- bestelbus: [Van](https://sketchfab.com/3d-models/5e8a68c6585c4cf3b764ef7e82ef9a78) door VertexVendingMac

Alleen in het bonuslevel, op vaste plekken voor de deur (`vasteAutos` in `tools/locaties.mjs`):
- zwarte Toyota RAV4: [2021 Toyota RAV4 Hybrid](https://sketchfab.com/3d-models/de74fe4e98004c92b1103947597d1b53) door tonielpro520 (CC BY 4.0), zwart gespoten met zwarte velgen
- rode Mitsubishi Colt: [Mitsubishi Colt 2004](https://sketchfab.com/3d-models/eb488d59a4ea4afd869ceaec991b43eb) door tutusho (Sketchfab Standard-licentie), met getinte ruiten achter en een dubbel glazen dak (`dakramen` in `tools/autos/autos.json`)

De modellen zijn verkleind met meshopt; daardoor zijn de getallen in het bestand gehele waarden met een eigen schaal. `src/autos.js` leest ze punt voor punt uit en gebruikt de wielassen uit het json-bestand.

Geparkeerde auto's zijn kopieën van hetzelfde model (`InstancedMesh`, `src/autos.js`), elk met een eigen lakkleur. Rijdende auto's hebben draaiende wielen en een bestuurder.

## Lopen

Met het loop-icoon ga je de straat op, in derde persoon. De opzet is afgekeken van hoe GTA op de telefoon werkt, op eigen wijze nagebouwd:
- **Bewegen met gewicht:** links je duim neerzetten (daar verschijnt de stuurknuppel) of WASD. Je komt op gang en loopt uit, je lijf draait in een boogje mee, en de loop-, jog- en sprintbeweging lopen op het tempo van je vaart. Sprinten: de knop » (of Shift); stoppen beëindigt het sprinten. Voetstappen klinken op het ritme van je passen.
- **Camera:** rechts slepen = rondkijken. De camera veert achter je aan, draait vanzelf mee als je loopt, gaat iets verder weg en wijder bij sprinten, en schuift naar voren als er een muur achter je staat.
- **Richten:** de richtknop (of X) zet de camera over je schouder met een nauwer beeld; je loopt dan langzaam en houdt het pistool gestrekt. De mikhulp markeert de band van de fatbike bij het kruisje (geel, rood als je richt), maar alleen als de schootslijn vrij is van muren, auto's, fietsen en mensen.
- **Wapens** (knop, of 1/2/3 of Tab): pistool; vuisten (een fatbiker van zijn fiets slaan, hij rent weg); mes (alleen banden lek steken).
- **Radar:** linksboven de buurt van bovenaf, gedraaid naar je kijkrichting: gele stippen = fatbikes (op de rand als ze verder weg zijn), rood = een kwade automobilist, wit vierkant = je raam.
- **De wereld reageert:** je loopt niet door mensen heen; loop of jog je tegen iemand op, dan wacht die even; sprint je iemand omver, dan krijg je ruzie (soms een klap: je gaat neer en staat weer op). Bij een schot rennen mensen in de buurt weg. Auto's remmen en toeteren als je in de weg staat; schiet je op een rijdende auto of sla je ertegen, dan rijdt de bestuurder je omver. Gebouwen, muurtjes, heggen, bomen en geparkeerde auto's houden je tegen. Er raakt niemand gewond: iedereen staat weer op.

### Autorijden

Sta je naast een geparkeerde auto, dan verschijnt een groene knop (of T) om in te stappen.
- **Je eigen auto** (de zwarte RAV4 voor de deur aan de Van Steelaan) gaat van het slot en je stapt in: geen schade, geen straf. De plek ervoor blijft leeg, zodat je zo wegrijdt.
- **Andere auto's** steel je: ruit in, alarm, en het telt als strafbaar (0,8). Een auto die je al open hebt, stap je daarna gewoon weer in.
- **Rijden (zoals GTA op de telefoon):** links alleen sturen met de stuurknuppel; rechts een groen gaspedaal en een rode rem (stilstaand is de rem achteruit), daarboven de claxon. Pc: WASD. Het stuur draait soepel en gaat op snelheid minder ver (zoveel als de banden houden: `maxHoek` in `stapRijden`); vol sturen of hard remmen op snelheid laat de banden piepen. Top 50 km/u (bestelbus 40).
- **Botsen:** gebouwen, heggen, bomen, muurtjes, geparkeerde auto's én rijdend verkeer zijn massief. Raak je iets met één hoek, dan draait de neus weg en schuur je erlangs; recht ertegenaan sta je stil (met een klap). Tegen een rijdende auto: die toetert en het is strafbaar. Fatbikes die je aanrijdt gaan onderuit (dat telt als treffer), voetgangers springen opzij (vlak langs ze scheren is strafbaar), agenten staan even stil.
- **Je achtergelaten auto:** het verkeer rijdt er langzaam omheen (`spel.verlaten`, `uitwijk` in `Auto.stap`).
- **Uitstappen:** dezelfde knop; de auto blijft staan waar je hem laat. Uit een rijdende auto kunnen agenten je niet halen.

Een geparkeerde auto is een getekende kopie (`InstancedMesh`); bij het instappen wordt die vervangen door een echte auto met wielen (`echtInstappen` in `src/main.js`). Testen: `node tools/rijden.cjs` en `node tools/gevecht.cjs`.

### Vechten

Met je vuisten (wapenknop) sla je een reeks: twee snelle klappen en dan een zware. Tik je door, dan volgt de volgende klap vanzelf. Je draait naar je tegenstander en doet een stap in.
- **Tegenstanders** hebben drie klappen conditie (de zware telt voor twee). Ze wankelen en worden achteruit geduwd; ongeveer zes op de tien vechten terug: ze komen op armlengte staan, nemen een vechthouding aan en halen uit. Je ziet de klap aankomen: stap je op tijd achteruit, dan slaan ze mis. De rest rent weg.
- **Neer** is nooit gewond: wie neergaat krabbelt na een paar tellen op en maakt dat hij wegkomt. Omstanders rennen weg zodra er geslagen wordt.
- **Jij** wankelt bij een klap en gaat pas na drie klappen neer (rode rand = hoeveel je gehad hebt; het herstelt vanzelf). Een auto die je schept legt je meteen neer.
- Fatbikers sla je met één klap van hun fiets; het mes is alleen voor banden.

De code staat in `beginRuzie`/`stapRuzie` (`src/verkeer.js`) en `sla`/`raakMens`/`klapKrijgen` (`src/main.js`).

### Om auto's heen

Voetgangers (ook met winkelwagen), fietsers en fatbikes lopen en rijden niet door geparkeerde auto's: `uitAuto` (in `src/main.js`, met een rooster van 6 m) duwt ze langs de kortste weg naar buiten; `Reiziger.glad` roept het elke stap aan. Jij loopt ook niet door stilstaand verkeer heen.

### Geluid

Alles komt uit `src/geluid.js` (Web Audio, geen bestanden): motor met versnellingen, piepende banden, botsen en schuren, portier, claxon, pistool (anders dan het geweer), vuistslagen met "oef", het zoemen van een fatbike vlakbij (zo hoor je ze aankomen), en vogels (zomer) of kraaien (winter).

### Missies en gezocht worden (`src/straat.js`)

**Missies** (alleen in het Julianaplein-level, zodra je op straat loopt): er verschijnt een gele lichtzuil (geel vierkant op de radar). Loop erin en de missie begint; je doelen zijn rood (pijl erboven, rood op de radar, rode zuil op de plek). Om de beurt:
- **hangplek**: drie fatbikes die staan te bellen; raak je er één, dan gaan de anderen ervandoor;
- **banden**: vier geparkeerde fatbikes; steek de banden lek binnen 80 seconden;
- **achtervolging**: één vluchter die kriskras door de buurt rijdt; stop hem binnen 110 seconden.

De missie staat midden boven in beeld, alleen met tekens en getallen. Gelukt: 500 punten (plus 5 per seconde die over is) en 4 kogels. Doelen van een missie tellen niet mee voor de ronde.

**Gezocht**: wat je op straat uithaalt telt op (schieten 0,5; een auto raken 0,7; bijna een mens raken 1; iemand slaan 0,6; iemand omver sprinten 0,2; een fatbike slopen 0,2; een agent slaan 1,2). Vanaf 1 heb je een ster:
- 1 ster: twee handhavers te voet (je blijft ze joggend voor); 2 en 3 sterren: politie (alleen met sprinten voor te blijven), met sirene;
- zien ze je vijf tellen niet, dan knipperen de sterren en zakt het niveau, een ster per zeven tellen;
- zolang ze je zien kun je niet naar binnen; uit het zicht naar binnen gaan is ontsnappen;
- pakt een agent je, dan sta je weer bij je raam, ben je 250 punten kwijt en is de missie mislukt.

Testen: `node tools/straat.cjs` (zet de spelregels zelf vooruit, omdat de testbrowser traag is).

Alle aanraakbediening loopt via touch-events per vinger (`sleepbaar` in `src/main.js`), zodat lopen, kijken en schieten tegelijk kunnen. Testen: `node tools/loop.cjs`.

## Lichte weergave

Valt het beeld weg (`webglcontextlost`: de telefoon pakt het grafisch geheugen af), dan onthoudt het spel dat en start het daarna licht: lagere resolutie, geen schaduwen, minder mensen. Op het startscherm staat dan "lichte weergave" en hoe vaak het beeld is weggevallen. Zelf aan- of uitzetten: `?licht=1` of `?licht=0`. Los daarvan krijgt alleen een handvol mensen dichtbij de zware versie (`zetDetail`).

## Eén doorlopende wereld

Beide levels zijn dezelfde wijk; je kunt lopend van het Julianaplein naar de Van Steelaan (ongeveer 200 m) en terug. Daarom:
- wat er staat is voor alle levels hetzelfde (`GEDEELD` in `tools/locaties.mjs`: gevels per pand, gevelstijl per gebied, vaste auto's bij een adres), en elke kaart bevat alles tot 320 m;
- op straat blijft de drukte dicht om je heen (`graaf.krap` = 0,62: voetgangers binnen ±45 m, fatbikes ±40 m, verkeer ±70 m); wie achterblijft, komt opnieuw de buurt in, bij voorkeur buiten beeld. Vanaf het balkon is alles verspreid over het plein;
- de wereld schuift met je mee (`wereld.bij(x, z)`): de scherpe grondtekening (170 m) wordt opnieuw getekend als je 45 m verder bent, de geparkeerde auto's worden alleen rond je getekend (heel model tot 50 m, licht model tot 115 m), en mensen en verkeer bewegen rond jou (`graaf.c`). Terug bij het raam ligt alles weer rond het level.
