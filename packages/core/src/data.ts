// Static data for every Mac keyboard and trackpad in the "Mac Keyboard" design canvas.
// Measurements: 1 key pitch (19.0 mm) = 64 px. Outlines come from Apple's tech specs; key, legend and
// trackpad offsets were measured on Apple's top-down product images.
import { fmt } from './util';

export type ModelId = 'pro' | 'air' | 'neo' | 'mk';

export interface ModelSpec {
  /** Top case width and depth in px. */
  W: number;
  H: number;
  /** Distance from the top edge to the first key row. */
  kbY: number;
  /** Padding of the recessed keyboard well around the keys. */
  wellPad: number;
  padW: number;
  padY: number;
  padH: number;
  hingeX: number;
  /** Speaker grilles left and right of the keyboard (14-inch and 16-inch MacBook Pro). */
  grille: boolean;
  /** Corner radii: top-left, top-right, bottom-right, bottom-left. */
  radius: [number, number, number, number];
}

export const MODELS: Record<ModelId, ModelSpec> = {
  pro: { W: 1053, H: 745, kbY: 65.8, wellPad: 8, padW: 437, padY: 454, padH: 272.7, hingeX: 125, grille: true, radius: [20, 20, 26, 26] },
  neo: { W: 1002, H: 695, kbY: 49.4, wellPad: 7, padW: 390.5, padY: 434.9, padH: 243.5, hingeX: 131, grille: false, radius: [30, 30, 32, 32] },
  mk: { W: 939, H: 387, kbY: 11, wellPad: 0, padW: 0, padY: 0, padH: 0, hingeX: 0, grille: false, radius: [18, 18, 18, 18] },
  air: { W: 1024, H: 724, kbY: 50.6, wellPad: 7, padW: 432.5, padY: 437, padH: 270.1, hingeX: 120, grille: false, radius: [20, 20, 26, 26] }
};

export type FinishId =
  | 'pro-space-black'
  | 'pro-silver'
  | 'air-midnight'
  | 'air-starlight'
  | 'air-sky-blue'
  | 'air-silver'
  | 'neo-silver'
  | 'neo-blush'
  | 'neo-citrus'
  | 'neo-indigo'
  | 'imac-silver'
  | 'imac-blue'
  | 'imac-purple'
  | 'imac-pink'
  | 'imac-orange'
  | 'imac-yellow'
  | 'imac-green';

export interface FinishSpec {
  id: FinishId;
  name: string;
  model: ModelId;
  dark: boolean;
  deck: [string, string];
  pad: [string, string];
  side: [string, string];
  lid: [string, string, string];
  edge: string;
  /** Speaker grille dot color. */
  dot: string;
  /** Light key caps (Neo and Magic Keyboard): face and legend colors. */
  kf?: string;
  kl?: string;
  /** Lid screen wallpaper, as a CSS background (web renderers only). */
  wall: string;
  /** Lid wallpaper ribbon colors: [ribbon A, ribbon highlight, ribbon B, dark ink (1) or light ink (0), ribbon C]. */
  ribbon: [string, string, string, number, string?];
}

const IMAC_RIB: FinishSpec['ribbon'] = ['#d0d6e0', '#ffffff', '#a8b0bd', 0];
const IMAC_WALL = 'linear-gradient(165deg, #f1f3f6 0%, #cfd5de 100%)';

