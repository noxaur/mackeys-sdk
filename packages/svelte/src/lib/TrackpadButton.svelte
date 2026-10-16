<script lang="ts">
  import type { TrackpadController, TrackpadPhase } from '@mackeys/core';
  import Grain from './Grain.svelte';
  let { controller, phase, label, style, grain }: { controller: TrackpadController; phase: TrackpadPhase; label: string; style: string; grain: number } = $props();
</script>

<button
  type="button"
  class="mk-tp"
  class:mk-dn={phase !== 'up'}
  class:mk-force={phase === 'force'}
  aria-label={label}
  {style}
  onpointerdown={(e) => { if (!(e.button > 0)) controller.press('pointer'); }}
  onpointerup={() => controller.release('pointer')}
  onpointerleave={() => controller.release('pointer')}
  onpointercancel={() => controller.release('pointer')}
  onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) controller.press('keyboard'); } }}
  onkeyup={(e) => { if (e.key === ' ' || e.key === 'Enter') controller.release('keyboard'); }}
  onblur={() => controller.release('keyboard')}
>
  {#if grain > 0}<Grain opacity={grain} freq={1.1} />{/if}
</button>
