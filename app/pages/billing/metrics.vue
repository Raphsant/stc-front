<script setup lang="ts">
import { canExport as mayExport, canSeeReport } from '#shared/metricsAccess'
import { hasScope } from '#shared/permissions'

// The billing metrics, read from stc-billing through /api/billing/metrics/*.
// This page only displays: every number and definition is stc-billing's. Which
// tabs a staff member gets follows their role (shared/permissions.ts); the server
// routes enforce the same rule, so hiding a tab here is a courtesy, not the check.

useSeoMeta({
  title: 'Métricas - STC Control',
  description: 'MRR, ingresos, bajas, pagos fallidos y altas de stc-billing.',
})

const route = useRoute()
const router = useRouter()
const { session } = useUserSession()
const user = computed(() => session.value?.user)

const canMoney = computed(() => hasScope(user.value, 'metrics:money'))
const canMembers = computed(() => hasScope(user.value, 'metrics:members'))
const exportOf = (name: string) => mayExport(user.value, name)

const TABS = [
  { key: 'summary', label: 'Resumen', report: 'summary' },
  { key: 'mrr', label: 'MRR', report: 'mrr' },
  { key: 'revenue', label: 'Ingresos', report: 'revenue' },
  { key: 'churn', label: 'Bajas', report: 'churn' },
  { key: 'failed', label: 'Pagos fallidos', report: 'failed-payments' },
  { key: 'signups', label: 'Altas', report: 'signups' },
  { key: 'reconciliation', label: 'Conciliación', report: 'reconciliation' },
] as const

const tabs = computed(() => TABS.filter((t) => canSeeReport(user.value, t.report)))
const tab = computed(() => {
  const wanted = String(route.query.tab || '')
  return tabs.value.find((t) => t.key === wanted)?.key ?? tabs.value[0]?.key ?? ''
})
function go(key: string) {
  router.replace({ query: key === tabs.value[0]?.key ? {} : { tab: key } })
}

const section = ref<{ refresh: () => unknown } | null>(null)
const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  try {
    await section.value?.refresh()
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="bm-page">
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Métricas</div>
        <div class="stc-page-sub">
          Calculadas por stc-billing con el dinero realmente cobrado y comprobadas a diario contra Stripe. Días y meses en hora de Chicago.
        </div>
      </div>
      <button class="stc-btn sm" :disabled="refreshing || !tab" @click="refresh">
        <UIcon name="i-lucide-refresh-cw" class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshing }" />
        Actualizar
      </button>
    </div>

    <BillingMetricsNotice v-if="!tabs.length" :error="{ statusCode: 403 }" what="las métricas" />

    <template v-else>
      <div class="bm-tabs">
        <div class="stc-seg" role="tablist">
          <button v-for="t in tabs" :key="t.key" role="tab" :aria-selected="tab === t.key" :class="{ on: tab === t.key }" @click="go(t.key)">
            {{ t.label }}
          </button>
        </div>
      </div>

      <BillingMetricsSummary v-if="tab === 'summary'" ref="section" :can-money="canMoney" :can-export="exportOf('summary')" />
      <BillingMetricsMrr v-else-if="tab === 'mrr'" ref="section" :can-export="exportOf('mrr')" />
      <BillingMetricsRevenue v-else-if="tab === 'revenue'" ref="section" :can-export="exportOf('revenue')" />
      <BillingMetricsChurn v-else-if="tab === 'churn'" ref="section" :can-money="canMoney" :can-export="exportOf('churn')" />
      <BillingMetricsFailedPayments v-else-if="tab === 'failed'" ref="section" :can-money="canMoney" :can-members="canMembers" :can-export="exportOf('failed-payments')" />
      <BillingMetricsSignups v-else-if="tab === 'signups'" ref="section" :can-export="exportOf('signups')" />
      <BillingMetricsReconciliation v-else-if="tab === 'reconciliation'" ref="section" :can-export="exportOf('reconciliation')" />
    </template>
  </div>
</template>