export const FINISHES: FinishSpec[] = [
  { id: 'pro-space-black', name: 'MacBook Pro · Space Black', model: 'pro', dark: true, deck: ['#4a484b', '#2d2b2e'], pad: ['#423f43', '#2b292c'], side: ['#1d1c1e', '#0f0e10'], lid: ['#7a787d', '#3c3b3e', '#232224'], edge: 'rgba(255,255,255,.13)', dot: 'rgba(0,0,0,.55)',
    wall: 'radial-gradient(60% 45% at 52% 12%, #f8dcb4 0%, rgba(248,220,180,0) 75%), radial-gradient(55% 45% at 86% 92%, #f2b47c 0%, rgba(242,180,124,0) 72%), radial-gradient(90% 70% at 20% 30%, #f2c58a 0%, rgba(242,197,138,0) 60%), radial-gradient(80% 80% at 85% 70%, #2f7fe0 0%, rgba(47,127,224,0) 65%), linear-gradient(160deg, #3d7fd0 0%, #9fc3ea 30%, #f3d7aa 52%, #e8a868 66%, #2f66b8 100%)',
    ribbon: ['#1a4fc0', '#fff0d4', '#123a94', 1, '#7fd0ff'] },
  { id: 'pro-silver', name: 'MacBook Pro · Silver', model: 'pro', dark: false, deck: ['#dfdfe1', '#e5e6e8'], pad: ['#dadbdd', '#e0e1e3'], side: ['#bdbec1', '#9c9da0'], lid: ['#f0f0f2', '#cbccce', '#a5a6a9'], edge: 'rgba(255,255,255,.95)', dot: 'rgba(30,30,34,.6)',
    wall: 'radial-gradient(60% 45% at 52% 12%, #fbe8cf 0%, rgba(251,232,207,0) 75%), radial-gradient(55% 45% at 86% 92%, #f7d3a8 0%, rgba(247,211,168,0) 72%), radial-gradient(90% 70% at 20% 30%, #ffffff 0%, rgba(255,255,255,0) 60%), radial-gradient(80% 80% at 85% 70%, #4f9cf0 0%, rgba(79,156,240,0) 65%), linear-gradient(160deg, #6aaef5 0%, #cfe3fa 32%, #f6e8d2 52%, #b8c8f2 70%, #4d84d8 100%)',
    ribbon: ['#2f78e0', '#fff4e0', '#1f5cc0', 0, '#8fd8ff'] },
  { id: 'air-midnight', name: 'MacBook Air · Midnight', model: 'air', dark: true, deck: ['#48505c', '#535b68'], pad: ['#4a525e', '#545c69'], side: ['#343a44', '#22262d'], lid: ['#c6c9ce', '#7d838c', '#464c56'], edge: 'rgba(225,232,245,.22)', dot: 'rgba(0,0,0,.6)',
    wall: 'radial-gradient(90% 70% at 25% 30%, #6f9de6 0%, rgba(111,157,230,0) 60%), radial-gradient(80% 80% at 85% 75%, #1f4fa3 0%, rgba(31,79,163,0) 65%), linear-gradient(160deg, #1d3a74 0%, #3f74c9 38%, #9dbdec 58%, #2b5aa8 78%, #142a58 100%)',
    ribbon: ['#1c3f96', '#d6e4fa', '#122d70', 1, '#8fb8f0'] },
  { id: 'air-starlight', name: 'MacBook Air · Starlight', model: 'air', dark: false, deck: ['#e8e1d7', '#eee7dd'], pad: ['#e8e1d7', '#ede6dc'], side: ['#d3cabc', '#b2a899'], lid: ['#f7f4f0', '#ddd6cb', '#b9b0a2'], edge: 'rgba(255,253,248,.95)', dot: 'rgba(60,50,30,.5)',
    wall: 'radial-gradient(110% 80% at 25% 105%, #f0c98a 0%, rgba(240,201,138,0) 55%), radial-gradient(80% 70% at 85% 10%, #fff3dc 0%, rgba(255,243,220,0) 60%), radial-gradient(60% 50% at 55% 55%, #d9a463 0%, rgba(217,164,99,0) 60%), linear-gradient(165deg, #f6e9d3 0%, #e3c597 55%, #b98a52 100%)',
    ribbon: ['#7f9fcf', '#fff1d8', '#5f80b8', 0, '#f2b27a'] },
  { id: 'air-sky-blue', name: 'MacBook Air · Sky Blue', model: 'air', dark: false, deck: ['#cdd8de', '#d5e0e6'], pad: ['#c9d4da', '#cfdae0'], side: ['#b3c0c7', '#94a1a8'], lid: ['#eff2f4', '#ced8dd', '#a7b4bb'], edge: 'rgba(250,253,255,.95)', dot: 'rgba(30,40,50,.5)',
    wall: 'radial-gradient(110% 80% at 25% 105%, #6fb4e8 0%, rgba(111,180,232,0) 55%), radial-gradient(80% 70% at 85% 10%, #e9f6ff 0%, rgba(233,246,255,0) 60%), radial-gradient(60% 50% at 55% 55%, #9fd3f2 0%, rgba(159,211,242,0) 60%), linear-gradient(165deg, #d9eefb 0%, #9cc9ea 55%, #5b95c7 100%)',
    ribbon: ['#4f9be0', '#f2fbff', '#f2b27a', 0, '#9fd6ff'] },
  { id: 'air-silver', name: 'MacBook Air · Silver', model: 'air', dark: false, deck: ['#dadbdd', '#e2e3e5'], pad: ['#d3d4d6', '#d8d9db'], side: ['#bdbec1', '#9fa0a3'], lid: ['#f3f3f4', '#d4d5d7', '#adaeb1'], edge: 'rgba(255,255,255,.95)', dot: 'rgba(30,30,34,.5)',
    wall: 'radial-gradient(110% 80% at 25% 105%, #b9c2d0 0%, rgba(185,194,208,0) 55%), radial-gradient(80% 70% at 85% 10%, #ffffff 0%, rgba(255,255,255,0) 60%), radial-gradient(60% 50% at 55% 55%, #d6dce6 0%, rgba(214,220,230,0) 60%), linear-gradient(165deg, #f1f3f6 0%, #cfd5de 55%, #9aa3b1 100%)',
    ribbon: ['#8fa6c8', '#ffffff', '#c9a7d8', 0] },
  { id: 'neo-silver', name: 'MacBook Neo · Silver', model: 'neo', dark: false, deck: ['#dcdde0', '#e2e3e5'], pad: ['#dadbdd', '#dcdddf'], side: ['#bfc0c3', '#a2a3a6'], lid: ['#f2f2f4', '#e0e1e3', '#b6b7ba'], edge: 'rgba(255,255,255,.95)', dot: 'transparent', kf: '#eaebed', kl: '#434446',
    wall: 'radial-gradient(110% 80% at 25% 105%, #c3c9e6 0%, rgba(195,201,230,0) 55%), radial-gradient(80% 70% at 85% 10%, #ffffff 0%, rgba(255,255,255,0) 60%), radial-gradient(60% 50% at 55% 55%, #dcdff0 0%, rgba(220,223,240,0) 60%), linear-gradient(165deg, #f3f4f8 0%, #d3d7e6 55%, #9ea5c0 100%)',
    ribbon: ['#9aa6e0', '#ffffff', '#e0b3d0', 0] },
  { id: 'neo-blush', name: 'MacBook Neo · Blush', model: 'neo', dark: false, deck: ['#e9d0d0', '#edd5d5'], pad: ['#e6cdcd', '#e8d0d0'], side: ['#d4b9b9', '#b99d9d'], lid: ['#f7e6e5', '#ead0cf', '#c9abab'], edge: 'rgba(255,248,248,.95)', dot: 'transparent', kf: '#f1dfdf', kl: '#4d4845',
    wall: 'radial-gradient(110% 80% at 25% 105%, #f2a7b4 0%, rgba(242,167,180,0) 55%), radial-gradient(80% 70% at 85% 10%, #fff1f1 0%, rgba(255,241,241,0) 60%), radial-gradient(60% 50% at 55% 55%, #f7c6c6 0%, rgba(247,198,198,0) 60%), linear-gradient(165deg, #fbe7e7 0%, #efbcbf 55%, #c98390 100%)',
    ribbon: ['#f07f98', '#ffe6e9', '#b98fe0', 0] },
  { id: 'neo-citrus', name: 'MacBook Neo · Citrus', model: 'neo', dark: false, deck: ['#e7e593', '#edeb98'], pad: ['#e6e592', '#e8e794'], side: ['#d0ce7c', '#b3b163'], lid: ['#f3f1b0', '#e2e08d', '#bebc69'], edge: 'rgba(255,255,235,.9)', dot: 'transparent', kf: '#f4f3bc', kl: '#47414b',
    wall: 'radial-gradient(110% 80% at 25% 105%, #d9e04a 0%, rgba(217,224,74,0) 55%), radial-gradient(80% 70% at 85% 10%, #fffbd6 0%, rgba(255,251,214,0) 60%), radial-gradient(60% 50% at 55% 55%, #f0ec7a 0%, rgba(240,236,122,0) 60%), linear-gradient(165deg, #fbf8c9 0%, #ece57c 55%, #b9b23a 100%)',
    ribbon: ['#c9d22e', '#fffbd6', '#5fc7a8', 0] },
  { id: 'neo-indigo', name: 'MacBook Neo · Indigo', model: 'neo', dark: true, deck: ['#4f5a70', '#59647a'], pad: ['#4d586e', '#525d73'], side: ['#38425a', '#262e40'], lid: ['#8a94ab', '#5d6880', '#353f55'], edge: 'rgba(220,228,250,.2)', dot: 'transparent', kf: '#8e99b7', kl: '#2c3232',
    wall: 'radial-gradient(90% 70% at 25% 30%, #a79cf2 0%, rgba(167,156,242,0) 60%), radial-gradient(80% 80% at 85% 75%, #3a46c8 0%, rgba(58,70,200,0) 65%), linear-gradient(160deg, #262c78 0%, #5560d8 38%, #c3b8f6 58%, #4a52c8 78%, #1c2160 100%)',
    ribbon: ['#3a3fc0', '#ece6ff', '#262a96', 1, '#a9a6ff'] },
  { id: 'imac-silver', name: 'iMac · Silver', model: 'mk', dark: false, deck: ['#e1e2e4', '#d4d5d9'], pad: ['#e1e2e4', '#d4d5d9'], side: ['#bfc0c3', '#a1a2a5'], lid: ['#ececee', '#d4d5d9', '#aaaaae'], edge: 'rgba(255,255,255,.9)', dot: 'transparent', kf: '#f6f7f9', kl: '#4a4a4c', wall: IMAC_WALL, ribbon: IMAC_RIB },
  { id: 'imac-blue', name: 'iMac · Blue', model: 'mk', dark: false, deck: ['#d8e0eb', '#c7d2e2'], pad: ['#d8e0eb', '#c7d2e2'], side: ['#b3bdcb', '#97a0ac'], lid: ['#e6ebf2', '#c7d2e2', '#9fa8b5'], edge: 'rgba(255,255,255,.9)', dot: 'transparent', kf: '#f6f7f9', kl: '#4a4a4c', wall: IMAC_WALL, ribbon: IMAC_RIB },
  { id: 'imac-purple', name: 'iMac · Purple', model: 'mk', dark: false, deck: ['#dfdce9', '#d1cde0'], pad: ['#dfdce9', '#d1cde0'], side: ['#bcb8ca', '#9f9caa'], lid: ['#eae8f1', '#d1cde0', '#a7a4b3'], edge: 'rgba(255,255,255,.9)', dot: 'transparent', kf: '#f6f7f9', kl: '#4a4a4c', wall: IMAC_WALL, ribbon: IMAC_RIB },
  { id: 'imac-pink', name: 'iMac · Pink', model: 'mk', dark: false, deck: ['#f0d8de', '#eac7d0'], pad: ['#f0d8de', '#eac7d0'], side: ['#d3b3bb', '#b2979e'], lid: ['#f6e6ea', '#eac7d0', '#bb9fa6'], edge: 'rgba(255,255,255,.9)', dot: 'transparent', kf: '#f6f7f9', kl: '#4a4a4c', wall: IMAC_WALL, ribbon: IMAC_RIB },
  { id: 'imac-orange', name: 'iMac · Orange', model: 'mk', dark: false, deck: ['#f1dcd3', '#ebcdc0'], pad: ['#f1dcd3', '#ebcdc0'], side: ['#d4b8ad', '#b39c92'], lid: ['#f6e8e3', '#ebcdc0', '#bca49a'], edge: 'rgba(255,255,255,.9)', dot: 'transparent', kf: '#f6f7f9', kl: '#4a4a4c', wall: IMAC_WALL, ribbon: IMAC_RIB },
  { id: 'imac-yellow', name: 'iMac · Yellow', model: 'mk', dark: false, deck: ['#ece4ce', '#e4d9b9'], pad: ['#ece4ce', '#e4d9b9'], side: ['#cdc3a6', '#ada58d'], lid: ['#f3eee0', '#e4d9b9', '#b6ae94'], edge: 'rgba(255,255,255,.9)', dot: 'transparent', kf: '#f6f7f9', kl: '#4a4a4c', wall: IMAC_WALL, ribbon: IMAC_RIB },
  { id: 'imac-green', name: 'iMac · Green', model: 'mk', dark: false, deck: ['#d6e3db', '#c4d7cc'], pad: ['#d6e3db', '#c4d7cc'], side: ['#b0c2b8', '#95a39b'], lid: ['#e4ede8', '#c4d7cc', '#9daca3'], edge: 'rgba(255,255,255,.9)', dot: 'transparent', kf: '#f6f7f9', kl: '#4a4a4c', wall: IMAC_WALL, ribbon: IMAC_RIB }
];

