<script setup lang="ts">
import { computed } from 'vue'
import type {
  CustomerOrder,
  OrderLayoutProgress,
  PageBatchInfo,
  DeliveryWarning,
  PlacedPatternWithOrder
} from '../types'
import {
  getOrderStatusLabel,
  getOrderStatusColor,
  getDaysRemaining,
  estimateSortingTime
} from '../utils/order'

const props = defineProps<{
  orders: CustomerOrder[]
  placements: PlacedPatternWithOrder[]
  orderProgress: Record<string, OrderLayoutProgress>
  batchPageInfo: PageBatchInfo[]
  deliveryWarnings: DeliveryWarning[]
  currentPage: number
}>()

const emit = defineEmits<{
  (e: 'boostPriority', orderId: string): void
  (e: 'selectOrder', orderId: string): void
}>()

const activeOrders = computed(() => {
  return props.orders.filter(o => o.status !== 'delivered')
})

const ordersOnCurrentPage = computed(() => {
  const pageInfo = props.batchPageInfo[props.currentPage]
  if (!pageInfo) return []
  return pageInfo.orders
})

const currentPageSortTime = computed(() => {
  const pageInfo = props.batchPageInfo[props.currentPage]
  if (!pageInfo) return 0
  return pageInfo.estimatedSortTimeSeconds
})

const currentPageRiskLevel = computed(() => {
  const pageInfo = props.batchPageInfo[props.currentPage]
  if (!pageInfo) return 'low' as const
  return pageInfo.riskLevel
})

const totalSortTime = computed(() => {
  return estimateSortingTime(props.placements)
})

const totalStats = computed(() => {
  const total = activeOrders.value.length
  const complete = activeOrders.value.filter(o => {
    const p = props.orderProgress[o.id]
    return p?.isComplete
  }).length
  const incomplete = total - complete
  return { total, complete, incomplete }
})

function getOrderById(id: string): CustomerOrder | undefined {
  return props.orders.find(o => o.id === id)
}

