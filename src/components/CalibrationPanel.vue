<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { PrintCalibration } from '../types'
import { updateCalibrationFromMeasurements } from '../utils/calibration'

const props = defineProps<{
  calibration: PrintCalibration
}>()

const emit = defineEmits<{
  (e: 'update', value: PrintCalibration): void
  (e: 'exportRuler'): void
}>()

const showPanel = ref(false)
const refLength = ref(props.calibration.referenceLengthMm)
const measuredH = ref(props.calibration.measuredHorizontalMm)
const measuredV = ref(props.calibration.measuredVerticalMm)

watch(
  () => props.calibration,
  (c) => {
    refLength.value = c.referenceLengthMm
    measuredH.value = c.measuredHorizontalMm
    measuredV.value = c.measuredVerticalMm
  },
  { deep: true }
)

const scaleSummary = computed(() => {
  const sx = props.calibration.scaleX
  const sy = props.calibration.scaleY
  const px = ((sx - 1) * 100).toFixed(2)
  const py = ((sy - 1) * 100).toFixed(2)
  return {
    xText: sx === 1 ? '无缩放' : `${sx > 1 ? '+' : ''}${px}%`,
    yText: sy === 1 ? '无缩放' : `${sy > 1 ? '+' : ''}${py}%`
  }
})

function toggleEnabled() {
  emit('update', {
    ...props.calibration,
    enabled: !props.calibration.enabled
  })
}

function applyMeasurements() {
  const next = updateCalibrationFromMeasurements(
    props.calibration,
    refLength.value,
    measuredH.value,
    measuredV.value
  )
  emit('update', next)
}

function resetCalibration() {
  emit('update', {
    enabled: props.calibration.enabled,
    referenceLengthMm: 100,
    measuredHorizontalMm: 100,
    measuredVerticalMm: 100,
    scaleX: 1,
    scaleY: 1
  })
}
</script>

<template>
  <div class="p-4 border-b border-gray-200">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-800">打印校准</h3>
      <button
        class="text-xs text-primary-600 hover:text-primary-700"
        @click="showPanel = !showPanel"
      >
        {{ showPanel ? '收起' : '展开' }}
      </button>
    </div>

    <div class="flex items-center justify-between mb-2">
      <span class="text-xs text-gray-600">启用校准</span>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          :checked="calibration.enabled"
          class="sr-only peer"
          @change="toggleEnabled"
        />
        <div class="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-primary-500 transition-colors"></div>
        <div class="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
      </label>
    </div>

    <div v-if="calibration.enabled" class="text-[10px] text-gray-500 mb-2 space-y-0.5">
      <div>横向缩放: {{ scaleSummary.xText }} (系数 {{ calibration.scaleX.toFixed(4) }})</div>
      <div>纵向缩放: {{ scaleSummary.yText }} (系数 {{ calibration.scaleY.toFixed(4) }})</div>
    </div>

    <div v-if="showPanel" class="space-y-3 mt-3 pt-3 border-t border-gray-100">
      <button
        class="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
        @click="emit('exportRuler')"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        导出校准尺 PDF
      </button>

      <p class="text-[10px] text-gray-500 leading-relaxed">
        1. 点击上方按钮导出校准尺并以 100% 实际尺寸打印<br/>
        2. 测量打印出的横线与竖线实际毫米数<br/>
        3. 将实测值填入下方并点击"应用校准"
      </p>

      <div>
        <label class="flex items-center justify-between mb-1">
          <span class="text-xs text-gray-600">参考长度 (mm)</span>
          <span class="text-xs text-primary-600">{{ refLength }}mm</span>
        </label>
        <input
          type="number"
          min="10"
          max="300"
          step="1"
          :value="refLength"
          @input="refLength = Number(($event.target as HTMLInputElement).value)"
          class="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-primary-400"
        />
      </div>

      <div>
        <label class="flex items-center justify-between mb-1">
          <span class="text-xs text-gray-600">实测横向长度 (mm)</span>
          <span class="text-xs text-primary-600">{{ measuredH }}mm</span>
        </label>
        <input
          type="number"
          min="1"
          max="500"
          step="0.1"
          :value="measuredH"
          @input="measuredH = Number(($event.target as HTMLInputElement).value)"
          class="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-primary-400"
        />
      </div>

      <div>
        <label class="flex items-center justify-between mb-1">
          <span class="text-xs text-gray-600">实测纵向长度 (mm)</span>
          <span class="text-xs text-primary-600">{{ measuredV }}mm</span>
        </label>
        <input
          type="number"
          min="1"
          max="500"
          step="0.1"
          :value="measuredV"
          @input="measuredV = Number(($event.target as HTMLInputElement).value)"
          class="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-primary-400"
        />
      </div>

      <div class="flex gap-2">
        <button
          class="flex-1 py-1.5 px-3 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-xs transition-colors"
          @click="applyMeasurements"
        >
          应用校准
        </button>
        <button
          class="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-xs transition-colors"
          @click="resetCalibration"
        >
          重置
        </button>
      </div>
    </div>
  </div>
</template>