export const FINISH_IDS = FINISHES.map((f) => f.id) as FinishId[];

export function getFinish(id: FinishId | string): FinishSpec {
  return FINISHES.find((f) => f.id === id || f.name === id) ?? FINISHES[0];
}

export type LayoutId =
  | 'en-us'
  | 'en-gb'
  | 'de'
  | 'fr'
  | 'es'
  | 'sv-fi'
  | 'no'
  | 'da'
  | 'it'
  | 'ja'
  | 'nl'
  | 'en-intl'
  | 'ch'
  | 'pt'
  | 'ru'
  | 'ko';

/**
 * A layout's legends, one row per string, keys split by spaces.
 * One character is a single legend. Two characters are shifted (top) and base (bottom).
 * A third and later characters are the option legend at bottom right. `X|Y` puts Y at bottom right.
 * `AB¦CD` is a four-legend key: left column A over B, right column C over D. `·` is an empty slot.
 */
export interface LayoutSpec {
  id: LayoutId;
  name: string;
  /** ISO: tall return key and an extra key beside left shift. */
  iso: boolean;
  /** English word legends (tab, caps lock, shift ...) on MacBook Pro and Air. */
  en: boolean;
  /** Japanese JIS: built from its own table. */
  jis?: boolean;
  /** A text legend for caps lock in place of the icon. */
  caps?: string;
  num?: string;
  q?: string;
  a?: string;
  x?: string;
  z?: string;
}

