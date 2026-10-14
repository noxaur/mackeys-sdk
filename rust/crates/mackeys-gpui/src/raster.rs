//! Rasterizes art documents with `resvg` and caches the images.
//!
//! An [`Art`] holds premultiplied RGBA pixels (`tiny_skia::Pixmap`) and its frame in CSS px. GPUI
//! draws it through `img(ImageSource::Render(..))`: [`Art::render_image`] converts the pixels once to
//! the straight-alpha BGRA that GPUI's sprite shader expects. The offscreen renderer composes the same
//! pixmaps with `tiny-skia`.
use crate::art::{Doc, Frame};
use gpui::RenderImage;
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex, OnceLock};
use tiny_skia::Pixmap;

/// A raster image and where it goes.
pub struct Art {
    pub pixmap: Pixmap,
    pub frame: Frame,
    image: OnceLock<Arc<RenderImage>>,
}

impl std::fmt::Debug for Art {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Art").field("frame", &self.frame).finish()
    }
}

impl Art {
    pub fn new(pixmap: Pixmap, frame: Frame) -> Self {
        Art { pixmap, frame, image: OnceLock::new() }
    }

    /// The image for GPUI: straight alpha, BGRA.
    pub fn render_image(&self) -> Arc<RenderImage> {
        self.image
            .get_or_init(|| {
                let (w, h) = (self.pixmap.width(), self.pixmap.height());
                let mut data = Vec::with_capacity((w * h * 4) as usize);
                for p in self.pixmap.pixels() {
                    let c = p.demultiply();
                    data.extend_from_slice(&[c.blue(), c.green(), c.red(), c.alpha()]);
                }
                let buf = image::RgbaImage::from_raw(w, h, data).expect("pixel buffer size");
                Arc::new(RenderImage::new(smallvec::smallvec![image::Frame::new(buf)]))
            })
            .clone()
    }
}

fn options() -> &'static resvg::usvg::Options<'static> {
    static O: OnceLock<resvg::usvg::Options<'static>> = OnceLock::new();
    O.get_or_init(resvg::usvg::Options::default)
}

/// Rasterizes an SVG string to a pixmap of `w` x `h` pixels (the SVG's own size).
pub fn rasterize_svg(svg: &str) -> Option<Pixmap> {
    let tree = resvg::usvg::Tree::from_str(svg, options()).ok()?;
    let size = tree.size();
    let mut pm = Pixmap::new(size.width().round().max(1.0) as u32, size.height().round().max(1.0) as u32)?;
    resvg::render(&tree, tiny_skia::Transform::identity(), &mut pm.as_mut());
    Some(pm)
}

/// Multiplies RGB by `k` (CSS `filter: brightness(k)`).
pub fn brighten(pm: &mut Pixmap, k: f64) {
    if (k - 1.0).abs() < 1e-6 {
        return;
    }
    let k = k as f32;
    for px in pm.data_mut().as_chunks_mut::<4>().0 {
        let a = px[3] as f32;
        for c in &mut px[..3] {
            *c = (*c as f32 * k).round().min(a) as u8;
        }
    }
}

fn cache() -> &'static Mutex<HashMap<u64, Arc<Art>>> {
    static C: OnceLock<Mutex<HashMap<u64, Arc<Art>>>> = OnceLock::new();
    C.get_or_init(|| Mutex::new(HashMap::new()))
}

/// The cache size at which it drops the images nobody holds.
pub const CACHE_LIMIT: usize = 1200;

fn dropped() -> &'static Mutex<Vec<Arc<RenderImage>>> {
    static D: OnceLock<Mutex<Vec<Arc<RenderImage>>>> = OnceLock::new();
    D.get_or_init(|| Mutex::new(vec![]))
}

/// GPUI images of art the cache dropped. A view frees their textures with `App::drop_image`.
pub fn take_dropped() -> Vec<Arc<RenderImage>> {
    dropped().lock().map(|mut d| std::mem::take(&mut *d)).unwrap_or_default()
}

fn insert(key: u64, a: Arc<Art>) {
    if let Ok(mut c) = cache().lock() {
        if c.len() >= CACHE_LIMIT {
            let unused: Vec<u64> = c.iter().filter(|(_, v)| Arc::strong_count(v) == 1).map(|(k, _)| *k).collect();
            for k in unused {
                if let Some(old) = c.remove(&k) {
                    if let Some(img) = old.image.get() {
                        if let Ok(mut d) = dropped().lock() {
                            d.push(img.clone());
                        }
                    }
                }
            }
        }
        c.insert(key, a);
    }
}

/// Rasterizes a document at `scale` device pixels per CSS px, with brightness `k`, through the cache.
pub fn art(doc: Doc, scale: f64, k: f64) -> Arc<Art> {
    let (svg, frame) = doc.finish(scale);
    let mut h = DefaultHasher::new();
    svg.hash(&mut h);
    k.to_bits().hash(&mut h);
    let key = h.finish();
    if let Some(a) = cache().lock().ok().and_then(|c| c.get(&key).cloned()) {
        return a;
    }
    let mut pm = rasterize_svg(&svg).unwrap_or_else(|| Pixmap::new(frame.px_w, frame.px_h).expect("pixmap"));
    brighten(&mut pm, k);
    let a = Arc::new(Art::new(pm, frame));
    insert(key, a.clone());
    a
}

