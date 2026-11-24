# python3 -I tools/geluid/maak.py <ffmpeg> <bronmap> <uitmap>
# Knipt uit opnames van Wikimedia Commons (publiek domein / CC0) de achtergrondgeluiden van het spel:
#   straat.mp3  lus: vogels en auto's die langsrijden      ("Birds songs and cars passing by", ezwa, publiek domein)
#   mensen.mp3  lus: geroezemoes van pratende mensen       ("1 minute at the alexa mall in berlin", thore, publiek domein)
#   auto1/2.mp3 een auto die langskomt en wegrijdt         ("Cars passing over bridge", Dsw4, publiek domein)
#   meeuw.mp3   een zilvermeeuw                            (xeno-canto XC707075, Sonothèque ADVL, CC0)
# Lussen krijgen een overvloeier van eind naar begin, zodat je de naad niet hoort.
import sys, subprocess, numpy as np
FF, BRON, UIT = sys.argv[1:4]
R = 22050
def lees(naam):
    return np.frombuffer(subprocess.run([FF, '-v', 'error', '-i', f'{BRON}/{naam}', '-ac', '1', '-ar', str(R), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, dtype=np.float32).copy()
def schrijf(naam, m, kbps=56):
    m = np.clip(m, -1, 1).astype(np.float32)
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(R), '-ac', '1', '-i', '-', '-b:a', f'{kbps}k', f'{UIT}/{naam}.mp3'], input=m.tobytes(), check=True)
    print(naam, round(len(m) / R, 1), 's')
def stuk(m, a, b): return m[int(a * R):int(b * R)].copy()
def niveau(m, doel): return m * (doel / max(1e-6, float(np.sqrt((m ** 2).mean()))))
def lus(m, over=2.0):
    n = int(over * R); t = np.linspace(0, 1, n, dtype=np.float32)
    kop = m[:n] * np.sqrt(t) + m[-n:] * np.sqrt(1 - t)
    return np.concatenate([kop, m[n:-n]])
def rand(m, inn=0.4, uit=1.0):
    a, b = int(inn * R), int(uit * R); m[:a] *= np.linspace(0, 1, a) ** 2; m[-b:] *= np.linspace(1, 0, b) ** 2; return m
schrijf('straat', lus(niveau(lees('Birds_songs_and_cars_passing_by.ogg'), 0.05)))
schrijf('mensen', lus(niveau(stuk(lees('1_minute_at_the_alexa_mall_in_berlin.ogg'), 16, 44), 0.08)))
brug = lees('Cars_passing_over_bridge.ogg')
schrijf('auto1', rand(niveau(stuk(brug, 4.5, 12.5), 0.12), 1.5, 2.0), 48)
schrijf('auto2', rand(niveau(stuk(brug, 24.5, 30.5), 0.12), 1.0, 1.5), 48)
schrijf('meeuw', rand(niveau(stuk(lees('XC707075_-_European_Herring_Gull_-_Larus_argentatus.mp3'), 5, 9.6), 0.09), 0.2, 0.6), 48)
