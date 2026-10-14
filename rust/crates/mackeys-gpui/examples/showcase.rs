//! Opens a window with a MacBook top case and a standalone trackpad.
//!
//! Run: `cargo run -p mackeys-gpui --example showcase [finish] [layout] [dark] [press=KeyA,CapsLock]`
//!
//! Click keys or type on your keyboard; click or hold the trackpads. Shortcuts:
//! - control-F / control-shift-F: next / previous finish
//! - control-L / control-shift-L: next / previous layout
//! - control-B: backlight on or off; control-up / control-down: backlight level
//! - control-R: daylight or dark room
//! - control-S: sound on or off
//! - control-D: lid on or off
//! - command-Q: quit
use gpui::{
    div, prelude::*, px, size, App, Application, Bounds, Context, Entity, KeyDownEvent, MouseButton, SharedString, Subscription,
    TitlebarOptions, Window, WindowBounds, WindowOptions,
};
use mackeys_gpui::{finish_ids, layout_ids, Backlight, KeyEvent, MacBook, MacKeysAssets, MacTrackpad, Room, TrackpadEvent};

struct Showcase {
    book: Entity<MacBook>,
    pad: Entity<MacTrackpad>,
    finish: usize,
    layout: usize,
    backlight: Backlight,
    sound: bool,
    lid: bool,
    last: SharedString,
    _subs: Vec<Subscription>,
}

const SCALE: f32 = 0.72;

impl Showcase {
    fn new(finish: &str, layout: &str, dark: bool, press: &[String], window: &mut Window, cx: &mut Context<Self>) -> Self {
        let finishes = finish_ids();
        let layouts = layout_ids();
        let fi = finishes.iter().position(|f| *f == finish).unwrap_or(0);
        let li = layouts.iter().position(|l| *l == layout).unwrap_or(0);
        let backlight = if dark { Backlight::lit(12.0, Room::Dark) } else { Backlight::default() };
        let book = cx.new(|cx| MacBook::new(window, cx).finish(finishes[fi]).layout(layouts[li]).backlight(backlight.clone()).scale(SCALE));
        let pad = cx.new(|cx| MacTrackpad::new(window, cx).finish(finishes[fi]).scale(SCALE));
        let s1 = cx.subscribe(&book, |this, _, e: &KeyEvent, cx| {
            this.last = format!("{:?} {} ({})", e.kind, e.id, e.label).into();
            cx.notify();
        });
        let s2 = cx.subscribe(&book, |this, _, e: &TrackpadEvent, cx| {
            this.last = format!("built-in trackpad {:?}", e.kind).into();
            cx.notify();
        });
        let s3 = cx.subscribe(&pad, |this, _, e: &TrackpadEvent, cx| {
            this.last = format!("trackpad {:?}", e.kind).into();
            cx.notify();
        });
        // Press keys given on the command line once the window is up (activation releases every key).
        let press = press.to_vec();
        let target = book.downgrade();
        cx.spawn(async move |_, cx| {
            cx.background_executor().timer(std::time::Duration::from_millis(1500)).await;
            let _ = target.update(cx, |b, cx| press.iter().for_each(|id| b.press(id, cx)));
        })
        .detach();
        let focus = book.read(cx).focus_handle();
        window.focus(&focus);
        Showcase { book, pad, finish: fi, layout: li, backlight, sound: true, lid: true, last: "Click a key or type".into(), _subs: vec![s1, s2, s3] }
    }

    fn apply(&mut self, cx: &mut Context<Self>) {
        let f = finish_ids()[self.finish];
        let l = layout_ids()[self.layout];
        let bl = self.backlight.clone();
        let sound = self.sound;
        let lid = self.lid;
        self.book.update(cx, |b, cx| {
            b.set_show_lid(lid, cx);
            b.set_finish(f, cx);
            b.set_layout(l, cx);
            b.set_backlight(bl, cx);
            b.set_sound(sound, cx);
        });
        self.pad.update(cx, |p, cx| {
            p.set_finish(f, cx);
            p.set_sound(sound, cx);
        });
        cx.notify();
    }

    fn step(i: usize, n: usize, back: bool) -> usize {
        if back {
            (i + n - 1) % n
        } else {
            (i + 1) % n
        }
    }

