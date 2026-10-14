<script lang="ts">
  import type { Snippet } from 'svelte';
  import { styleString, topCaseStyles, type TopCaseGeometry } from '@mackeys/core';
  import Grain from './Grain.svelte';

  let { tc, children, trackpad }: { tc: TopCaseGeometry; children: Snippet; trackpad?: Snippet } = $props();
  let s = $derived(topCaseStyles(tc));
</script>

<div aria-hidden="true" style={styleString(s.side)}></div>
<div aria-hidden="true" style={styleString(s.deck)}></div>
<div aria-hidden="true" style={styleString(s.grainBox)}><Grain opacity={tc.grain} freq={0.95} /></div>
{#if s.hinge}
  <div aria-hidden="true" style={styleString(s.hinge.bar)}></div>
  <div aria-hidden="true" style={styleString(s.hinge.left)}></div>
  <div aria-hidden="true" style={styleString(s.hinge.right)}></div>
{/if}
{@render trackpad?.()}
{#if s.notch}
  <div aria-hidden="true" style={styleString(s.notch.lip)}></div>
  <div aria-hidden="true" style={styleString(s.notch.scoop)}></div>
{/if}
{#each s.grilles as g}<div aria-hidden="true" style={styleString(g)}></div>{/each}
<div aria-hidden="true" style={styleString(s.dim)}></div>
<div style={styleString(s.well)}>{@render children()}</div>
