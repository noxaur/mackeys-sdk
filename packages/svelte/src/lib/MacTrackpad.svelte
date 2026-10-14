<script lang="ts">
  import { onMount } from 'svelte';
  import { TrackpadController, injectStyles, styleString, trackpad, trackpadStyles } from '@mackeys/core';
  import Scaled from './Scaled.svelte';
  import TrackpadButton from './TrackpadButton.svelte';
  import { resolveSound } from './sound';
  import { trackpadState } from './state.svelte';
  import type { MacTrackpadProps } from './types';

  let { finish = 'pro-space-black', sound, forceDelayMs = 500, scale = 1, onpress, onforceclick, onrelease, class: className, style }: MacTrackpadProps = $props();

  onMount(() => injectStyles());
  const controller = new TrackpadController();
  const tp = trackpadState(controller);
  $effect(() => {
    controller.sound = resolveSound(sound);
    controller.forceDelayMs = forceDelayMs;
  });
  $effect(() => controller.onEvent((e) => (e.type === 'press' ? onpress?.() : e.type === 'force' ? onforceclick?.() : onrelease?.())));
  let g = $derived(trackpad(finish));
  let s = $derived(trackpadStyles(g));
</script>

<Scaled w={g.width} h={g.height + g.sideDepth} {scale} class={className} {style}>
  <div style={styleString(s.root)}>
    <div aria-hidden="true" style={styleString(s.side)}></div>
    <TrackpadButton {controller} phase={tp.value} label={g.label} style={styleString(s.pad)} grain={g.grain} />
  </div>
</Scaled>
