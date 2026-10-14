<script lang="ts">
  import {
    iconStyle,
    keyStyle,
    legendStyle,
    rectStyle,
    styleString,
    themeVars,
    touchIdStyle,
    type KeyboardController,
    type KeyboardGeometry,
    type KeyboardState,
    type KeyboardTheme
  } from '@mackeys/core';
  import { uid } from './sound';

  interface Props {
    geometry: KeyboardGeometry;
    theme: KeyboardTheme;
    kbState: KeyboardState;
    controller: KeyboardController;
    /** Extra keys to show as pressed. */
    highlight?: readonly string[];
    label?: string;
    /** Feed physical keys to the controller while a key has focus. */
    focusKeys?: boolean;
  }
  let { geometry, theme, kbState, controller, highlight = [], label, focusKeys = true }: Props = $props();
  const gradId = uid('mk-iso');
  let hl = $derived(new Set(highlight));
  let rootStyle = $derived(styleString({ width: geometry.width + 'px', height: geometry.height + 'px', ...themeVars(theme, geometry.lightKeys) }));

  function onkeydown(e: KeyboardEvent) {
    if (focusKeys && controller.handleKeyDown(e)) e.preventDefault();
  }
  function onkeyup(e: KeyboardEvent) {
    if (focusKeys) controller.handleKeyUp(e);
  }
  function onfocusout(e: FocusEvent) {
    const root = e.currentTarget as HTMLElement;
    if (!root.contains(e.relatedTarget as Node | null)) controller.releaseAll('keyboard');
  }
  function down(id: string, e: PointerEvent) {
    if (e.button > 0) return;
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });
    controller.press(id, 'pointer');
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div role="group" class="mk-kbd" aria-label={label} style={rootStyle} {onkeydown} {onkeyup} {onfocusout}>
  {#if geometry.keys.some((k) => k.iso)}
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <defs>
        <radialGradient id={gradId} cx="50%" cy="100%" r="90%">
          <stop offset="0" style="stop-color: var(--mk-f1)" />
          <stop offset="1" style="stop-color: var(--mk-f0)" />
        </radialGradient>
      </defs>
    </svg>
  {/if}
  {#each geometry.keys as k (k.id)}
    <button
      type="button"
      class="mk-k"
      class:mk-dn={kbState.down.has(k.id) || hl.has(k.id)}
      class:mk-iso={!!k.iso}
      aria-label={k.label}
      aria-pressed={k.id === 'CapsLock' ? kbState.caps : undefined}
      data-key={k.id}
      style={styleString(keyStyle(k))}
      onpointerdown={(e) => down(k.id, e)}
      onpointerup={() => controller.release(k.id, 'pointer')}
      onpointerleave={() => controller.release(k.id, 'pointer')}
      onpointercancel={() => controller.release(k.id, 'pointer')}
    >
      {#if k.iso}
        <svg class="mk-isoshape" width={k.w} height={k.h} viewBox={'0 0 ' + k.w + ' ' + k.h} aria-hidden="true">
          <path class="mk-fc" d={k.iso.path} fill={'url(#' + gradId + ')'} stroke-width="1" />
          <path class="mk-hl" d={k.iso.highlight} fill="none" stroke-width="0.8" />
        </svg>
      {/if}
      {#each k.legends as l (l.slot)}
        <span class="mk-l" aria-hidden="true" style={styleString(legendStyle(l))}>{l.text}</span>
      {/each}
      {#if k.icon}
        <svg class="mk-ic" viewBox={k.icon.viewBox.join(' ')} style={styleString(iconStyle(k.icon))} aria-hidden="true">
          {#if k.icon.fill}<path d={k.icon.fill} fill="currentColor" />{/if}
          {#if k.icon.stroke}<path d={k.icon.stroke} fill="none" stroke="currentColor" stroke-width={k.icon.strokeWidth} stroke-linecap="round" stroke-linejoin="round" />{/if}
        </svg>
      {/if}
      {#if k.capsLed}
        <span class="mk-led" class:mk-on={kbState.caps} aria-hidden="true" style={styleString(rectStyle({ x: k.capsLed.x, y: k.capsLed.y, w: k.capsLed.d, h: k.capsLed.d }))}></span>
      {/if}
      {#if k.homeBar}<span class="mk-home" aria-hidden="true" style={styleString(rectStyle(k.homeBar))}></span>{/if}
      {#if k.touchId}<span class={'mk-tid mk-tid-' + theme.touchId} aria-hidden="true" style={styleString(touchIdStyle(k.touchId.d))}></span>{/if}
    </button>
  {/each}
</div>
