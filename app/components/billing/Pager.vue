<script setup lang="ts">
// Prev/next pager for offset lists whose API returns no total count.
defineProps<{ page: number; hasNext: boolean; disabled?: boolean }>()
defineEmits<{ (e: 'update:page', v: number): void }>()
</script>

<template>
  <div v-if="page > 1 || hasNext" class="bp">
    <button class="bp-btn" :disabled="disabled || page === 1" title="Primera página" @click="$emit('update:page', 1)">
      <UIcon name="i-lucide-chevrons-left" class="w-[15px] h-[15px]" />
    </button>
    <button class="bp-btn" :disabled="disabled || page === 1" title="Anterior" @click="$emit('update:page', page - 1)">
      <UIcon name="i-lucide-chevron-left" class="w-[15px] h-[15px]" />
    </button>
    <span class="bp-cur stc-mono">Página {{ page }}</span>
    <button class="bp-btn" :disabled="disabled || !hasNext" title="Siguiente" @click="$emit('update:page', page + 1)">
      <UIcon name="i-lucide-chevron-right" class="w-[15px] h-[15px]" />
    </button>
  </div>
</template>

<style scoped>
.bp {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 18px 22px;
  border-top: 1px solid var(--line);
}
.bp-btn {
  min-width: 34px; height: 34px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  color: var(--dim);
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  transition: .14s;
}
.bp-btn:hover:not(:disabled) { color: var(--text); border-color: var(--line-2); background: rgba(255,255,255,.03); }
html:not(.dark) .bp-btn:hover:not(:disabled) { background: rgba(0,0,0,.03); }
.bp-btn:disabled { opacity: .35; cursor: not-allowed; }
.bp-cur { font-size: 12.5px; color: var(--dim); padding: 0 8px; }
</style>
