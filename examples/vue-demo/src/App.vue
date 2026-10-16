<script setup lang="ts">
import { computed, ref } from 'vue';
import { FINISHES, LAYOUTS, MacBook, MacKeyboard, MacTrackpad, stageColor, type FinishId, type KeyEvent, type LayoutId } from '@mackeys/vue';

const finish = ref<FinishId>('pro-space-black');
const layout = ref<LayoutId>('en-us');
const part = ref<'macbook' | 'keyboard' | 'trackpad'>('macbook');
const view = ref<'top-down' | 'angled'>('top-down');
const on = ref(true);
const level = ref(12);
const room = ref<'daylight' | 'dark'>('daylight');
const last = ref('');
const backlight = computed(() => ({ on: on.value, level: level.value, room: room.value }));
const bg = computed(() => stageColor(finish.value, backlight.value));
const onKeydown = (e: KeyEvent) => (last.value = e.label + ' (' + e.id + ')');
</script>

<template>
  <div :style="{ minHeight: '100vh', boxSizing: 'border-box', padding: '16px', fontFamily: 'system-ui', background: bg, color: room === 'dark' ? '#ddd' : '#222' }">
    <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; align-items: center">
      <label>Part <select v-model="part"><option value="macbook">MacBook</option><option value="keyboard">Keyboard</option><option value="trackpad">Trackpad</option></select></label>
      <label>Finish <select v-model="finish"><option v-for="f in FINISHES" :key="f.id" :value="f.id">{{ f.name }}</option></select></label>
      <label>Layout <select v-model="layout"><option v-for="l in LAYOUTS" :key="l.id" :value="l.id">{{ l.name }}</option></select></label>
      <label>View <select v-model="view"><option value="top-down">Top-down</option><option value="angled">Angled</option></select></label>
      <label><input v-model="on" type="checkbox" /> Backlight</label>
      <label>Level <input v-model.number="level" type="range" min="0" max="16" /></label>
      <label>Room <select v-model="room"><option value="daylight">Daylight</option><option value="dark">Dark room</option></select></label>
      <span>Last key: {{ last }}</span>
    </div>
    <MacBook v-if="part === 'macbook'" :finish="finish" :layout="layout" :view="view" :backlight="backlight" capture="window" :scale="0.9" @keydown="onKeydown" />
    <MacKeyboard v-else-if="part === 'keyboard'" :finish="finish" :layout="layout" :view="view" :backlight="backlight" capture="window" @keydown="onKeydown" />
    <MacTrackpad v-else :finish="finish" />
  </div>
</template>
