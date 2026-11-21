<script setup lang="ts">
// Gross and net revenue for a range of Chicago days. Dollars only.
const props = defineProps<{ canExport: boolean }>()

const presets = rangePresets()
const presetKey = ref('month')
const preset = computed(() => presets.find((p) => p.key === presetKey.value) ?? presets[0]!)
const GROUPS = [
  { key: 'kind', label: 'Tipo de pago' },
  { key: 'product', label: 'Producto' },
  { key: 'provider', label: 'Proveedor' },
]
const groupBy = ref('kind')
const query = computed(() => ({ from: preset.value.from, to: preset.value.to, groupBy: groupBy.value }))

const { data, pending, error, refresh } = useFetch<any>('/api/billing/metrics/revenue', { query })
defineExpose({ refresh })

const d = computed(() => data.value?.data)
const loading = computed(() => pending.value && !data.value)
const groupLabel = (g: any) => (groupBy.value === 'kind' ? REVENUE_KIND[g.key] ?? g.key : groupBy.value === 'provider' ? PROVIDER_LABEL[g.key] ?? g.key : g.label)
const share = (g: any) => (d.value?.gross ? Math.round((g.gross / d.value.gross) * 100) : 0)
const exportHref = computed(() => `/api/billing/metrics/export?report=revenue&from=${preset.value.from}&to=${preset.value.to}&groupBy=${groupBy.value}`)
</script>

<template>
  <div class="bm-filters">
    <div class="stc-seg">
      <button v-for="p in presets" :key="p.key" :class="{ on: presetKey === p.key }" @click="presetKey = p.key">{{ p.label }}</button>
    </div>
    <a v-if="props.canExport" class="stc-btn sm" :href="exportHref" download><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /> CSV</a>
  </div>

  <BillingMetricsNotice v-if="error" :error="error" what="los ingresos" />
  <template v-else>
    <div class="bm-tiles">
      <BillingMetricsTile label="Bruto" icon="i-lucide-banknote" :loading="loading" :value="formatUsd(d?.gross)" :note="countOf(d?.payments, 'pago cobrado', 'pagos cobrados')" />
      <BillingMetricsTile label="Reembolsos" icon="i-lucide-undo-2" :loading="loading" :value="formatUsdSigned(d ? -d.refunds : null)" :note="countOf(d?.refundCount, 'reembolso', 'reembolsos')" />
      <BillingMetricsTile label="Contracargos" icon="i-lucide-shield-alert" :loading="loading" :value="formatUsdSigned(d ? -d.chargebacks : null)" :note="countOf(d?.chargebackCount, 'disputa perdida', 'disputas perdidas')" :tone="d?.chargebacks ? 'red' : undefined" />
      <BillingMetricsTile label="Neto" icon="i-lucide-wallet" gold :loading="loading" :value="formatUsd(d?.net)" note="Bruto − reembolsos − contracargos" />
    </div>

    <section class="stc-panel" style="overflow:hidden">
      <div class="stc-panel-head">
        <div class="stc-panel-title"><UIcon name="i-lucide-pie-chart" class="w-[18px] h-[18px]" /> Bruto por</div>
        <div class="stc-seg">
          <button v-for="g in GROUPS" :key="g.key" :class="{ on: groupBy === g.key }" @click="groupBy = g.key">{{ g.label }}</button>
        </div>
      </div>
      <div v-if="loading" class="bm-pad"><USkeleton class="h-4 w-full" /><USkeleton class="h-4 w-3/5 mt-3" /></div>
      <div v-else-if="!d?.groups?.length" class="stc-empty" style="padding:40px 20px"><UIcon name="i-lucide-banknote" /><p>Sin pagos en este periodo.</p></div>
      <table v-else class="bm-table" :class="{ dim: pending }">
        <thead>
          <tr><th>{{ GROUPS.find((g) => g.key === groupBy)?.label }}</th><th class="num">Pagos</th><th class="num">Bruto</th><th class="bm-bar-col">Parte</th></tr>
        </thead>
        <tbody>
          <tr v-for="g in d.groups" :key="g.key">
            <td>{{ groupLabel(g) }}</td>
            <td class="num stc-mono">{{ formatCount(g.payments) }}</td>
            <td class="num stc-mono">{{ formatUsd(g.gross) }}</td>
            <td class="bm-bar-col"><div class="bm-bar"><i :style="{ width: share(g) + '%' }" /></div><span class="stc-mono">{{ share(g) }} %</span></td>
          </tr>
        </tbody>
      </table>
    </section>

    <p class="bm-foot">
      {{ asOfLabel(data?.as_of) }}. Solo cuenta dinero cobrado: un pago de 6 meses es ingreso del día en que se paga.
      El reembolso se resta el día en que se hace y el contracargo el día en que se pierde. Días en hora de Chicago.
    </p>
  </template>
</template>
