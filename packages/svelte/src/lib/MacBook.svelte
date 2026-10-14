<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import {
    KeyboardController,
    TrackpadController,
    buildKeyboard,
    getFinish,
    grad2,
    gradientCss,
    injectStyles,
    keyboardTheme,
    shadowsCss,
    topCase,
    trackpadShadows
  } from '@mackeys/core';
  import Deck from './Deck.svelte';
  import Keys from './Keys.svelte';
  import Lid from './Lid.svelte';
  import Scaled from './Scaled.svelte';
  import TrackpadButton from './TrackpadButton.svelte';
  import { idleMs, resolveSound } from './sound';
  import { keyboardState, trackpadState, windowKeys } from './state.svelte';
  import type { MacBookProps } from './types';

  let {
    finish = 'pro-space-black',
    layout = 'en-us',
    custom,
    backlight,
    sound,
    capture = 'focus',
    highlight,
    scale = 1,
    view = 'top-down',
    lid = true,
    forceDelayMs = 500,
    onkeydown,
    onkeyup,
    onpress,
    onforceclick,
    onrelease,
    class: className,
    style
  }: MacBookProps = $props();

  // The open lid leans toward the viewer, so its top edge projects wider than the base.
  const LID_SPACE = 200;
  const LID_SIDE = 120;
  onMount(() => injectStyles());
  const controller = new KeyboardController();
  const kb = keyboardState(controller);
  const tpc = new TrackpadController();
  const tp = trackpadState(tpc);
  let geometry = $derived(buildKeyboard({ finish, layout, custom }));
  controller.setKeys(untrack(() => geometry.keys));
  $effect(() => controller.setKeys(geometry.keys));
  $effect(() => {
    controller.sound = resolveSound(sound);
    tpc.sound = resolveSound(sound);
    tpc.forceDelayMs = forceDelayMs;
  });
  $effect(() => controller.setIdleOff(idleMs(backlight?.idleOff)));
  $effect(() => controller.onKey((e) => (e.type === 'press' ? onkeydown?.(e) : onkeyup?.(e))));
  $effect(() => tpc.onEvent((e) => (e.type === 'press' ? onpress?.() : e.type === 'force' ? onforceclick?.() : onrelease?.())));
  windowKeys(() => capture === 'window', controller);

  let bl = $derived({ ...backlight, idle: kb.value.idle });
  let theme = $derived(keyboardTheme(finish, bl));
  let tc = $derived(topCase(finish, geometry, { parts: 'full', backlight: bl }));
  let f = $derived(getFinish(finish));
  let showLid = $derived(lid && tc.full);
  let top = $derived(showLid ? LID_SPACE : 0);
  let side = $derived(showLid ? LID_SIDE : 0);
  let padStyle = $derived(
    tc.trackpad
      ? 'left:' + tc.trackpad.x + 'px;top:' + tc.trackpad.y + 'px;width:' + tc.trackpad.w + 'px;height:' + tc.trackpad.h + 'px;border-radius:' + tc.trackpad.radius + 'px;background:' + gradientCss(grad2(f.pad)) + ';box-shadow:' + shadowsCss(trackpadShadows(finish))
      : ''
  );
</script>

<Scaled w={tc.width + 2 * side} h={tc.height + 10 + top} {scale} {view} class={className} {style}>
  <div style={'position:absolute;left:' + side + 'px;top:' + top + 'px;width:' + tc.width + 'px;height:' + tc.height + 'px'}>
    {#if showLid}<Lid {finish} width={tc.width} height={tc.height} />{/if}
    <Deck {tc}>
      {#snippet trackpad()}
        {#if tc.trackpad}
          <TrackpadButton controller={tpc} phase={tp.value} label="Force Touch trackpad. Click, or press and hold for a force click." style={padStyle} grain={0} />
        {/if}
      {/snippet}
      <Keys {geometry} {theme} kbState={kb.value} {controller} {highlight} focusKeys={capture === 'focus'} label={f.name + ' keyboard. Click or type to press keys.'} />
    </Deck>
  </div>
</Scaled>
