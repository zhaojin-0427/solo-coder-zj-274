<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { PatternMaterial } from '../types/materialLibrary'
import type { UploadedPattern, PatternIndependentConfig, NailSize, NailShape, CustomerOrder, OrderPatternItem } from '../types'
import {
  getAllMaterials,
  deleteMaterial,
  markMaterialUsed,
  getAllTags,
  filterMaterials,
  materialToUploadedPattern,
  materialToPatternConfig,
  updateMaterial
} from '../utils/materialLibrary'
import { nailSizes, nailShapes } from '../data/nailConfig'
import { generateId } from '../utils/image'

const props = defineProps<{
  appMode: 'normal' | 'order'
  patterns: UploadedPattern[]
  orders?: CustomerOrder[]
  selectedOrderIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'addPatterns', patterns: UploadedPattern[], configs: Record<string, PatternIndependentConfig>): void
  (e: 'addOrderItems', orderId: string, patterns: UploadedPattern[], items: OrderPatternItem[]): void
}>()

const materials = ref<PatternMaterial[]>([])
const allTags = ref<string[]>([])
const searchKeyword = ref('')
const selectedTags = ref<string[]>([])
const sortBy = ref<'name' | 'recent' | 'created'>('recent')
const selectedMaterialIds = ref<Set<string>>(new Set())
const editingMaterialId = ref<string | null>(null)
const editingForm = ref({
  name: '',
  tags: '',
  defaultNailSize: 'M' as NailSize,
  defaultNailShape: 'square' as NailShape,
  defaultQuantity: 5
})
const showPanel = ref(true)

function refresh() {
  materials.value = getAllMaterials()
  allTags.value = getAllTags()
}

onMounted(() => {
  refresh()
})

const filteredMaterials = computed(() => {
  return filterMaterials(materials.value, {
    keyword: searchKeyword.value,
    tags: selectedTags.value,
    sortBy: sortBy.value
  })
})

function toggleTag(tag: string) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter(t => t !== tag)
  } else {
    selectedTags.value = [...selectedTags.value, tag]
  }
}

function clearTagsFilter() {
  selectedTags.value = []
}

function toggleSelectMaterial(id: string) {
  const next = new Set(selectedMaterialIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedMaterialIds.value = next
}

function selectAllFiltered() {
  selectedMaterialIds.value = new Set(filteredMaterials.value.map(m => m.id))
}

function clearSelection() {
  selectedMaterialIds.value = new Set()
}

function getSelectedMaterials(): PatternMaterial[] {
  return materials.value.filter(m => selectedMaterialIds.value.has(m.id))
}

function handleAddToNormalLayout() {
  const selected = getSelectedMaterials()
  if (selected.length === 0) {
    alert('请先选择要添加的素材')
    return
  }
  const newPatterns: UploadedPattern[] = []
  const newConfigs: Record<string, PatternIndependentConfig> = {}
  for (const mat of selected) {
    const pat = materialToUploadedPattern(mat)
    newPatterns.push(pat)
    newConfigs[pat.id] = materialToPatternConfig(mat)
    markMaterialUsed(mat.id)
  }
  emit('addPatterns', newPatterns, newConfigs)
  clearSelection()
  refresh()
}

function handleAddSingleToNormalLayout(mat: PatternMaterial) {
  const pat = materialToUploadedPattern(mat)
  const config = materialToPatternConfig(mat)
  markMaterialUsed(mat.id)
  emit('addPatterns', [pat], { [pat.id]: config })
  refresh()
}

function handleAddSingleToOrder(mat: PatternMaterial) {
  if (!props.orders || props.selectedOrderIds?.length !== 1) {
    alert('请先选择一个订单，再添加素材到订单图案清单')
    return
  }
  const orderId = props.selectedOrderIds[0]
  const order = props.orders.find(o => o.id === orderId)
  if (!order) return
  const pat = materialToUploadedPattern(mat)
  const item: OrderPatternItem = {
    id: generateId(),
    patternId: pat.id,
    patternName: mat.name,
    nailSize: mat.defaultNailSize,
    nailShape: mat.defaultNailShape,
    quantity: mat.defaultQuantity,
    priority: 1,
    setGroupId: null
  }
  markMaterialUsed(mat.id)
  emit('addOrderItems', orderId, [pat], [item])
  refresh()
}

function handleAddToOrder() {
  const selected = getSelectedMaterials()
  if (selected.length === 0) {
    alert('请先选择要添加的素材')
    return
  }
  if (!props.orders || props.selectedOrderIds?.length !== 1) {
    alert('请先选择一个订单，再批量添加素材')
    return
  }
  const orderId = props.selectedOrderIds[0]
  const patterns: UploadedPattern[] = []
  const items: OrderPatternItem[] = []
  for (const mat of selected) {
    const pat = materialToUploadedPattern(mat)
    patterns.push(pat)
    items.push({
      id: generateId(),
      patternId: pat.id,
      patternName: mat.name,
      nailSize: mat.defaultNailSize,
      nailShape: mat.defaultNailShape,
      quantity: mat.defaultQuantity,
      priority: 1,
      setGroupId: null
    })
    markMaterialUsed(mat.id)
  }
  emit('addOrderItems', orderId, patterns, items)
  clearSelection()
  refresh()
}

function handleDelete(id: string) {
  if (!confirm('确定从素材库删除此素材？删除不会影响已有订单和批次记录。')) return
  deleteMaterial(id)
  const next = new Set(selectedMaterialIds.value)
  next.delete(id)
  selectedMaterialIds.value = next
  refresh()
}

function startEdit(mat: PatternMaterial) {
  editingMaterialId.value = mat.id
  editingForm.value = {
    name: mat.name,
    tags: mat.tags.join(', '),
    defaultNailSize: mat.defaultNailSize,
    defaultNailShape: mat.defaultNailShape,
    defaultQuantity: mat.defaultQuantity
  }
}

function saveEdit() {
  if (!editingMaterialId.value) return
  const tags = editingForm.value.tags
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean)
  updateMaterial(editingMaterialId.value, {
    name: editingForm.value.name.trim() || '未命名素材',
    tags,
    defaultNailSize: editingForm.value.defaultNailSize,
    defaultNailShape: editingForm.value.defaultNailShape,
    defaultQuantity: Math.max(1, Math.min(50, editingForm.value.defaultQuantity))
  })
  editingMaterialId.value = null
  refresh()
}

