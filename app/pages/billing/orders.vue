<script setup lang="ts">
useSeoMeta({
  title: 'Órdenes - STC Control',
  description: 'Órdenes de compra registradas por stc-billing (Stripe y PayPal).',
})

const PAGE_SIZE = 25
const FILTERS = [
  { key: '',         label: 'Todas' },
  { key: 'paid',     label: 'Pagadas' },
  { key: 'pending',  label: 'Pendientes' },
  { key: 'failed',   label: 'Fallidas' },
  { key: 'refunded', label: 'Reembolsadas' },
  { key: 'canceled', label: 'Canceladas' },
  { key: 'expired',  label: 'Expiradas' },
]

const status = ref('')
const page = ref(1)
watch(status, () => { page.value = 1 })

// One extra row tells us whether there is a next page (the API returns no total).
const { data, pending, error, refresh } = useFetch<any[]>('/api/billing/orders', {
  query: computed(() => ({
    status: status.value || undefined,
    limit: PAGE_SIZE + 1,
    offset: (page.value - 1) * PAGE_SIZE,
  })),
})

const rows = computed(() => (data.value ?? []).slice(0, PAGE_SIZE))
const hasNext = computed(() => (data.value?.length ?? 0) > PAGE_SIZE)
</script>

<template>
  <div class="bo-page">
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Órdenes</div>
        <div class="stc-page-sub">Cada compra iniciada en el checkout: el primer pago de una suscripción o un pago único.</div>
      </div>
      <button class="stc-btn sm" :disabled="pending" @click="refresh()">
        <UIcon name="i-lucide-refresh-cw" class="w-3.5 h-3.5" :class="{ 'animate-spin': pending }" />
        Actualizar
      </button>
    </div>

    <div class="bo-filters">
      <div class="stc-seg">
        <button v-for="f in FILTERS" :key="f.key" :class="{ on: status === f.key }" @click="status = f.key">
          {{ f.label }}
        </button>
      </div>
    </div>

    <section v-if="error" class="stc-panel bo-alert">
      <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 flex-shrink-0" />
      <div>
        <div class="bo-alert-t">Error</div>
        <p class="bo-alert-p">No se pudieron cargar las órdenes: {{ error.data?.message || error.statusMessage || error.message }}</p>
      </div>
    </section>

    <section v-else class="stc-panel" style="overflow:hidden">
      <template v-if="pending && !data">
        <div v-for="i in 8" :key="i" class="bo-trow bo-grid">
          <div class="space-y-1.5"><USkeleton class="h-3.5 w-28" /><USkeleton class="h-3 w-40" /></div>
          <div class="space-y-1.5"><USkeleton class="h-3.5 w-32" /><USkeleton class="h-3 w-20" /></div>
          <USkeleton class="h-4 w-20" />
          <USkeleton class="h-5 w-20 rounded-md" />
          <USkeleton class="h-5 w-16 rounded-md bo-col-prov" />
          <USkeleton class="h-3.5 w-28 bo-col-date" />
        </div>
      </template>

      <div v-else-if="!rows.length" class="stc-empty" style="padding:48px 20px">
        <UIcon name="i-lucide-receipt" />
        <p>{{ status ? 'No hay órdenes con este estado.' : 'Todavía no hay órdenes.' }}</p>
      </div>

      <template v-else>
        <div class="bo-thead bo-grid">
          <span class="stc-eyebrow">Cliente</span>
          <span class="stc-eyebrow">Servicio</span>
          <span class="stc-eyebrow" style="text-align:right">Total</span>
          <span class="stc-eyebrow">Estado</span>
          <span class="stc-eyebrow bo-col-prov">Proveedor</span>
          <span class="stc-eyebrow bo-col-date">Fecha</span>
        </div>

        <div v-for="r in rows" :key="r.order.id" class="bo-trow bo-grid" :class="{ dim: pending }">
          <BillingCustomer :customer="r.customer" class="bo-cust" />

          <div class="min-w-0 bo-svc">
            <span class="bo-svc-name">{{ r.service.name }}</span>
            <span class="bo-svc-sub">{{ r.price.nickname || formatInterval(r.price.interval, r.price.intervalCount) }}</span>
          </div>

          <div class="bo-total">
            <span class="stc-mono">{{ formatMoney(r.order.total, r.order.currency) }}</span>
            <span v-if="r.order.discount" class="bo-disc stc-mono">
              −{{ formatMoney(r.order.discount, r.order.currency) }} desc.
            </span>
          </div>

          <div class="bo-status">
            <span class="stc-badge" :class="statusMeta(ORDER_STATUS, r.order.status).tone">
              {{ statusMeta(ORDER_STATUS, r.order.status).label }}
            </span>
          </div>

          <div class="bo-col-prov">
            <span class="stc-badge neutral">{{ PROVIDER_LABEL[r.order.provider] || r.order.provider }}</span>
          </div>

          <div class="bo-col-date">
            <span class="bo-date stc-mono">{{ formatBillingDateTime(r.order.createdAt) }}</span>
            <span v-if="r.order.paidAt" class="bo-date-sub stc-mono">Pagada {{ formatBillingDate(r.order.paidAt) }}</span>
          </div>
        </div>

        <BillingPager v-model:page="page" :has-next="hasNext" :disabled="pending" />
      </template>
    </section>
  </div>
