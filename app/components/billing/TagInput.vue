<script setup lang="ts">
// Chips for a product's internal tags. Enter or comma adds, Backspace on an empty
// input removes the last one. stc-billing lowercases and de-duplicates as well.
const model = defineModel<string[]>({ default: () => [] })
const props = defineProps<{ suggestions?: string[]; disabled?: boolean; inputId?: string }>()

const draft = ref('')
const listId = useId()

const unused = computed(() => (props.suggestions ?? []).filter(t => !model.value.includes(t)))

function add(raw: string) {
  const tags = raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  if (!tags.length) return
  model.value = [...new Set([...model.value, ...tags])].slice(0, 20)
  draft.value = ''
}

function remove(tag: string) {
  model.value = model.value.filter(t => t !== tag)
}

// A comma that arrives without a keydown (paste, autocomplete) also commits.
watch(draft, (v) => {
  if (!v.includes(',')) return
  const parts = v.split(',')
  const rest = parts.pop() ?? ''
  add(parts.join(','))
  draft.value = rest
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    add(draft.value)
  } else if (e.key === 'Backspace' && !draft.value && model.value.length) {
    model.value = model.value.slice(0, -1)
  }
}
</script>

<template>
  <div class="ti" :class="{ off: disabled }">
    <span v-for="t in model" :key="t" class="ti-chip">
      {{ t }}
      <button v-if="!disabled" type="button" class="ti-x" :aria-label="`Quitar ${t}`" @click="remove(t)">
        <UIcon name="i-lucide-x" class="w-3 h-3" />
      </button>
    </span>
    <input
      v-if="!disabled"
      :id="inputId"
      v-model="draft"
      class="ti-input"
      :list="listId"
      :placeholder="model.length ? '' : 'Escribe y pulsa Enter'"
      maxlength="40"
      @keydown="onKey"
      @blur="add(draft)"
    >
    <datalist :id="listId">
      <option v-for="t in unused" :key="t" :value="t" />
    </datalist>
    <span v-if="disabled && !model.length" class="ti-empty">Sin etiquetas</span>
  </div>
</template>

<style scoped>
.ti {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  min-height: 42px; padding: 6px 8px;
  background: var(--inset); border: 1px solid var(--line); border-radius: var(--r-sm);
  transition: .15s;
}
.ti:focus-within { border-color: var(--gold-ring); box-shadow: 0 0 0 3px var(--gold-wash); }
.ti.off { background: transparent; border-style: dashed; }
.ti-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 500; color: var(--gold-soft);
  background: var(--gold-wash); border: 1px solid var(--gold-ring); border-radius: 999px;
  padding: 2px 6px 2px 10px;
}
.ti.off .ti-chip { padding-right: 10px; }
.ti-x { display: grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; color: inherit; cursor: pointer; }
.ti-x:hover { background: var(--gold-ring); }
.ti-input {
  flex: 1; min-width: 120px; padding: 4px; border: none; outline: none; background: transparent;
  font-family: var(--ui); font-size: 13.5px; color: var(--text);
}
.ti-input::placeholder { color: var(--faint); }
.ti-empty { font-size: 12.5px; color: var(--faint); padding: 0 4px; }
</style>
