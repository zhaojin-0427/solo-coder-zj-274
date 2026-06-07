<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { LayoutScheme, LayoutSettings, UploadedPattern } from '../types'
import { getAllSchemes, saveLayoutScheme, deleteScheme, loadScheme } from '../utils/storage'

const props = defineProps<{
  currentPatterns: UploadedPattern[]
  currentSettings: LayoutSettings
}>()

const emit = defineEmits<{
  (e: 'load', patterns: UploadedPattern[], settings: LayoutSettings): void
}>()

const schemes = ref<LayoutScheme[]>([])
const newSchemeName = ref('')
const showSaveInput = ref(false)

onMounted(() => {
  refreshSchemes()
})

function refreshSchemes() {
  schemes.value = getAllSchemes()
}

function handleSave() {
  if (!newSchemeName.value.trim()) return
  saveLayoutScheme(newSchemeName.value.trim(), props.currentPatterns, props.currentSettings)
  newSchemeName.value = ''
  showSaveInput.value = false
  refreshSchemes()
}

function handleLoad(id: string) {
  const scheme = loadScheme(id)
  if (scheme) {
    emit('load', scheme.patterns, scheme.settings)
  }
}

function handleDelete(id: string) {
  if (confirm('确定要删除此排版方案吗？')) {
    deleteScheme(id)
    refreshSchemes()
  }
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-800">排版方案</h3>
      <button
        class="text-xs px-2 py-1 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
        @click="showSaveInput = !showSaveInput"
      >
        {{ showSaveInput ? '取消' : '保存方案' }}
      </button>
    </div>

    <div v-if="showSaveInput" class="mb-3 flex gap-2">
      <input
        v-model="newSchemeName"
        type="text"
        placeholder="输入方案名称"
        class="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-primary-400"
        @keyup.enter="handleSave"
      />
      <button
        class="px-2 py-1 bg-primary-500 text-white text-xs rounded-md hover:bg-primary-600"
        @click="handleSave"
      >
        保存
      </button>
    </div>

    <div v-if="schemes.length === 0" class="text-xs text-gray-400 text-center py-4">
      暂无保存的方案
    </div>

    <div v-else class="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
      <div
        v-for="scheme in schemes"
        :key="scheme.id"
        class="group flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-gray-800 truncate">{{ scheme.name }}</p>
          <p class="text-[10px] text-gray-500">
            {{ scheme.patterns.length }} 图案 · {{ formatDate(scheme.createdAt) }}
          </p>
        </div>
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            class="p-1 text-primary-600 hover:bg-primary-100 rounded"
            title="加载"
            @click="handleLoad(scheme.id)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <button
            class="p-1 text-red-500 hover:bg-red-100 rounded"
            title="删除"
            @click="handleDelete(scheme.id)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