    fn command(&mut self, cmd: &str, back: bool, cx: &mut Context<Self>) {
        match cmd {
            "finish" => self.finish = Self::step(self.finish, finish_ids().len(), back),
            "layout" => self.layout = Self::step(self.layout, layout_ids().len(), back),
            "backlight" => self.backlight.on = !self.backlight.on,
            "up" => self.backlight.level = (self.backlight.level + 2.0).min(16.0),
            "down" => self.backlight.level = (self.backlight.level - 2.0).max(0.0),
            "room" => self.backlight.room = if self.backlight.room == Room::Dark { Room::Daylight } else { Room::Dark },
            "sound" => self.sound = !self.sound,
            "lid" => self.lid = !self.lid,
            _ => return,
        }
        self.apply(cx);
    }
}

fn button(label: String, cmd: &'static str, cx: &mut Context<Showcase>) -> impl IntoElement {
    div()
        .id(cmd)
        .px(px(10.))
        .py(px(5.))
        .rounded(px(6.))
        .bg(gpui::rgba(0x8080802a))
        .text_size(px(12.))
        .cursor_pointer()
        .child(label)
        .on_mouse_down(MouseButton::Left, cx.listener(move |this, _, _, cx| this.command(cmd, false, cx)))
}

impl Render for Showcase {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let bg = self.book.read(cx).page_background();
        let dark = self.backlight.room == Room::Dark;
        let ink = if dark { gpui::rgb(0xd8d8dc) } else { gpui::rgb(0x2a2a2e) };
        let f = finish_ids()[self.finish];
        let l = layout_ids()[self.layout];
        div()
            .id("showcase")
            .size_full()
            .bg(bg)
            .text_color(ink)
            .font_family(".SystemUIFont")
            .flex()
            .flex_col()
            .gap(px(14.))
            .p(px(20.))
            .on_key_down(cx.listener(|this, e: &KeyDownEvent, _, cx| {
                let m = &e.keystroke.modifiers;
                if m.platform && e.keystroke.key == "q" {
                    cx.quit();
                }
                if !m.control {
                    return;
                }
                let cmd = match e.keystroke.key.as_str() {
                    "f" => "finish",
                    "l" => "layout",
                    "b" => "backlight",
                    "r" => "room",
                    "s" => "sound",
                    "d" => "lid",
                    "up" => "up",
                    "down" => "down",
                    _ => return,
                };
                this.command(cmd, m.shift, cx);
            }))
            .child(
                div()
                    .flex()
                    .flex_row()
                    .gap(px(8.))
                    .items_center()
                    .child(button(format!("Finish: {f}"), "finish", cx))
                    .child(button(format!("Layout: {l}"), "layout", cx))
                    .child(button(format!("Backlight: {}", if self.backlight.on { "on" } else { "off" }), "backlight", cx))
                    .child(button(format!("Level {}", self.backlight.level), "up", cx))
                    .child(button(format!("Room: {}", if dark { "dark" } else { "daylight" }), "room", cx))
                    .child(button(format!("Sound: {}", if self.sound { "on" } else { "off" }), "sound", cx))
                    .child(button(format!("Lid: {}", if self.lid { "on" } else { "off" }), "lid", cx))
                    .child(div().text_size(px(12.)).opacity(0.7).child(self.last.clone())),
            )
            .child(div().flex().flex_row().gap(px(36.)).items_start().child(self.book.clone()).child(div().pt(px(200.)).child(self.pad.clone())))
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let finish = args.first().cloned().unwrap_or_else(|| "pro-space-black".into());
    let layout = args.get(1).cloned().unwrap_or_else(|| "en-us".into());
    let dark = args.iter().any(|a| a == "dark");
    let press: Vec<String> = args
        .iter()
        .filter_map(|a| a.strip_prefix("press="))
        .flat_map(|p| p.split(',').map(String::from).collect::<Vec<_>>())
        .collect();
    Application::new().with_assets(MacKeysAssets::new()).run(move |cx: &mut App| {
        let bounds = Bounds::centered(None, size(px(1340.), px(800.)), cx);
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                titlebar: Some(TitlebarOptions { title: Some("MacKeys GPUI showcase".into()), ..Default::default() }),
                ..Default::default()
            },
            |window, cx| cx.new(|cx| Showcase::new(&finish, &layout, dark, &press, window, cx)),
        )
        .unwrap();
        cx.activate(true);
    });
}
