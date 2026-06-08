<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type {
  PlacedPattern,
  UploadedPattern,
  NailShape,
  PageLayoutInfo,
  SetGroup,
  PatternIndependentConfig,
  PrintCalibration,
  PlacedPatternWithOrder,
  CustomerOrder,
  PageBatchInfo
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
  orders?: CustomerOrder[]
  batchPageInfo?: PageBatchInfo[]
  showOrderTags?: boolean
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

const batchPageInfoByIndex = computed(() => {
  const m = new Map<number, PageBatchInfo>()
  if (props.batchPageInfo) {
    for (const bi of props.batchPageInfo) {
      m.set(bi.pageIndex, bi)
    }
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

function getOrderById(id: string | null): CustomerOrder | undefined {
  if (!id || !props.orders) return undefined
  return props.orders.find(o => o.id === id)
}

function getPlacementOrderInfo(p: PlacedPattern): { orderId: string | null; orderNo: string | null; orderColorTag: string | null } {
  const pp = p as PlacedPatternWithOrder
  return {
    orderId: pp.orderId || null,
    orderNo: pp.orderNo || null,
    orderColorTag: pp.orderColorTag || null
  }
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

function pageOrderText(pageIdx: number): string {
  const batchInfo = batchPageInfoByIndex.value.get(pageIdx)
  if (!batchInfo || !props.orders || batchInfo.orders.length === 0) return ''
  return batchInfo.orders
    .map(oi => {
      const order = getOrderById(oi.orderId)
      if (!order) return ''
      return `${order.customerName} ${oi.placedCount}/${oi.totalCount}`
    })
    .filter(Boolean)
    .join(' · ')
}

function getRiskLabel(level: 'low' | 'medium' | 'high'): string {
  const map = { low: '低风险', medium: '中风险', high: '高风险' }
  return map[level]
}

function getRiskColorClass(level: 'low' | 'medium' | 'high'): string {
  const map = { low: 'text-green-600', medium: 'text-amber-600', high: 'text-red-600' }
  return map[level]
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
          <template v-if="batchPageInfoByIndex.get(pageIdx)">
            <span class="mx-1">·</span>
            <span :class="getRiskColorClass(batchPageInfoByIndex.get(pageIdx)!.riskLevel)">
              {{ getRiskLabel(batchPageInfoByIndex.get(pageIdx)!.riskLevel) }}
            </span>
          </template>
        </div>
        <div
          v-if="pageInfoByIndex.get(pageIdx) && Object.keys(pageInfoByIndex.get(pageIdx)!.setCompletion).length > 0"
          class="text-[10px] text-center text-gray-500 mb-1 px-2"
        >
          套图完整度: {{ pageSetCompletionText(pageInfoByIndex.get(pageIdx)) }}
        </div>
        <div
          v-if="orders && orders.length > 0 && pageOrderText(pageIdx)"
          class="text-[10px] text-center text-gray-600 mb-1 px-2"
        >
          本页订单: {{ pageOrderText(pageIdx) }}
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
              boxShadow: getPlacementOrderInfo(placement).orderColorTag
                ? `0 0 0 1.5px ${getPlacementOrderInfo(placement).orderColorTag}, inset 0 0 0 0.5px rgba(255,255,255,0.5)`
                : getGroupById(placement.setGroupId)
                ? `0 0 0 1px ${getGroupById(placement.setGroupId)!.color}`
                : 'none'
            }"
            @click.stop="emit('select', getGlobalIndex(placement))"
          >
            <div
              v-if="getPlacementOrderInfo(placement).orderColorTag"
              class="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-sm border border-white shadow-sm flex items-center justify-center"
              :style="{ backgroundColor: getPlacementOrderInfo(placement).orderColorTag || '' }"
              :title="getOrderById(getPlacementOrderInfo(placement).orderId)?.customerName || ''"
            >
              <span
                v-if="showOrderTags && getPlacementOrderInfo(placement).orderNo"
                class="text-[6px] font-bold text-white leading-none"
              >
                {{ getPlacementOrderInfo(placement).orderNo!.slice(-2) }}
              </span>
            </div>
            <div
              v-else-if="getGroupById(placement.setGroupId)"
              class="absolute top-0 left-0 w-2 h-2"
              :style="{ backgroundColor: getGroupById(placement.setGroupId)!.color }"
            ></div>
            <img
              v-if="getPatternById(placement.patternId)"
              :src="getPatternById(placement.patternId)!.dataUrl"
              :style="getTransformStyle(placement.transform)"
              draggable="false"
            />
            <div
              v-if="showOrderTags && getPlacementOrderInfo(placement).orderColorTag"
              class="absolute bottom-0 right-0 bg-black/60 rounded-tl px-1 py-0.5 pointer-events-none"
            >
              <span class="text-[6px] font-bold text-white leading-none whitespace-nowrap">
                {{ getOrderById(getPlacementOrderInfo(placement).orderId)?.customerName?.slice(0, 2) || getPlacementOrderInfo(placement).orderNo?.slice(-2) || '' }}
              </span>
            </div>
          </div>
        </div>
        <div
          v-if="orders && orders.length > 0"
          class="mt-2 flex flex-wrap justify-center gap-1.5"
        >
          <div
            v-for="order in orders.filter(o => {
              const info = batchPageInfoByIndex.get(pageIdx)
              return info?.orders.some(oi => oi.orderId === o.id)
            })"
            :key="order.id"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[9px]"
          >
            <span
              class="w-2 h-2 rounded-sm"
              :style="{ backgroundColor: order.colorTag }"
            ></span>
            <span class="text-gray-700">{{ order.customerName }}</span>
            <span v-if="order.isUrgent" class="text-red-500 font-medium">急</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