export const LAYOUTS: LayoutSpec[] = [
  { id: 'en-us', name: 'English (US)', iso: false, en: true, num: "~` !1 @2 #3 $4 %5 ^6 &7 *8 (9 )0 _- +=", q: 'Q W E R T Y U I O P {[ }] |\\', a: 'A S D F G H J K L :; "\'', z: 'Z X C V B N M <, >. ?/' },
  { id: 'en-gb', name: 'English (UK)', iso: true, en: false, num: '±§ !1 @2€ £3# $4 %5 ^6 &7 *8 (9 )0 _- +=', q: 'Q W E R T Y U I O P {[ }]', a: 'A S D F G H J K L :; "\' |\\', x: '~`', z: 'Z X C V B N M <, >. ?/' },
  { id: 'de', name: 'German', iso: true, en: false, num: '°^ !1 "2 §3 $4 %5 &6 /7 (8 )9 =0 ?ß `´', q: 'Q W E|€ R T Z U I O P Ü *+', a: "A S D F G H J K L|@ Ö Ä '#", x: '><', z: 'Y X C V B N M ;, :. _-' },
  { id: 'fr', name: 'French', iso: true, en: false, num: '#@ 1& 2é 3" 4\' 5( 6§ 7è 8! 9ç 0à °) _-', q: 'A Z E R T Y U I O P ¨^ *$€', a: 'Q S D F G H J K L M %ù £`', x: '><', z: 'W X C V B N ?, .; /: +=' },
  { id: 'es', name: 'Spanish', iso: true, en: false, num: 'ªº\\ !1| "2@ ·3# $4 %5 &6 /7 (8 )9 =0 ?\' ¿¡', q: 'Q W E|€ R T Y U I O P ^`[ *+]', a: 'A S D F G H J K L Ñ ¨´{ Ç|}', x: '><', z: 'Z X C V B N M ;, :. _-' },
  { id: 'sv-fi', name: 'Swedish / Finnish', iso: true, en: false, num: '°§ !1 "2@ #3 €4 %5 &6 /7 (8 )9 =0 ?+ `´', q: 'Q W E R T Y U I O P Å ^¨', a: "A S D F G H J K L Ö Ä *'", x: '><', z: 'Z X C V B N M ;, :. _-' },
  { id: 'no', name: 'Norwegian', iso: true, en: false, num: '§\' !1 "2 #3 $4€ %5 &6 /7 (8 )9 =0 ?+ `´', q: 'Q W E R T Y U I O P Å ^¨', a: 'A S D F G H J K L Ø Æ *@', x: '><', z: 'Z X C V B N M ;, :. _-' },
  { id: 'da', name: 'Danish', iso: true, en: false, num: '§$ !1 "2 #3 €4 %5 &6 /7 (8 )9 =0 ?+ `´', q: 'Q W E R T Y U I O P Å ^¨', a: "A S D F G H J K L Æ Ø *'@", x: '><', z: 'Z X C V B N M ;, :. _-' },
  { id: 'it', name: 'Italian', iso: true, en: false, num: '|\\ !1 "2 £3 $4 %5 &6 /7 (8 )9 =0 ?\' ^ì', q: 'Q W E|€ R T Y U I O P éè[ *+]', a: 'A S D F G H J K L çò@ °à# §ù', x: '><', z: 'Z X C V B N M ;, :. _-' },
  { id: 'ja', name: 'Japanese', iso: false, en: false, jis: true },
  { id: 'nl', name: 'Dutch', iso: true, en: false, num: '±§ !1 @2€ #3 $4 %5 ^6 &7 *8 (9 )0 _- +=', q: 'Q W E R T Y U I O P {[ }]', a: 'A S D F G H J K L :; "\' |\\', x: '~`', z: 'Z X C V B N M <, >. ?/' },
  { id: 'en-intl', name: 'English (International)', iso: true, en: false, num: '±§ !1 @2 #3 $4 %5 ^6 &7 *8 (9 )0 _- +=', q: 'Q W E R T Y U I O P {[ }]', a: 'A S D F G H J K L :; "\' |\\', x: '~`', z: 'Z X C V B N M <, >. ?/' },
  { id: 'ch', name: 'Swiss', iso: true, en: false, num: '°§ +1 "2 *3# ç4 %5 &6 /7 (8 )9 =0 ?\' `^', q: 'Q W E|€ R T Z U I O P èü !¨', a: 'A S D F G|@ H J K L éö àä £$', x: '><', z: 'Y X C V B N M ;, :. _-' },
  { id: 'pt', name: 'Portuguese', iso: true, en: false, num: '±§ !1 "2@ #3€ $4 %5 &6 /7 (8 )9 =0 ?\' *+', q: 'Q W E R T Y U I O P ªº `´', a: 'A S D F G H J K L Ç ^~ |\\', x: '><', z: 'Z X C V B N M ;, :. _-' },
  { id: 'ru', name: 'Russian', iso: true, en: false, num: '±§¦<> !1 @2¦"· #3¦№· $4¦%· %5¦:· ^6¦,· &7¦.· *8¦;· (9 )0 _- +=', q: 'Q¦Й W¦Ц E¦У R¦К T¦Е Y¦Н U¦Г I¦Ш O¦Щ P¦З {[¦·Х }]¦·Ъ', a: 'A¦Ф S¦Ы D¦В F¦А G¦П H¦₽Р J¦О K¦Л L¦Д :;¦·Ж "\'¦·Э |\\¦·Ё', x: '~`¦[]', z: 'Z¦Я X¦Ч C¦С V¦М B¦И N¦Т M¦Ь <,¦·Б >.¦·Ю ?/' },
  { id: 'ko', name: 'Korean', iso: false, en: false, caps: '한/A', num: '~₩ !1 @2 #3 $4 %5 ^6 &7 *8 (9 )0 _- +=', q: 'ㅃㅂ¦Q· ㅉㅈ¦W· ㄸㄷ¦E· ㄲㄱ¦R· ㅆㅅ¦T· ·ㅛ¦Y· ·ㅕ¦U· ·ㅑ¦I· ㅒㅐ¦O· ㅖㅔ¦P· {[ }] |\\', a: '·ㅁ¦A· ·ㄴ¦S· ·ㅇ¦D· ·ㄹ¦F· ·ㅎ¦G· ·ㅗ¦H· ·ㅓ¦J· ·ㅏ¦K· ·ㅣ¦L· :; "\'', z: '·ㅋ¦Z· ·ㅌ¦X· ·ㅊ¦C· ·ㅍ¦V· ·ㅠ¦B· ·ㅜ¦N· ·ㅡ¦M· <, >. ?/' }
];

