<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { KeyboardController, buildKeyboard, getFinish, injectStyles, keyboardTheme, topCase } from '@mackeys/core';
  import Deck from './Deck.svelte';
  import Keys from './Keys.svelte';
  import Scaled from './Scaled.svelte';
  import { idleMs, resolveSound } from './sound';
  import { keyboardState, windowKeys } from './state.svelte';
  import type { MacKeyboardProps } from './types';

  let { finish = 'pro-space-black', layout = 'en-us', custom, backlight, sound, capture = 'focus', highlight, scale = 1, view = 'top-down', onkeydown, onkeyup, class: className, style }: MacKeyboardProps = $props();

  onMount(() => injectStyles());
  const controller = new KeyboardController();
  const kb = keyboardState(controller);
  let geometry = $derived(buildKeyboard({ finish, layout, custom }));
  $effect(() => controller.setKeys(geometry.keys));
  $effect(() => {
    controller.sound = resolveSound(sound);
  });
  $effect(() => controller.setIdleOff(idleMs(backlight?.idleOff)));
  $effect(() => controller.onKey((e) => (e.type === 'press' ? onkeydown?.(e) : onkeyup?.(e))));
  windowKeys(() => capture === 'window', controller);
  controller.setKeys(untrack(() => geometry.keys));

  let bl = $derived({ ...backlight, idle: kb.value.idle });
  let theme = $derived(keyboardTheme(finish, bl));
  let tc = $derived(topCase(finish, geometry, { parts: 'keyboard', backlight: bl }));
</script>

<Scaled w={tc.width} h={tc.height + 10} {scale} {view} class={className} {style}>
  <Deck {tc}>
    <Keys {geometry} {theme} kbState={kb.value} {controller} {highlight} focusKeys={capture === 'focus'} label={getFinish(finish).name + ' keyboard. Click or type to press keys.'} />
  </Deck>
</Scaled>
