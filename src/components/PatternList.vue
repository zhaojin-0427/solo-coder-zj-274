<script setup lang="ts">
import { ref } from 'vue'
import type { UploadedPattern, PatternIndependentConfig, SetGroup, NailSize, NailShape } from '../types'
import { nailSizes, nailShapes } from '../data/nailConfig'

const props = defineProps<{
  patterns: UploadedPattern[]
  patternConfigs: Record<string, PatternIndependentConfig>
  setGroups: SetGroup[]
  defaultConfig: PatternIndependentConfig
}>()

const emit = defineEmits<{
  (e: 'remove', id: string): void
  (e: 'clear'): void
  (e: 'updateConfig', patternId: string, patch: Partial<PatternIndependentConfig>): void
  (e: 'createSetGroup', name: string): void
  (e: 'assignSetGroup', patternIds: string[], groupId: string | null): void
  (e: 'deleteSetGroup', groupId: string): void
}>()

const editingPatternId = ref<string | null>(null)
const newSetGroupName = ref('')
const showNewSetGroup = ref(false)
const selectedPatternIds = ref<Set<string>>(new Set())
const showBatchPanel = ref(false)

const sizeOptions: NailSize[] = ['XS', 'S', 'M', 'L']
const shapeOptions: NailShape[] = ['square', 'round', 'oval', 'almond', 'stiletto', 'coffin']

function toggleSelect(id: string) {
  if (selectedPatternIds.value.has(id)) {
    selectedPatternIds.value.delete(id)
  } else {
    selectedPatternIds.value.add(id)
  }
  selectedPatternIds.value = new Set(selectedPatternIds.value)
}

function selectAll() {
  selectedPatternIds.value = new Set(props.patterns.map(p => p.id))
}

function clearSelection() {
  selectedPatternIds.value = new Set()
}

function batchAssignSize(size: NailSize) {
  for (const id of selectedPatternIds.value) {
    emit('updateConfig', id, { nailSize: size })
  }
}

function batchAssignShape(shape: NailShape) {
  for (const id of selectedPatternIds.value) {
    emit('updateConfig', id, { nailShape: shape })
  }
}

function batchAssignQuantity(qty: number) {
  for (const id of selectedPatternIds.value) {
    emit('updateConfig', id, { quantity: qty })
  }
}

function batchAssignPriority(priority: number) {
  for (const id of selectedPatternIds.value) {
    emit('updateConfig', id, { priority })
  }
}

function batchAssignGroup(groupId: string | null) {
  emit('assignSetGroup', Array.from(selectedPatternIds.value), groupId)
}

function handleCreateSetGroup() {
  if (!newSetGroupName.value.trim()) return
  emit('createSetGroup', newSetGroupName.value.trim())
  newSetGroupName.value = ''
  showNewSetGroup.value = false
}

function updateSingleConfig(id: string, patch: Partial<PatternIndependentConfig>) {
  emit('updateConfig', id, patch)
}

function getGroup(id: string | null): SetGroup | undefined {
  if (!id) return undefined
  return props.setGroups.find(g => g.id === id)
}
</script>

