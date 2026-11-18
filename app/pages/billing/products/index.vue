<script setup lang="ts">
useSeoMeta({
  title: 'Productos - STC Control',
  description: 'Productos y variantes que se venden en stc-billing (Stripe y PayPal).',
})

const { session } = useUserSession()
const canEdit = computed(() => (session.value?.user as any)?.role === 'superadmin')

const FILTERS = [
  { key: 'all',      label: 'Todos' },
  { key: 'live',     label: 'Publicados' },
  { key: 'draft',    label: 'Borradores' },
  { key: 'archived', label: 'Archivados' },
] as const
const filter = ref<(typeof FILTERS)[number]['key']>('all')
const tag = ref<string | null>(null)

// The catalog is small: load everything (archived too) and filter here.
const { data, pending, error, refresh } = useFetch<any[]>('/api/billing/products', { query: { archived: '1' }, default: () => [] })

const allTags = computed(() => [...new Set((data.value ?? []).flatMap(p => p.tags ?? []))].sort())

const rows = computed(() =>
  (data.value ?? []).filter((p) => {
    if (tag.value && !(p.tags ?? []).includes(tag.value)) return false
    if (filter.value === 'archived') return !!p.archivedAt
    if (p.archivedAt) return false
    if (filter.value === 'live') return p.active
    if (filter.value === 'draft') return !p.active
    return true
  }),
)

function onSale(p: any) {
  return (p.prices ?? []).filter((v: any) => v.active)
}

function summary(p: any) {
  const sale = onSale(p)
  const drafts = (p.prices ?? []).filter((v: any) => !v.active && !v.retiredAt).length
  if (!sale.length && !drafts) return 'Sin variantes'
  const parts: string[] = []
  if (sale.length) parts.push(`${sale.length} a la venta · desde ${formatMoney(Math.min(...sale.map((v: any) => v.amount)), sale[0].currency)}`)
  if (drafts) parts.push(`${drafts} en borrador`)
  return parts.join(' · ')
}

function hasSyncError(p: any) {
  return !!p.syncError || (p.prices ?? []).some((v: any) => v.syncError)
}
</script>

<template>
  <div class="bp-page">
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Productos</div>
        <div class="stc-page-sub">Lo que se vende en el checkout. stc-billing es la fuente de verdad y lo copia a Stripe y PayPal.</div>
      </div>
      <div class="bp-head-actions">
        <button class="stc-btn sm" :disabled="pending" title="Actualizar" @click="refresh()">
          <UIcon name="i-lucide-refresh-cw" class="w-3.5 h-3.5" :class="{ 'animate-spin': pending }" />
        </button>
        <NuxtLink v-if="canEdit" to="/billing/products/new" class="stc-btn gold sm">
          <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />
          Nuevo producto
        </NuxtLink>
      </div>
    </div>

    <div class="bp-filters">
      <div class="stc-seg">
        <button v-for="f in FILTERS" :key="f.key" :class="{ on: filter === f.key }" @click="filter = f.key">{{ f.label }}</button>
      </div>
      <div v-if="allTags.length" class="bp-tags" aria-label="Filtrar por etiqueta">
        <button
          v-for="t in allTags" :key="t" type="button"
          class="bp-tag" :class="{ on: tag === t }" :aria-pressed="tag === t"
          @click="tag = tag === t ? null : t"
        >
          {{ t }}
        </button>
      </div>
    </div>

    <section v-if="error" class="stc-panel bp-alert">
      <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 flex-shrink-0" />
      <div>
        <div class="bp-alert-t">Error</div>
        <p class="bp-alert-p">No se pudieron cargar los productos: {{ error.data?.message || error.statusMessage || error.message }}</p>
      </div>
    </section>

    <section v-else class="stc-panel bp-table" style="overflow:hidden">
      <template v-if="pending && !data?.length">
        <div v-for="i in 4" :key="i" class="bp-row bp-grid">
          <div class="space-y-1.5"><USkeleton class="h-4 w-40" /><USkeleton class="h-3 w-24" /></div>
          <USkeleton class="h-5 w-24 rounded-md" />
          <USkeleton class="h-3.5 w-48" />
          <USkeleton class="h-3.5 w-10 bp-col-subs" />
          <USkeleton class="h-5 w-20 rounded-md" />
        </div>
      </template>

      <div v-else-if="!rows.length" class="stc-empty" style="padding:48px 20px">
        <UIcon name="i-lucide-package" />
        <p v-if="!(data ?? []).length">Todavía no hay productos.<template v-if="canEdit"> Crea el primero con «Nuevo producto».</template></p>
        <p v-else>Ningún producto coincide con el filtro.</p>
      </div>

      <template v-else>
        <div class="bp-thead bp-grid">
          <span class="stc-eyebrow">Producto</span>
          <span class="stc-eyebrow">Tipo</span>
          <span class="stc-eyebrow">Variantes</span>
          <span class="stc-eyebrow bp-col-subs" style="text-align:right">Suscriptores</span>
          <span class="stc-eyebrow">Estado</span>
        </div>
        <NuxtLink v-for="p in rows" :key="p.id" :to="`/billing/products/${p.id}`" class="bp-row bp-grid" :class="{ dim: pending }">
          <div class="min-w-0 bp-name-col">
            <div class="bp-name">
              {{ p.name }}
              <UIcon v-if="hasSyncError(p)" name="i-lucide-cloud-alert" class="w-4 h-4 bp-warn" title="Hay cambios que no llegaron a Stripe o PayPal" />
            </div>
            <div class="bp-sub">
              <span class="stc-mono">/s/{{ p.slug }}</span>
              <span v-for="t in p.tags" :key="t" class="bp-chip">{{ t }}</span>
            </div>
          </div>
          <div class="bp-kind">
            <span class="stc-badge" :class="statusMeta(PRODUCT_KIND, p.kind).tone">{{ statusMeta(PRODUCT_KIND, p.kind).label }}</span>
            <UIcon v-if="p.discordRoleId" name="i-lucide-message-circle" class="w-3.5 h-3.5 bp-discord" title="Da acceso a Discord" />
          </div>
          <div class="bp-variants">{{ summary(p) }}</div>
          <div class="bp-col-subs bp-subs stc-mono">{{ p.activeSubscriptions }}</div>
          <div class="bp-status"><span class="stc-badge" :class="productStatus(p).tone">{{ productStatus(p).label }}</span></div>
        </NuxtLink>
      </template>
    </section>
  </div>
