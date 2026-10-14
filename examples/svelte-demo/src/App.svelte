<script lang="ts">
  import { FINISHES, LAYOUTS, MacBook, MacKeyboard, MacTrackpad, cssColor, buildKeyboard, topCase, type FinishId, type LayoutId, type KeyEvent } from '@mackeys/svelte';
  let finish = $state<FinishId>('air-starlight');
  let layout = $state<LayoutId>('fr');
  let part = $state<'macbook' | 'keyboard' | 'trackpad'>('macbook');
  let on = $state(true);
  let level = $state(12);
  let room = $state<'daylight' | 'dark'>('daylight');
  let last = $state('');
  let backlight = $derived({ on, level, room });
  let bg = $derived(cssColor(topCase(finish, buildKeyboard({ finish }), { backlight }).pageBackground));
  const onkeydown = (e: KeyEvent) => (last = e.label + ' (' + e.id + ')');
</script>

<div style="min-height:100vh;box-sizing:border-box;padding:16px;font-family:system-ui;background:{bg};color:{room === 'dark' ? '#ddd' : '#222'}">
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
    <label>Part <select bind:value={part}><option value="macbook">MacBook</option><option value="keyboard">Keyboard</option><option value="trackpad">Trackpad</option></select></label>
    <label>Finish <select bind:value={finish}>{#each FINISHES as f}<option value={f.id}>{f.name}</option>{/each}</select></label>
    <label>Layout <select bind:value={layout}>{#each LAYOUTS as l}<option value={l.id}>{l.name}</option>{/each}</select></label>
    <label><input type="checkbox" bind:checked={on} /> Backlight</label>
    <label>Level <input type="range" min="0" max="16" bind:value={level} /></label>
    <label>Room <select bind:value={room}><option value="daylight">Daylight</option><option value="dark">Dark room</option></select></label>
    <span>Last key: {last}</span>
  </div>
  {#if part === 'macbook'}
    <MacBook {finish} {layout} {backlight} capture="window" scale={0.9} {onkeydown} />
  {:else if part === 'keyboard'}
    <MacKeyboard {finish} {layout} {backlight} capture="window" {onkeydown} />
  {:else}
    <MacTrackpad {finish} />
  {/if}
</div>
