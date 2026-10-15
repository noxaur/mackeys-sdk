import { onScopeDispose, shallowRef, useId, watchEffect, type ShallowRef } from 'vue';
import { KeyboardController, TrackpadController, type KeyboardState, type TrackpadPhase } from '@mackeys/core';

/** Creates a keyboard controller for the life of the component. `state` follows every change. */
export function useKeyboardController(): { controller: KeyboardController; state: ShallowRef<KeyboardState> } {
  const controller = new KeyboardController();
  const state = shallowRef(controller.getState());
  const stop = controller.subscribe((s) => (state.value = s));
  onScopeDispose(() => {
    stop();
    controller.dispose();
  });
  return { controller, state };
}

/** Creates a trackpad controller for the life of the component. `phase` follows every change. */
export function useTrackpadController(): { controller: TrackpadController; phase: ShallowRef<TrackpadPhase> } {
  const controller = new TrackpadController();
  const phase = shallowRef(controller.getPhase());
  const stop = controller.subscribe((p) => (phase.value = p));
  onScopeDispose(() => {
    stop();
    controller.dispose();
  });
  return { controller, phase };
}

/** Feeds every key press on the page to the controller while `enabled()` is true. */
export function useWindowKeys(enabled: () => boolean, controller: KeyboardController) {
  watchEffect((onCleanup) => {
    if (!enabled() || typeof window === 'undefined') return;
    const down = (e: KeyboardEvent) => {
      if (controller.handleKeyDown(e)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => controller.handleKeyUp(e);
    const blur = () => controller.releaseAll();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    onCleanup(() => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    });
  });
}

/** A stable id for SVG references, unique per component instance and the same on server and client. */
export function useStableId(prefix: string) {
  return prefix + '-' + (useId() ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
}
