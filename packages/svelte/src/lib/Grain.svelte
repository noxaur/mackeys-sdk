<script lang="ts">
  import { uid } from './sound';
  let { opacity, freq }: { opacity: number; freq: number } = $props();
  const id = uid('mk-grain');
</script>

<svg class="mk-grain" width="100%" height="100%" style:opacity aria-hidden="true">
  <filter {id}>
    <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="2" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
  <rect width="100%" height="100%" filter={'url(#' + id + ')'} />
</svg>
