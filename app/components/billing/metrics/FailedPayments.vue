<script setup lang="ts">
// Renewals that failed in a month and what became of them, plus the ones still open.
const props = defineProps<{ canMoney: boolean; canMembers: boolean; canExport: boolean }>()

const months = recentMonths()
const month = ref(months[0]!.value)
const { data, pending, error, refresh: refreshReport } = useFetch<any>('/api/billing/metrics/failed-payments', { query: computed(() => ({ month: month.value })) })
// The list with names is its own request, and only made for a role that may see it.
const { data: openData, pending: openPending, error: openError, refresh: refreshOpen } = useFetch<any>('/api/billing/metrics/failed-payments/open', { immediate: props.canMembers })
defineExpose({ refresh: () => Promise.all([refreshReport(), props.canMembers ? refreshOpen() : null]) })

const d = computed(() => data.value?.data)
const loading = computed(() => pending.value && !data.value)
const open = computed(() => openData.value?.data?.open ?? [])
const OUTCOMES = [
  { key: 'recoveredInGrace', meta: FAILURE_OUTCOME.recovered_in_grace! },
  { key: 'recoveredAfterGrace', meta: FAILURE_OUTCOME.recovered_after_grace! },
  { key: 'lost', meta: FAILURE_OUTCOME.lost! },
  { key: 'open', meta: FAILURE_OUTCOME.open! },
]
</script>

