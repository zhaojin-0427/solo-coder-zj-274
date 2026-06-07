<script setup lang="ts">
import type { LayoutConflict, LayoutConflictSuggestion } from '../types'

defineProps<{
  conflicts: LayoutConflict[]
}>()

const emit = defineEmits<{
  (e: 'applySuggestion', suggestion: LayoutConflictSuggestion): void
}>()

function typeToIcon(type: LayoutConflict['type']): string {
  switch (type) {
    case 'pattern_too_wide': return '↔️'
    case 'pattern_too_tall': return '↕️'
    case 'margin_too_large': return '⬛'
    case 'gap_too_large': return '⇔'
    case 'no_patterns_fit': return '⚠️'
    default: return '⚠️'
  }
}
</script>

<template>
  <div v-if="conflicts.length > 0" class="p-4 border-b border-gray-200 bg-red-50">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-red-600">⚠️</span>
      <h3 class="text-sm font-semibold text-red-800">排版冲突 ({{ conflicts.length }})</h3>
    </div>

    <div class="space-y-3">
      <div
        v-for="(conflict, idx) in conflicts"
        :key="idx"
        class="bg-white rounded-lg p-3 border border-red-200"
      >
        <div class="flex items-start gap-2 mb-2">
          <span class="text-base">{{ typeToIcon(conflict.type) }}</span>
          <p class="text-xs text-red-700 flex-1">{{ conflict.message }}</p>
        </div>

        <div v-if="conflict.affectedPatternIds.length > 0" class="text-[10px] text-gray-500 mb-2">
          影响图案: {{ conflict.affectedPatternIds.length }} 个
        </div>

        <div v-if="conflict.suggestions.length > 0">
          <p class="text-[10px] text-gray-500 mb-1.5">建议操作：</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="(sug, sIdx) in conflict.suggestions"
              :key="sIdx"
              class="text-[10px] px-2 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded transition-colors border border-primary-200"
              @click="emit('applySuggestion', sug)"
            >
              ✓ {{ sug.description }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