</template>

<style scoped>
.bp-page { display: flex; flex-direction: column; gap: 20px; }
.bp-head-actions { display: flex; gap: 8px; align-items: center; }
.bp-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.bp-filters .stc-seg { width: max-content; max-width: 100%; overflow-x: auto; }
.bp-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.bp-tag {
  font-size: 12px; padding: 4px 11px; border-radius: 999px; cursor: pointer;
  color: var(--dim); border: 1px solid var(--line); background: transparent;
}
.bp-tag:hover { color: var(--text); border-color: var(--line-2); }
.bp-tag.on { color: var(--gold-soft); border-color: var(--gold-ring); background: var(--gold-wash); }

.bp-alert { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; color: var(--red); border-color: var(--red-line); background: var(--red-dim); }
.bp-alert-t { font-weight: 600; font-size: 14px; }
.bp-alert-p { font-size: 13px; color: var(--dim); margin-top: 3px; }

.bp-grid {
  display: grid;
  grid-template-columns: minmax(200px, 1.6fr) 140px minmax(180px, 1.4fr) 100px 110px;
  align-items: center; gap: 14px;
}
.bp-thead { padding: 14px 22px; border-bottom: 1px solid var(--line); }
.bp-row { padding: 13px 22px; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; transition: background .14s, opacity .14s; }
.bp-row:last-of-type { border-bottom: none; }
.bp-row:hover { background: rgba(255,255,255,.022); }
html:not(.dark) .bp-row:hover { background: rgba(0,0,0,.02); }
.bp-row.dim { opacity: .55; }
.bp-name { display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; color: var(--text); }
.bp-row:hover .bp-name { color: var(--gold-soft); }
.bp-warn { color: var(--red); flex-shrink: 0; }
.bp-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 3px; font-size: 11.5px; color: var(--faint); }
.bp-chip { font-size: 11px; padding: 0 7px; border-radius: 999px; border: 1px solid var(--line-2); color: var(--dim); }
.bp-kind { display: flex; align-items: center; gap: 8px; }
.bp-discord { color: #5865f2; }
.bp-variants { font-size: 12.5px; color: var(--dim); }
.bp-subs { text-align: right; font-size: 13.5px; color: var(--text); }

/* Sized by the panel, not the window: the sidebar takes part of the width. */
.bp-table { container-type: inline-size; }
@container (max-width: 860px) {
  .bp-grid { grid-template-columns: minmax(180px, 1.5fr) 130px minmax(150px, 1.2fr) 100px; }
  .bp-col-subs { display: none; }
}
@container (max-width: 620px) {
  .bp-thead { display: none; }
  .bp-row.bp-grid { grid-template-columns: 1fr auto; gap: 6px 10px; padding: 14px 16px; }
  .bp-name-col { grid-column: 1; grid-row: 1; }
  .bp-status   { grid-column: 2; grid-row: 1; justify-self: end; }
  .bp-variants { grid-column: 1; grid-row: 2; }
  .bp-kind     { grid-column: 2; grid-row: 2; justify-self: end; }
}
</style>