export const LAYOUT_IDS = LAYOUTS.map((l) => l.id) as LayoutId[];

export function getLayout(id: LayoutId | string): LayoutSpec {
  return LAYOUTS.find((l) => l.id === id || l.name === id) ?? LAYOUTS[0];
}

/** A user-defined layout. Rows use the same legend syntax as {@link LayoutSpec}. */
export interface CustomLayout {
  kind: 'ISO' | 'ANSI';
  num: string;
  q: string;
  a: string;
  /** The key beside left shift (ISO only). */
  x: string;
  z: string;
}

export const DEFAULT_CUSTOM_LAYOUT: CustomLayout = {
  kind: 'ISO',
  num: '§ 1 2 3 4 5 6 7 8 9 0 - =',
  q: 'Q W E R T Y U I O P [ ]',
  a: "A S D F G H J K L ; ' \\",
  x: '`',
  z: 'Z X C V B N M , . /'
};

// Japanese JIS rows: [shifted, base, kana, small kana, width in units].
export const JIS = {
  num: [['!', '1', 'ぬ', '', 1.25], ['"', '2', 'ふ'], ['#', '3', 'あ', 'ぁ'], ['$', '4', 'う', 'ぅ'], ['%', '5', 'え', 'ぇ'], ['&', '6', 'お', 'ぉ'], ["'", '7', 'や', 'ゃ'], ['(', '8', 'ゆ', 'ゅ'], [')', '9', 'よ', 'ょ'], ['', '0', 'わ', 'を'], ['=', '-', 'ほ'], ['~', '^', 'へ'], ['|', '¥', 'ー']],
  qLetters: [['Q', 'た'], ['W', 'て'], ['E', 'い', 'ぃ'], ['R', 'す'], ['T', 'か'], ['Y', 'ん'], ['U', 'な'], ['I', 'に'], ['O', 'ら'], ['P', 'せ']],
  qSymbols: [['`', '@', '゛'], ['{', '[', '゜', '「']],
  aLetters: [['A', 'ち'], ['S', 'と'], ['D', 'し'], ['F', 'は'], ['G', 'き'], ['H', 'く'], ['J', 'ま'], ['K', 'の'], ['L', 'り']],
  aSymbols: [['+', ';', 'れ'], ['*', ':', 'け'], ['}', ']', 'む', '」']],
  zLetters: [['Z', 'つ', 'っ'], ['X', 'さ'], ['C', 'そ'], ['V', 'ひ'], ['B', 'こ'], ['N', 'み'], ['M', 'も']],
  zSymbols: [['<', ',', 'ね', '、'], ['>', '.', 'る', '。'], ['?', '/', 'め', '・'], ['_', '', 'ろ']]
} as const;

