<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type {
  CustomerOrder,
  OrderStatus,
  OrderPatternItem,
  UploadedPattern,
  NailSize,
  NailShape
} from '../types'
import {
  createOrder,
  createOrderItem,
  getOrderStatusLabel,
  getOrderStatusColor,
  getDaysRemaining,
  filterOrders,
  saveOrder,
  deleteOrder,
  updateOrderStatus,
  boostOrderPriority,
  getAllOrders
} from '../utils/order'
import { nailSizes, nailShapes } from '../data/nailConfig'

const props = defineProps<{
  patterns: UploadedPattern[]
  selectedOrderIds: string[]
}>()

const emit = defineEmits<{
  (e: 'ordersChange', orders: CustomerOrder[]): void
  (e: 'toggleSelectOrder', orderId: string): void
  (e: 'boostPriority', orderId: string): void
}>()

const orders = ref<CustomerOrder[]>(getAllOrders())
const showForm = ref(false)
const editingOrderId = ref<string | null>(null)
const expandOrderId = ref<string | null>(null)

const filterStatus = ref<OrderStatus | 'all'>('all')
const filterKeyword = ref('')
const filterUrgent = ref<boolean | null>(null)

const sizeOptions: NailSize[] = ['XS', 'S', 'M', 'L']
const shapeOptions: NailShape[] = ['square', 'round', 'oval', 'almond', 'stiletto', 'coffin']

const form = ref({
  customerName: '',
  deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  isUrgent: false,
  notes: '',
  requiresFullSet: false,
  items: [] as Array<{
    patternId: string
    nailSize: NailSize
    nailShape: NailShape
    quantity: number
    priority: number
  }>
})

const filteredOrders = computed(() => {
  return filterOrders(orders.value, {
    status: filterStatus.value,
    keyword: filterKeyword.value,
    isUrgent: filterUrgent.value
  })
})

function resetForm() {
  form.value = {
    customerName: '',
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isUrgent: false,
    notes: '',
    requiresFullSet: false,
    items: []
  }
  editingOrderId.value = null
}

function openCreateForm() {
  resetForm()
  showForm.value = true
}

function openEditForm(order: CustomerOrder) {
  form.value = {
    customerName: order.customerName,
    deliveryDate: order.deliveryDate,
    isUrgent: order.isUrgent,
    notes: order.notes,
    requiresFullSet: order.requiresFullSet,
    items: order.items.map(i => ({
      patternId: i.patternId,
      nailSize: i.nailSize,
      nailShape: i.nailShape,
      quantity: i.quantity,
      priority: i.priority
    }))
  }
  editingOrderId.value = order.id
  showForm.value = true
}

function addItem() {
  form.value.items.push({
    patternId: props.patterns[0]?.id || '',
    nailSize: 'M',
    nailShape: 'square',
    quantity: 5,
    priority: 1
  })
}

function removeItem(index: number) {
  form.value.items.splice(index, 1)
}

function handleSubmit() {
  if (!form.value.customerName.trim()) {
    alert('请输入客户姓名')
    return
  }
  if (!form.value.deliveryDate) {
    alert('请选择交付日期')
    return
  }
  if (form.value.items.length === 0) {
    alert('请至少添加一个图案条目')
    return
  }

  const items: OrderPatternItem[] = form.value.items.map(i => {
    const pat = props.patterns.find(p => p.id === i.patternId)
    return createOrderItem({
      patternId: i.patternId,
      patternName: pat?.name || '未知图案',
      nailSize: i.nailSize,
      nailShape: i.nailShape,
      quantity: i.quantity,
      priority: i.priority
    })
  })

  if (editingOrderId.value) {
    const existing = orders.value.find(o => o.id === editingOrderId.value)
    if (existing) {
      const updated: CustomerOrder = {
        ...existing,
        customerName: form.value.customerName,
        deliveryDate: form.value.deliveryDate,
        isUrgent: form.value.isUrgent,
        notes: form.value.notes,
        requiresFullSet: form.value.requiresFullSet,
        items
      }
      orders.value = saveOrder(updated)
    }
  } else {
    const newOrder = createOrder({
      customerName: form.value.customerName,
      deliveryDate: form.value.deliveryDate,
      isUrgent: form.value.isUrgent,
      notes: form.value.notes,
      requiresFullSet: form.value.requiresFullSet,
      items
    })
    orders.value = saveOrder(newOrder)
  }

  emit('ordersChange', orders.value)
  showForm.value = false
  resetForm()
}

function handleDelete(orderId: string) {
  if (!confirm('确定删除此订单？')) return
  orders.value = deleteOrder(orderId)
  emit('ordersChange', orders.value)
}

function handleStatusChange(orderId: string, status: OrderStatus) {
  orders.value = updateOrderStatus(orderId, status)
  emit('ordersChange', orders.value)
}

function handleBoostPriority(orderId: string) {
  if (!confirm('确定提升此订单优先级？将标记为急单并提高图案优先级。')) return
  orders.value = boostOrderPriority(orderId)
  emit('ordersChange', orders.value)
  emit('boostPriority', orderId)
}

