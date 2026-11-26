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

- **Busken Huethove** (`buskenhuet`, Zoetermeer): een hofje met rijtjeshuizen uit 1976 (plat dak, stijl `jaren70`) rond een rond speeltuintje met kunstgras. Je schiet vanuit de slaapkamer van het hoekhuis of vanaf het dak. Gewone rondes. Het is er rustig (`druk: 0.3`) en de grond is gras (`grond: "gras"`). Fatbikes hangen bij het speeltuintje. Het speeltoestel (houten toren met glijbaan en schommels) is [Playground](https://sketchfab.com/3d-models/965816aa987644c59de6eb9e844619ae) door JanStano (CC BY 4.0), verwerkt met `tools/speel/bouw.sh`. Dit level ligt 9 km van de andere twee en is een eigen wereld.

  In dit level:
  - **Grond uit de BGT** (`bgt: true`): `tools/haal.mjs` haalt de Basisregistratie Grootschalige Topografie op bij PDOK (CC0): tuinen (erven), bestrating, groen, water, bomen, heggen en hekken, op de decimeter nauwkeurig. `tools/bouw.mjs` maakt er vlakken `b_*` van (de grondtekening gebruikt dan alleen die, niet de geschatte OSM-stroken), vervangt de bomen, en zet om elke tuin een schutting of heg (`data.schuttingen`: hout 1,8 m, heg 1,5 m, muur, hek). Je loopt er niet doorheen en kogels blijven erin steken.
  - **Gevels** naar Street View: donker roodbruine baksteen, witte kozijnen, witte band tussen de verdiepingen (stijl `jaren70`).
  - **De slaapkamer** is een klein kamertje (2,7 bij 3 m) met bed, kast, deur, radiator en gordijnen; je ziet het van binnen als je uit het raam hangt.
  - **Uit het raam hangen:** de standplaats `raam` (in `bouwDecor`): je ziet de slaapkamer van binnen, met een open raam; je buigt in je heup over de vensterbank (`m.buig`).
  - **Hangjeugd** (`hangjeugd: true`): groepjes met capuchons rond het speeltuintje en op de bankjes (`nieuweGroep`), en veel meer fatbikes die af en aan rijden (`fatDruk`). Wie wegrent komt na een tijdje terug. Het zijn volwassen modellen; er lopen geen kinderen rond.
  - **Karate** (`karate: true`, `src/karate.js`): buiten loop je in een wit pak met zwarte band (model `karateka`). De grote knop is stoten, de knop erboven trappen (pc: J en K). De bewegingen komen uit het vechtspel van Dojo Hokori Meiyo (`assets/karate/clips.json`, 28 opnames van echte vechtsporters): per bot per beeld een *anatomisch frame*, dat bij het laden wordt omgerekend naar ons skelet en daarna als gewone animatie afspeelt. Alle 14 aanvallen zitten erin. Armen: jab, gyaku zuki, shita zuki, hiji (elleboog), jodan tsuki. Benen: gedan mawashi, mae geri, chudan mawashi, hiza (knie), jodan mawashi, ushiro geri, kakato (axe kick), ushiro mawashi, rol kick. De twee blokken (uke, gedan barai) gaan vanzelf: sta je stil en sla je niet, dan blok je een klap. Zware technieken gaan met een kiai. De band wordt om het middel van het model gemeten (`band` in `src/mensen.js`). Bij het raam wissel je met de wapenknop tussen geweer en vuurwerk (`gooiRaam`). Hangjeugd vecht terug en er komen hoogstens twee vrienden bij; ze halen om de beurt uit. Niemand raakt gewond: wie neergaat staat weer op.
  - **Honkbalknuppel:** met de wapenknop wissel je tussen karate en de knuppel (`maakKnuppel`, zwaai = `Sword_Attack`). De knuppel is voor fatbikes en auto's: de fiets gaat aan gort, de berijder valt, staat op en rent weg. Mensen sla je er niet mee; wie voor je staat schrikt en rent weg.
  - **Klein vuurwerk** (categorie 1: knetteren en vonken, geen schade): het derde wat je met de wapenknop kiest. Je gooit het naar het groepje waar je naar kijkt (`gooi`, `stapVuurwerk`); iedereen binnen 7,5 m schrikt en rent van de knallen weg, en wie met je vocht houdt ermee op. Niemand wordt geraakt.
  - **Dreigen:** loop je in karatepak binnen 13 m van de hangjeugd, dan komen ze op je af en blijven op 2 tot 4 m staan: gebalde vuisten, wijzen, schreeuwen (`Staander.dreig`). Blijf je lang vlak voor iemand staan, dan haalt hij uit (hoogstens drie tegelijk). Loop je weg, dan gaan ze terug naar hun plek.
  - **Jij:** blond haar in een staart met weggeschoren zijkanten (`zijkantenKaal` in `tools/mensen/mensen.json`), ook op de andere levels; in dit level draag je het karatepak ook bij het raam.
  - Testen: `node tools/karate.cjs` (maakt van elke techniek een beeld op het moment van raken).

## Kooigevecht (`kooi.html`, `src/kooi.js`)

Een eigen pagina, bereikbaar met de knop Kooigevecht op het beginscherm: twee vechters in een achthoekige kooi (een verzonnen zaal, geen echte plek), publiek dat joelt en opspringt, en muziek in de stijl van een 16-bit vechtspel (`src/muziek.js`, helemaal met Web Audio gemaakt). Je kiest je vechter en het aantal rondes (1, 3 of 5, elk 60 s). K.O. wint meteen; is de tijd om, dan wint wie het meeste leven over heeft.
- **Vechters** staan in `VECHTERS`: De Kale (bokser: harde stoten, zwakke en trage trappen, veel adem), Karateman (harde trappen, groter bereik, minder adem), Beer (traag, veel leven, harde klappen, een lichte klap brengt hem niet van zijn stuk, snel buiten adem) en Wolf (snel, veel adem, lichte klappen, weinig leven). Per vechter: `stoot`, `trap`, `tempo`, `snel`, `leven`, `stamina`, `herstel`, `stug`.
- **Dieren** zijn een mensenlijf in vachtkleur (`vacht` in `tools/mensen/mensen.json`) met een dierenkop erop (`zetKop`): [Bear head](https://sketchfab.com/3d-models/f513ca8443fb427ea2537a7c5e9fc472) van Wilka.io en [Wolf Head](https://sketchfab.com/3d-models/69c280a8e248431c9a4bc4b6cf1fd696) van Hipsteralbatros, beide CC BY 4.0, gebouwd met `tools/koppen/bouw.sh` naar `assets/dieren`.
- **Voetenwerk:** de computer loopt recht op je af, blijft op afstand in de vechthouding staan en doet af en toe een kort stapje opzij, in of uit (`denk`); de camera draait rustig mee (`KOOI.draai`).
- **Bediening:** links de stuurknuppel, rechts Stoot, Trap en Blok (vasthouden). Pc: WASD, J, K, L. Snel doortikken geeft een reeks.
- **Regels** (`KOOI`, `SCHADE`): elke aanval kost adem; buiten adem ben je trager en raak je zachter. Blokken laat 20% door. Na drie klappen achter elkaar (of een zware) word je uit elkaar geslagen en heb je even lucht. Een lichte stoot stopt een trap die al onderweg is niet.
- De bewegingen zijn de karate-opnames (`src/karate.js`); de tegenstander wordt door de computer gespeeld (`denk`).
- Testen: `node tools/kooi.cjs` (speelt een gevecht en laat dertig gevechten computer tegen computer de balans meten; `SNEL=1` slaat het beeld over).

## Wapenkast en honkbalknuppel

Bij het raam opent de wapenknop een **kast** (`openKast`, `src/wapens.js`): geweer, machinegeweer, bazooka en vlammenwerper (in Zoetermeer ook vuurwerk). Wat je kiest gebruik je bij het raam en neem je mee naar buiten (het staat dan in de rij van de wapenknop). De modellen komen van Sketchfab (CC BY 4.0, `tools/wapens/bouw.sh`): RPG-7 en MG 42 van TastyTony, Flamethrower van bumstrum. Munitie en gedrag staan in `WAPENKAST`; elke ronde is de kast weer vol.
- **Machinegeweer:** vuurknop vasthouden, 90 kogels. De kogels gelden als die van het geweer: een mens raken is een fout.
- **Bazooka:** 5 raketten. De ontploffing (`ontplof`) blaast fatbikes binnen 6,5 m op, laat auto's alarm slaan en gooit mensen door de lucht.
- **Vlammenwerper:** vasthouden, 14 seconden vuur, 11 m ver. Fatbikes in de vlam vliegen in brand; mensen rennen weg (niemand brandt).
- **Cobra's** (alleen Zoetermeer, 6 stuks) en **handgranaten** (de andere levels, 4 stuks): je gooit ze naar waar het kruisje staat (6 tot 28 m; uit het raam tot 45 m). Ze blijven liggen, de lont sist (wie het ziet rent weg) en dan volgt de knal: een cobra heeft een straal van 3,5 m, een granaat 5,5 m. Verder hetzelfde als de bazooka.
- **Honkbalknuppel** (nu op elk level in de rij): wie voor je staat vliegt door de lucht, ligt even, staat op en hinkt weg (`werp` en `stapWorp` in `src/verkeer.js`). Dat geldt ook voor de ontploffing. Niemand raakt gewond of gaat dood; het telt wel als strafbaar.
- Testen: `node tools/kast.cjs`.

## Reacties op schieten

Geen piepjes en geen kruizen meer bij een treffer of een fout (`geluid.goed`/`fout` en `melding` doen niets meer). Schiet je op of vlak naast een omstander, dan springt hij op of valt om en rent weg (`schrikVan` in `src/verkeer.js`); het telt nog steeds als fout. Een fatbike die omligt met een hele accu blijft een doelwit (`soort: "wrak"` in `stil`): raak je hem, of ontploft er iets naast, dan knalt de accu alsnog (`wrakOntploft`) en vliegen de berijders die er nog bij zijn door de lucht.

## Alle wapens zijn modellen

Geweer (Savage Axis II), pistool (HK UCP), machinegeweer en bazooka zijn van TastyTony, de vlammenwerper van bumstrum, de knuppel van Planetrix23 en het mes van San.Dro (Sketchfab, CC BY 4.0; `tools/wapens/bouw.sh`). De raket is de kop van het bazookamodel (`maakRaket`). Bij het laden (`src/wapens.js`) worden modellen met een skelet omgezet naar vaste vormen (`maakVast`) en gedraaid tot de loop naar +z wijst met de greep op de oorsprong.

**Vasthouden:** lange wapens worden aangelegd met `legAan` (`src/main.js`): de kolf vóór de rechterschouder, de bazooka óp de schouder, rechterhand aan de greep en linkerhand onder de voorkant (arm-IK). De maten per wapen staan in `HOUVAST`; daar stel je bij als iets door het lijf steekt. `/tmp/fbs/k/vast.cjs` (niet in de repo) maakte de controlebeelden van elk wapen van opzij en van voren.

## Verkeer botst niet meer

Rijdende auto's sturen om geparkeerde auto's heen (`uitwijk` in `Auto.stap`, via `graaf.autosBij`), worden er nooit meer in getekend (neus, midden en achterkant worden uit elke geparkeerde auto geduwd in `Reiziger.glad`), geven voorrang aan kruisend verkeer van rechts (met geduld: na 4 s rijden ze toch) en schuiven uit elkaar als ze toch in elkaar staan. Gemeten over twee minuten op het Julianaplein: 6% van de tijd in een geparkeerde auto → 0%.

## Gooien, vliegen en twee opties

- **Granaat of cobra gooien** (`beginWorp`, `worpClip`, `worpHanden` in `src/main.js`): pin eruit bij je borst (0,45 s), bovenhands gooien, en dan bukken met je handen voor je oren tot na de knal. Zo lang kun je niets anders. Met een granaat in je hand leg je geen geweer aan.
- **Door de lucht** (`werp` in `src/verkeer.js`): hoogstens een paar meter (gemeten: tot 3,1 m ver, onder 1 m hoog), en ieder valt anders: achterover, een salto, opzij rollend of alleen omver. De draai is één vloeiende beweging die klaar is bij het landen. Liggen duurt 1 tot 2,5 s; zeven op de tien hinken daarna weg, de rest rent.
- **Opties:** "Af na 3 fouten" (uit = iets anders raken telt niet) en "Onbeperkt munitie" (geldt voor kogels, raketten, brandstof, granaten en cobra's).

## Grond en bomen

- **Grond:** foto's van echte grond van Poly Haven (CC0) geven de structuur: gras, klinkers, stoeptegels en asfalt (`assets/grond/*.jpg`, 512 px). De getekende kaart bepaalt nog steeds de kleur en de soort; de shader in `steenPatroon` (`src/wereld.js`) vermenigvuldigt die met de foto. Zonder de texturen valt het spel terug op het getekende patroon.
- **Bomen:** binnen 110 m (hoogstens 170 stuks) staan echte modellen (`plantBomen`): "Leaf Tree" en "Dead Tree" van wersaus33 (Sketchfab, CC BY 4.0). In de winter is de helft kaal en heeft de rest oranjebruin blad. Verder weg staan de eenvoudige bomen.
- **Cobra's en handgranaten** zijn modellen (`laadWerp`/`maakWerp` in `src/wapens.js`): F1-granaat van TastyTony en een staaf met lont van bumstrum (CC BY 4.0). Je ziet ze in je hand en in de lucht.
- Opnieuw bouwen: `tools/natuur/bouw.sh` en `tools/wapens/bouw.sh`.

## Spelers kiezen

Het beginscherm heeft twee knoppen, Speler en Level, die elk een eigen keuzescherm openen (`#spelerPaneel`, `#levelPaneel`; het kooigevecht staat bij de levels). De naamsvermeldingen staan achter de knop Makers.

Op het beginscherm kies je wie je speelt (`SPELERS` en `kiesSpeler` in `src/main.js`, bewaard als `fbs-speler`), op elk level:
- **De Kale:** geweer, wapenkast, pistool, vuisten, mes, knuppel.
- **Karateman:** stoten en trappen, knuppel, vuurwerk (en de kast bij het raam).
- **Tovenares** (model `tovenares`, paarse cape met zwarte kraag en zoom: `cape` in `src/mensen.js`): geen vuurwapens maar een toverstokje ("Magic Wand" van bojidarkn, CC BY 4.0). Ze staat in een toverhouding en richt de staf met gestrekte arm (`heksPose`). De wapenknop wisselt tussen drie spreuken (`tover`):
  - **Vuurbal:** vliegt naar het kruisje en ontploft klein (2,6 m): fatbikes gaan eraan, mensen vliegen een paar meter.
  - **Bevriezen** (`src/magie.js`): wie bij het kruisje staat wordt een standbeeld van ijs. Loop ertegenaan en het valt stijf om, breekt in stukken (hoofd, armen, benen), ontdooit, klikt weer in elkaar, staat op en rent weg. Laat je het staan, dan ontdooit het na 9 s. Een fatbike glijdt onderuit.
  - **Zweven:** alles binnen 4,5 m van het kruisje stijgt op, hangt drie tellen hulpeloos in de lucht en valt. Fatbikes vallen kapot.
- Testen: `node tools/heks.cjs`.
- **Jongetje** (model `jongen`: kinderverhoudingen via `kind` in `tools/mensen/mens.py`, 74% groot, blond met een kuifje): hij heeft alleen zijn telefoon. Een vizier ligt plat op de grond waar je naar kijkt (tot 45 m, `vizierPunt`/`tekenVizier`) en draait mee. De wapenknop wisselt tussen drie apps (`tikTelefoon`): **Gat** (`maakGat`: een zwarte schacht met een rand van aarde en brokken die open blijft, hoogstens zes tegelijk; wie of wat erboven komt valt erin (`gatBij`, ook fatbikes die later langsrijden), jij loopt en rijdt eromheen; wie erin viel komt een halve minuut verderop weer boven uit een tweede gat dat daarna dichtvalt (`uitGat`); van een fatbike in het vizier vliegt de accu in brand, de berijders springen opzij en de fiets verdwijnt in het gat), **Bellen** (iedereen binnen 8 m wordt gebeld en blijft 9 s staan; fatbikes stoppen) en **Sproeier** (een fontein: mensen rennen weg, een fatbike glijdt onderuit). Bij het raam staat hij op een kruk. Niemand slaat hem, er komt geen handhaving op hem af en hij rijdt geen auto. Testen: `node tools/kind.cjs`.
- **Roxy** (model `meisje`: 12 jaar, 84% groot, lang koperrood haar, T-shirt en korte broek): een katapult en vier trucs (`TRUCS`, `truc`, houding in `roxyPose`). **Verf**: een verfbal in steeds een andere kleur (`VERF`) recht naar het kruisje; hij spat uiteen (`verfRaak`, `spat`) op straat, op muren, op auto's (de vlek zit op de goede kant en rijdt mee, `autoKant`) en op mensen (die schrikken en rennen weg); een fatbiker met verf in zijn gezicht gaat onderuit. De groene verf is spekglad (`plekken`, soort "glad", 45 s): fatbikes en fietsers gaan onderuit, auto's slippen (ook de jouwe) en voetgangers gaan op hun rug; de katapultknop heeft de kleur van de volgende bal. **Kauwgom**: een roze klodder die blijft liggen (`gomRaak`, 60 s, hoogstens acht); een fatbike die eroverheen rijdt blokkeert met zijn voorwiel en slaat over de kop (`slaOver`), voetgangers plakken even vast. **Spinnen**: waar de spin landt krioelen er zes (`maakSpin`, `spinRaak`); wie binnen 6,5 m staat springt op en rent gillend weg, een fatbiker vlakbij valt. **Heliumbol**: een witte bol met een boog naar het vizier; hij klapt open (`bolOpen`) en iedereen binnen 3,4 m gaat aan een ballon de lucht in (`laatOpstijgen` in verkeer.js) en verdwijnt boven de huizen; fatbikers worden van hun fiets getrokken. Voor haar gelden dezelfde regels als voor het jongetje. Testen: `node tools/meisje.cjs`.
- **Bonk** (de kale schutter) heeft overal zijn hele arsenaal: de kast toont alles en buiten wisselt de wapenknop langs pistool, vuist, mes, knuppel, machinegeweer, bazooka, vlammenwerper, handgranaten en cobra's (`kale`, `wapens`). Een raket of granaat laat auto's uitbranden en de vlammenwerper steekt ze aan (`autoBrand`: vlammen, de lak wordt zwart, niet meer in te stappen); een rijdende auto staat stil en de bestuurder springt eruit en rent weg (`rijderBrand`). Testen: `node tools/arsenaal.cjs`.

## Opties

Op het beginscherm staat een knop Opties (`OPTIES` en `opties` in `src/main.js`, bewaard in `localStorage` onder `fbs-opties`): handhaving aan/uit, tijdslimiet aan/uit (standaard zoals het level bedoeld is: alleen het bonuslevel heeft een klok; aan = 45 s plus 10 s per fatbike), fatbikes normaal/veel/heel veel (×1, ×1,8, ×3; hoogstens 16 tegelijk), onbeperkt kogels, mikhulp op straat, geluid, fatbikes markeren, en het volume van de muziek en van de achtergrond (uit, zacht, gewoon, hard). Het nootje rechtsboven in beeld opent tijdens het spelen alleen de drie geluidsregels. De muziek is een gespannen 16-bit-deuntje (`src/muziek.js`, stijl `sluip`; de kooi gebruikt stijl `kooi`) dat alleen tijdens een ronde speelt. Testen: `node tools/opties.cjs`.

- **Hoekerkade** (`hoekerkade`, Zoetermeer): rijtjeshuizen uit 1985 met pannendaken rond een parkeerhofje; grond, tuinen en bomen uit de BGT. Je hangt uit het slaapkamerraam. Hangjeugd op het hofje en langs de straat (`hangRond`), veel fatbikes. Voor de deur staat een zilvergrijze RAV4 met zwart dak (`rav4duo`: hetzelfde model, het plaatwerk boven 80% van de hoogte zwart via een kleur per punt in `src/autos.js`); die is van jou, dus instappen zonder ruit in te slaan. Schuurtjes en garages krijgen de stijl `schuur` (geen etalages meer), en tuinen zijn aan de straatkant open.

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

Effecten komen uit `src/geluid.js` (Web Audio): motor met versnellingen, banden, botsen, portier, claxon, vuistslagen, kiai, boeien, vuurwerk. Geweer en pistool zijn **gedempt en droog** (een doffe plof en het mechaniek, geen galm).

De achtergrond bestaat uit **echte opnames** (`assets/geluid/*.mp3`, gemaakt met `tools/geluid/maak.py` uit bestanden van Wikimedia Commons; de ruis is weg):
- `straat` (lus): vogels en langsrijdende auto's, "Birds songs and cars passing by" van ezwa, publiek domein
- `mensen` (lus): geroezemoes, "1 minute at the alexa mall in berlin" van thore, publiek domein; klinkt harder naarmate er meer mensen om je heen zijn (`geluid.drukte`)
- `auto1`, `auto2`: een auto die langskomt, uit "Cars passing over bridge" van Dsw4, publiek domein; om de 9 tot 25 s
- `meeuw`: zilvermeeuw, xeno-canto XC707075 (Sonothèque ADVL), CC0; om de 18 tot 58 s

`maak.py` heeft ffmpeg nodig (hier: `npm i @ffmpeg-installer/ffmpeg` in `/root/tools/ffmpeg-npm`).

### Camera, richten en schieten afstellen (`src/config.js`)

Alle getallen voor het gevoel staan in `src/config.js`:
- `CAMERA` (lopen, richten, sprint): `afstand`, `hoogte`, `schouder` (hoger = jij verder links, het midden vrij), `demping`, `fov`
- `CAMERA_BOTSING`: de camera schuift naar voren voor muren, schuttingen, heggen, speeltoestellen en boomstammen; vier stralen (een "bol") in plaats van één
- `CAMERA_STAND`: de camera bij het raam per soort standplaats `[achter, rechts, omhoog]`
- `KIJKEN`: gevoeligheid van slepen (wordt vanzelf fijner als je richt of inzoomt, want de beeldhoek telt mee) en hoe ver je omhoog en omlaag kunt kijken
- `SCHOT`: tijd tussen schoten (geweer 1,1 s, pistool 0,42 s), terugslag, duur van het mondingsvuur
- `VRIJ_ZICHT`: bomen pal voor je raam worden weggelaten

`tools/hud.cjs` controleert op drie telefoonmaten of knoppen elkaar of het midden van het beeld overlappen.

## Lichte weergave

Valt het beeld weg (`webglcontextlost`: de telefoon pakt het grafisch geheugen af), dan onthoudt het spel dat en start het daarna licht: lagere resolutie, geen schaduwen, minder mensen. Op het startscherm staat dan "lichte weergave" en hoe vaak het beeld is weggevallen. Zelf aan- of uitzetten: `?licht=1` of `?licht=0`. Los daarvan krijgt alleen een handvol mensen dichtbij de zware versie (`zetDetail`).

## Eén doorlopende wereld

Beide levels zijn dezelfde wijk; je kunt lopend van het Julianaplein naar de Van Steelaan (ongeveer 200 m) en terug. Daarom:
- wat er staat is voor alle levels hetzelfde (`GEDEELD` in `tools/locaties.mjs`: gevels per pand, gevelstijl per gebied, vaste auto's bij een adres), en elke kaart bevat alles tot 320 m;
- op straat blijft de drukte dicht om je heen (`graaf.krap` = 0,62: voetgangers binnen ±45 m, fatbikes ±40 m, verkeer ±70 m); wie achterblijft, komt opnieuw de buurt in, bij voorkeur buiten beeld. Vanaf het balkon is alles verspreid over het plein;
- de wereld schuift met je mee (`wereld.bij(x, z)`): de scherpe grondtekening (170 m) wordt opnieuw getekend als je 45 m verder bent, de geparkeerde auto's worden alleen rond je getekend (heel model tot 50 m, licht model tot 115 m), en mensen en verkeer bewegen rond jou (`graaf.c`). Terug bij het raam ligt alles weer rond het level.