// ---- Glyphs -------------------------------------------------------------------------------------

const rr = (x: number, y: number, w: number, h: number, r: number) =>
  'M' + fmt(x + r) + ' ' + fmt(y) + 'h' + fmt(w - 2 * r) + 'a' + fmt(r) + ' ' + fmt(r) + ' 0 0 1 ' + fmt(r) + ' ' + fmt(r) + 'v' + fmt(h - 2 * r) + 'a' + fmt(r) + ' ' + fmt(r) + ' 0 0 1 -' + fmt(r) + ' ' + fmt(r) + 'h-' + fmt(w - 2 * r) + 'a' + fmt(r) + ' ' + fmt(r) + ' 0 0 1 -' + fmt(r) + ' -' + fmt(r) + 'v-' + fmt(h - 2 * r) + 'a' + fmt(r) + ' ' + fmt(r) + ' 0 0 1 ' + fmt(r) + ' -' + fmt(r) + 'z';
const ring = (cx: number, cy: number, r: number) => 'M' + fmt(cx - r) + ' ' + fmt(cy) + 'a' + fmt(r) + ' ' + fmt(r) + ' 0 1 0 ' + fmt(2 * r) + ' 0a' + fmt(r) + ' ' + fmt(r) + ' 0 1 0 -' + fmt(2 * r) + ' 0';
const sun = (c: number, rc: number, r0: number, r1: number) => {
  let d = ring(c, c, rc);
  for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4, co = Math.cos(t), si = Math.sin(t);
    d += 'M' + fmt(+(c + r0 * co).toFixed(2)) + ' ' + fmt(+(c + r0 * si).toFixed(2)) + 'L' + fmt(+(c + r1 * co).toFixed(2)) + ' ' + fmt(+(c + r1 * si).toFixed(2));
  }
  return d;
};