<template>
  <div class="p-4 border-b border-gray-200">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-800">已上传图案：{{ patterns.length }}</h3>
      <div class="flex gap-2">
        <button
          v-if="patterns.length > 0"
          class="text-xs text-primary-600 hover:text-primary-700"
          @click="showBatchPanel = !showBatchPanel"
        >
          {{ showBatchPanel ? '收起批量' : '批量操作' }}
        </button>
        <button
          v-if="patterns.length > 0"
          class="text-xs text-red-500 hover:text-red-600"
          @click="emit('clear')"
        >
          清空全部
        </button>
      </div>
    </div>

    <div v-if="showBatchPanel && patterns.length > 0" class="mb-3 p-2 bg-gray-50 rounded-lg space-y-2 text-[10px]">
      <div class="flex justify-between items-center">
        <span class="text-gray-600">已选 {{ selectedPatternIds.size }} 个</span>
        <div class="flex gap-1">
          <button class="px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-100" @click="selectAll">全选</button>
          <button class="px-2 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-100" @click="clearSelection">清空</button>
        </div>
      </div>
      <div v-if="selectedPatternIds.size > 0" class="space-y-2 pt-2 border-t border-gray-200">
        <div class="flex flex-wrap gap-1">
          <span class="text-gray-500 w-10">型号:</span>
          <button
            v-for="sz in sizeOptions"
            :key="sz"
            class="px-1.5 py-0.5 bg-white border border-gray-200 rounded hover:bg-primary-50 hover:border-primary-300"
            @click="batchAssignSize(sz)"
          >{{ sz }}</button>
        </div>
        <div class="flex flex-wrap gap-1">
          <span class="text-gray-500 w-10">形状:</span>
          <button
            v-for="sh in shapeOptions"
            :key="sh"
            class="px-1.5 py-0.5 bg-white border border-gray-200 rounded hover:bg-primary-50 hover:border-primary-300"
            @click="batchAssignShape(sh)"
          >{{ nailShapes[sh].icon }}</button>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-500 w-10">数量:</span>
          <input
            type="number"
            min="1"
            max="50"
            class="w-16 px-1 py-0.5 border border-gray-200 rounded text-xs"
            placeholder="1-50"
            @change="batchAssignQuantity(Number(($event.target as HTMLInputElement).value) || 1)"
          />
          <span class="text-gray-500 w-10">优先级:</span>
          <input
            type="number"
            min="0"
            max="10"
            class="w-12 px-1 py-0.5 border border-gray-200 rounded text-xs"
            placeholder="0-10"
            @change="batchAssignPriority(Number(($event.target as HTMLInputElement).value) || 1)"
          />
        </div>
        <div>
          <span class="text-gray-500">套图分组:</span>
          <div class="flex flex-wrap gap-1 mt-1">
            <button
              class="px-1.5 py-0.5 bg-white border border-gray-200 rounded hover:bg-gray-100"
              @click="batchAssignGroup(null)"
            >不分组</button>
            <button
              v-for="g in setGroups"
              :key="g.id"
              class="px-1.5 py-0.5 rounded border"
              :style="{ borderColor: g.color, color: g.color }"
              @click="batchAssignGroup(g.id)"
            >{{ g.name }}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="setGroups.length > 0" class="mb-3 flex flex-wrap gap-1">
      <span class="text-[10px] text-gray-500 w-full mb-1">套图分组：</span>
      <div
        v-for="g in setGroups"
        :key="g.id"
        class="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
        :style="{ backgroundColor: g.color + '20', color: g.color }"
      >
        <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: g.color }"></span>
        <span>{{ g.name }}</span>
        <button
          class="hover:bg-black/10 rounded px-0.5"
          @click="emit('deleteSetGroup', g.id)"
          title="删除分组"
        >×</button>
      </div>
      <button
        v-if="!showNewSetGroup"
        class="text-[10px] text-gray-500 hover:text-primary-600"
        @click="showNewSetGroup = true"
      >+ 新建分组</button>
      <div v-else class="flex gap-1">
        <input
          v-model="newSetGroupName"
          type="text"
          placeholder="分组名"
          class="w-20 px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
          @keyup.enter="handleCreateSetGroup"
        />
        <button class="text-[10px] px-1.5 py-0.5 bg-primary-500 text-white rounded" @click="handleCreateSetGroup">确认</button>
        <button class="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded" @click="showNewSetGroup = false">取消</button>
      </div>
    </div>

    <div v-if="patterns.length === 0" class="text-xs text-gray-400 text-center py-4">
      暂无图案
    </div>

    <div v-else class="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
      <div
        v-for="pattern in patterns"
        :key="pattern.id"
        class="border border-gray-200 rounded-lg overflow-hidden bg-white"
      >
        <div class="flex gap-2 p-2">
          <label class="flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              :checked="selectedPatternIds.has(pattern.id)"
              class="w-3 h-3 accent-primary-500"
              @change="toggleSelect(pattern.id)"
            />
          </label>
          <div class="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden border border-gray-200 bg-gray-50">
            <img :src="pattern.dataUrl" :alt="pattern.name" class="w-full h-full object-cover" />
            <div
              v-if="patternConfigs[pattern.id]?.setGroupId && getGroup(patternConfigs[pattern.id].setGroupId)"
              class="absolute top-0 left-0 w-3 h-3"
              :style="{ backgroundColor: getGroup(patternConfigs[pattern.id].setGroupId)!.color }"
            ></div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-gray-800 truncate">{{ pattern.name }}</p>
              <button
                class="text-[10px] text-gray-400 hover:text-red-500"
                @click="emit('remove', pattern.id)"
              >删除</button>
            </div>
            <div class="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
              <span class="px-1 py-0.5 bg-gray-100 rounded">{{ patternConfigs[pattern.id]?.nailSize || 'M' }}</span>
              <span>{{ nailShapes[patternConfigs[pattern.id]?.nailShape || 'square']?.icon }}</span>
              <span>×{{ patternConfigs[pattern.id]?.quantity || 1 }}</span>
              <span v-if="patternConfigs[pattern.id]?.priority && patternConfigs[pattern.id].priority > 1" class="text-amber-600">P{{ patternConfigs[pattern.id].priority }}</span>
            </div>
            <button
              class="text-[10px] text-primary-600 hover:text-primary-700 mt-0.5"
              @click="editingPatternId = editingPatternId === pattern.id ? null : pattern.id"
            >
              {{ editingPatternId === pattern.id ? '收起设置' : '独立设置' }}
            </button>
          </div>
        </div>

        <div v-if="editingPatternId === pattern.id" class="px-2 pb-2 pt-0 space-y-2 border-t border-gray-100 bg-gray-50">
          <div>
            <span class="text-[10px] text-gray-500 block mb-1">指甲型号</span>
            <div class="flex gap-1">
              <button
                v-for="sz in sizeOptions"
                :key="sz"
                class="flex-1 py-1 text-[10px] rounded border transition-colors"
                :class="(patternConfigs[pattern.id]?.nailSize || 'M') === sz ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-200 hover:border-primary-300'"
                @click="updateSingleConfig(pattern.id, { nailSize: sz })"
              >{{ sz }}</button>
            </div>
          </div>
          <div>
            <span class="text-[10px] text-gray-500 block mb-1">指甲形状</span>
            <div class="flex gap-1">
              <button
                v-for="sh in shapeOptions"
                :key="sh"
                class="flex-1 py-1 text-[10px] rounded border transition-colors"
                :class="(patternConfigs[pattern.id]?.nailShape || 'square') === sh ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-200 hover:border-primary-300'"
                @click="updateSingleConfig(pattern.id, { nailShape: sh })"
              >{{ nailShapes[sh].icon }}</button>
            </div>
          </div>
          <div class="flex gap-2">
            <div class="flex-1">
              <span class="text-[10px] text-gray-500 block mb-1">数量</span>
              <input
                type="number"
                min="1"
                max="50"
                :value="patternConfigs[pattern.id]?.quantity || 1"
                class="w-full px-2 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                @change="updateSingleConfig(pattern.id, { quantity: Math.max(1, Math.min(50, Number(($event.target as HTMLInputElement).value) || 1)) })"
              />
            </div>
            <div class="flex-1">
              <span class="text-[10px] text-gray-500 block mb-1">优先级</span>
              <input
                type="number"
                min="0"
                max="10"
                :value="patternConfigs[pattern.id]?.priority || 1"
                class="w-full px-2 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                @change="updateSingleConfig(pattern.id, { priority: Math.max(0, Math.min(10, Number(($event.target as HTMLInputElement).value) || 1)) })"
              />
            </div>
          </div>
          <div>
            <span class="text-[10px] text-gray-500 block mb-1">套图分组</span>
            <div class="flex flex-wrap gap-1">
              <button
                class="px-2 py-0.5 text-[10px] rounded border"
                :class="!patternConfigs[pattern.id]?.setGroupId ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-gray-200'"
                @click="updateSingleConfig(pattern.id, { setGroupId: null })"
              >不分组</button>
              <button
                v-for="g in setGroups"
                :key="g.id"
                class="px-2 py-0.5 text-[10px] rounded border"
                :class="patternConfigs[pattern.id]?.setGroupId === g.id ? 'text-white' : 'bg-white'"
                :style="patternConfigs[pattern.id]?.setGroupId === g.id ? { backgroundColor: g.color, borderColor: g.color } : { borderColor: g.color, color: g.color }"
                @click="updateSingleConfig(pattern.id, { setGroupId: g.id })"
              >{{ g.name }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
