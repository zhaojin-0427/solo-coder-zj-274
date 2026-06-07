<script setup lang="ts">
import type { NailSize, NailShape } from '../types'
import { nailSizes, nailShapes } from '../data/nailConfig'

defineProps<{
  selectedSize: NailSize
  selectedShape: NailShape
}>()

const emit = defineEmits<{
  (e: 'update:selectedSize', value: NailSize): void
  (e: 'update:selectedShape', value: NailShape): void
}>()

const sizeOptions: NailSize[] = ['XS', 'S', 'M', 'L']
const shapeOptions: NailShape[] = ['square', 'round', 'oval', 'almond', 'stiletto', 'coffin']
</script>

<template>
  <div class="p-4 border-b border-gray-200">
    <h3 class="text-sm font-semibold text-gray-800 mb-3">指甲模板</h3>

    <div class="mb-4">
      <label class="block text-xs font-medium text-gray-600 mb-2">指甲型号</label>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="size in sizeOptions"
          :key="size"
          :class="[
            'py-2 px-1 rounded-lg text-xs font-medium transition-all border',
            selectedSize === size
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300 hover:bg-primary-50'
          ]"
          @click="emit('update:selectedSize', size)"
        >
          {{ size }}
        </button>
      </div>
      <p class="text-[10px text-gray-500 mt-1">
        {{ nailSizes[selectedSize].label }} - {{ nailSizes[selectedSize].dimensions.width }}×{{ nailSizes[selectedSize].dimensions.height }}mm
      </p>
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-600 mb-2">指甲形状</label>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="shape in shapeOptions"
          :key="shape"
          :class="[
            'py-2 px-1 rounded-lg text-xs transition-all border flex flex-col items-center gap-1',
            selectedShape === shape
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300 hover:bg-primary-50'
          ]"
          @click="emit('update:selectedShape', shape)"
        >
          <span class="text-base">{{ nailShapes[shape].icon }}</span>
          <span class="text-[10px]">{{ nailShapes[shape].label.split('/')[0] }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
