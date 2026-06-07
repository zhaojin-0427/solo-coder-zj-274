<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { UploadedPattern, NailSize, NailShape, LayoutSettings, PlacedPattern, MaterialEstimate, PatternTransform } from './types'
import { calculateLayout, calculateMaterialEstimate } from './utils/layout'
import { exportToPDF } from './utils/pdf'
import PatternUploader from './components/PatternUploader.vue'
import PatternList from './components/PatternList.vue'
import NailSelector from './components/NailSelector.vue'
import LayoutSettingsPanel from './components/LayoutSettings.vue'
import PatternEditor from './components/PatternEditor.vue'
import MaterialEstimatePanel from './components/MaterialEstimate.vue'
import SchemeManager from './components/SchemeManager.vue'
import PrintCanvas from './components/PrintCanvas.vue'

const patterns = ref<UploadedPattern[]>([])
const selectedPlacementIndex = ref<number | null>(null)
const previewMode = ref(false)
const isExporting = ref(false)

const layoutSettings = ref<LayoutSettings>({
  nailSize: 'M',
  nailShape: 'square',
  gapX: 2,
  gapY: 2,
  margin: 10,
  copiesPerNail: 5
})

const pageRefs = ref<Map<number, HTMLElement>>(new Map())

const placements = ref<PlacedPattern[]>([])

watch(
  [patterns, layoutSettings],
  () => {
    const newPlacements = calculateLayout(patterns.value, layoutSettings.value)
    if (placements.value.length > 0 && newPlacements.length > 0) {
      const minLen = Math.min(placements.value.length, newPlacements.length)
      for (let i = 0; i < minLen; i++) {
        newPlacements[i].transform = { ...placements.value[i].transform }
      }
    }
    placements.value = newPlacements
    if (selectedPlacementIndex.value !== null && selectedPlacementIndex.value >= placements.value.length) {
      selectedPlacementIndex.value = null
    }
  },
  { deep: true, immediate: true }
)

const estimate = computed<MaterialEstimate>(() => {
  return calculateMaterialEstimate(patterns.value, placements.value, layoutSettings.value)
})

const selectedTransform = computed<PatternTransform>(() => {
  if (selectedPlacementIndex.value === null) {
    return { rotation: 0, mirrorX: false, mirrorY: false, invertColor: false }
  }
  return placements.value[selectedPlacementIndex.value].transform
})

function handlePatternUpload(newPatterns: UploadedPattern[]) {
  patterns.value = [...patterns.value, ...newPatterns]
}

function handlePatternRemove(id: string) {
  patterns.value = patterns.value.filter(p => p.id !== id)
}

function handleClearPatterns() {
  patterns.value = []
  selectedPlacementIndex.value = null
}

function handlePlacementSelect(index: number | null) {
  selectedPlacementIndex.value = index
}

function handlePageRefsReady(refs: Map<number, HTMLElement>) {
  pageRefs.value = refs
}

function rotateSelected(delta: number) {
  if (selectedPlacementIndex.value === null) return
  const placement = placements.value[selectedPlacementIndex.value]
  placement.transform.rotation = (placement.transform.rotation + delta + 360) % 360
}

function toggleMirrorX() {
  if (selectedPlacementIndex.value === null) return
  placements.value[selectedPlacementIndex.value].transform.mirrorX =
    !placements.value[selectedPlacementIndex.value].transform.mirrorX
}

function toggleMirrorY() {
  if (selectedPlacementIndex.value === null) return
  placements.value[selectedPlacementIndex.value].transform.mirrorY =
    !placements.value[selectedPlacementIndex.value].transform.mirrorY
}

function toggleInvertColor() {
  if (selectedPlacementIndex.value === null) return
  placements.value[selectedPlacementIndex.value].transform.invertColor =
    !placements.value[selectedPlacementIndex.value].transform.invertColor
}

function resetTransform() {
  if (selectedPlacementIndex.value === null) return
  placements.value[selectedPlacementIndex.value].transform = {
    rotation: 0,
    mirrorX: false,
    mirrorY: false,
    invertColor: false
  }
}

function handleLoadScheme(loadedPatterns: UploadedPattern[], settings: LayoutSettings) {
  patterns.value = loadedPatterns
  layoutSettings.value = settings
}

async function handleExportPDF() {
  if (placements.value.length === 0) {
    alert('请先上传图案进行排版')
    return
  }
  isExporting.value = true
  try {
    await nextTick()
    await exportToPDF(pageRefs.value)
  } catch (e) {
    console.error('导出PDF失败:', e)
    alert('导出PDF失败，请重试')
  } finally {
    isExporting.value = false
  }
}

function handlePrint() {
  window.print()
}
</script>

<template>
  <div class="h-full flex flex-col bg-gray-100">
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold text-gray-800">美甲贴纸排版预览器</h1>
          <p class="text-xs text-gray-500">智能排版 · 高效打印 · 节约耗材</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            v-model="previewMode"
            class="w-4 h-4 accent-primary-500"
          />
          预览模式
        </label>
        <button
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          @click="handlePrint"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          打印
        </button>
        <button
          class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isExporting || placements.length === 0"
          @click="handleExportPDF"
        >
          <svg v-if="!isExporting" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isExporting ? '导出中...' : '导出 PDF' }}
        </button>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <aside class="w-80 bg-white border-r border-gray-200 overflow-y-auto scrollbar-thin flex-shrink-0">
        <PatternUploader @upload="handlePatternUpload" />
        <PatternList
          :patterns="patterns"
          @remove="handlePatternRemove"
          @clear="handleClearPatterns"
        />
        <NailSelector
          :selected-size="layoutSettings.nailSize"
          :selected-shape="layoutSettings.nailShape"
          @update:selected-size="(s: NailSize) => layoutSettings.nailSize = s"
          @update:selected-shape="(s: NailShape) => layoutSettings.nailShape = s"
        />
        <LayoutSettingsPanel
          :settings="layoutSettings"
          @update:settings="(s: LayoutSettings) => layoutSettings = s"
        />
        <PatternEditor
          :transform="selectedTransform"
          :has-selection="selectedPlacementIndex !== null"
          @rotate="rotateSelected"
          @mirror-x="toggleMirrorX"
          @mirror-y="toggleMirrorY"
          @invert-color="toggleInvertColor"
          @reset="resetTransform"
        />
        <MaterialEstimatePanel :estimate="estimate" />
        <SchemeManager
          :current-patterns="patterns"
          :current-settings="layoutSettings"
          @load="handleLoadScheme"
        />
      </aside>

      <main class="flex-1 overflow-auto bg-gray-100 scrollbar-thin">
        <PrintCanvas
          :placements="placements"
          :patterns="patterns"
          :selected-placement-index="selectedPlacementIndex"
          :shape="layoutSettings.nailShape"
          :preview-mode="previewMode"
          @select="handlePlacementSelect"
          @page-refs-ready="handlePageRefsReady"
        />
      </main>
    </div>
  </div>
</template>
