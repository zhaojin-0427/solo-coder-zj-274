<script setup lang="ts">
import { ref } from 'vue'
import type { UploadedPattern } from '../types'
import { loadImageFromFile } from '../utils/image'

const emit = defineEmits<{
  (e: 'upload', patterns: UploadedPattern[]): void
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function handleFiles(files: FileList | null) {
  if (!files) return
  const patterns: UploadedPattern[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.type.startsWith('image/')) {
      try {
        const pattern = await loadImageFromFile(file)
        patterns.push(pattern)
      } catch (e) {
          console.error('加载图片失败:', file.name)
        }
    }
  }
  if (patterns.length > 0) {
    emit('upload', patterns)
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  handleFiles(e.dataTransfer?.files || null)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}
</script>

<template>
  <div class="p-4 border-b border-gray-200">
    <h3 class="text-sm font-semibold text-gray-800 mb-3">图案上传</h3>
    <div
      class="relative"
      @drop="onDrop"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @click="triggerFileInput"
      :class="[
        'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all',
        isDragging
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
      ]"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="(e) => handleFiles((e.target as HTMLInputElement).files)"
      />
      <div class="flex flex-col items-center gap-2">
        <svg class="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div class="text-sm text-gray-600">
          点击或拖拽上传图案</div>
        <div class="text-xs text-gray-400">支持 PNG, JPG, GIF 等图片格式</div>
      </div>
    </div>
  </div>
</template>