function getDaysText(days: number): string {
  if (days < 0) return `已逾期 ${-days} 天`
  if (days === 0) return '今日交付'
  if (days === 1) return '明日交付'
  return `${days} 天后交付`
}

function getDaysColorClass(days: number, isUrgent: boolean): string {
  if (isUrgent) return 'text-red-600'
  if (days < 0) return 'text-red-600'
  if (days <= 1) return 'text-red-600'
  if (days <= 3) return 'text-amber-600'
  if (days <= 7) return 'text-yellow-600'
  return 'text-gray-600'
}

function getPatternName(id: string): string {
  return props.patterns.find(p => p.id === id)?.name || '未知图案'
}

watch(
  () => props.patterns,
  () => {
    if (form.value.items.length === 0 && props.patterns.length > 0) {
      addItem()
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="border-b border-gray-200">
    <div class="p-4 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-800">客户订单管理</h3>
      <button
        class="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium rounded-lg transition-colors"
        @click="openCreateForm"
      >
        + 新建订单
      </button>
    </div>

    <div class="px-4 pb-3 space-y-2">
      <div class="flex gap-2">
        <input
          v-model="filterKeyword"
          type="text"
          placeholder="搜索订单号/客户/备注..."
          class="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
        />
        <select
          v-model="filterStatus"
          class="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
        >
          <option value="all">全部状态</option>
          <option value="pending_layout">待排版</option>
          <option value="layout_done">已排版</option>
          <option value="printed">已打印</option>
          <option value="delivered">已交付</option>
        </select>
      </div>
      <div class="flex gap-2">
        <button
          :class="[
            'px-2 py-1 text-[11px] rounded-md transition-colors',
            filterUrgent === null ? 'bg-gray-100 text-gray-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          ]"
          @click="filterUrgent = null"
        >
          全部
        </button>
        <button
          :class="[
            'px-2 py-1 text-[11px] rounded-md transition-colors',
            filterUrgent === true ? 'bg-red-100 text-red-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          ]"
          @click="filterUrgent = filterUrgent === true ? null : true"
        >
          仅急单
        </button>
        <button
          :class="[
            'px-2 py-1 text-[11px] rounded-md transition-colors',
            filterUrgent === false ? 'bg-blue-100 text-blue-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          ]"
          @click="filterUrgent = filterUrgent === false ? null : false"
        >
          仅普通
        </button>
      </div>
    </div>

    <div v-if="showForm" class="px-4 pb-4">
      <div class="bg-gray-50 rounded-lg p-3 space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-medium text-gray-600 mb-1">客户姓名 *</label>
            <input
              v-model="form.customerName"
              type="text"
              class="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-primary-400"
              placeholder="客户姓名"
            />
          </div>
          <div>
            <label class="block text-[11px] font-medium text-gray-600 mb-1">交付日期 *</label>
            <input
              v-model="form.deliveryDate"
              type="date"
              class="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-primary-400"
            />
          </div>
        </div>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input v-model="form.isUrgent" type="checkbox" class="w-3.5 h-3.5 accent-red-500" />
            <span class="text-[11px] text-gray-700">急单</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input v-model="form.requiresFullSet" type="checkbox" class="w-3.5 h-3.5 accent-primary-500" />
            <span class="text-[11px] text-gray-700">成套要求</span>
          </label>
        </div>
        <div>
          <label class="block text-[11px] font-medium text-gray-600 mb-1">备注</label>
          <textarea
            v-model="form.notes"
            rows="2"
            class="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-primary-400 resize-none"
            placeholder="订单备注..."
          ></textarea>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] font-medium text-gray-600">图案清单</span>
            <button
              class="px-2 py-0.5 bg-primary-50 text-primary-600 text-[11px] rounded hover:bg-primary-100 transition-colors"
              @click="addItem"
            >
              + 添加
            </button>
          </div>
          <div v-if="form.items.length === 0" class="text-[11px] text-gray-400 text-center py-3 bg-white rounded-md border border-dashed border-gray-200">
            暂无条目，点击上方添加
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="(item, idx) in form.items"
              :key="idx"
              class="bg-white rounded-md p-2 border border-gray-200"
            >
              <div class="grid grid-cols-6 gap-1.5 mb-1.5">
                <select
                  v-model="item.patternId"
                  class="col-span-2 px-1.5 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                >
                  <option v-for="p in patterns" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <select
                  v-model="item.nailSize"
                  class="px-1.5 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                >
                  <option v-for="s in sizeOptions" :key="s" :value="s">{{ s }}</option>
                </select>
                <select
                  v-model="item.nailShape"
                  class="px-1.5 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                >
                  <option v-for="sh in shapeOptions" :key="sh" :value="sh">{{ nailShapes[sh].icon }}</option>
                </select>
                <input
                  v-model.number="item.quantity"
                  type="number"
                  min="1"
                  class="px-1.5 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                  placeholder="数量"
                />
                <input
                  v-model.number="item.priority"
                  type="number"
                  min="1"
                  max="10"
                  class="px-1.5 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                  placeholder="优先级"
                />
              </div>
              <div class="flex justify-end">
                <button
                  class="text-[10px] text-red-500 hover:text-red-600"
                  @click="removeItem(idx)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-2 pt-1">
          <button
            class="flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-colors"
            @click="showForm = false; resetForm()"
          >
            取消
          </button>
          <button
            class="flex-1 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium rounded-md transition-colors"
            @click="handleSubmit"
          >
            {{ editingOrderId ? '保存修改' : '创建订单' }}
          </button>
        </div>
      </div>
    </div>

    <div class="max-h-80 overflow-y-auto">
      <div v-if="filteredOrders.length === 0" class="px-4 py-6 text-center text-xs text-gray-400">
        暂无订单
      </div>
      <div v-else class="divide-y divide-gray-100">
        <div
          v-for="order in filteredOrders"
          :key="order.id"
          :class="[
            'p-3 cursor-pointer transition-colors',
            selectedOrderIds.includes(order.id) ? 'bg-primary-50' : 'hover:bg-gray-50'
          ]"
        >
          <div class="flex items-start gap-2">
            <input
              type="checkbox"
              :checked="selectedOrderIds.includes(order.id)"
              class="mt-1 w-3.5 h-3.5 accent-primary-500"
              @click.stop
              @change="emit('toggleSelectOrder', order.id)"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span
                    class="w-3 h-3 rounded-sm flex-shrink-0"
                    :style="{ backgroundColor: order.colorTag }"
                  ></span>
                  <span class="text-[11px] font-mono text-gray-500">{{ order.orderNo }}</span>
                </div>
                <span :class="['text-[10px] px-1.5 py-0.5 rounded', getOrderStatusColor(order.status)]">
                  {{ getOrderStatusLabel(order.status) }}
                </span>
              </div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-gray-800 truncate">{{ order.customerName }}</span>
                <span v-if="order.isUrgent" class="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                  急单
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span :class="['text-[11px]', getDaysColorClass(getDaysRemaining(order.deliveryDate), order.isUrgent)]">
                  {{ getDaysText(getDaysRemaining(order.deliveryDate)) }}
                </span>
                <span class="text-[11px] text-gray-500">
                  {{ order.items.length }} 种 · {{ order.items.reduce((s, i) => s + i.quantity, 0) }} 张
                </span>
              </div>

              <div class="mt-2 flex items-center gap-1 flex-wrap">
                <button
                  class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  @click.stop="expandOrderId = expandOrderId === order.id ? null : order.id"
                >
                  {{ expandOrderId === order.id ? '收起' : '详情' }}
                </button>
                <button
                  v-if="order.status === 'pending_layout'"
                  class="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                  @click.stop="handleStatusChange(order.id, 'layout_done')"
                >
                  标记已排版
                </button>
                <button
                  v-if="order.status === 'layout_done'"
                  class="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors"
                  @click.stop="handleStatusChange(order.id, 'printed')"
                >
                  标记已打印
                </button>
                <button
                  v-if="order.status === 'printed'"
                  class="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
                  @click.stop="handleStatusChange(order.id, 'delivered')"
                >
                  标记已交付
                </button>
                <button
                  v-if="!order.isUrgent && order.status !== 'delivered'"
                  class="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded hover:bg-amber-200 transition-colors"
                  @click.stop="handleBoostPriority(order.id)"
                >
                  提升优先级
                </button>
                <button
                  class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  @click.stop="openEditForm(order)"
                >
                  编辑
                </button>
                <button
                  class="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                  @click.stop="handleDelete(order.id)"
                >
                  删除
                </button>
              </div>

              <div v-if="expandOrderId === order.id" class="mt-2 bg-gray-50 rounded-md p-2 text-[11px]">
                <div class="space-y-1">
                  <div class="flex justify-between text-gray-500">
                    <span>交付日期:</span>
                    <span class="text-gray-700">{{ order.deliveryDate }}</span>
                  </div>
                  <div v-if="order.requiresFullSet" class="flex justify-between text-gray-500">
                    <span>成套要求:</span>
                    <span class="text-gray-700">是</span>
                  </div>
                  <div v-if="order.notes" class="flex justify-between text-gray-500">
                    <span>备注:</span>
                    <span class="text-gray-700 max-w-[60%] text-right">{{ order.notes }}</span>
                  </div>
                  <div class="pt-1 border-t border-gray-200 mt-1">
                    <div class="text-gray-500 mb-1">图案明细:</div>
                    <div class="space-y-0.5">
                      <div
                        v-for="item in order.items"
                        :key="item.id"
                        class="flex justify-between text-gray-600"
                      >
                        <span class="truncate max-w-[55%]">· {{ getPatternName(item.patternId) }}</span>
                        <span>
                          {{ item.nailSize }} {{ nailShapes[item.nailShape].icon }} ×{{ item.quantity }}
                          <span v-if="item.priority > 1" class="text-amber-600"> P{{ item.priority }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
