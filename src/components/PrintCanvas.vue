<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type {
  PlacedPattern,
  UploadedPattern,
  NailShape,
  PageLayoutInfo,
  SetGroup,
  PatternIndependentConfig,
  PrintCalibration
} from '../types'
import { getNailClipPath } from '../data/nailConfig'

const props = defineProps<{
  placements: PlacedPattern[]
  patterns: UploadedPattern[]
  patternConfigs: Record<string, PatternIndependentConfig>
  setGroups: SetGroup[]
  selectedPlacementIndex: number | null
  pageInfo: PageLayoutInfo[]
  previewMode: boolean
  calibration: PrintCalibration
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

const pageInfoByIndex = computed(() => {
  const m = new Map<number, PageLayoutInfo>()
  for (const pi of props.pageInfo) {
    m.set(pi.pageIndex, pi)
  }
  return m
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

function getGroupById(id: string | null): SetGroup | undefined {
  if (!id) return undefined
  return props.setGroups.find(g => g.id === id)
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

function formatWaste(mm2: number): string {
  return (mm2 / 100).toFixed(1)
}

function pageSetCompletionText(info: PageLayoutInfo | undefined): string {
  if (!info) return ''
  const entries = Object.entries(info.setCompletion)
  if (entries.length === 0) return ''
  return entries
    .map(([gid, sc]) => {
      const g = getGroupById(gid)
      const name = g?.name || '未知'
      return `${name} ${sc.placed}/${sc.total}${sc.complete ? '✓' : ''}`
    })
    .join(' · ')
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
        <div class="text-center text-xs text-gray-500 mb-2">
          <span class="font-medium">第 {{ pageIdx + 1 }} 页</span>
          <template v-if="pageInfoByIndex.get(pageIdx)">
            <span class="mx-1">·</span>
            <span class="text-gray-600">
              贴纸 {{ pageInfoByIndex.get(pageIdx)!.estimatedStickers }} 张
            </span>
            <span class="mx-1">·</span>
            <span :class="pageInfoByIndex.get(pageIdx)!.wasteAreaMm2 / 100 > 20 ? 'text-amber-600' : 'text-gray-600'">
              浪费 {{ formatWaste(pageInfoByIndex.get(pageIdx)!.wasteAreaMm2) }} cm²
            </span>
            <template v-if="pageInfoByIndex.get(pageIdx)!.incompleteSets.length > 0">
              <span class="mx-1">·</span>
              <span class="text-amber-600">
                {{ pageInfoByIndex.get(pageIdx)!.incompleteSets.length }} 套未完成
              </span>
            </template>
          </template>
        </div>
        <div
          v-if="pageInfoByIndex.get(pageIdx) && Object.keys(pageInfoByIndex.get(pageIdx)!.setCompletion).length > 0"
          class="text-[10px] text-center text-gray-500 mb-1 px-2"
        >
          套图完整度: {{ pageSetCompletionText(pageInfoByIndex.get(pageIdx)) }}
        </div>
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
              clipPath: getNailClipPath(placement.nailShape as NailShape),
              borderRadius: placement.nailShape === 'round' || placement.nailShape === 'oval' ? '50%' : undefined,
              boxShadow: getGroupById(placement.setGroupId)
                ? `0 0 0 1px ${getGroupById(placement.setGroupId)!.color}`
                : undefined
            }"
            @click.stop="emit('select', getGlobalIndex(placement))"
          >
            <div
              v-if="getGroupById(placement.setGroupId)"
              class="absolute top-0 left-0 w-2 h-2"
              :style="{ backgroundColor: getGroupById(placement.setGroupId)!.color }"
            ></div>
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
