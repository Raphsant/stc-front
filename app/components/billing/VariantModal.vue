<script setup lang="ts">
// "Añadir variante": a new price for a product. Amounts are typed in dollars and
// sent as integer cents. The savings line is a preview; stc-billing computes the
// tag customers see.
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ product: any }>()
const emit = defineEmits<{ saved: [result: any] }>()
const toast = useToast()

const PRESETS = [
  { key: 'm1', label: '1 mes', interval: 'month', count: 1 },
  { key: 'm3', label: '3 meses', interval: 'month', count: 3 },
  { key: 'm6', label: '6 meses', interval: 'month', count: 6 },
  { key: 'y1', label: '1 año', interval: 'year', count: 1 },
] as const

const recurring = computed(() => props.product?.kind === 'recurring')

const preset = ref<string>('m1')
const customInterval = ref<'month' | 'year'>('month')
const customCount = ref(2)
const amountText = ref('')
const nickname = ref('')
const lifetime = ref(true)
const days = ref(30)
const publishNow = ref(false)
const saving = ref(false)

watch(open, (v) => {
  if (!v) return
  // Suggest the first duration the product does not have yet.
  const have = new Set(live.value.map(p => `${p.interval}:${p.intervalCount}`))
  preset.value = PRESETS.find(p => !have.has(`${p.interval}:${p.count}`))?.key ?? 'custom'
  amountText.value = ''
  nickname.value = ''
  lifetime.value = true
  days.value = 30
  publishNow.value = false
})

const interval = computed(() => {
  const p = PRESETS.find(x => x.key === preset.value)
  return p ? { interval: p.interval, count: p.count } : { interval: customInterval.value, count: Number(customCount.value) || 1 }
})

const amount = computed(() => parseMoneyInput(amountText.value))

/** Variants that can still be sold: what the savings base is chosen from. */
const live = computed<any[]>(() => (props.product?.prices ?? []).filter((p: any) => !p.retiredAt))

const base = computed(() => {
  const withMonths = live.value
    .filter(p => p.currency === 'USD')
    .map(p => ({ p, months: variantMonths(p) }))
    .filter((x): x is { p: any; months: number } => x.months !== null)
  const pool = withMonths.some(x => x.p.active) ? withMonths.filter(x => x.p.active) : withMonths
  const best = pool.sort((a, b) => a.months - b.months || a.p.amount - b.p.amount)[0]
  return best ? { amount: best.p.amount, months: best.months, label: variantLabel(best.p) } : null
})

const months = computed(() => variantMonths({ kind: 'recurring', interval: interval.value.interval, intervalCount: interval.value.count }))
const savings = computed(() => recurring.value ? previewSavings(base.value, amount.value, months.value) : null)
const perMonth = computed(() => (amount.value && months.value && months.value > 1 ? Math.round(amount.value / months.value) : null))

const duplicate = computed(() =>
  recurring.value
    ? live.value.find(p => p.interval === interval.value.interval && p.intervalCount === interval.value.count)
    : null,
)

const problem = computed(() => {
  if (!amount.value) return 'Escribe el monto en dólares, por ejemplo 237.60.'
  if (recurring.value && (interval.value.count < 1 || interval.value.count > 36)) return 'La duración va de 1 a 36.'
  if (!recurring.value && !lifetime.value && !(days.value >= 1 && days.value <= 3650)) return 'Los días de acceso van de 1 a 3650.'
  return null
})