export interface Glyph {
  /** Accessible name of the key's function. */
  name: string;
  /** Drawn size in px. */
  w: number;
  h: number;
  viewBox: [number, number, number, number];
  /** Path drawn with a stroke (round caps and joins). */
  stroke: string;
  /** Path drawn filled. */
  fill: string;
  strokeWidth: number;
  /** Drawn size, when it differs from the measured size (function-row glyphs are drawn 1.07 times larger). */
  drawW?: number;
  drawH?: number;
}

const glyph = (name: string, w: number, h: number, stroke: string, vb?: [number, number, number, number], sw = 1.05, fill = ''): Glyph => ({
  name,
  w,
  h,
  viewBox: vb ?? [0, 0, w, h],
  stroke,
  fill,
  strokeWidth: sw
});

/** Function-row glyphs for F1 to F12. They are drawn 1.07 times larger than measured, to match the caps. */
export const FKEY_GLYPHS: Glyph[] = ([
  glyph('brightness down', 10.5, 10.5, sun(5.25, 1.6, 3.4, 4.6)),
  glyph('brightness up', 11.4, 11.4, sun(5.7, 2.2, 3.6, 5.1)),
  glyph('Mission Control', 15.8, 10.5, rr(0.55, 0.55, 5.9, 4.2, 1) + rr(0.55, 5.75, 5.9, 4.2, 1) + rr(9.4, 0.55, 5.85, 9.4, 1)),
  glyph('Spotlight', 10.5, 10.5, ring(4.3, 4.3, 3.6) + 'M6.9 6.9L9.95 9.95'),
  glyph('Dictation', 8.2, 12.3, rr(2.4, 0.55, 3.4, 6.2, 1.7) + 'M.6 5.2a3.5 3.5 0 0 0 7 0M4.1 8.75v2.6M2.55 11.75h3.1', [0, 0, 8.2, 12.3]),
  glyph('Do Not Disturb', 10.5, 10.5, 'M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1z', [5, 3.8, 15.2, 15.2], 1.6),
  glyph('previous track', 14.9, 8.8, 'M7 .55L.55 4.4L7 8.25zM14.35 .55L7.8 4.4L14.35 8.25z'),
  glyph('play or pause', 14, 8.8, 'M.55 .55L6.7 4.4L.55 8.25zM9.7 .55v7.7M13.45 .55v7.7'),
  glyph('next track', 15.8, 8.8, 'M.55 .55L7.2 4.4L.55 8.25zM8.2 .55L15.25 4.4L8.2 8.25z'),
  glyph('mute', 9.6, 9.6, 'M.55 3.5h2.1L5.4 1.1v7.4L2.65 6.1H.55zM.9 .8L9.05 8.8'),
  glyph('volume down', 10.5, 9.6, 'M.55 3.5h2.2L5.8 .75v8.1L2.75 6.1H.55zM7.7 2.9A2.6 2.6 0 0 1 7.7 6.8'),
  glyph('volume up', 14.9, 10.5, 'M.55 3.9h2.3L6.1 .8v8.9L2.85 6.6H.55zM7.9 3.3A2.4 2.4 0 0 1 7.9 7.2M9.7 2A4.2 4.2 0 0 1 9.7 8.5M11.5 .8A6 6 0 0 1 11.5 9.7')
] as Glyph[]).map((g) => ({ ...g, drawW: +(g.w * 1.07).toFixed(2), drawH: +(g.h * 1.07).toFixed(2) }));

