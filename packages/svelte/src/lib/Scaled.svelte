<script lang="ts">
  import type { Snippet } from 'svelte';
  let { w, h, scale = 1, view = 'top-down', class: className = '', style = '', children }: { w: number; h: number; scale?: number; view?: 'top-down' | 'angled'; class?: string; style?: string; children: Snippet } = $props();
  let transform = $derived(((scale !== 1 ? 'scale(' + scale + ')' : '') + (view === 'angled' ? ' perspective(2600px) rotateX(32deg) scale(.96)' : '')).trim() || 'none');
</script>

<div class={className} style={'position:relative;width:' + w * scale + 'px;height:' + h * scale + 'px;' + style}>
  <div style={'position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px;transform-origin:0 0;transform:' + transform}>
    {@render children()}
  </div>
</div>