async function save() {
  if (problem.value || saving.value) return
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      amount: amount.value,
      currency: 'USD',
      nickname: nickname.value.trim() || null,
      active: publishNow.value,
    }
    if (recurring.value) {
      body.interval = interval.value.interval
      body.intervalCount = interval.value.count
    } else {
      body.accessDurationDays = lifetime.value ? null : Number(days.value)
    }
    const result = await $fetch<any>(`/api/billing/products/${props.product.id}/variants`, { method: 'POST', body })
    const issue = syncProblems(result.sync)
    toast.add(issue
      ? { title: 'Variante guardada, pero no se sincronizó', description: issue, color: 'warning' }
      : { title: 'Variante creada', description: publishNow.value ? 'Ya está a la venta.' : 'Quedó como borrador.', color: 'success' })
    emit('saved', result)
    open.value = false
  } catch (e: any) {
    toast.add({ title: 'No se pudo crear la variante', description: e?.data?.message || e?.statusMessage || e?.message || '', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :dismissible="!saving">
    <template #content>
      <form class="vm" @submit.prevent="save">
        <div class="vm-head">
          <span class="vm-glyph"><UIcon name="i-lucide-plus" class="w-5 h-5" /></span>
          <h3 class="vm-title">Añadir variante</h3>
        </div>

        <template v-if="recurring">
          <span class="vm-label">Duración</span>
          <div class="vm-presets">
            <button
              v-for="p in PRESETS" :key="p.key" type="button"
              class="vm-preset" :class="{ on: preset === p.key }" @click="preset = p.key"
            >
              {{ p.label }}
            </button>
            <button type="button" class="vm-preset" :class="{ on: preset === 'custom' }" @click="preset = 'custom'">Otra</button>
          </div>
          <div v-if="preset === 'custom'" class="vm-custom">
            <span>Cada</span>
            <input v-model.number="customCount" type="number" min="1" max="36" class="stc-input vm-num" aria-label="Cantidad">
            <select v-model="customInterval" class="stc-input vm-sel" aria-label="Unidad">
              <option value="month">meses</option>
              <option value="year">años</option>
            </select>
          </div>
          <p v-if="duplicate" class="vm-warn">
            <UIcon name="i-lucide-triangle-alert" class="w-4 h-4" />
            Ya existe la variante «{{ variantLabel(duplicate) }}». Para cambiarle el precio usa «Cambiar precio» en su fila.
          </p>
        </template>

        <template v-else>
          <span class="vm-label">Acceso que da la compra</span>
          <label class="vm-check"><input v-model="lifetime" type="radio" :value="true"> Para siempre</label>
          <label class="vm-check">
            <input v-model="lifetime" type="radio" :value="false"> Por
            <input v-model.number="days" type="number" min="1" max="3650" class="stc-input vm-num" :disabled="lifetime" aria-label="Días"> días
          </label>
        </template>

        <label class="vm-field">
          <span class="vm-label">Monto (USD)</span>
          <div class="vm-amount">
            <span>$</span>
            <input v-model="amountText" class="stc-input stc-mono" inputmode="decimal" placeholder="237.60" autofocus>
          </div>
          <span v-if="recurring" class="vm-preview">
            <template v-if="amount && perMonth">Equivale a {{ formatMoney(perMonth, 'USD') }} al mes. </template>
            <template v-if="savings">
              <span class="stc-badge solid">Ahorra {{ savings }}%</span>
              comparado con {{ base?.label }} ({{ formatMoney(base!.amount, 'USD') }}).
            </template>
            <template v-else-if="amount && base && months && months > base.months">Sin ahorro frente a {{ base.label }}: no lleva etiqueta.</template>
          </span>
        </label>

        <label class="vm-field">
          <span class="vm-label">Nombre visible <small>opcional; si no, «{{ recurring ? variantLabel({ kind: 'recurring', interval: interval.interval, intervalCount: interval.count }) : (lifetime ? 'De por vida' : `${days} días`) }}»</small></span>
          <input v-model="nickname" class="stc-input" maxlength="80">
        </label>

        <label class="vm-check">
          <input v-model="publishNow" type="checkbox">
          Ponerla a la venta ahora <small>(si no, queda como borrador)</small>
        </label>

        <p class="vm-note">El monto y la duración no se pueden editar después: Stripe no lo permite. Para cambiar el precio se crea uno nuevo.</p>
        <p v-if="problem && amountText" class="vm-err">{{ problem }}</p>

        <div class="vm-foot">
          <button type="button" class="stc-btn" :disabled="saving" @click="open = false">Cancelar</button>
          <button type="submit" class="stc-btn gold" :disabled="saving || !!problem">
            {{ saving ? 'Guardando…' : 'Crear variante' }}
          </button>
        </div>
      </form>
    </template>
  </UModal>
</template>

<style scoped>
.vm { padding: 24px; display: flex; flex-direction: column; gap: 14px; }
.vm-head { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.vm-glyph {
  width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center;
  color: var(--gold); background: var(--gold-wash); border: 1px solid var(--gold-ring);
}
.vm-title { font-family: var(--disp); font-size: 23px; font-weight: 700; letter-spacing: .015em; text-transform: uppercase; color: var(--text); }
.vm-label { font-size: 12px; font-weight: 600; color: var(--text); }
.vm-label small { font-weight: 400; color: var(--faint); margin-left: 4px; }
.vm-field { display: flex; flex-direction: column; gap: 7px; }
.vm-presets { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-top: -6px; }
@media (max-width: 480px) { .vm-presets { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.vm-preset {
  padding: 9px 6px; font-size: 13px; font-weight: 500; color: var(--dim); cursor: pointer;
  border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--inset);
}
.vm-preset:hover { color: var(--text); border-color: var(--line-2); }
.vm-preset.on { color: var(--text); border-color: var(--gold-ring); background: var(--gold-wash); }
.vm-custom { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--dim); }
.vm-num { width: 84px; }
.vm-sel { width: 120px; }
.vm-amount { display: flex; align-items: center; gap: 8px; font-family: var(--disp); font-size: 20px; color: var(--gold); }
.vm-amount .stc-input { font-size: 16px; max-width: 200px; }
.vm-preview { font-size: 12.5px; color: var(--dim); min-height: 1.4em; line-height: 1.7; }
.vm-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); cursor: pointer; }
.vm-check small { color: var(--faint); }
.vm-check input[type=checkbox], .vm-check input[type=radio] { width: 15px; height: 15px; accent-color: var(--gold); }
.vm-warn {
  display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; line-height: 1.5;
  color: var(--gold-soft); background: var(--gold-wash); border: 1px solid var(--gold-ring); border-radius: var(--r-sm); padding: 9px 11px;
}
.vm-warn .iconify { flex-shrink: 0; margin-top: 2px; }
.vm-note { font-size: 12px; color: var(--faint); line-height: 1.5; }
.vm-err { font-size: 12.5px; color: var(--red); }
.vm-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
</style>
