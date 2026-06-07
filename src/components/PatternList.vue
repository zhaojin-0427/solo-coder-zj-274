<script setup lang="ts">
import type { UploadedPattern } from '../types'

defineProps<{
  patterns: UploadedPattern[]
}>()

const emit = defineEmits<{
  (e: 'remove', id: string): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div class="p-4 border-b border-gray-200">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-800">已上传图案：{{ patterns.length }}</h3>
      <button
        v-if="patterns.length > 0"
        class="text-xs text-red-500 hover:text-red-600"
        @click="emit('clear')"
      >
        清空全部
      </button>
    </div>
    <div v-if="patterns.length === 0" class="text-xs text-gray-400 text-center py-4">
      暂无图案
    </div>
    <div v-else class="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto scrollbar-thin">
      <div
        v-for="pattern in patterns"
        :key="pattern.id"
        class="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
      >
        <img :src="pattern.dataUrl" :alt="pattern.name" class="w-full h-full object-cover" />
        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
          <button
            class="opacity-0 group-hover:opacity-100 bg-red-500 text-white p-1 rounded-full transition-opacity"
            @click.stop="emit('remove', pattern.id)"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-[10px] px-1 truncate">
          {{ pattern.name }}
        </div>
      </div>
    </div>
  </div>
</template>
