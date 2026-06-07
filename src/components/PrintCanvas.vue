<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { PlacedPattern, UploadedPattern, NailShape } from '../types'
import { getNailClipPath } from '../data/nailConfig'

const props = defineProps<{
  placements: PlacedPattern[]
  patterns: UploadedPattern[]
  selectedPlacementIndex: number | null
  shape: NailShape
  previewMode: boolean
}>()

const emit = defineEmits<{
  (e: 'select', index: number | null): void
  (e: 'pageRefsReady', refs: Map<number, HTMLElement>): void
}>()

const pageRefs = ref<Map<number, HTMLElement>>(new Map())
const containerRef = ref<HTMLElement | null>(null)

const placementsByPage = computed(() => {
  const map = new Map<number, PlacedPattern[]>()
  props.placements.forEach((p, idx) => {
    const extended = p as PlacedPattern & { _globalIndex?: number }
    extended._globalIndex = idx
    const list = map.get(p.pageIndex) || []
    list.push(p)
    map.set(p.pageIndex, list)
  })
  return map
})

const pageIndices = computed(() => {
  return Array.from(placementsByPage.value.keys()).sort((a, b) => a - b)
})

watch(
  () => [pageIndices.value.length, props.placements.length],
  async () => {
    await nextTick()
    emit('pageRefsReady', pageRefs.value)
  },
  { immediate: true }
)

function setPageRef(pageIdx: number, el: unknown) {
  if (el && el instanceof HTMLElement) {
    pageRefs.value.set(pageIdx, el)
  } else {
    pageRefs.value.delete(pageIdx)
  }
}

function getPatternById(id: string): UploadedPattern | undefined {
  return props.patterns.find(p => p.id === id)
}

function getTransformStyle(transform: PlacedPattern['transform']): Record<string, string> {
  const scaleX = transform.mirrorX ? -1 : 1
  const scaleY = transform.mirrorY ? -1 : 1
  const filters: string[] = []
  if (transform.invertColor) {
    filters.push('invert(1)')
  }
  return {
    transform: `rotate(${transform.rotation}deg) scale(${scaleX}, ${scaleY})`,
    filter: filters.length > 0 ? filters.join(' ') : 'none'
  }
}

function getGlobalIndex(placement: PlacedPattern): number {
  return (placement as PlacedPattern & { _globalIndex?: number })._globalIndex ?? -1
}
</script>

<template>
  <div ref="containerRef" class="flex flex-col items-center gap-6 p-6">
    <div v-if="placements.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
      <svg class="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p class="text-sm">上传图案后自动排版预览</p>
    </div>

    <template v-else>
      <div
        v-for="pageIdx in pageIndices"
        :key="pageIdx"
        class="relative print-area"
      >
        <div class="text-center text-xs text-gray-500 mb-2">第 {{ pageIdx + 1 }} 页</div>
        <div
          :ref="(el) => setPageRef(pageIdx, el)"
          class="a4-page"
          @click.self="emit('select', null)"
        >
          <div
            v-for="placement in placementsByPage.get(pageIdx)"
            :key="getGlobalIndex(placement)"
            :class="[
              'nail-pattern',
              selectedPlacementIndex === getGlobalIndex(placement) && !previewMode ? 'selected' : ''
            ]"
            :style="{
              left: `${placement.x}mm`,
              top: `${placement.y}mm`,
              width: `${placement.width}mm`,
              height: `${placement.height}mm`,
              clipPath: getNailClipPath(shape),
              borderRadius: shape === 'round' || shape === 'oval' ? '50%' : undefined
            }"
            @click.stop="emit('select', getGlobalIndex(placement))"
          >
            <img
              v-if="getPatternById(placement.patternId)"
              :src="getPatternById(placement.patternId)!.dataUrl"
              :style="getTransformStyle(placement.transform)"
              draggable="false"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
