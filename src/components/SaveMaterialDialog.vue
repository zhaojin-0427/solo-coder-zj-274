<script setup lang="ts">
import { ref, watch } from 'vue'
import type { UploadedPattern, PatternIndependentConfig, NailSize, NailShape } from '../types'
import { nailSizes, nailShapes } from '../data/nailConfig'
import { createMaterial, getAllTags } from '../utils/materialLibrary'

const props = defineProps<{
  visible: boolean
  pattern: UploadedPattern | null
  defaultConfig?: PatternIndependentConfig | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const name = ref('')
const tagsInput = ref('')
const defaultNailSize = ref<NailSize>('M')
const defaultNailShape = ref<NailShape>('square')
const defaultQuantity = ref(5)
const existingTags = ref<string[]>([])
const showTagSuggestions = ref(false)

watch(
  () => props.visible,
  (v) => {
    if (v && props.pattern) {
      name.value = props.pattern.name.replace(/\.[^/.]+$/, '')
      defaultNailSize.value = props.defaultConfig?.nailSize || 'M'
      defaultNailShape.value = props.defaultConfig?.nailShape || 'square'
      defaultQuantity.value = props.defaultConfig?.quantity || 5
      tagsInput.value = ''
      existingTags.value = getAllTags()
    }
  }
)

const suggestedTags = ref<string[]>([])

watch(
  tagsInput,
  (v) => {
    const parts = v.split(/[,，]/)
    const lastPart = parts[parts.length - 1].trim().toLowerCase()
    if (lastPart.length > 0) {
      suggestedTags.value = existingTags.value.filter(
        t => t.toLowerCase().includes(lastPart) && !parts.slice(0, -1).map(p => p.trim()).includes(t)
      ).slice(0, 6)
      showTagSuggestions.value = suggestedTags.value.length > 0
    } else {
      showTagSuggestions.value = false
    }
  }
)

function selectSuggestion(tag: string) {
  const parts = tagsInput.value.split(/[,，]/)
  parts[parts.length - 1] = tag
  tagsInput.value = parts.join(', ') + ', '
  showTagSuggestions.value = false
}

function handleSave() {
  if (!props.pattern) return
  if (!name.value.trim()) {
    alert('请输入素材名称')
    return
  }
  const tags = tagsInput.value
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean)

  createMaterial({
    name: name.value.trim(),
    tags,
    dataUrl: props.pattern.dataUrl,
    width: props.pattern.width,
    height: props.pattern.height,
    defaultNailSize: defaultNailSize.value,
    defaultNailShape: defaultNailShape.value,
    defaultQuantity: Math.max(1, Math.min(50, defaultQuantity.value))
  })

  emit('saved')
  emit('close')
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="handleClose"
    >
      <div class="bg-white rounded-xl shadow-2xl w-96 max-w-[90vw] overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-800">保存到素材库</h3>
          <button
            class="text-gray-400 hover:text-gray-600 transition-colors"
            @click="handleClose"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div v-if="pattern" class="p-5 space-y-4">
          <div class="flex gap-3 items-start">
            <div class="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
              <img :src="pattern.dataUrl" :alt="pattern.name" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-500 truncate">原始文件名: {{ pattern.name }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ pattern.width }} × {{ pattern.height }} px</p>
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-medium text-gray-700 mb-1">素材名称 *</label>
            <input
              v-model="name"
              type="text"
              placeholder="给素材起个名字"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
            />
          </div>

          <div class="relative">
            <label class="block text-[11px] font-medium text-gray-700 mb-1">标签（逗号分隔）</label>
            <input
              v-model="tagsInput"
              type="text"
              placeholder="花朵, 简约, 日系"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
              @blur="setTimeout(() => showTagSuggestions = false, 150)"
              @focus="showTagSuggestions = suggestedTags.length > 0"
            />
            <div
              v-if="showTagSuggestions && suggestedTags.length > 0"
              class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10"
            >
              <button
                v-for="tag in suggestedTags"
                :key="tag"
                class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-primary-50 hover:text-primary-700"
                @mousedown.prevent="selectSuggestion(tag)"
              >{{ tag }}</button>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-[11px] font-medium text-gray-700 mb-1">默认型号</label>
              <select
                v-model="defaultNailSize"
                class="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
              >
                <option v-for="(cfg, sz) in nailSizes" :key="sz" :value="sz">{{ cfg.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-gray-700 mb-1">默认形状</label>
              <select
                v-model="defaultNailShape"
                class="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
              >
                <option v-for="(cfg, sh) in nailShapes" :key="sh" :value="sh">{{ cfg.icon }} {{ cfg.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-gray-700 mb-1">默认数量</label>
              <input
                v-model.number="defaultQuantity"
                type="number"
                min="1"
                max="50"
                class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>
        </div>

        <div class="px-5 py-3 bg-gray-50 border-t border-gray-200 flex gap-2 justify-end">
          <button
            class="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            @click="handleClose"
          >取消</button>
          <button
            class="px-4 py-2 text-sm text-white bg-primary-500 hover:bg-primary-600 rounded-lg font-medium transition-colors"
            @click="handleSave"
          >保存</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
