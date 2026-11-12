<script setup lang="ts">
export interface BreakdownItem {
  key: string
  label: string
  count: number
  active?: boolean
  tone?: 'gold' | 'green' | 'red' | 'blue' | 'neutral'
}

const props = withDefaults(defineProps<{
  title: string
  icon: string
  items: BreakdownItem[]
  total: number
  clickable?: boolean
  hint?: string
  limit?: number
}>(), { clickable: false, limit: 6 })
defineEmits<{ select: [key: string] }>()

const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.items : props.items.slice(0, props.limit)))
const pct = (n: number) => (props.total ? Math.round((n / props.total) * 100) : 0)
</script>

<template>
  <section class="stc-panel r-bd">
    <header class="r-bd-head">
      <h3 class="r-bd-title"><UIcon :name="icon" class="w-4 h-4" />{{ title }}</h3>
      <span v-if="hint" class="r-bd-hint">{{ hint }}</span>
    </header>

    <p v-if="!items.length" class="r-bd-empty">Sin datos</p>

    <ul v-else class="r-bd-list">
      <li v-for="it in shown" :key="it.key">
        <component
          :is="clickable ? 'button' : 'div'"
          :type="clickable ? 'button' : undefined"
          class="r-bd-row" :class="{ clickable, on: it.active }"
          :aria-pressed="clickable ? !!it.active : undefined"
          @click="clickable && $emit('select', it.key)"
        >
          <span class="r-bd-label">{{ it.label }}</span>
          <span class="r-bd-num stc-mono"><b>{{ it.count.toLocaleString('es-ES') }}</b> · {{ pct(it.count) }}%</span>
          <span class="r-bd-bar" :class="it.tone ?? 'gold'"><i :style="{ width: `${Math.max(pct(it.count), it.count ? 2 : 0)}%` }" /></span>
        </component>
      </li>
    </ul>

    <button v-if="items.length > limit" type="button" class="r-bd-more" @click="expanded = !expanded">
      {{ expanded ? 'Ver menos' : `Ver ${items.length - limit} más` }}
    </button>
  </section>
</template>
