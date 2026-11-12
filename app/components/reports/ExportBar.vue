<script setup lang="ts">
import type { ExportFormat } from '~/composables/useReportExport'

defineProps<{ total: number; busy: ExportFormat | null }>()
defineEmits<{ export: [format: ExportFormat] }>()

const formats: { id: ExportFormat; label: string; icon: string }[] = [
  { id: 'pdf', label: 'PDF', icon: 'i-lucide-file-text' },
  { id: 'xlsx', label: 'Excel', icon: 'i-lucide-file-spreadsheet' },
  { id: 'csv', label: 'CSV', icon: 'i-lucide-table' },
]
</script>

<template>
  <div class="r-export" role="group" aria-label="Exportar reporte">
    <div class="r-export-info">
      <span class="stc-eyebrow">Exportar</span>
      <span class="r-export-n stc-mono"><b>{{ total.toLocaleString('es-ES') }}</b> {{ total === 1 ? 'usuario' : 'usuarios' }}</span>
    </div>
    <div class="r-export-btns">
      <button
        v-for="(fmt, i) in formats" :key="fmt.id" type="button" class="stc-btn" :class="{ gold: i === 0 }"
        :disabled="!total || !!busy" :aria-label="`Exportar a ${fmt.label}`" @click="$emit('export', fmt.id)"
      >
        <UIcon :name="busy === fmt.id ? 'i-lucide-loader-circle' : fmt.icon" class="w-4 h-4" :class="{ 'animate-spin': busy === fmt.id }" />
        {{ fmt.label }}
      </button>
    </div>
  </div>
</template>