function getProgressBarColor(percent: number, isUrgent: boolean): string {
  if (isUrgent) return 'bg-red-500'
  if (percent >= 100) return 'bg-green-500'
  if (percent >= 80) return 'bg-primary-500'
  if (percent >= 50) return 'bg-amber-500'
  return 'bg-red-400'
}

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec} 秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分`
}

function getRiskLabel(level: 'low' | 'medium' | 'high'): string {
  const map = { low: '低', medium: '中', high: '高' }
  return map[level]
}

function getRiskClass(level: 'low' | 'medium' | 'high'): string {
  const map = {
    low: 'text-green-600 bg-green-100',
    medium: 'text-amber-600 bg-amber-100',
    high: 'text-red-600 bg-red-100'
  }
  return map[level]
}

function handleBoost(warning: DeliveryWarning) {
  if (!confirm('确定提升此订单优先级？')) return
  emit('boostPriority', warning.orderId)
}
</script>

<template>
  <div class="border-b border-gray-200">
    <div class="p-4">
      <h3 class="text-sm font-semibold text-gray-800 mb-3">订单进度 & 分拣</h3>

      <div v-if="deliveryWarnings.length > 0" class="mb-3 space-y-1.5">
        <div
          v-for="w in deliveryWarnings"
          :key="w.orderId"
          :class="[
            'rounded-md p-2 border',
            w.isUrgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
          ]"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1 mb-0.5">
                <span v-if="w.isUrgent" class="text-[9px] px-1 bg-red-500 text-white rounded">急单</span>
                <span class="text-[11px] font-medium text-gray-800">{{ w.customerName }}</span>
              </div>
              <div class="text-[10px] text-gray-600">{{ w.suggestion }}</div>
              <div class="text-[10px] text-gray-500 mt-0.5">
                交付日期: {{ w.deliveryDate }} · 完成度: {{ w.completionPercent }}%
                <span v-if="w.daysRemaining <= 0"> · 已逾期</span>
                <span v-else-if="w.daysRemaining === 1"> · 明日</span>
                <span v-else> · {{ w.daysRemaining }}天后</span>
              </div>
            </div>
            <button
              v-if="w.completionPercent < 100"
              class="px-2 py-0.5 text-[10px] bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors whitespace-nowrap"
              @click="handleBoost(w)"
            >
              提升优先级
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-3">
        <div class="bg-gray-50 rounded-md p-2 text-center">
          <div class="text-lg font-bold text-gray-800">{{ totalStats.total }}</div>
          <div class="text-[10px] text-gray-500">活跃订单</div>
        </div>
        <div class="bg-green-50 rounded-md p-2 text-center">
          <div class="text-lg font-bold text-green-600">{{ totalStats.complete }}</div>
          <div class="text-[10px] text-gray-500">排版完成</div>
        </div>
        <div class="bg-red-50 rounded-md p-2 text-center">
          <div class="text-lg font-bold text-red-500">{{ totalStats.incomplete }}</div>
          <div class="text-[10px] text-gray-500">进行中</div>
        </div>
      </div>

      <div class="mb-3">
        <div class="text-[11px] font-medium text-gray-600 mb-1.5">订单完成度</div>
        <div v-if="activeOrders.length === 0" class="text-[11px] text-gray-400 text-center py-2">
          暂无活跃订单
        </div>
        <div v-else class="space-y-1.5 max-h-40 overflow-y-auto">
          <div
            v-for="order in activeOrders"
            :key="order.id"
            class="bg-gray-50 rounded-md p-2 cursor-pointer hover:bg-gray-100 transition-colors"
            @click="emit('selectOrder', order.id)"
          >
            <div class="flex items-center gap-1.5 mb-1">
              <span
                class="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                :style="{ backgroundColor: order.colorTag }"
              ></span>
              <span class="text-[11px] font-medium text-gray-800 flex-1 truncate">{{ order.customerName }}</span>
              <span :class="['text-[9px] px-1 rounded', getOrderStatusColor(order.status)]">
                {{ getOrderStatusLabel(order.status) }}
              </span>
            </div>
            <div class="flex items-center gap-1.5 mb-1">
              <div class="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  :class="['h-full rounded-full transition-all', getProgressBarColor(orderProgress[order.id]?.completionPercent || 0, order.isUrgent)]"
                  :style="{ width: `${orderProgress[order.id]?.completionPercent || 0}%` }"
                ></div>
              </div>
              <span class="text-[10px] font-medium text-gray-700 w-10 text-right">
                {{ orderProgress[order.id]?.completionPercent || 0 }}%
              </span>
            </div>
            <div class="flex items-center justify-between text-[10px] text-gray-500">
              <span>
                {{ orderProgress[order.id]?.placedItems || 0 }}/{{ orderProgress[order.id]?.totalItems || 0 }} 张
                <span v-if="orderProgress[order.id]?.missingItems.length" class="text-red-500"> · 缺{{ orderProgress[order.id]!.missingItems.length }}项</span>
              </span>
              <span :class="getDaysRemaining(order.deliveryDate) <= 3 ? 'text-red-500' : ''">
                {{ getDaysRemaining(order.deliveryDate) }}天
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-gray-200 pt-3">
        <div class="text-[11px] font-medium text-gray-600 mb-2">
          当前页 (第 {{ currentPage + 1 }} 页)
        </div>
        <div class="grid grid-cols-2 gap-2 mb-2">
          <div class="bg-gray-50 rounded-md p-2">
            <div class="text-xs font-bold text-gray-800">{{ formatSeconds(currentPageSortTime) }}</div>
            <div class="text-[10px] text-gray-500">预计分拣耗时</div>
          </div>
          <div class="bg-gray-50 rounded-md p-2">
            <div class="flex items-center gap-1">
              <span class="text-xs font-bold text-gray-800">{{ getRiskLabel(currentPageRiskLevel) }}</span>
              <span :class="['text-[9px] px-1 rounded', getRiskClass(currentPageRiskLevel)]">风险</span>
            </div>
            <div class="text-[10px] text-gray-500">分拣复杂度</div>
          </div>
        </div>

        <div v-if="ordersOnCurrentPage.length > 0">
          <div class="text-[10px] text-gray-500 mb-1">本页订单:</div>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="info in ordersOnCurrentPage"
              :key="info.orderId"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded"
            >
              <span
                v-if="getOrderById(info.orderId)"
                class="w-2 h-2 rounded-sm"
                :style="{ backgroundColor: getOrderById(info.orderId)!.colorTag }"
              ></span>
              <span class="text-[10px] text-gray-700">
                {{ getOrderById(info.orderId)?.customerName || '未知' }}
              </span>
              <span class="text-[9px] text-gray-500">
                {{ info.placedCount }}/{{ info.totalCount }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="text-[10px] text-gray-400">
          本页暂无订单数据
        </div>
      </div>

      <div v-if="batchPageInfo.length > 0" class="border-t border-gray-200 mt-3 pt-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[11px] font-medium text-gray-600">整批分拣预估</span>
          <span class="text-[11px] font-bold text-primary-600">{{ formatSeconds(totalSortTime) }}</span>
        </div>
        <div class="text-[10px] text-gray-500">
          共 {{ batchPageInfo.length }} 页，{{ new Set(placements.map(p => p.orderId).filter(Boolean)).size }} 个客户
        </div>
      </div>
    </div>
  </div>
</template>
