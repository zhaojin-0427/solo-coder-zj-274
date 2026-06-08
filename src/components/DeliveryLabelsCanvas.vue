<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type {
  DeliveryLabelData,
  DeliveryLabelConfig
} from '../types'
import { paginateDeliveryLabels, formatQCStatusLabel, formatQCStatusColor } from '../utils/delivery'

const props = defineProps<{
  labels: DeliveryLabelData[]
  config: DeliveryLabelConfig
}>()

const emit = defineEmits<{
  (e: 'pageRefsReady', refs: Map<number, HTMLElement>): void
}>()

const pageRefs = ref<Map<number, HTMLElement>>(new Map())

const pagedLabels = computed(() => {
  return paginateDeliveryLabels(props.labels, props.config)
})

watch(
  () => pagedLabels.value.length,
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

function getLabelPosition(index: number): { left: string; top: string } {
  const col = index % props.config.columns
  const row = Math.floor(index / props.config.columns)
  const left = props.config.marginMm + col * (props.config.labelWidthMm + props.config.gapMm)
  const top = props.config.marginMm + row * (props.config.labelHeightMm + props.config.gapMm)
  return { left: `${left}mm`, top: `${top}mm` }
}
</script>

<template>
  <div class="flex flex-col items-center gap-6 p-6">
    <div v-if="labels.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
      <svg class="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
      <p class="text-sm">请选择订单后生成交付标签</p>
    </div>

    <template v-else>
      <div
        v-for="(pageLabels, pageIdx) in pagedLabels"
        :key="pageIdx"
        class="relative"
      >
        <div class="text-center text-xs text-gray-500 mb-2">
          <span class="font-medium">第 {{ pageIdx + 1 }} 页</span>
          <span class="mx-1">·</span>
          <span class="text-gray-600">{{ pageLabels.length }} 个标签</span>
        </div>
        <div
          :ref="(el) => setPageRef(pageIdx, el)"
          class="a4-page"
          style="position: relative"
        >
          <template v-if="config.showCutLines">
            <div
              v-for="(_, idx) in pageLabels"
              :key="`cut-${idx}`"
              class="absolute border border-dashed border-gray-300 pointer-events-none"
              :style="{
                left: getLabelPosition(idx).left,
                top: getLabelPosition(idx).top,
                width: `${config.labelWidthMm}mm`,
                height: `${config.labelHeightMm}mm`
              }"
            ></div>
          </template>

          <div
            v-for="(label, idx) in pageLabels"
            :key="label.orderId"
            class="absolute border border-gray-400 bg-white overflow-hidden"
            :style="{
              left: `calc(${getLabelPosition(idx).left} + 1mm)`,
              top: `calc(${getLabelPosition(idx).top} + 1mm)`,
              width: `calc(${config.labelWidthMm}mm - 2mm)`,
              height: `calc(${config.labelHeightMm}mm - 2mm)`,
              padding: '3mm'
            }"
          >
            <div class="flex items-start justify-between mb-1">
              <div class="flex items-center gap-1.5">
                <span
                  class="w-3 h-3 rounded-sm flex-shrink-0"
                  :style="{ backgroundColor: label.colorTag }"
                ></span>
                <span class="text-[11px] font-bold text-gray-800 leading-tight">{{ label.customerName }}</span>
              </div>
              <span class="text-[8px] text-gray-500 flex-shrink-0 ml-1">{{ label.orderNo }}</span>
            </div>

            <div class="flex items-center gap-1 mb-1.5 flex-wrap">
              <span
                v-if="label.isUrgent"
                class="text-[7px] px-1 py-0.5 bg-red-500 text-white rounded font-bold"
              >急单</span>
              <span
                class="text-[7px] px-1 py-0.5 text-white rounded font-bold"
                :style="{ backgroundColor: formatQCStatusColor(label.qcStatus) }"
              >
                {{ formatQCStatusLabel(label.qcStatus) }}
                <template v-if="label.isDeliverable"> ✓</template>
              </span>
            </div>

            <div class="space-y-0.5">
              <div class="text-[8px] text-gray-600">
                交付日期: <span class="text-gray-800 font-medium">{{ label.deliveryDate }}</span>
              </div>
              <div class="text-[8px] text-gray-600">
                贴纸数量: <span class="text-gray-800 font-medium">{{ label.totalStickers }} 张</span>
              </div>
              <div v-if="label.nailSummary" class="text-[7px] text-gray-500 leading-snug">
                规格: {{ label.nailSummary }}
              </div>
              <div v-if="label.notes" class="text-[7px] text-gray-500 leading-snug mt-0.5 truncate">
                备注: {{ label.notes }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
