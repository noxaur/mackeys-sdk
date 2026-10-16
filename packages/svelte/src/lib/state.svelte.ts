import { isEditableTarget, KeyboardController, TrackpadController, type KeyEvent, type KeyboardState, type TrackpadPhase } from '@mackeys/core';

/** Wraps a KeyboardController in runes state. Call from a component's script. */
export function keyboardState(controller: KeyboardController) {
  let s = $state<KeyboardState>(controller.getState());
  $effect(() => controller.subscribe((v) => (s = v)));
  $effect(() => () => controller.dispose());
  return {
    get value() {
      return s;
    }
  };
}

export function trackpadState(controller: TrackpadController) {
  let p = $state<TrackpadPhase>(controller.getPhase());
  $effect(() => controller.subscribe((v) => (p = v)));
  $effect(() => () => controller.dispose());
  return {
    get value() {
      return p;
    }
  };
}

/** Feeds every key press on the page to the controller while `enabled()` is true. */
export function windowKeys(enabled: () => boolean, controller: KeyboardController) {
  $effect(() => {
    if (!enabled()) return;
    const down = (e: KeyboardEvent) => {
      // Typing in a text field, select or slider stays with the page.
      if (isEditableTarget(e.target)) return;
      if (controller.handleKeyDown(e)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => controller.handleKeyUp(e);
    const blur = () => controller.releaseAll();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  });
}

export type KeyHandler = (e: KeyEvent) => void;
