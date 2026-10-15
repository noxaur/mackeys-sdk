// The demo only sets attributes on the elements, as any framework template would.
import '@mackeys/elements/define';
import { FINISHES, LAYOUTS, stageColor, type FinishId, type KeyEvent } from '@mackeys/elements';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const part = $<HTMLSelectElement>('part');
const finish = $<HTMLSelectElement>('finish');
const layout = $<HTMLSelectElement>('layout');
const view = $<HTMLSelectElement>('view');
const on = $<HTMLInputElement>('on');
const level = $<HTMLInputElement>('level');
const room = $<HTMLSelectElement>('room');
finish.innerHTML = FINISHES.map((f) => `<option value="${f.id}">${f.name}</option>`).join('');
layout.innerHTML = LAYOUTS.map((l) => `<option value="${l.id}">${l.name}</option>`).join('');

let device: HTMLElement | null = null;

function render() {
  if (!device || device.localName !== part.value) {
    device?.remove();
    device = document.createElement(part.value);
    device.setAttribute('capture', 'window');
    device.setAttribute('scale', '0.9');
    device.addEventListener('mk-keydown', (e) => {
      const k = (e as CustomEvent<KeyEvent>).detail;
      $('last').textContent = k.label + ' (' + k.id + ')';
    });
    $('device').appendChild(device);
  }
  device.setAttribute('finish', finish.value);
  device.setAttribute('layout', layout.value);
  device.setAttribute('view', view.value);
  device.setAttribute('backlight', on.checked ? 'on' : 'off');
  device.setAttribute('backlight-level', level.value);
  device.setAttribute('room', room.value);
  const stage = $('stage');
  stage.style.background = stageColor(finish.value as FinishId, { on: on.checked, level: +level.value, room: room.value as 'dark' });
  stage.style.color = room.value === 'dark' ? '#ddd' : '#222';
}

for (const el of [part, finish, layout, view, on, level, room]) el.addEventListener('input', render);
render();
