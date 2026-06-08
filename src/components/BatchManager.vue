<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type {
  ProductionBatch,
  CustomerOrder,
  LayoutSettings,
  PrintCalibration,
  PlacedPatternWithOrder,
  PageLayoutInfo,
  PageBatchInfo
} from '../types'
import {
  createBatch,
  saveBatch,
  deleteBatch,
  getAllBatches,
  loadBatch,
  getOrderStatusLabel,
  getOrderStatusColor
} from '../utils/order'

const props = defineProps<{
  orders: CustomerOrder[]
  selectedOrderIds: string[]
  settings: LayoutSettings
  calibration: PrintCalibration
  placements: PlacedPatternWithOrder[]
  pageInfo: PageLayoutInfo[]
  batchPageInfo: PageBatchInfo[]
}>()

const emit = defineEmits<{
  (e: 'createBatch', orderIds: string[]): void
  (e: 'loadBatch', batch: ProductionBatch): void
  (e: 'saveCurrentBatch'): void
}>()

const batches = ref<ProductionBatch[]>([])
const showCreateForm = ref(false)
const batchName = ref('')
const expandHistory = ref(false)

const selectedOrders = computed(() => {
  return props.orders.filter(o => props.selectedOrderIds.includes(o.id))
})

const canCreateBatch = computed(() => props.selectedOrderIds.length > 0)

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function handleCreateBatch() {
  if (!canCreateBatch.value) return
  if (!batchName.value.trim()) {
    alert('请输入批次名称')
    return
  }
  const newBatch = createBatch({
    name: batchName.value.trim(),
    orderIds: [...props.selectedOrderIds]
  })
  batches.value = saveBatch(newBatch)
  emit('createBatch', newBatch.orderIds)
  batchName.value = ''
  showCreateForm.value = false
}

function handleSaveCurrent() {
  emit('saveCurrentBatch')
  batches.value = getAllBatches()
}

function handleLoadBatch(batch: ProductionBatch) {
  if (!confirm(`确定恢复批次 "${batch.name}"？当前排版将被替换。`)) return
  const loaded = loadBatch(batch.id)
  if (loaded) {
    emit('loadBatch', loaded)
  }
}

function handleDeleteBatch(batchId: string) {
  if (!confirm('确定删除此历史批次？')) return
  batches.value = deleteBatch(batchId)
}

function getOrderById(id: string): CustomerOrder | undefined {
  return props.orders.find(o => o.id === id)
}

onMounted(() => {
  batches.value = getAllBatches()
})
</script>

<template>
  <div class="border-b border-gray-200">
    <div class="p-4 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-800">生产批次</h3>
      <div class="flex items-center gap-2">
        <button
          class="text-[11px] text-gray-500 hover:text-gray-700"
          @click="expandHistory = !expandHistory"
        >
          {{ expandHistory ? '收起历史' : '历史批次' }} ({{ batches.length }})
        </button>
        <button
          :disabled="!canCreateBatch"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
            canCreateBatch
              ? 'bg-primary-500 hover:bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          ]"
          @click="showCreateForm = true"
        >
          合并选中为批次
        </button>
      </div>
    </div>

    <div class="px-4 pb-3">
      <div class="text-[11px] text-gray-500 mb-2">
        已选中 <span class="font-medium text-primary-600">{{ selectedOrders.length }}</span> 个订单，
        共 <span class="font-medium text-primary-600">{{ selectedOrders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0) }}</span> 张贴纸
      </div>
      <div v-if="selectedOrders.length > 0" class="flex flex-wrap gap-1">
        <div
          v-for="order in selectedOrders"
          :key="order.id"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded"
        >
          <span
            class="w-2 h-2 rounded-sm"
            :style="{ backgroundColor: order.colorTag }"
          ></span>
          <span class="text-[10px] text-gray-700">{{ order.customerName }}</span>
          <span :class="['text-[9px] px-1 rounded', getOrderStatusColor(order.status)]">
            {{ getOrderStatusLabel(order.status) }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="showCreateForm" class="px-4 pb-4">
      <div class="bg-gray-50 rounded-lg p-3">
        <label class="block text-[11px] font-medium text-gray-600 mb-1.5">批次名称</label>
        <input
          v-model="batchName"
          type="text"
          :placeholder="`生产批次 - ${new Date().toLocaleDateString()}`"
          class="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-primary-400 mb-2"
          @keyup.enter="handleCreateBatch"
        />
        <div class="flex gap-2">
          <button
            class="flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-colors"
            @click="showCreateForm = false; batchName = ''"
          >
            取消
          </button>
          <button
            class="flex-1 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium rounded-md transition-colors"
            @click="handleCreateBatch"
          >
            创建批次
          </button>
        </div>
      </div>
    </div>

    <div v-if="expandHistory" class="px-4 pb-3 max-h-60 overflow-y-auto">
      <div v-if="batches.length === 0" class="text-[11px] text-gray-400 text-center py-3">
        暂无历史批次
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="batch in batches"
          :key="batch.id"
          class="bg-gray-50 rounded-md p-2"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-medium text-gray-800">{{ batch.name }}</span>
            <span class="text-[10px] text-gray-400">{{ formatDate(batch.createdAt) }}</span>
          </div>
          <div class="text-[10px] text-gray-500 mb-2">
            {{ batch.orderIds.length }} 个订单 · {{ batch.placements.length }} 张贴纸 · {{ batch.pageInfo.length }} 页
          </div>
          <div class="flex flex-wrap gap-1 mb-2">
            <div
              v-for="oid in batch.orderIds"
              :key="oid"
              class="inline-flex items-center gap-1"
            >
              <span
                v-if="getOrderById(oid)"
                class="w-2 h-2 rounded-sm"
                :style="{ backgroundColor: getOrderById(oid)!.colorTag }"
              ></span>
              <span class="text-[9px] text-gray-600">{{ getOrderById(oid)?.customerName || '已删除' }}</span>
            </div>
          </div>
          <div class="flex gap-1">
            <button
              class="flex-1 px-2 py-1 text-[10px] bg-primary-100 text-primary-600 rounded hover:bg-primary-200 transition-colors"
              @click="handleLoadBatch(batch)"
            >
              恢复
            </button>
            <button
              class="px-2 py-1 text-[10px] bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
              @click="handleDeleteBatch(batch.id)"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
