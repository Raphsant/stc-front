<script setup lang="ts">
// Churn for one Chicago month and the renewal rate of each variant.
const props = defineProps<{ canMoney: boolean; canExport: boolean }>()

const months = recentMonths()
const month = ref(months[0]!.value)
const { data, pending, error, refresh } = useFetch<any>('/api/billing/metrics/churn', { query: computed(() => ({ month: month.value })) })
defineExpose({ refresh })

const d = computed(() => data.value?.data)
const loading = computed(() => pending.value && !data.value)
</script>

<template>
  <div class="bm-filters">
    <select v-model="month" class="stc-input bm-select" aria-label="Mes">
      <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
    </select>
    <div v-if="props.canExport" class="bm-actions">
      <a class="stc-btn sm" :href="`/api/billing/metrics/export?report=churn&month=${month}`" download><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /> Bajas CSV</a>
      <a class="stc-btn sm" :href="`/api/billing/metrics/export?report=renewals&month=${month}`" download><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /> Renovaciones CSV</a>
    </div>
  </div>

  <BillingMetricsNotice v-if="error" :error="error" what="las bajas" />
  <template v-else>
    <div class="bm-tiles">
      <BillingMetricsTile label="Tasa de bajas" icon="i-lucide-user-minus" gold :loading="loading" :value="formatRate(d?.subscriberChurnRate)" :note="`${formatCount(d?.churned?.total)} de ${formatCount(d?.activeOnDay1)} activos el día 1`" />
      <BillingMetricsTile v-for="k in CHURN_KEYS" :key="k" :label="CHURN_KIND[k]!.label" :loading="loading" :value="formatCount(d?.churned?.[k])" :note="`${formatRate(d?.churnRateByType?.[k])} · ${CHURN_KIND[k]!.help}`" />
    </div>

    <div class="bm-tiles">
      <BillingMetricsTile v-if="props.canMoney" label="MRR perdido" icon="i-lucide-trending-down" :loading="loading" :value="formatUsd(d?.mrrChurned)" :note="`${formatRate(d?.mrrChurnRate)} del MRR del día 1 (${formatUsd(d?.mrrOnDay1)})`" :tone="d?.mrrChurned ? 'red' : undefined" />
      <BillingMetricsTile label="Reactivaciones" icon="i-lucide-rotate-ccw" :loading="loading" :value="formatCount(d?.reactivations)" :note="props.canMoney ? `${formatUsd(d?.reactivatedMrr)} de MRR recuperado tras perder el acceso` : 'Pagaron después de perder el acceso'" />
      <BillingMetricsTile label="Pidieron cancelar" icon="i-lucide-calendar-x" :loading="loading" :value="formatCount(d?.cancelRequests)" :note="countOf(d?.cancelReversals, 'se arrepintió', 'se arrepintieron')" />
      <BillingMetricsTile label="Nunca pagaron" icon="i-lucide-circle-slash" :loading="loading" :value="formatCount(d?.ended?.neverPaid)" note="Primer pago que no pasó: no es una baja" />
    </div>

    <section class="stc-panel" style="overflow:hidden">
      <div class="stc-panel-head">
        <div class="stc-panel-title"><UIcon name="i-lucide-repeat" class="w-[18px] h-[18px]" /> Renovación por variante</div>
        <span class="bm-hint">De los periodos pagados que terminaron en {{ monthLabel(month) }}</span>
      </div>
      <div v-if="loading" class="bm-pad"><USkeleton class="h-4 w-full" /></div>
      <div v-else-if="!d?.renewalByVariant?.length" class="stc-empty" style="padding:40px 20px"><UIcon name="i-lucide-repeat" /><p>Ningún periodo pagado terminó en este mes.</p></div>
      <div v-else class="bm-scroll">
        <table class="bm-table" :class="{ dim: pending }">
          <thead>
            <tr><th>Producto</th><th>Variante</th><th class="num">Vencían</th><th class="num">Renovaron</th><th class="num">No renovaron</th><th class="num">Pendientes</th><th class="num">Tasa</th></tr>
          </thead>
          <tbody>
            <tr v-for="v in d.renewalByVariant" :key="v.priceId">
              <td>{{ v.serviceName }}</td>
              <td>{{ variantLabel({ ...v, kind: 'recurring' }) }}</td>
              <td class="num stc-mono">{{ formatCount(v.due) }}</td>
              <td class="num stc-mono bm-green">{{ formatCount(v.renewed) }}</td>
              <td class="num stc-mono" :class="v.notRenewed ? 'bm-red' : 'bm-zero'">{{ formatCount(v.notRenewed) }}</td>
              <td class="num stc-mono" :class="v.pending ? 'bm-gold' : 'bm-zero'">{{ formatCount(v.pending) }}</td>
              <td class="num stc-mono">{{ formatRate(v.renewalRate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="bm-foot">
      {{ asOfLabel(data?.as_of) }}<template v-if="data?.redacted"> · Tu rol ve conteos, no montos</template>.
      La baja cuenta el día en que termina el acceso, no el día en que se pide cancelar. "Pendientes" siguen en gracia y no entran en la tasa.
    </p>
  </template>
</template>
