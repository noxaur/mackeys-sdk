#!/usr/bin/env python3
"""Cuts the keyboard click clips from the recordings in spec/recordings and writes spec/keyboard-clicks.json.

Each recording holds one key press and its release, made on a MacBook with the Norwegian layout.
`soft` is a normal press ("myk"), `hard` is a forceful press. The power button (Touch ID) has one force.
Needs ffmpeg. Run: python3 scripts/cut-clicks.py, then pnpm spec.
"""
import array, base64, json, math, os, subprocess, sys, tempfile, wave

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
REC = os.path.join(ROOT, 'spec', 'recordings')
OUT = os.path.join(ROOT, 'spec', 'keyboard-clicks.json')
SR_IN, SR_OUT = 48000, 32000

# Recording, approximate press onset in ms. The script finds the exact onsets.
FILES = {
    'key-soft': 1740, 'key-hard': 1575,
    'mod-soft': 1250, 'mod-hard': 1495,
    'tab-soft': 1125, 'tab-hard': 1390,
    'caps-soft': 2070, 'caps-hard': 1325,
    'wide-soft': 1440, 'wide-hard': 965,
    'enter-soft': 1250, 'enter-hard': 1245,
    'space-soft': 1045, 'space-hard': 1660,
    'arrow-soft': 1005, 'arrow-hard': 1080,
    'power': 370,
}
# The soft space bar release is below the noise floor in its recording: use the hard one at this level.
BORROW = {'space-soft': ('space-hard', 0.6)}
# Each soft press gets the same RMS over its first 40 ms. Hard presses are 1.6x (+4 dB), the space bar 1.2x.
# A release keeps its recorded level relative to its press.
TARGET, HARD, SPACE = 0.06, 1.6, 1.2


def load(name):
    """Decodes a recording to 48 kHz mono, with a 4-pole 300 Hz high-pass to remove the room hum."""
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'x.wav')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(REC, name + '.m4a'), '-ac', '1', '-ar', str(SR_IN),
                        '-af', 'highpass=f=300,highpass=f=300', '-c:a', 'pcm_s16le', wav], check=True)
        with wave.open(wav) as w:
            a = array.array('h', w.readframes(w.getnframes()))
    return [v / 32768 for v in a]


def envelope(x):
    """RMS per 1 ms."""
    h = SR_IN // 1000
    return [math.sqrt(sum(v * v for v in x[i:i + h]) / h) for i in range(0, len(x) - h, h)]


def onset(e, lo, hi, noise):
    """The first ms of the strongest transient in e[lo:hi]."""
    lo, hi = max(0, lo), min(len(e), hi)
    peak = max(range(lo, hi), key=lambda i: e[i])
    th = max(4 * noise, 0.2 * e[peak])
    i = peak
    while i > lo and e[i - 1] > th:
        i -= 1
    return i


def shape(x, fade_ms):
    """A 1 ms fade in and a raised-cosine fade out over the last `fade_ms`."""
    x = list(x)
    n, f, a = len(x), int(SR_IN * fade_ms / 1000), SR_IN // 1000
    for i in range(min(a, n)):
        x[i] *= i / a
    for i in range(max(0, n - f), n):
        x[i] *= 0.5 + 0.5 * math.cos(math.pi * (i - (n - f)) / f)
    return x


def resample(x):
    """48 kHz to 32 kHz: a short low-pass, then linear interpolation."""
    y = [(x[max(i - 1, 0)] + 2 * x[i] + x[min(i + 1, len(x) - 1)]) / 4 for i in range(len(x))]
    r, out = SR_IN / SR_OUT, []
    for j in range(int(len(y) / r)):
        t = j * r
        i = min(int(t), len(y) - 2)
        out.append(y[i] + (y[i + 1] - y[i]) * (t - i))
    return out


def rms(x):
    return math.sqrt(sum(v * v for v in x) / len(x))


def b64(x):
    a = array.array('h', [max(-32768, min(32767, round(v * 32767))) for v in x])
    return base64.b64encode(a.tobytes()).decode()


def main():
    cut = {}
    for name, t in FILES.items():
        x = load(name)
        e = envelope(x)
        noise = sorted(e)[len(e) // 5]
        p = onset(e, t - 30, t + 40, noise)
        # The release is the strongest transient 50 to 400 ms after the press.
        rp = max(range(p + 50, min(len(e), p + 400)), key=lambda i: e[i])
        r = onset(e, rp - 15, rp + 5, noise)
        ms = SR_IN // 1000
        down = shape(x[(p - 2) * ms:min(r - 3, p + 140) * ms], 25)
        up = shape(x[(r - 2) * ms:(r + 120) * ms], 60)
        cut[name] = (down, up)
        print(f'{name:11s} press {p} ms, release {r} ms, snr {20 * math.log10(e[rp] / noise):.0f} dB', file=sys.stderr)

    out = {'source': 'MacBook keyboard, Norwegian layout, recorded for MacKeys. soft = normal press (myk), hard = forceful press.', 'sr': SR_OUT}
    gains = {}
    for name, (down, up) in cut.items():
        g = TARGET * (HARD if name.endswith('-hard') else 1) * (SPACE if name.startswith('space') else 1) / rms(down[:SR_IN // 25])
        g = min(g, 0.95 / max(abs(v) for v in down + up))
        gains[name] = g
        out[name + '-down'] = [b64(resample([v * g for v in down]))]
        out[name + '-up'] = [b64(resample([v * g for v in up]))]
    for name, (src, level) in BORROW.items():
        out[name + '-up'] = [b64(resample([v * gains[src] * level for v in cut[src][1]]))]
    with open(OUT, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'wrote {OUT}: {len(out) - 2} clips, {os.path.getsize(OUT)} bytes', file=sys.stderr)


if __name__ == '__main__':
    main()