function cancelEdit() {
  editingMaterialId.value = null
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const hasSelection = computed(() => selectedMaterialIds.value.size > 0)
</script>

<template>
  <div class="border-b border-gray-200">
    <div class="p-4 flex items-center justify-between cursor-pointer" @click="showPanel = !showPanel">
      <h3 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        图案素材库
        <span class="text-[10px] text-gray-400 font-normal">({{ materials.length }})</span>
      </h3>
      <svg
        :class="['w-4 h-4 text-gray-500 transition-transform', showPanel ? '' : '-rotate-90']"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>

    <div v-if="showPanel" class="px-4 pb-4 space-y-3">
      <div class="space-y-2">
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索名称/标签..."
          class="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
        />
        <div class="flex gap-2">
          <select
            v-model="sortBy"
            class="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
          >
            <option value="recent">最近使用</option>
            <option value="created">最新添加</option>
            <option value="name">按名称</option>
          </select>
        </div>

        <div v-if="allTags.length > 0" class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-gray-500">标签筛选：</span>
            <button
              v-if="selectedTags.length > 0"
              class="text-[10px] text-primary-600 hover:text-primary-700"
              @click.stop="clearTagsFilter"
            >清除</button>
          </div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="tag in allTags"
              :key="tag"
              :class="[
                'px-2 py-0.5 text-[10px] rounded-full transition-colors',
                selectedTags.includes(tag)
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              ]"
              @click.stop="toggleTag(tag)"
            >{{ tag }}</button>
          </div>
        </div>
      </div>

      <div v-if="filteredMaterials.length > 0" class="flex items-center justify-between">
        <span class="text-[10px] text-gray-500">已选 {{ selectedMaterialIds.size }} 个</span>
        <div class="flex gap-1">
          <button
            class="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            @click="selectAllFiltered"
          >全选当前</button>
          <button
            v-if="hasSelection"
            class="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            @click="clearSelection"
          >清空选择</button>
        </div>
      </div>

      <div v-if="hasSelection" class="flex gap-2">
        <button
          v-if="appMode === 'normal'"
          class="flex-1 px-2 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium rounded-lg transition-colors"
          @click="handleAddToNormalLayout"
        >
          批量加入排版
        </button>
        <button
          v-else
          :disabled="!selectedOrderIds || selectedOrderIds.length !== 1"
          :class="[
            'flex-1 px-2 py-1.5 text-white text-xs font-medium rounded-lg transition-colors',
            (!selectedOrderIds || selectedOrderIds.length !== 1)
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary-500 hover:bg-primary-600'
          ]"
          :title="(!selectedOrderIds || selectedOrderIds.length !== 1) ? '请先选择一个订单' : ''"
          @click="handleAddToOrder"
        >
          批量加入订单
        </button>
      </div>

      <div v-if="filteredMaterials.length === 0" class="text-xs text-gray-400 text-center py-4">
        暂无素材，在已上传图案列表中点击「保存到素材库」
      </div>

      <div v-else class="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
        <div
          v-for="mat in filteredMaterials"
          :key="mat.id"
          :class="[
            'border rounded-lg overflow-hidden bg-white transition-colors',
            selectedMaterialIds.has(mat.id) ? 'border-primary-300 bg-primary-50' : 'border-gray-200'
          ]"
        >
          <div v-if="editingMaterialId === mat.id" class="p-3 space-y-2 bg-gray-50">
            <div>
              <label class="block text-[10px] text-gray-500 mb-0.5">名称</label>
              <input
                v-model="editingForm.name"
                type="text"
                class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-500 mb-0.5">标签（逗号分隔）</label>
              <input
                v-model="editingForm.tags"
                type="text"
                placeholder="花朵, 简约, 日系"
                class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-primary-400"
              />
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <div>
                <label class="block text-[10px] text-gray-500 mb-0.5">型号</label>
                <select
                  v-model="editingForm.defaultNailSize"
                  class="w-full px-1 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                >
                  <option v-for="(cfg, sz) in nailSizes" :key="sz" :value="sz">{{ sz }}</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] text-gray-500 mb-0.5">形状</label>
                <select
                  v-model="editingForm.defaultNailShape"
                  class="w-full px-1 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                >
                  <option v-for="(cfg, sh) in nailShapes" :key="sh" :value="sh">{{ cfg.icon }}</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] text-gray-500 mb-0.5">数量</label>
                <input
                  v-model.number="editingForm.defaultQuantity"
                  type="number"
                  min="1"
                  max="50"
                  class="w-full px-1 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                />
              </div>
            </div>
            <div class="flex gap-1 pt-1">
              <button
                class="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] rounded transition-colors"
                @click="cancelEdit"
              >取消</button>
              <button
                class="flex-1 px-2 py-1 bg-primary-500 hover:bg-primary-600 text-white text-[10px] rounded transition-colors"
                @click="saveEdit"
              >保存</button>
            </div>
          </div>

          <template v-else>
            <div class="flex gap-2 p-2">
              <label class="flex items-center cursor-pointer flex-shrink-0" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedMaterialIds.has(mat.id)"
                  class="w-3 h-3 accent-primary-500"
                  @change="toggleSelectMaterial(mat.id)"
                />
              </label>
              <div class="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden border border-gray-200 bg-gray-50">
                <img :src="mat.dataUrl" :alt="mat.name" class="w-full h-full object-cover" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-medium text-gray-800 truncate">{{ mat.name }}</p>
                </div>
                <div class="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                  <span class="px-1 py-0.5 bg-gray-100 rounded">{{ mat.defaultNailSize }}</span>
                  <span>{{ nailShapes[mat.defaultNailShape]?.icon }}</span>
                  <span>×{{ mat.defaultQuantity }}</span>
                </div>
                <div v-if="mat.tags.length > 0" class="flex flex-wrap gap-0.5 mt-0.5">
                  <span
                    v-for="t in mat.tags.slice(0, 3)"
                    :key="t"
                    class="text-[9px] px-1 py-0 bg-gray-100 text-gray-500 rounded"
                  >{{ t }}</span>
                  <span v-if="mat.tags.length > 3" class="text-[9px] text-gray-400">+{{ mat.tags.length - 3 }}</span>
                </div>
                <div class="text-[9px] text-gray-400 mt-0.5">最近使用: {{ formatDate(mat.lastUsedAt) }}</div>
              </div>
            </div>

            <div class="flex border-t border-gray-100 text-[10px]">
              <button
                v-if="appMode === 'normal'"
                class="flex-1 py-1.5 text-primary-600 hover:bg-primary-50 transition-colors border-r border-gray-100"
                @click="handleAddSingleToNormalLayout(mat)"
              >加入排版</button>
              <button
                v-else
                :disabled="!selectedOrderIds || selectedOrderIds.length !== 1"
                :class="[
                  'flex-1 py-1.5 border-r border-gray-100 transition-colors',
                  (!selectedOrderIds || selectedOrderIds.length !== 1)
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-primary-600 hover:bg-primary-50'
                ]"
                @click="handleAddSingleToOrder(mat)"
              >加入订单</button>
              <button
                class="flex-1 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
                @click="startEdit(mat)"
              >编辑</button>
              <button
                class="flex-1 py-1.5 text-red-500 hover:bg-red-50 transition-colors"
                @click="handleDelete(mat.id)"
              >删除</button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