</template>

<style scoped>
.bo-page { display: flex; flex-direction: column; gap: 20px; }
.bo-filters { overflow-x: auto; }
.bo-filters .stc-seg { width: max-content; }

.bo-alert {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 16px 18px;
  color: var(--red); border-color: var(--red-line); background: var(--red-dim);
}
.bo-alert-t { font-weight: 600; font-size: 14px; }
.bo-alert-p { font-size: 13px; color: var(--dim); margin-top: 3px; }

.bo-grid {
  display: grid;
  grid-template-columns: minmax(180px, 1.5fr) minmax(160px, 1.3fr) 120px 120px 100px minmax(140px, 1fr);
  align-items: center;
  gap: 14px;
}
.bo-thead { padding: 14px 22px; border-bottom: 1px solid var(--line); }
.bo-trow { padding: 12px 22px; border-bottom: 1px solid var(--line); transition: background .14s, opacity .14s; }
.bo-trow:last-of-type { border-bottom: none; }
.bo-trow:hover { background: rgba(255,255,255,.022); }
html:not(.dark) .bo-trow:hover { background: rgba(0,0,0,.02); }
.bo-trow.dim { opacity: .55; }

.bo-svc-name { display: block; font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bo-svc-sub  { display: block; font-size: 11.5px; color: var(--faint); margin-top: 1px; }

.bo-total { text-align: right; font-size: 13.5px; font-weight: 600; color: var(--text); }
.bo-disc  { display: block; font-size: 11px; font-weight: 400; color: var(--gold-soft); margin-top: 1px; }

.bo-date     { display: block; font-size: 12px; color: var(--dim); white-space: nowrap; }
.bo-date-sub { display: block; font-size: 11px; color: var(--faint); margin-top: 2px; }

@media (max-width: 1100px) {
  .bo-grid { grid-template-columns: minmax(170px, 1.4fr) minmax(150px, 1.2fr) 110px 110px minmax(120px, 1fr); }
  .bo-col-prov { display: none; }
}
@media (max-width: 820px) {
  .bo-grid { grid-template-columns: minmax(150px, 1.3fr) minmax(130px, 1fr) 100px 110px; }
  .bo-col-date { display: none; }
}
@media (max-width: 640px) {
  .bo-thead { display: none; }
  .bo-trow.bo-grid { grid-template-columns: 1fr auto; gap: 6px 10px; padding: 14px 16px; }
  .bo-cust   { grid-column: 1; grid-row: 1; }
  .bo-total  { grid-column: 2; grid-row: 1; }
  .bo-svc    { grid-column: 1; grid-row: 2; }
  .bo-status { grid-column: 2; grid-row: 2; justify-self: end; }
}
</style>
