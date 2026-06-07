<script setup lang="ts">
import type { MaterialEstimate } from '../types'

defineProps<{
  estimate: MaterialEstimate
}>()
</script>

<template>
  <div class="p-4 border-b border-gray-200">
    <h3 class="text-sm font-semibold text-gray-800 mb-3">耗材估算</h3>

    <div v-if="estimate.totalPatterns === 0" class="text-xs text-gray-400 text-center py-2">
      上传图案后显示估算
    </div>

    <div v-else class="space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <div class="bg-gray-50 rounded-lg p-2">
          <p class="text-[10px] text-gray-500">图案总数</p>
          <p class="text-lg font-bold text-gray-800">{{ estimate.totalPatterns }}</p>
        </div>
        <div class="bg-gray-50 rounded-lg p-2">
          <p class="text-[10px] text-gray-500">纸张页数</p>
          <p class="text-lg font-bold text-gray-800">{{ estimate.pagesNeeded }}</p>
        </div>
      </div>

      <div class="bg-gray-50 rounded-lg p-2">
        <p class="text-[10px] text-gray-500">总面积</p>
        <p class="text-sm font-bold text-gray-800">{{ (estimate.totalArea / 100).toFixed(2) }} cm²</p>
      </div>

      <div>
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs text-gray-600">纸张利用率</span>
          <span class="text-xs font-medium text-primary-600">{{ estimate.paperUsage.toFixed(1) }}%</span>
        </div>
        <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all"
            :style="{ width: `${Math.min(estimate.paperUsage, 100)}%` }"
          />
        </div>
      </div>

      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-500">预估浪费面积</span>
        <span class="text-gray-700 font-medium">{{ (estimate.estimatedWaste / 100).toFixed(2) }} cm²</span>
      </div>
    </div>
  </div>
</template>
