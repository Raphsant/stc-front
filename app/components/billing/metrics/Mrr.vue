<script setup lang="ts">
// MRR over time and what moved it. Dollars only: the tab is not offered without metrics:money.
const props = defineProps<{ canExport: boolean }>()

const presets = rangePresets()
const presetKey = ref('90d')
const preset = computed(() => presets.find((p) => p.key === presetKey.value) ?? presets[0]!)
const query = computed(() => ({ from: preset.value.from, to: preset.value.to, bucket: preset.value.bucket }))

const { data, pending, error, refresh } = useFetch<any>('/api/billing/metrics/mrr', { query })
defineExpose({ refresh })

const d = computed(() => data.value?.data)
const loading = computed(() => pending.value && !data.value)
const points = computed(() => mrrChartPoints(d.value?.buckets))
/** Only the periods in which something moved: a day-by-day list of nothing helps nobody. */
const moved = computed(() =>
  (d.value?.buckets ?? []).filter((b: any) => MOVEMENT_KEYS.some((k) => b.movements[k] !== 0)).reverse(),
)
const exportHref = computed(() => `/api/billing/metrics/export?report=mrr&from=${preset.value.from}&to=${preset.value.to}&bucket=${preset.value.bucket}`)
</script>

<template>
  <div class="bm-filters">
    <div class="stc-seg">
      <button v-for="p in presets" :key="p.key" :class="{ on: presetKey === p.key }" @click="presetKey = p.key">{{ p.label }}</button>
    </div>
    <a v-if="props.canExport" class="stc-btn sm" :href="exportHref" download><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /> CSV</a>
  </div>

  <BillingMetricsNotice v-if="error" :error="error" what="el MRR" />
  <template v-else>
    <div class="bm-tiles">
      <BillingMetricsTile label="MRR al inicio" :loading="loading" :value="formatUsdShort(d?.start)" :note="formatBillingDate(preset.from + 'T12:00:00')" />
      <BillingMetricsTile v-for="k in MOVEMENT_KEYS" :key="k" :label="MOVEMENT[k]!.label" :loading="loading" :value="formatUsdSigned((d?.movements?.[k] ?? 0) * MOVEMENT[k]!.sign)" :note="countOf(d?.movements?.counts?.[k], 'suscripción', 'suscripciones')" :tone="k === 'churned' && d?.movements?.churned ? 'red' : undefined" />
      <BillingMetricsTile label="MRR al final" gold :loading="loading" :value="formatUsdShort(d?.end)" note="Inicio + nuevo + migrado + reactivado − bajas" />
    </div>

    <section class="stc-panel" style="overflow:hidden">
      <div class="stc-panel-head">
        <div class="stc-panel-title"><UIcon name="i-lucide-trending-up" class="w-[18px] h-[18px]" /> MRR</div>
        <span class="bm-hint">Al cierre de cada {{ preset.bucket === 'day' ? 'día' : 'mes' }}, en dólares</span>
      </div>
      <div class="bm-pad" :class="{ dim: pending }">
        <USkeleton v-if="loading" class="h-[280px] w-full" />
        <StcChart v-else-if="points.length > 1" :data="points" :height="280" unit="US$" />
        <div v-else class="stc-empty" style="padding:40px 20px"><UIcon name="i-lucide-trending-up" /><p>Sin datos en este periodo.</p></div>
      </div>
    </section>

    <section class="stc-panel" style="overflow:hidden">
      <div class="stc-panel-head">
        <div class="stc-panel-title"><UIcon name="i-lucide-arrow-left-right" class="w-[18px] h-[18px]" /> Movimientos</div>
        <span class="bm-hint">Solo los periodos en que algo cambió</span>
      </div>
      <div v-if="loading" class="bm-pad"><USkeleton class="h-4 w-full" /></div>
      <div v-else-if="!moved.length" class="stc-empty" style="padding:40px 20px"><UIcon name="i-lucide-arrow-left-right" /><p>El MRR no se movió en este periodo.</p></div>
      <div v-else class="bm-scroll">
        <table class="bm-table">
          <thead>
            <tr>
              <th>Periodo</th>
              <th class="num">Inicio</th>
              <th v-for="k in MOVEMENT_KEYS" :key="k" class="num">{{ MOVEMENT[k]!.label }}</th>
              <th class="num">Fin</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in moved" :key="b.period">
              <td>{{ periodLabel(b.period) }}</td>
              <td class="num stc-mono">{{ formatUsd(b.start) }}</td>
              <td v-for="k in MOVEMENT_KEYS" :key="k" class="num stc-mono" :class="b.movements[k] ? `bm-${MOVEMENT[k]!.tone}` : 'bm-zero'">
                {{ b.movements[k] ? formatUsdSigned(b.movements[k] * MOVEMENT[k]!.sign) : '—' }}
              </td>
              <td class="num stc-mono">{{ formatUsd(b.end) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="bm-foot">{{ asOfLabel(data?.as_of) }}. "Migrado" es el primer cobro real de un miembro importado de Payments AI: no es una venta nueva.</p>
  </template>
</template>
