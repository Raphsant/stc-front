<script setup lang="ts">
useSeoMeta({
  title: 'Suscripciones - STC Control',
  description: 'Suscripciones de stc-billing (Stripe y PayPal) y el acceso que dan en Discord.',
})

const PAGE_SIZE = 25
const FILTERS = [
  { key: '',           label: 'Todas' },
  { key: 'active',     label: 'Activas' },
  { key: 'past_due',   label: 'Pago fallido' },
  { key: 'canceled',   label: 'Canceladas' },
  { key: 'incomplete', label: 'Incompletas' },
  { key: 'expired',    label: 'Expiradas' },
]

const status = ref('')
const page = ref(1)
watch(status, () => { page.value = 1 })

// One extra row tells us whether there is a next page (the API returns no total).
const { data, pending, error, refresh } = useFetch<any[]>('/api/billing/subscriptions', {
  query: computed(() => ({
    status: status.value || undefined,
    limit: PAGE_SIZE + 1,
    offset: (page.value - 1) * PAGE_SIZE,
  })),
})

const rows = computed(() => (data.value ?? []).slice(0, PAGE_SIZE))
const hasNext = computed(() => (data.value?.length ?? 0) > PAGE_SIZE)

// One line on what happens next with this subscription, most important fact first.
function nextStep(s: any): { text: string; tone: 'red' | 'gold' | 'dim' } {
  if (s.revokedAt) return { text: `Revocada ${formatBillingDate(s.revokedAt)}${s.revokedReason ? ` · ${s.revokedReason}` : ''}`, tone: 'red' }
  if (s.endedAt) return { text: `Terminó ${formatBillingDate(s.endedAt)}`, tone: 'dim' }
  if (s.graceEndsAt) return { text: `Gracia hasta ${formatBillingDateTime(s.graceEndsAt)}`, tone: 'red' }
  if (s.cancelAtPeriodEnd || s.status === 'canceled') return { text: `No renueva · acceso hasta ${formatBillingDate(s.paidThrough)}`, tone: 'gold' }
  if (s.status === 'active' && s.currentPeriodEnd) return { text: `Renueva ${formatBillingDate(s.currentPeriodEnd)}`, tone: 'dim' }
  return { text: '—', tone: 'dim' }
}
</script>

<template>
  <div class="bs-page">
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Suscripciones</div>
        <div class="stc-page-sub">Estado en Stripe o PayPal y si el miembro tiene ahora el rol en Discord.</div>
      </div>
      <button class="stc-btn sm" :disabled="pending" @click="refresh()">
        <UIcon name="i-lucide-refresh-cw" class="w-3.5 h-3.5" :class="{ 'animate-spin': pending }" />
        Actualizar
      </button>
    </div>

    <div class="bs-filters">
      <div class="stc-seg">
        <button v-for="f in FILTERS" :key="f.key" :class="{ on: status === f.key }" @click="status = f.key">
          {{ f.label }}
        </button>
      </div>
    </div>

    <section v-if="error" class="stc-panel bs-alert">
      <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 flex-shrink-0" />
      <div>
        <div class="bs-alert-t">Error</div>
        <p class="bs-alert-p">No se pudieron cargar las suscripciones: {{ error.data?.message || error.statusMessage || error.message }}</p>
      </div>
    </section>

    <section v-else class="stc-panel" style="overflow:hidden">
      <template v-if="pending && !data">
        <div v-for="i in 8" :key="i" class="bs-trow bs-grid">
          <div class="space-y-1.5"><USkeleton class="h-3.5 w-28" /><USkeleton class="h-3 w-40" /></div>
          <div class="space-y-1.5"><USkeleton class="h-3.5 w-32" /><USkeleton class="h-3 w-24" /></div>
          <div class="flex gap-1.5"><USkeleton class="h-5 w-16 rounded-md" /><USkeleton class="h-5 w-20 rounded-md" /></div>
          <USkeleton class="h-3.5 w-24 bs-col-paid" />
          <USkeleton class="h-3.5 w-36 bs-col-next" />
          <USkeleton class="h-5 w-16 rounded-md bs-col-prov" />
        </div>
      </template>

      <div v-else-if="!rows.length" class="stc-empty" style="padding:48px 20px">
        <UIcon name="i-lucide-repeat" />
        <p>{{ status ? 'No hay suscripciones con este estado.' : 'Todavía no hay suscripciones.' }}</p>
      </div>

      <template v-else>
        <div class="bs-thead bs-grid">
          <span class="stc-eyebrow">Cliente</span>
          <span class="stc-eyebrow">Servicio</span>
          <span class="stc-eyebrow">Estado · acceso</span>
          <span class="stc-eyebrow bs-col-paid">Pagado hasta</span>
          <span class="stc-eyebrow bs-col-next">Próximo</span>
          <span class="stc-eyebrow bs-col-prov">Proveedor</span>
        </div>

        <div v-for="r in rows" :key="r.subscription.id" class="bs-trow bs-grid" :class="{ dim: pending }">
          <BillingCustomer :customer="r.customer" class="bs-cust" />

          <div class="min-w-0 bs-svc">
            <span class="bs-svc-name">{{ r.service.name }}</span>
            <span class="bs-svc-sub stc-mono">
              {{ formatMoney(r.price.amount, r.price.currency) }} · {{ formatInterval(r.price.interval, r.price.intervalCount) }}
            </span>
          </div>

          <div class="bs-status">
            <span class="stc-badge" :class="statusMeta(SUBSCRIPTION_STATUS, r.subscription.status).tone">
              {{ statusMeta(SUBSCRIPTION_STATUS, r.subscription.status).label }}
            </span>
            <span v-if="r.access" class="stc-badge" :class="statusMeta(ACCESS_STATUS, r.access).tone">
              {{ statusMeta(ACCESS_STATUS, r.access).label }}
            </span>
          </div>

          <div class="bs-col-paid">
            <span class="bs-date stc-mono">{{ formatBillingDate(r.subscription.paidThrough) }}</span>
          </div>

          <div class="bs-col-next min-w-0">
            <span class="bs-next" :class="nextStep(r.subscription).tone">{{ nextStep(r.subscription).text }}</span>
          </div>

          <div class="bs-col-prov">
            <span class="stc-badge neutral">{{ PROVIDER_LABEL[r.subscription.provider] || r.subscription.provider }}</span>
            <span v-if="r.subscription.origin === 'import'" class="bs-origin">Importada</span>
          </div>
        </div>

        <BillingPager v-model:page="page" :has-next="hasNext" :disabled="pending" />
      </template>
    </section>
  </div>