<template>
  <div class="bm-filters">
    <select v-model="month" class="stc-input bm-select" aria-label="Mes">
      <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
    </select>
    <a v-if="props.canExport" class="stc-btn sm" :href="`/api/billing/metrics/export?report=failed-payments&month=${month}`" download><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /> CSV</a>
  </div>

  <BillingMetricsNotice v-if="error" :error="error" what="los pagos fallidos" />
  <template v-else>
    <div class="bm-tiles">
      <BillingMetricsTile label="Renovaciones fallidas" icon="i-lucide-credit-card" :loading="loading" :value="formatCount(d?.failed)" :note="props.canMoney ? formatUsd(d?.failedAmount) + ' en juego' : `Primer fallo en ${monthLabel(month)}`" />
      <BillingMetricsTile label="Tasa de recuperación" icon="i-lucide-life-buoy" gold :loading="loading" :value="formatRate(d?.recoveryRate)" :note="`${formatRate(d?.inGraceRecoveryRate)} dentro de la gracia`" />
      <BillingMetricsTile label="Días para recuperar" icon="i-lucide-timer" :loading="loading" :value="d?.medianDaysToRecover == null ? '—' : String(d.medianDaysToRecover).replace('.', ',')" note="Mediana desde el primer fallo" />
      <BillingMetricsTile v-if="props.canMoney" label="MRR recuperado" icon="i-lucide-trending-up" :loading="loading" :value="formatUsd(d?.recoveredMrr)" :note="`Perdido ${formatUsd(d?.lostMrr)} · en juego ${formatUsd(d?.atStakeMrr)}`" />
    </div>

    <div class="bm-two">
      <section class="stc-panel" style="overflow:hidden">
        <div class="stc-panel-head"><div class="stc-panel-title"><UIcon name="i-lucide-git-branch" class="w-[18px] h-[18px]" /> Qué pasó con ellas</div></div>
        <div v-if="loading" class="bm-pad"><USkeleton class="h-4 w-full" /></div>
        <table v-else class="bm-table" :class="{ dim: pending }">
          <tbody>
            <tr v-for="o in OUTCOMES" :key="o.key">
              <td><span class="stc-badge" :class="o.meta.tone">{{ o.meta.label }}</span></td>
              <td class="num stc-mono">{{ formatCount(d?.[o.key]) }}</td>
            </tr>
            <tr v-if="d?.actionRequired">
              <td class="bm-sub">De ellas, pidieron confirmación 3-D Secure</td>
              <td class="num stc-mono">{{ formatCount(d.actionRequired) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="stc-panel" style="overflow:hidden">
        <div class="stc-panel-head"><div class="stc-panel-title"><UIcon name="i-lucide-message-square-warning" class="w-[18px] h-[18px]" /> Motivo del banco</div></div>
        <div v-if="loading" class="bm-pad"><USkeleton class="h-4 w-full" /></div>
        <div v-else-if="!d?.byFailureCode?.length" class="stc-empty" style="padding:32px 20px"><UIcon name="i-lucide-credit-card" /><p>Ninguna renovación falló en este mes.</p></div>
        <table v-else class="bm-table" :class="{ dim: pending }">
          <thead><tr><th>Motivo</th><th class="num">Fallaron</th><th class="num">Recuperadas</th><th class="num">Perdidas</th><th class="num">Abiertas</th></tr></thead>
          <tbody>
            <tr v-for="c in d.byFailureCode" :key="c.code">
              <td>{{ failureCodeLabel(c.code) }}</td>
              <td class="num stc-mono">{{ formatCount(c.failed) }}</td>
              <td class="num stc-mono" :class="c.recovered ? 'bm-green' : 'bm-zero'">{{ formatCount(c.recovered) }}</td>
              <td class="num stc-mono" :class="c.lost ? 'bm-red' : 'bm-zero'">{{ formatCount(c.lost) }}</td>
              <td class="num stc-mono" :class="c.open ? 'bm-gold' : 'bm-zero'">{{ formatCount(c.open) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <section v-if="props.canMembers" class="stc-panel" style="overflow:hidden">
      <div class="stc-panel-head">
        <div class="stc-panel-title"><UIcon name="i-lucide-list-todo" class="w-[18px] h-[18px]" /> Abiertos ahora</div>
        <div class="bm-actions">
          <span class="bm-hint">De cualquier mes, sin cobrar todavía</span>
          <a v-if="props.canExport && props.canMoney" class="stc-btn sm" href="/api/billing/metrics/export?report=failed-payments-open" download><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /> CSV</a>
        </div>
      </div>
      <BillingMetricsNotice v-if="openError" :error="openError" what="la lista de pagos abiertos" />
      <div v-else-if="openPending && !openData" class="bm-pad"><USkeleton class="h-4 w-full" /><USkeleton class="h-4 w-4/5 mt-3" /></div>
      <div v-else-if="!open.length" class="stc-empty" style="padding:40px 20px"><UIcon name="i-lucide-party-popper" /><p>No hay renovaciones fallidas sin resolver.</p></div>
      <div v-else class="bm-scroll">
        <table class="bm-table">
          <thead>
            <tr><th>Miembro</th><th>Plan</th><th>Motivo</th><th class="num">Intentos</th><th>Primer fallo</th><th>Próximo intento</th><th>Acceso</th><th v-if="props.canMoney" class="num">Monto</th></tr>
          </thead>
          <tbody>
            <tr v-for="o in open" :key="o.invoiceId || o.subscriptionId + o.firstFailedAt">
              <td class="bm-cust"><BillingCustomer v-if="o.customer" :customer="o.customer" /><span v-else>—</span></td>
              <td>{{ o.serviceName }}<span class="bm-sub-line">{{ o.nickname || '' }}</span></td>
              <td>{{ failureCodeLabel(o.failureCode) }}</td>
              <td class="num stc-mono">{{ o.attempts || '—' }}</td>
              <td class="stc-mono bm-date">{{ formatBillingDate(o.firstFailedAt) }}</td>
              <td class="stc-mono bm-date">{{ formatBillingDateTime(o.nextRetryAt) }}</td>
              <td>
                <span class="stc-badge" :class="statusMeta(ACCESS_STATUS, o.access).tone">{{ statusMeta(ACCESS_STATUS, o.access).label }}</span>
                <span v-if="o.access === 'grace' && o.graceEndsAt" class="bm-sub-line">hasta {{ formatBillingDateTime(o.graceEndsAt) }}</span>
              </td>
              <td v-if="props.canMoney" class="num stc-mono">{{ formatUsd(o.amount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="bm-foot">
      {{ asOfLabel(data?.as_of) }}<template v-if="data?.redacted"> · Tu rol ve conteos, no montos</template>.
      Cada renovación cuenta en el mes de su primer fallo. La tasa deja fuera las abiertas hasta que se resuelven.
    </p>
  </template>
</template>
