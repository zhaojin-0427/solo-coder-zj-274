<script setup lang="ts">
import type { LayoutSettings } from '../types'

const props = defineProps<{
  settings: LayoutSettings
}>()

const emit = defineEmits<{
  (e: 'update:settings', value: LayoutSettings): void
}>()

function updateSetting<K extends keyof LayoutSettings>(key: K, value: LayoutSettings[K]) {
  emit('update:settings', { ...props.settings, [key]: value })
}
</script>

<template>
  <div class="p-4 border-b border-gray-200">
    <h3 class="text-sm font-semibold text-gray-800 mb-3">排版参数</h3>

    <div class="space-y-4">
      <div>
        <label class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-gray-600">水平间距</span>
          <span class="text-xs text-primary-600">{{ settings.gapX }}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="10"
          step="0.5"
          :value="settings.gapX"
          @input="updateSetting('gapX', Number(($event.target as HTMLInputElement).value))"
          class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
      </div>

      <div>
        <label class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-gray-600">垂直间距</span>
          <span class="text-xs text-primary-600">{{ settings.gapY }}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="10"
          step="0.5"
          :value="settings.gapY"
          @input="updateSetting('gapY', Number(($event.target as HTMLInputElement).value))"
          class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
      </div>

      <div>
        <label class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-gray-600">页边距</span>
          <span class="text-xs text-primary-600">{{ settings.margin }}mm</span>
        </label>
        <input
          type="range"
          min="0"
          max="20"
          step="1"
          :value="settings.margin"
          @input="updateSetting('margin', Number(($event.target as HTMLInputElement).value))"
          class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
      </div>

      <div>
        <label class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-gray-600">每个图案复制数</span>
          <span class="text-xs text-primary-600">{{ settings.copiesPerNail }}</span>
        </label>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          :value="settings.copiesPerNail"
          @input="updateSetting('copiesPerNail', Number(($event.target as HTMLInputElement).value))"
          class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
      </div>
    </div>
  </div>
</template>
