<script setup lang="ts">
// Signups by where the buyer first came from. Counts only: every role with metrics:counts sees all of it.
const props = defineProps<{ canExport: boolean }>()

const presets = rangePresets()
const presetKey = ref('30d')
const preset = computed(() => presets.find((p) => p.key === presetKey.value) ?? presets[0]!)
const groupBy = ref('source')
const query = computed(() => ({ from: preset.value.from, to: preset.value.to, groupBy: groupBy.value }))

const { data, pending, error, refresh } = useFetch<any>('/api/billing/metrics/signups', { query })
defineExpose({ refresh })

const d = computed(() => data.value?.data)
const loading = computed(() => pending.value && !data.value)
/** One row per source: its signups, and the accounts created under it. */
const rows = computed(() => {
  const keys = new Set<string>([...(d.value?.groups ?? []).map((g: any) => g.key), ...(d.value?.accounts?.groups ?? []).map((g: any) => g.key)])
  return [...keys].map((key) => ({
    key,
    signup: (d.value?.groups ?? []).find((g: any) => g.key === key),
    account: (d.value?.accounts?.groups ?? []).find((g: any) => g.key === key),
  }))
})
const exportHref = computed(() => `/api/billing/metrics/export?report=signups&from=${preset.value.from}&to=${preset.value.to}&groupBy=${groupBy.value}`)
</script>

<template>
  <div class="bm-filters">
    <div class="stc-seg">
      <button v-for="p in presets" :key="p.key" :class="{ on: presetKey === p.key }" @click="presetKey = p.key">{{ p.label }}</button>
    </div>
    <a v-if="props.canExport" class="stc-btn sm" :href="exportHref" download><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /> CSV</a>
  </div>

  <BillingMetricsNotice v-if="error" :error="error" what="las altas" />
  <template v-else>
    <div class="bm-tiles">
      <BillingMetricsTile label="Altas" icon="i-lucide-user-plus" gold :loading="loading" :value="formatCount(d?.signups)" note="Primera compra pagada de cada cliente" />
      <BillingMetricsTile label="Cuentas creadas" icon="i-lucide-user-round" :loading="loading" :value="formatCount(d?.accounts?.created)" note="Registradas en el periodo" />
      <BillingMetricsTile label="De cuenta a pago" icon="i-lucide-funnel" :loading="loading" :value="formatRate(d?.accounts?.conversionRate)" :note="`${formatCount(d?.accounts?.paid)} de esas cuentas ya pagaron`" />
    </div>

    <section class="stc-panel" style="overflow:hidden">
      <div class="stc-panel-head">
        <div class="stc-panel-title"><UIcon name="i-lucide-megaphone" class="w-[18px] h-[18px]" /> Por</div>
        <div class="stc-seg">
          <button v-for="g in SIGNUP_GROUP" :key="g.key" :class="{ on: groupBy === g.key }" @click="groupBy = g.key">{{ g.label }}</button>
        </div>
      </div>
      <div v-if="loading" class="bm-pad"><USkeleton class="h-4 w-full" /><USkeleton class="h-4 w-3/5 mt-3" /></div>
      <div v-else-if="!rows.length" class="stc-empty" style="padding:40px 20px"><UIcon name="i-lucide-user-plus" /><p>Sin altas ni cuentas nuevas en este periodo.</p></div>
      <div v-else class="bm-scroll">
        <table class="bm-table" :class="{ dim: pending }">
          <thead>
            <tr><th>{{ SIGNUP_GROUP.find((g) => g.key === groupBy)?.label }}</th><th class="num">Altas</th><th class="num">Suscripciones</th><th class="num">Pago único</th><th class="num">Cuentas creadas</th><th class="num">Pagaron</th><th class="num">Conversión</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.key">
              <td>{{ sourceLabel(r.key) }}</td>
              <td class="num stc-mono">{{ formatCount(r.signup?.signups ?? 0) }}</td>
              <td class="num stc-mono">{{ formatCount(r.signup?.subscriptions ?? 0) }}</td>
              <td class="num stc-mono">{{ formatCount(r.signup?.oneTime ?? 0) }}</td>
              <td class="num stc-mono">{{ formatCount(r.account?.created ?? 0) }}</td>
              <td class="num stc-mono">{{ formatCount(r.account?.paid ?? 0) }}</td>
              <td class="num stc-mono">{{ formatRate(r.account?.conversionRate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="bm-foot">
      {{ asOfLabel(data?.as_of) }}. La fuente es el primer contacto (30 días): un afiliado, si lo hay; si no la UTM; si no el sitio que lo envió; si no, directo.
      Los miembros importados de Payments AI no son altas.
    </p>
  </template>
</template>