</template>

<style scoped>
.bs-page { display: flex; flex-direction: column; gap: 20px; }
.bs-filters { overflow-x: auto; }
.bs-filters .stc-seg { width: max-content; }

.bs-alert {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 16px 18px;
  color: var(--red); border-color: var(--red-line); background: var(--red-dim);
}
.bs-alert-t { font-weight: 600; font-size: 14px; }
.bs-alert-p { font-size: 13px; color: var(--dim); margin-top: 3px; }

.bs-grid {
  display: grid;
  grid-template-columns: minmax(180px, 1.4fr) minmax(170px, 1.3fr) minmax(190px, 1.2fr) 120px minmax(170px, 1.3fr) 100px;
  align-items: center;
  gap: 14px;
}
.bs-thead { padding: 14px 22px; border-bottom: 1px solid var(--line); }
.bs-trow { padding: 12px 22px; border-bottom: 1px solid var(--line); transition: background .14s, opacity .14s; }
.bs-trow:last-of-type { border-bottom: none; }
.bs-trow:hover { background: rgba(255,255,255,.022); }
html:not(.dark) .bs-trow:hover { background: rgba(0,0,0,.02); }
.bs-trow.dim { opacity: .55; }

.bs-svc-name { display: block; font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bs-svc-sub  { display: block; font-size: 11.5px; color: var(--faint); margin-top: 1px; }

.bs-status { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }

.bs-date { font-size: 12px; color: var(--dim); white-space: nowrap; }

.bs-next { display: block; font-size: 12px; line-height: 1.4; }
.bs-next.dim  { color: var(--dim); }
.bs-next.gold { color: var(--gold-soft); }
.bs-next.red  { color: var(--red); }

.bs-origin { display: block; font-size: 10.5px; color: var(--faint); margin-top: 3px; }

@media (max-width: 1200px) {
  .bs-grid { grid-template-columns: minmax(170px, 1.4fr) minmax(150px, 1.2fr) minmax(180px, 1.2fr) minmax(160px, 1.3fr); }
  .bs-col-paid, .bs-col-prov { display: none; }
}
@media (max-width: 860px) {
  .bs-grid { grid-template-columns: minmax(150px, 1.3fr) minmax(130px, 1fr) minmax(150px, 1fr); }
  .bs-col-next { display: none; }
}
@media (max-width: 640px) {
  .bs-thead { display: none; }
  .bs-trow.bs-grid { grid-template-columns: 1fr; gap: 6px; padding: 14px 16px; }
  .bs-trow .bs-col-next { display: block; }
}
</style>