/** Modifier symbols: control, option, command. */
export const MOD_GLYPHS: Record<'ctrl' | 'opt' | 'cmd', Glyph> = {
  ctrl: glyph('control', 10.2, 6, 'M.6 5.4L5.1 .6L9.6 5.4', [0, 0, 10.2, 6], 1.1),
  opt: glyph('option', 12.6, 11.2, 'M.6 .9H4.6L8.4 10.3H12M8.5 .9H12', [0, 0, 12.6, 11.2], 1.1),
  cmd: glyph('command', 11.6, 11.6, 'M9 9V6.5A2.5 2.5 0 1 0 6.5 9H17.5A2.5 2.5 0 1 0 15 6.5V17.5A2.5 2.5 0 1 0 17.5 15H6.5A2.5 2.5 0 1 0 9 17.5Z', [3.2, 3.2, 17.6, 17.6], 1.6)
};

/** Icon legends used by Magic Keyboard, MacBook Neo and every non-English layout. */
export const ICON_GLYPHS: Record<'tab' | 'caps' | 'shift' | 'del' | 'ret', Glyph> = {
  tab: glyph('tab', 12.3, 9, 'M.6 4.5H10.3M6.85 1.05L10.3 4.5L6.85 7.95M11.7 .6V8.4'),
  caps: glyph('caps lock', 12.4, 12.6, 'M6.2 .65L11.75 5.85H8.85V8.45H3.55V5.85H.65ZM3.55 10.3H8.85V11.95H3.55Z'),
  shift: glyph('shift', 12.7, 11, 'M6.35 .65L12.05 6.35H9.05V10.35H3.65V6.35H.65Z'),
  del: glyph('delete', 12.7, 11, 'M4.3 .65H11.05A1 1 0 0 1 12.05 1.65V9.35A1 1 0 0 1 11.05 10.35H4.3L.65 5.5ZM6.2 3.4L9.6 7.6M9.6 3.4L6.2 7.6'),
  ret: glyph('return', 12.3, 11, 'M11.65 .6V6.1A1.2 1.2 0 0 1 10.45 7.3H1.3M4.5 4.1L1.2 7.3L4.5 10.5')
};

export const GLOBE_GLYPH: Glyph = glyph('globe', 13, 13, 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M3 12h18M12 3c2.6 2.5 3.8 5.6 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.6-3.8-9s1.2-6.5 3.8-9z', [3, 3, 18, 18], 1.45);

/** Filled arrow triangles for the inverted-T arrow keys. */
export const ARROW_GLYPHS: Record<'up' | 'down' | 'left' | 'right', Glyph> = {
  up: glyph('up arrow', 6.4, 5.6, '', undefined, 0, 'M3.2 .3L6.1 5.3H.3Z'),
  down: glyph('down arrow', 6.4, 5.6, '', undefined, 0, 'M3.2 5.3L.3 .3H6.1Z'),
  left: glyph('left arrow', 5.6, 6.4, '', undefined, 0, 'M.3 3.2L5.3 .3V6.1Z'),
  right: glyph('right arrow', 5.6, 6.4, '', undefined, 0, 'M5.3 3.2L.3 .3V6.1Z')
};
