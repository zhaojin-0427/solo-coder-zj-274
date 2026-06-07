<script setup lang="ts">
import type { PatternTransform } from '../types'

defineProps<{
  transform: PatternTransform
  hasSelection: boolean
}>()

const emit = defineEmits<{
  (e: 'rotate', delta: number): void
  (e: 'mirrorX'): void
  (e: 'mirrorY'): void
  (e: 'invertColor'): void
  (e: 'reset'): void
}>()
</script>

<template>
  <div class="p-4 border-b border-gray-200">
    <h3 class="text-sm font-semibold text-gray-800 mb-3">图案编辑</h3>

    <div v-if="!hasSelection" class="text-xs text-gray-400 text-center py-2">
      请在画布上选择一个图案进行编辑
    </div>

    <div v-else class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-2">旋转</label>
        <div class="flex gap-2">
          <button
            class="flex-1 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs transition-colors"
            @click="emit('rotate', -45)"
          >
            ↺ -45°
          </button>
          <button
            class="flex-1 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs transition-colors"
            @click="emit('rotate', -15)"
          >
            ↺ -15°
          </button>
          <button
            class="flex-1 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs transition-colors"
            @click="emit('rotate', 15)"
          >
            ↻ +15°
          </button>
          <button
            class="flex-1 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs transition-colors"
            @click="emit('rotate', 45)"
          >
            ↻ +45°
          </button>
        </div>
        <p class="text-[10px] text-gray-500 mt-1 text-center">当前角度: {{ transform.rotation }}°</p>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-2">镜像翻转</label>
        <div class="flex gap-2">
          <button
            :class="[
              'flex-1 py-1.5 px-3 rounded-lg text-xs transition-colors border',
              transform.mirrorX
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
            ]"
            @click="emit('mirrorX')"
          >
            ⇋ 水平镜像
          </button>
          <button
            :class="[
              'flex-1 py-1.5 px-3 rounded-lg text-xs transition-colors border',
              transform.mirrorY
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
            ]"
            @click="emit('mirrorY')"
          >
            ⇅ 垂直镜像
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-2">颜色效果</label>
        <button
          :class="[
            'w-full py-1.5 px-3 rounded-lg text-xs transition-colors border',
            transform.invertColor
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
          ]"
          @click="emit('invertColor')"
        >
          {{ transform.invertColor ? '✓' : '○' }} 颜色反转
        </button>
      </div>

      <button
        class="w-full py-1.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600 transition-colors"
        @click="emit('reset')"
      >
        重置变换
      </button>
    </div>
  </div>
</template>
