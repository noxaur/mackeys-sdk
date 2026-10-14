//! Aluminium grain: the SVG `feTurbulence type="fractalNoise"` algorithm (the reference code of the
//! SVG 1.1 specification, seed 0), made gray with `feColorMatrix type="saturate" values="0"` in
//! linear RGB, and blended onto the deck with `mix-blend-mode: overlay` at the grain opacity. This is
//! the web `Grain` component, computed in Rust (much faster than a resvg filter over the whole deck).
use std::sync::OnceLock;

const BSIZE: usize = 0x100;
const BM: i64 = 0xff;
const PERLIN_N: f64 = 4096.0;

struct Lattice {
    sel: [usize; BSIZE + BSIZE + 2],
    grad: [[[f64; 2]; BSIZE + BSIZE + 2]; 4],
}

fn random(seed: i64) -> i64 {
    const M: i64 = 2147483647;
    const A: i64 = 16807;
    const Q: i64 = 127773;
    const R: i64 = 2836;
    let mut r = A * (seed % Q) - R * (seed / Q);
    if r <= 0 {
        r += M;
    }
    r
}

fn lattice() -> &'static Lattice {
    static L: OnceLock<Lattice> = OnceLock::new();
    L.get_or_init(|| {
        let mut l = Lattice { sel: [0; BSIZE + BSIZE + 2], grad: [[[0.0; 2]; BSIZE + BSIZE + 2]; 4] };
        // setup_seed(0) = 1.
        let mut seed: i64 = 1;
        for k in 0..4 {
            for i in 0..BSIZE {
                l.sel[i] = i;
                for j in 0..2 {
                    seed = random(seed);
                    l.grad[k][i][j] = ((seed % (2 * BSIZE as i64)) - BSIZE as i64) as f64 / BSIZE as f64;
                }
                let s = (l.grad[k][i][0].powi(2) + l.grad[k][i][1].powi(2)).sqrt();
                if s > 0.0 {
                    l.grad[k][i][0] /= s;
                    l.grad[k][i][1] /= s;
                }
            }
        }
        let mut i = BSIZE - 1;
        while i > 0 {
            let k = l.sel[i];
            seed = random(seed);
            let j = (seed % BSIZE as i64) as usize;
            l.sel[i] = l.sel[j];
            l.sel[j] = k;
            i -= 1;
        }
        for i in 0..BSIZE + 2 {
            l.sel[BSIZE + i] = l.sel[i];
            for k in 0..4 {
                l.grad[k][BSIZE + i] = l.grad[k][i];
            }
        }
        l
    })
}

fn noise2(l: &Lattice, ch: usize, x: f64, y: f64) -> f64 {
    let t = x + PERLIN_N;
    let bx0 = (t as i64) & BM;
    let bx1 = (bx0 + 1) & BM;
    let rx0 = t - (t as i64) as f64;
    let rx1 = rx0 - 1.0;
    let t = y + PERLIN_N;
    let by0 = (t as i64) & BM;
    let by1 = (by0 + 1) & BM;
    let ry0 = t - (t as i64) as f64;
    let ry1 = ry0 - 1.0;
    let i = l.sel[bx0 as usize];
    let j = l.sel[bx1 as usize];
    let b00 = l.sel[i + by0 as usize];
    let b10 = l.sel[j + by0 as usize];
    let b01 = l.sel[i + by1 as usize];
    let b11 = l.sel[j + by1 as usize];
    let s = |t: f64| t * t * (3.0 - 2.0 * t);
    let (sx, sy) = (s(rx0), s(ry0));
    let g = &l.grad[ch];
    let u = rx0 * g[b00][0] + ry0 * g[b00][1];
    let v = rx1 * g[b10][0] + ry0 * g[b10][1];
    let a = u + sx * (v - u);
    let u = rx0 * g[b01][0] + ry1 * g[b01][1];
    let v = rx1 * g[b11][0] + ry1 * g[b11][1];
    let b = u + sx * (v - u);
    a + sy * (b - a)
}

/// `fractalNoise` with two octaves at user-space point (`x`, `y`): RGBA, each 0 to 1.
pub fn fractal_noise(x: f64, y: f64, freq: f64) -> [f64; 4] {
    let l = lattice();
    let mut out = [0.0; 4];
    for (ch, o) in out.iter_mut().enumerate() {
        let (mut vx, mut vy, mut ratio, mut sum) = (x * freq, y * freq, 1.0, 0.0);
        for _ in 0..2 {
            sum += noise2(l, ch, vx, vy) / ratio;
            vx *= 2.0;
            vy *= 2.0;
            ratio *= 2.0;
        }
        *o = ((sum + 1.0) / 2.0).clamp(0.0, 1.0);
    }
    out
}

fn linear_to_srgb(v: f64) -> f64 {
    if v <= 0.0031308 {
        v * 12.92
    } else {
        1.055 * v.powf(1.0 / 2.4) - 0.055
    }
}

/// Blends grain onto `pm` (premultiplied RGBA) where `mask` (alpha, same size) covers. Pixel
/// (`px`, `py`) maps to user space point (`origin.0 + (px + 0.5) / scale`, ...).
pub fn apply(pm: &mut tiny_skia::Pixmap, mask: &tiny_skia::Pixmap, opacity: f64, freq: f64, scale: f64, origin: (f64, f64)) {
    if opacity <= 0.0 {
        return;
    }
    let w = pm.width() as usize;
    let m = mask.data();
    let data = pm.data_mut();
    for (i, px) in data.as_chunks_mut::<4>().0.iter_mut().enumerate() {
        let cov = m.get(i * 4 + 3).copied().unwrap_or(0) as f64 / 255.0;
        let a_b = px[3] as f64 / 255.0;
        if cov <= 0.0 || a_b <= 0.0 {
            continue;
        }
        let (x, y) = ((i % w) as f64, (i / w) as f64);
        let n = fractal_noise(origin.0 + (x + 0.5) / scale, origin.1 + (y + 0.5) / scale, freq);
        let gray = linear_to_srgb(0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]);
        let a_s = n[3] * opacity * cov;
        for c in &mut px[..3] {
            let cb = *c as f64 / 255.0 / a_b;
            let ov = if cb <= 0.5 { 2.0 * cb * gray } else { 1.0 - 2.0 * (1.0 - cb) * (1.0 - gray) };
            let co = (1.0 - a_s) * cb + a_s * ov;
            *c = (co * a_b * 255.0).round().clamp(0.0, px_alpha(a_b)) as u8;
        }
    }
}

fn px_alpha(a: f64) -> f64 {
    a * 255.0
}

#[cfg(test)]
mod tests {
    #[test]
    fn noise_is_deterministic_and_centered() {
        let a = super::fractal_noise(10.3, 7.7, 0.95);
        assert_eq!(a, super::fractal_noise(10.3, 7.7, 0.95));
        let mut sum = 0.0;
        for i in 0..400 {
            sum += super::fractal_noise(i as f64 * 0.37, i as f64 * 0.11, 0.95)[1];
        }
        let mean = sum / 400.0;
        assert!((mean - 0.5).abs() < 0.1, "mean {mean}");
    }
}
