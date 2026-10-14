//! Draws scene layers in GPUI and keeps rasterization off the UI thread.
//!
//! A view describes its art with a key (a hash of everything the images depend on). When the key
//! changes, [`ArtState::request`] rasterizes the images on GPUI's background executor (they land
//! in the shared cache in `raster.rs`) and redraws when they are ready. Until then the view keeps
//! the layers it drew last, so a change of finish, layout or backlight never blocks a frame.
use crate::raster;
use crate::scene::Layer;
use gpui::{img, prelude::*, px, Context, ImageSource, ObjectFit, Task, Window};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// The art state of one view.
#[derive(Default)]
pub struct ArtState {
    wanted: Option<u64>,
    ready: Option<u64>,
    last: Vec<Layer>,
    task: Option<Task<()>>,
}

/// A view that owns an [`ArtState`].
pub trait HasArt: 'static + Sized {
    fn art_state(&mut self) -> &mut ArtState;
}

/// Hashes any value into an art key.
pub fn art_key(v: &impl Hash) -> u64 {
    let mut h = DefaultHasher::new();
    v.hash(&mut h);
    h.finish()
}

impl ArtState {
    /// True when the images for `key` are ready (draw with [`ArtState::store`]).
    pub fn is_ready(&self, key: u64) -> bool {
        self.ready == Some(key)
    }

    /// Starts rasterizing for `key` in the background (once per key). `job` runs on a background
    /// thread and fills the cache.
    pub fn request<V: HasArt>(&mut self, key: u64, job: impl FnOnce() + Send + 'static, cx: &mut Context<V>) {
        if self.wanted == Some(key) || self.ready == Some(key) {
            return;
        }
        self.wanted = Some(key);
        let task = cx.spawn(async move |this, cx| {
            cx.background_executor().spawn(async move { job() }).await;
            let _ = this.update(cx, |v, cx| {
                let st = v.art_state();
                if st.wanted == Some(key) {
                    st.ready = Some(key);
                    st.task = None;
                }
                cx.notify();
            });
        });
        self.task = Some(task);
    }

    /// Keeps `layers` as the last drawn layers and returns them.
    pub fn store(&mut self, layers: Vec<Layer>) -> Vec<Layer> {
        self.last = layers.clone();
        self.last.clone()
    }

    /// The layers drawn last (shown while new images are made).
    pub fn last(&self) -> Vec<Layer> {
        self.last.clone()
    }

    /// Forgets the ready key, so the next request rasterizes again.
    pub fn reset(&mut self) {
        self.ready = None;
        self.wanted = None;
    }
}

/// Converts every layer image to GPUI's format, on the calling (background) thread.
pub fn prepare(layers: &[Layer]) {
    for l in layers {
        let _ = l.art.render_image();
    }
}

/// The GPUI element of a layer, at view scale `s`.
pub fn layer_element(l: &Layer, s: f32) -> impl IntoElement {
    img(ImageSource::Render(l.art.render_image()))
        .absolute()
        .left(px(l.x as f32 * s))
        .top(px(l.y as f32 * s))
        .w(px(l.w as f32 * s))
        .h(px(l.h as f32 * s))
        .opacity(l.opacity)
        .object_fit(ObjectFit::Fill)
}

/// Frees the GPU textures of images the cache dropped.
pub fn drop_unused<V>(window: &mut Window, cx: &mut Context<V>) {
    for image in raster::take_dropped() {
        cx.drop_image(image, Some(window));
    }
}
