<script setup lang="ts">
// The checks of our numbers against Stripe. metrics:admin only.
const props = defineProps<{ canExport: boolean }>()

const { data, pending, error, refresh } = useFetch<any>('/api/billing/metrics/reconciliation', { query: { limit: 60 } })
defineExpose({ refresh })

const runs = computed(() => data.value?.data?.runs ?? [])
const loading = computed(() => pending.value && !data.value)
const bad = computed(() => runs.value.filter((r: any) => r.status !== 'ok').length)
const opened = ref<Set<string>>(new Set())
function toggle(id: string) {
  const next = new Set(opened.value)
  next.has(id) ? next.delete(id) : next.add(id)
  opened.value = next
}
</script>

<template>
  <BillingMetricsNotice v-if="error" :error="error" what="la conciliación" />
  <template v-else>
    <div class="bm-tiles">
      <BillingMetricsTile label="Comprobaciones" icon="i-lucide-scale" :loading="loading" :value="formatCount(runs.length)" note="Las más recientes" />
      <BillingMetricsTile label="Con diferencias" icon="i-lucide-triangle-alert" :gold="!bad" :loading="loading" :value="formatCount(bad)" :note="bad ? 'Revisa cada una abajo' : 'Todo coincide con Stripe'" :tone="bad ? 'red' : 'green'" />
    </div>

    <section class="stc-panel" style="overflow:hidden">
      <div class="stc-panel-head">
        <div class="stc-panel-title"><UIcon name="i-lucide-scale" class="w-[18px] h-[18px]" /> Contra Stripe</div>
        <a v-if="props.canExport" class="stc-btn sm" href="/api/billing/metrics/export?report=reconciliation" download><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /> CSV</a>
      </div>
      <div v-if="loading" class="bm-pad"><USkeleton class="h-4 w-full" /><USkeleton class="h-4 w-4/5 mt-3" /></div>
      <div v-else-if="!runs.length" class="stc-empty" style="padding:40px 20px"><UIcon name="i-lucide-scale" /><p>Todavía no se ha corrido ninguna comprobación.</p></div>
      <div v-else class="bm-scroll">
        <table class="bm-table" :class="{ dim: pending }">
          <thead><tr><th>Cuándo</th><th>Qué se comparó</th><th>Día</th><th>Resultado</th><th class="num">Comparados</th><th class="num">Ajenos</th><th /></tr></thead>
          <tbody>
            <template v-for="r in runs" :key="r.id">
              <tr :class="{ 'bm-row-click': r.mismatches?.length }" @click="r.mismatches?.length && toggle(r.id)">
                <td class="stc-mono bm-date">{{ formatBillingDateTime(r.runAt) }}</td>
                <td>{{ RECON_SCOPE[r.scope] || r.scope }}</td>
                <td class="stc-mono bm-date">{{ r.day || '—' }}</td>
                <td><span class="stc-badge" :class="statusMeta(RECON_STATUS, r.status).tone">{{ statusMeta(RECON_STATUS, r.status).label }}</span></td>
                <td class="num stc-mono">{{ formatCount(r.checked) }}</td>
                <td class="num stc-mono bm-zero">{{ formatCount(r.ignored) }}</td>
                <td class="num">
                  <button v-if="r.mismatches?.length" class="bm-more" :class="{ calm: r.status === 'ok' }" :aria-expanded="opened.has(r.id)" :title="r.status === 'ok' ? 'Reparado automáticamente' : 'Ver diferencias'">
                    {{ r.mismatches.length }} <UIcon :name="opened.has(r.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
              <tr v-if="opened.has(r.id)" class="bm-detail">
                <td colspan="7">
                  <div v-for="(m, i) in r.mismatches" :key="i" class="bm-mismatch">
                    <span class="bm-mm-kind">{{ mismatchLabel(m.kind) }}<span v-if="m.repaired" class="stc-badge green" style="margin-left:8px">Reparado</span></span>
                    <span class="stc-code bm-mm-id">{{ m.id }}</span>
                    <span class="bm-mm-vals">Aquí: <b>{{ mismatchValue(m.kind, m.ours) }}</b> · Stripe: <b>{{ mismatchValue(m.kind, m.theirs) }}</b></span>
                    <span v-if="m.note" class="bm-mm-note">{{ m.note }}</span>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <p class="bm-foot">
      {{ asOfLabel(data?.as_of) }}. Cada hora se repara lo que difiere de Stripe; una vez al día se comparan suscripciones, MRR, pagos del día y facturas fallidas.
      "Ajenos" son objetos de la misma cuenta de Stripe que no son de este sistema (Payments AI): se cuentan y se ignoran.
    </p>
  </template>
</template>