/// The resolution for soft shadows: blur radius 12 px becomes about 3 pixels of sigma.
pub fn far_scale(scale: f64) -> f64 {
    (0.5f64).min(scale)
}

/// Rasterizes `far` at a low resolution and scales it up into a pixmap of `frame`'s size.
pub fn render_far(far: Doc, scale: f64, frame: Frame) -> Pixmap {
    let mut pm = Pixmap::new(frame.px_w, frame.px_h).expect("pixmap");
    let low = far_scale(scale);
    let (svg, f) = far.finish(low);
    if let Some(small) = rasterize_svg(&svg) {
        let sx = (f.w * scale) / small.width() as f64;
        let sy = (f.h * scale) / small.height() as f64;
        let p = tiny_skia::PixmapPaint { quality: tiny_skia::FilterQuality::Bicubic, ..Default::default() };
        pm.draw_pixmap(0, 0, small.as_ref(), &p, tiny_skia::Transform::from_scale(sx as f32, sy as f32), None);
    }
    pm
}

/// Rasterizes `main` over the low-resolution `far` document (same rectangle), through the cache.
pub fn art_with_far(far: Doc, main: Doc, scale: f64) -> Arc<Art> {
    let (fsvg, _) = Doc::finish_ref(&far, far_scale(scale));
    let (svg, frame) = main.finish(scale);
    cached(&(fsvg, svg.clone(), "far"), || {
        let mut pm = render_far(far, scale, frame);
        if let Ok(tree) = resvg::usvg::Tree::from_str(&svg, options()) {
            resvg::render(&tree, tiny_skia::Transform::identity(), &mut pm.as_mut());
        }
        Art::new(pm, frame)
    })
}

/// Caches any image under a caller key (for images that are not one SVG, such as the projected lid).
pub fn cached(key: &impl Hash, make: impl FnOnce() -> Art) -> Arc<Art> {
    let mut h = DefaultHasher::new();
    "custom".hash(&mut h);
    key.hash(&mut h);
    let key = h.finish();
    if let Some(a) = cache().lock().ok().and_then(|c| c.get(&key).cloned()) {
        return a;
    }
    let a = Arc::new(make());
    insert(key, a.clone());
    a
}

/// The top case base (side, deck, grain, hinge, notch, grilles) and its well layer (dim, well).
pub fn top_case_art(tc: &mackeys_core::TopCaseGeometry, scale: f64) -> (Arc<Art>, Arc<Art>) {
    let docs = crate::art::top_case(tc);
    let (far_svg, _) = Doc::finish_ref(&docs.far, far_scale(scale));
    let far = docs.far;
    let (deck, frame) = docs.deck.finish(scale);
    let (mask, _) = docs.mask.finish(scale);
    let (details, _) = docs.details.finish(scale);
    let key = (far_svg, deck.clone(), details.clone(), tc.grain.to_bits(), "top case");
    let base = cached(&key, || {
        let mut pm = render_far(far, scale, frame);
        if let Ok(tree) = resvg::usvg::Tree::from_str(&deck, options()) {
            resvg::render(&tree, tiny_skia::Transform::identity(), &mut pm.as_mut());
        }
        if let Some(m) = rasterize_svg(&mask) {
            crate::grain::apply(&mut pm, &m, tc.grain, 0.95, scale, (frame.x, frame.y));
        }
        if let Some(d) = rasterize_svg(&details) {
            pm.draw_pixmap(0, 0, d.as_ref(), &tiny_skia::PixmapPaint::default(), tiny_skia::Transform::identity(), None);
        }
        Art::new(pm, frame)
    });
    (base, art(docs.well, scale, 1.0))
}

/// The trackpad glass at `phase` with grain, brightness `k`.
#[allow(clippy::too_many_arguments)]
pub fn pad_art(surface: &mackeys_core::Gradient, shadows: &[mackeys_core::Shadow], radius: f64, w: f64, h: f64, grain: f64, phase: mackeys_core::TrackpadPhase, scale: f64, k: f64) -> Arc<Art> {
    let (under, over, shape) = crate::art::pad_surface(surface, shadows, radius, w, h, phase);
    let (usvg_s, frame) = under.finish(scale);
    let (osvg, _) = over.finish(scale);
    let key = (usvg_s.clone(), osvg.clone(), grain.to_bits(), k.to_bits(), "pad");
    cached(&key, || {
        let mut pm = rasterize_svg(&usvg_s).unwrap_or_else(|| Pixmap::new(frame.px_w, frame.px_h).expect("pixmap"));
        if grain > 0.0 {
            let mut m = Doc::new(frame.x, frame.y, frame.w, frame.h);
            m.push(&format!(r##"<path d="{}" fill="#fff"/>"##, shape.path()));
            if let Some(mask) = rasterize_svg(&m.finish(scale).0) {
                crate::grain::apply(&mut pm, &mask, grain, 1.1, scale, (frame.x, frame.y));
            }
        }
        if let Some(o) = rasterize_svg(&osvg) {
            pm.draw_pixmap(0, 0, o.as_ref(), &tiny_skia::PixmapPaint::default(), tiny_skia::Transform::identity(), None);
        }
        brighten(&mut pm, k);
        Art::new(pm, frame)
    })
}