<!-- Not scoped: the sections in components/billing/metrics share these. Everything is prefixed bm-. -->
<style>
.bm-page { display: flex; flex-direction: column; gap: 20px; }
.bm-tabs, .bm-filters { overflow-x: auto; }
.bm-tabs .stc-seg, .bm-filters .stc-seg { width: max-content; }
.bm-filters { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.bm-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.bm-select { width: auto; min-width: 190px; padding-right: 28px; text-transform: capitalize; }

.bm-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
.bm-tiles.two { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.bm-tile { min-width: 0; }
.bm-tile-val { font-size: 34px; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bm-tile-foot { font-size: 12px; color: var(--dim); line-height: 1.4; min-height: 17px; }
.bm-tile-foot.red { color: var(--red); }
.bm-tile-foot.gold { color: var(--gold-soft); }
.bm-tile-foot.green { color: var(--green); }

.bm-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; align-items: start; }
.bm-pad { padding: 18px 20px; transition: opacity .14s; }
.bm-pad.dim, .bm-table.dim { opacity: .55; }
.bm-hint { font-size: 12px; color: var(--faint); }
.bm-foot { font-size: 12px; color: var(--faint); line-height: 1.55; max-width: 900px; }
.bm-scroll { overflow-x: auto; }

.bm-table { width: 100%; border-collapse: collapse; font-size: 13px; transition: opacity .14s; }
.bm-table th {
  text-align: left; padding: 12px 20px; white-space: nowrap;
  font-size: 10px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--faint);
  border-bottom: 1px solid var(--line);
}
.bm-table td { padding: 11px 20px; border-bottom: 1px solid var(--line); color: var(--text); vertical-align: middle; }
.bm-table tbody tr:last-child td { border-bottom: none; }
.bm-table tbody tr:hover td { background: rgba(255,255,255,.022); }
html:not(.dark) .bm-table tbody tr:hover td { background: rgba(0,0,0,.02); }
.bm-table .num { text-align: right; white-space: nowrap; }
.bm-table .bm-date { font-size: 12px; color: var(--dim); white-space: nowrap; }
.bm-table .bm-cust { min-width: 180px; max-width: 260px; }
.bm-sub { color: var(--dim); font-size: 12.5px; }
.bm-sub-line { display: block; font-size: 11px; color: var(--faint); margin-top: 2px; white-space: nowrap; }
.bm-green { color: var(--green) !important; }
.bm-red { color: var(--red) !important; }
.bm-gold { color: var(--gold-soft) !important; }
.bm-blue { color: var(--blue) !important; }
.bm-zero { color: var(--faint) !important; }

.bm-bar-col { width: 34%; min-width: 150px; white-space: nowrap; }
.bm-bar { display: inline-block; vertical-align: middle; width: calc(100% - 52px); height: 6px; border-radius: 3px; background: var(--line); margin-right: 10px; overflow: hidden; }
.bm-bar i { display: block; height: 100%; border-radius: 3px; background: var(--gold); }
.bm-bar-col span { font-size: 11.5px; color: var(--dim); }

.bm-row-click { cursor: pointer; }
.bm-more {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: var(--red); background: transparent; border: none; cursor: pointer;
}
.bm-more.calm { color: var(--dim); }
.bm-detail td { background: var(--inset); padding: 6px 20px 12px; }
.bm-detail:hover td { background: var(--inset) !important; }
.bm-mismatch { display: grid; grid-template-columns: minmax(220px, 1.2fr) minmax(160px, 1fr) minmax(220px, 1.6fr); gap: 4px 16px; padding: 9px 0; border-bottom: 1px dashed var(--line); font-size: 12.5px; }
.bm-mismatch:last-child { border-bottom: none; }
.bm-mm-kind { color: var(--text); font-weight: 500; }
.bm-mm-id { color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bm-mm-vals { color: var(--dim); }
.bm-mm-vals b { color: var(--text); font-weight: 500; }
.bm-mm-note { grid-column: 1 / -1; color: var(--faint); font-size: 11.5px; }

.bm-alert {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 16px 18px;
  color: var(--red); border-color: var(--red-line); background: var(--red-dim);
}
.bm-alert.quiet { color: var(--dim); border-color: var(--line); background: var(--panel); }
.bm-alert-t { font-weight: 600; font-size: 14px; }
.bm-alert-p { font-size: 13px; color: var(--dim); margin-top: 3px; }

@media (max-width: 640px) {
  .bm-table th, .bm-table td { padding: 10px 14px; }
  .bm-tile-val { font-size: 28px; }
  .bm-mismatch { grid-template-columns: 1fr; }
  .bm-bar-col { display: none; }
}
</style>
