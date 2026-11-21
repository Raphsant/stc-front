<script setup lang="ts">
// Where things stand now. With metrics:money: MRR, at risk, set to cancel and
// revenue. Without: the same picture in subscriber counts only.
const props = defineProps<{ canMoney: boolean; canExport: boolean }>()

const { data, pending, error, refresh } = useFetch<any>('/api/billing/metrics/summary')
defineExpose({ refresh })

const d = computed(() => data.value?.data)
const loading = computed(() => pending.value && !data.value)
const variants = computed(() => d.value?.byVariant ?? [])
</script>

<template>
  <BillingMetricsNotice v-if="error" :error="error" what="el resumen" />
  <template v-else>
    <div class="bm-tiles">
      <BillingMetricsTile v-if="props.canMoney" label="MRR" icon="i-lucide-trending-up" gold :loading="loading" :value="formatUsdShort(d?.mrr)" :note="countOf(d?.activeSubscribers, 'suscriptor activo', 'suscriptores activos')" />
      <BillingMetricsTile v-else label="Suscriptores activos" icon="i-lucide-users" gold :loading="loading" :value="formatCount(d?.activeSubscribers)" note="Suscripciones que cuentan en el MRR" />

      <BillingMetricsTile label="En riesgo" icon="i-lucide-triangle-alert" :loading="loading" :tone="d?.atRiskSubscribers ? 'red' : undefined" :value="props.canMoney ? formatUsdShort(d?.atRiskMrr) : formatCount(d?.atRiskSubscribers)" :note="props.canMoney ? `${formatCount(d?.atRiskSubscribers)} en gracia tras un cobro fallido` : 'En gracia tras un cobro fallido'" />

      <BillingMetricsTile label="Por cancelar" icon="i-lucide-calendar-x" :loading="loading" :tone="d?.scheduledToCancelSubscribers ? 'gold' : undefined" :value="props.canMoney ? formatUsdShort(d?.scheduledToCancelMrr) : formatCount(d?.scheduledToCancelSubscribers)" :note="props.canMoney ? `${countOf(d?.scheduledToCancelSubscribers, 'suscripción', 'suscripciones')} sin renovar al terminar el periodo` : 'Sin renovar al terminar el periodo'" />

      <BillingMetricsTile label="Importados en espera" icon="i-lucide-hourglass" :loading="loading" :value="formatCount(d?.importedWaiting)" :note="props.canMoney && d?.importedWaiting ? `${formatUsd(d?.importedWaitingMrr)} al mes cuando se cobren` : 'De Payments AI, sin primer cobro aquí'" />
    </div>

    <div v-if="props.canMoney" class="bm-tiles two">
      <BillingMetricsTile label="Ingresos de hoy" icon="i-lucide-banknote" :loading="loading" :value="formatUsd(d?.revenueToday?.gross)" :note="`Neto ${formatUsd(d?.revenueToday?.net)} · ${countOf(d?.revenueToday?.payments, 'pago', 'pagos')}`" />
      <BillingMetricsTile label="Ingresos del mes" icon="i-lucide-calendar-range" :loading="loading" :value="formatUsd(d?.revenueMonthToDate?.gross)" :note="`Neto ${formatUsd(d?.revenueMonthToDate?.net)} · reembolsos ${formatUsd(d?.revenueMonthToDate?.refunds)} · contracargos ${formatUsd(d?.revenueMonthToDate?.chargebacks)}`" />
    </div>

    <section class="stc-panel" style="overflow:hidden">
      <div class="stc-panel-head">
        <div class="stc-panel-title"><UIcon name="i-lucide-layers" class="w-[18px] h-[18px]" /> Por variante</div>
        <a v-if="props.canExport" class="stc-btn sm" href="/api/billing/metrics/export?report=summary" download><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /> CSV</a>
      </div>
      <div v-if="loading" class="bm-pad"><USkeleton class="h-4 w-full" /><USkeleton class="h-4 w-4/5 mt-3" /></div>
      <div v-else-if="!variants.length" class="stc-empty" style="padding:40px 20px">
        <UIcon name="i-lucide-users" />
        <p>Todavía no hay suscripciones activas.</p>
      </div>
      <table v-else class="bm-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Variante</th>
            <th class="num">Suscriptores</th>
            <th v-if="props.canMoney" class="num">MRR</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in variants" :key="v.priceId">
            <td>{{ v.serviceName }}</td>
            <td>{{ variantLabel({ ...v, kind: 'recurring' }) }}</td>
            <td class="num stc-mono">{{ formatCount(v.subscribers) }}</td>
            <td v-if="props.canMoney" class="num stc-mono">{{ formatUsd(v.mrr) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <p class="bm-foot">
      {{ asOfLabel(data?.as_of) }}<template v-if="data?.redacted"> · Tu rol ve conteos, no montos</template>.
      El MRR cuenta a quien está en gracia; los importados entran con su primer cobro real.
    </p>
  </template>
</template>
