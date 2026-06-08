<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { PackingListOrderData } from '../types'
import { formatQCStatusLabel, formatQCStatusColor } from '../utils/delivery'
import { nailSizes, nailShapes } from '../data/nailConfig'

const props = defineProps<{
  packingList: PackingListOrderData[]
}>()

const emit = defineEmits<{
  (e: 'pageRefsReady', refs: Map<number, HTMLElement>): void
}>()

const pageRefs = ref<Map<number, HTMLElement>>(new Map())

watch(
  () => props.packingList.length,
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

function getNailSizeLabel(size: string): string {
  return (nailSizes as any)[size]?.label || size
}

function getNailShapeLabel(shape: string): string {
  return (nailShapes as any)[shape]?.label || shape
}

const stats = computed(() => {
  const totalOrders = props.packingList.length
  const deliverableCount = props.packingList.filter(o => o.isDeliverable).length
  const totalStickers = props.packingList.reduce((s, o) => s + o.totalStickers, 0)
  const totalPassed = props.packingList.reduce((s, o) => s + o.totalPassed, 0)
  const totalFailed = props.packingList.reduce((s, o) => s + o.totalFailed, 0)
  return { totalOrders, deliverableCount, totalStickers, totalPassed, totalFailed }
})
</script>

<template>
  <div class="flex flex-col items-center gap-6 p-6">
    <div v-if="packingList.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
      <svg class="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
      <p class="text-sm">请选择订单后生成包装清单</p>
    </div>

    <template v-else>
      <div class="w-full max-w-4xl">
        <div
          :ref="(el) => setPageRef(0, el)"
          class="a4-page relative"
          style="height: auto; min-height: 297mm; padding: 15mm;"
        >
          <div class="text-center mb-6">
            <h1 class="text-2xl font-bold text-gray-800 mb-2">包装清单</h1>
            <p class="text-xs text-gray-500">
              生成时间: {{ new Date().toLocaleString() }}
            </p>
            <p class="text-xs text-gray-600 mt-1">
              订单总数: {{ stats.totalOrders }}
              <span class="mx-2">|</span>
              可交付: <span class="text-green-600 font-medium">{{ stats.deliverableCount }}</span>
              <span class="mx-2">|</span>
              贴纸总数: {{ stats.totalStickers }}
              <span class="mx-2">|</span>
              合格: <span class="text-green-600">{{ stats.totalPassed }}</span>
              <span class="mx-2">|</span>
              不合格: <span class="text-red-600">{{ stats.totalFailed }}</span>
            </p>
          </div>

          <div class="border-t border-gray-300 mb-4"></div>

          <div class="space-y-6">
            <div
              v-for="(order, orderIdx) in packingList"
              :key="order.orderId"
              class="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div
                class="px-4 py-3 flex items-center justify-between"
                :style="{ backgroundColor: order.colorTag + '15' }"
              >
                <div class="flex items-center gap-3">
                  <span
                    class="w-4 h-4 rounded-sm flex-shrink-0"
                    :style="{ backgroundColor: order.colorTag }"
                  ></span>
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-bold text-gray-800">
                        {{ orderIdx + 1 }}. {{ order.customerName }}
                      </span>
                      <span
                        v-if="order.isUrgent"
                        class="text-[9px] px-1.5 py-0.5 bg-red-500 text-white rounded font-bold"
                      >急单</span>
                      <span
                        class="text-[9px] px-1.5 py-0.5 text-white rounded font-bold"
                        :style="{ backgroundColor: formatQCStatusColor(order.qcStatus) }"
                      >
                        {{ formatQCStatusLabel(order.qcStatus) }}
                        <template v-if="order.isDeliverable"> ✓</template>
                      </span>
                    </div>
                    <div class="text-[10px] text-gray-500 mt-0.5">
                      {{ order.orderNo }}
                    </div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-xs text-gray-600">
                    交付日期: <span class="text-gray-800 font-medium">{{ order.deliveryDate }}</span>
                  </div>
                  <div class="text-[10px] text-gray-500 mt-0.5">
                    {{ order.isDeliverable ? '可交付' : '不可交付' }}
                  </div>
                </div>
              </div>

              <div class="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div class="flex items-center gap-4 text-[11px]">
                  <span class="text-gray-600">
                    贴纸总数: <span class="font-medium text-gray-800">{{ order.totalStickers }}</span>
                  </span>
                  <span class="text-gray-600">
                    合格: <span class="font-medium text-green-600">{{ order.totalPassed }}</span>
                  </span>
                  <span class="text-gray-600">
                    不合格: <span class="font-medium text-red-600">{{ order.totalFailed }}</span>
                  </span>
                  <span class="text-gray-600">
                    待检: <span class="font-medium text-amber-600">{{ order.totalPending }}</span>
                  </span>
                </div>
              </div>

              <table class="w-full text-[10px]">
                <thead class="bg-gray-100">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium text-gray-600">图案名称</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-600 w-28">规格</th>
                    <th class="px-3 py-2 text-center font-medium text-gray-600 w-16">数量</th>
                    <th class="px-3 py-2 text-center font-medium text-gray-600 w-16">合格</th>
                    <th class="px-3 py-2 text-center font-medium text-gray-600 w-16">不合格</th>
                    <th class="px-3 py-2 text-center font-medium text-gray-600 w-16">状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, itemIdx) in order.items"
                    :key="itemIdx"
                    class="border-t border-gray-100"
                  >
                    <td class="px-3 py-2 text-gray-800">{{ item.patternName }}</td>
                    <td class="px-3 py-2 text-gray-600">
                      {{ getNailSizeLabel(item.nailSize) }}/{{ getNailShapeLabel(item.nailShape) }}
                    </td>
                    <td class="px-3 py-2 text-center text-gray-800 font-medium">{{ item.quantity }}</td>
                    <td class="px-3 py-2 text-center text-green-600 font-medium">{{ item.passedCount }}</td>
                    <td class="px-3 py-2 text-center text-red-600 font-medium">{{ item.failedCount }}</td>
                    <td class="px-3 py-2 text-center">
                      <span
                        class="font-bold"
                        :style="{ color: formatQCStatusColor(item.qcStatus) }"
                      >
                        {{ item.isDeliverable ? '✓' : '✗' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div v-if="order.notes" class="px-4 py-2 bg-gray-50 border-t border-gray-200">
                <span class="text-[10px] text-gray-500">备注: </span>
                <span class="text-[10px] text-gray-700">{{ order.notes }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
