<script setup lang="ts">
import type { ProductFormValue } from '~/components/billing/ProductForm.vue'

const route = useRoute()
const id = computed(() => String(route.params.id))
const toast = useToast()
const { session } = useUserSession()
const canEdit = computed(() => (session.value?.user as any)?.role === 'superadmin')

// Awaited so the form below is filled during server render too (an immediate
// watcher runs once on the server, before an un-awaited fetch has data).
const [{ data: p, pending, error, refresh }, { data: tagSuggestions }] = await Promise.all([
  useFetch<any>(() => `/api/billing/products/${id.value}`),
  useFetch<string[]>('/api/billing/products/tags', { default: () => [] }),
])

useSeoMeta({ title: computed(() => `${p.value?.name ?? 'Producto'} - STC Control`) })

const archived = computed(() => !!p.value?.archivedAt)
const editable = computed(() => canEdit.value && !archived.value)
const variants = computed<any[]>(() => p.value?.prices ?? [])
const current = computed(() => variants.value.filter(v => !v.retiredAt))
const retired = computed(() => variants.value.filter(v => v.retiredAt))
const onSale = computed(() => current.value.filter(v => v.active))
const showRetired = ref(false)

// ── Acciones ────────────────────────────────────────────────────────────────

const busy = ref<string | null>(null)

/** Runs a write, then toasts success, a partial success (saved but not synced) or the error. */
async function run(key: string, ok: string, fn: () => Promise<any>) {
  if (busy.value) return null
  busy.value = key
  try {
    const result = await fn()
    const issue = syncProblems(result?.sync ?? result)
    toast.add(issue
      ? { title: `${ok}, pero no se sincronizó`, description: issue, color: 'warning' }
      : { title: ok, color: 'success' })
    await refresh()
    return result
  } catch (e: any) {
    toast.add({ title: 'No se pudo completar', description: e?.data?.message || e?.statusMessage || e?.message || '', color: 'error' })
    return null
  } finally {
    busy.value = null
  }
}

// Typed as a plain string: the template also matches the GET-only /products/tags route.
const productUrl = computed<string>(() => `/api/billing/products/${id.value}`)
const patchProduct = (body: Record<string, unknown>) =>
  $fetch(productUrl.value, { method: 'PATCH', body })
const patchVariant = (v: any, body: Record<string, unknown>) =>
  $fetch(`/api/billing/products/variants/${v.id}`, { method: 'PATCH', body })

const confirmPublish = ref(false)
function publish() {
  if (!onSale.value.length) { confirmPublish.value = true; return }
  run('publish', 'Producto publicado', () => patchProduct({ active: true }))
}
const unpublish = () => run('publish', 'Producto pasado a borrador', () => patchProduct({ active: false }))
const sync = () => run('sync', 'Sincronizado con Stripe y PayPal', () => $fetch(`/api/billing/products/${id.value}/sync`, { method: 'POST' }))

const confirmRemove = ref(false)
async function remove() {
  const result = await run('remove', variants.value.length ? 'Producto archivado' : 'Producto eliminado', () =>
    $fetch<any>(`/api/billing/products/${id.value}`, { method: 'DELETE' }))
  confirmRemove.value = false
  if (result?.deleted) await navigateTo('/billing/products')
}

// ── Detalles (formulario) ──────────────────────────────────────────────────

const form = ref<ProductFormValue>({ name: '', slug: '', description: '', kind: 'recurring', tags: [], grantsDiscord: false, discordRoleId: '' })
const formRef = ref<{ problem: string | null } | null>(null)

function fromProduct(v: any): ProductFormValue {
  return {
    name: v.name,
    slug: v.slug,
    description: v.description ?? '',
    kind: v.kind,
    tags: [...(v.tags ?? [])],
    grantsDiscord: !!v.discordRoleId,
    discordRoleId: v.discordRoleId ?? '',
  }
}
watch(p, (v) => { if (v) form.value = fromProduct(v) }, { immediate: true })

const changes = computed(() => {
  if (!p.value) return {}
  const f = form.value
  const out: Record<string, unknown> = {}
  if (f.name.trim() !== p.value.name) out.name = f.name.trim()
  if ((f.description.trim() || null) !== (p.value.description ?? null)) out.description = f.description.trim() || null
  if (f.kind !== p.value.kind) out.kind = f.kind
  if (f.tags.join(',') !== (p.value.tags ?? []).join(',')) out.tags = f.tags
  const role = f.grantsDiscord ? f.discordRoleId.trim() : null
  if (role !== (p.value.discordRoleId ?? null)) out.discordRoleId = role
  return out
})
const dirty = computed(() => Object.keys(changes.value).length > 0)
const saveDetails = () => run('details', 'Cambios guardados', () => patchProduct(changes.value))
const resetDetails = () => { if (p.value) form.value = fromProduct(p.value) }

// ── Variantes ──────────────────────────────────────────────────────────────

const addOpen = ref(false)
/** Events and other one-time products: a single price with N days of access. */
const oneTime = computed(() => p.value?.kind === 'one_time')

const toggleVariant = (v: any) =>
  run(`v-${v.id}`, v.active ? 'Variante retirada de la venta' : 'Variante a la venta', () => patchVariant(v, { active: !v.active }))

// Cambiar precio
const replacing = ref<any | null>(null)
const replaceText = ref('')
const replaceAmount = computed(() => parseMoneyInput(replaceText.value))
const replaceDays = ref<number | null>(null)
const replaceOpen = computed({ get: () => !!replacing.value, set: (v) => { if (!v) replacing.value = null } })
function openReplace(v: any) {
  replacing.value = v
  replaceText.value = centsToInput(v.amount)
  replaceDays.value = v.accessDurationDays ?? null
}
const replaceDaysValid = computed(() =>
  replacing.value?.kind !== 'one_time' || (Number.isInteger(replaceDays.value) && replaceDays.value! >= 1 && replaceDays.value! <= 3650))
/** What actually changes; empty when nothing does. */
const replaceBody = computed(() => {
  const v = replacing.value
  if (!v || !replaceAmount.value || !replaceDaysValid.value) return null
  const body: Record<string, number> = {}
  if (replaceAmount.value !== v.amount) body.amount = replaceAmount.value
  if (v.kind === 'one_time' && replaceDays.value !== v.accessDurationDays) body.accessDurationDays = replaceDays.value!
  return Object.keys(body).length ? body : null
})
async function doReplace() {
  const v = replacing.value
  const body = replaceBody.value
  if (!v || !body) return
  const result = await run(`v-${v.id}`, 'Precio cambiado', () =>
    $fetch<any>(`/api/billing/products/variants/${v.id}/replace`, { method: 'POST', body }))
  if (result) {
    replacing.value = null
    if (!result.swapped && v.active) {
      toast.add({ title: 'El precio nuevo quedó pendiente', description: 'No llegó a Stripe. Pulsa «Sincronizar» y luego ponlo a la venta; el anterior se retirará solo.', color: 'warning' })
    }
  }
}

// Nombre y etiqueta
const editing = ref<any | null>(null)
const editNickname = ref('')
const editMode = ref<'auto' | 'custom' | 'hidden'>('auto')
const editText = ref('')
const editOpen = computed({ get: () => !!editing.value, set: (v) => { if (!v) editing.value = null } })
function openEdit(v: any) {
  editing.value = v
  editNickname.value = v.nickname ?? ''
  editMode.value = v.badgeMode
  editText.value = v.badgeText ?? ''
}
const editProblem = computed(() => (editMode.value === 'custom' && !editText.value.trim() ? 'Escribe el texto de la etiqueta.' : null))
async function doEdit() {
  const v = editing.value
  if (!v || editProblem.value) return
  const result = await run(`v-${v.id}`, 'Variante actualizada', () =>
    patchVariant(v, {
      nickname: editNickname.value.trim() || null,
      badgeMode: editMode.value,
      badgeText: editMode.value === 'custom' ? editText.value.trim() : null,
    }))
  if (result) editing.value = null
}

// Eliminar (solo si nunca se vendió)
const deleting = ref<any | null>(null)
const deleteOpen = computed({ get: () => !!deleting.value, set: (v) => { if (!v) deleting.value = null } })
async function doDelete() {
  const v = deleting.value
  if (!v) return
  await run(`v-${v.id}`, 'Variante eliminada', () => $fetch(`/api/billing/products/variants/${v.id}`, { method: 'DELETE' }))
  deleting.value = null
}

function badgeNote(v: any) {
  if (v.badgeMode === 'hidden') return v.savingsPercent ? `Oculta (calculada: ${v.savingsPercent}%)` : 'Oculta'
  if (v.badgeMode === 'custom') return v.savingsPercent ? `Personalizada · calculada: ${v.savingsPercent}%` : 'Personalizada'
  return null
}

/** A new price waiting to replace one that is still current (its Stripe push failed). */
function pendingSwap(v: any) {
  return !!v.replacesPriceId && !v.active && variants.value.some(x => x.id === v.replacesPriceId && !x.retiredAt)
}

function replacedBy(v: any) {
  return variants.value.find(x => x.replacesPriceId === v.id)
}
</script>

<template>
  <div class="pd-page">
    <NuxtLink to="/billing/products" class="stc-link-all" style="align-self:flex-start">
      <UIcon name="i-lucide-arrow-left" class="w-3.5 h-3.5" />
      Volver a Productos
    </NuxtLink>

    <section v-if="error" class="stc-panel pd-alert">
      <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 flex-shrink-0" />
      <div>
        <div class="pd-alert-t">{{ error.statusCode === 404 ? 'Producto no encontrado' : 'Error' }}</div>
        <p class="pd-alert-p">{{ error.data?.message || error.statusMessage || error.message }}</p>
      </div>
    </section>

    <template v-else-if="pending && !p">
      <USkeleton class="h-28 w-full rounded-[10px]" />
      <USkeleton class="h-72 w-full rounded-[10px]" />
    </template>

    <template v-else-if="p">
      <!-- Cabecera -->
      <section class="stc-panel pd-head">
        <div class="min-w-0">
          <div class="stc-eyebrow">Producto</div>
          <div class="pd-title">
            <span class="stc-display">{{ p.name }}</span>
            <span class="stc-badge" :class="productStatus(p).tone">{{ productStatus(p).label }}</span>
            <span class="stc-badge" :class="statusMeta(PRODUCT_KIND, p.kind).tone">{{ statusMeta(PRODUCT_KIND, p.kind).label }}</span>
          </div>
          <div class="pd-meta">
            <span class="stc-mono">/s/{{ p.slug }}</span>
            <span>·</span>
            <span>{{ p.activeSubscriptions }} {{ p.activeSubscriptions === 1 ? 'suscriptor activo' : 'suscriptores activos' }}</span>
            <template v-if="p.discordRoleId">
              <span>·</span>
              <span class="pd-discord"><UIcon name="i-lucide-message-circle" class="w-3.5 h-3.5" /> Rol <span class="stc-mono">{{ p.discordRoleId }}</span></span>
            </template>
            <template v-else><span>·</span><span>Sin acceso a Discord</span></template>
          </div>
        </div>
        <div v-if="editable" class="pd-actions">
          <button class="stc-btn sm" :disabled="!!busy" title="Copiar todo a Stripe y PayPal" @click="sync">
            <UIcon name="i-lucide-refresh-cw" class="w-3.5 h-3.5" :class="{ 'animate-spin': busy === 'sync' }" />
            Sincronizar
          </button>
          <button v-if="p.active" class="stc-btn sm" :disabled="!!busy" @click="unpublish">
            <UIcon name="i-lucide-eye-off" class="w-3.5 h-3.5" /> Pasar a borrador
          </button>
          <button v-else class="stc-btn gold sm" :disabled="!!busy" @click="publish">
            <UIcon name="i-lucide-eye" class="w-3.5 h-3.5" /> Publicar
          </button>
          <button class="stc-btn danger sm" :disabled="!!busy" @click="confirmRemove = true">
            <UIcon :name="variants.length ? 'i-lucide-archive' : 'i-lucide-trash-2'" class="w-3.5 h-3.5" />
            {{ variants.length ? 'Archivar' : 'Eliminar' }}
          </button>
        </div>
        <button v-else class="stc-btn sm" :disabled="pending" title="Actualizar" @click="refresh()">
          <UIcon name="i-lucide-refresh-cw" class="w-3.5 h-3.5" :class="{ 'animate-spin': pending }" />
        </button>
      </section>

      <!-- Avisos -->
      <div v-if="p.syncError" class="pd-note err">
        <UIcon name="i-lucide-cloud-alert" class="w-4 h-4" />
        <span><b>El producto no está al día en Stripe/PayPal.</b> {{ p.syncError }}. Pulsa «Sincronizar» para reintentar.</span>
      </div>
      <div v-if="archived" class="pd-note">
        <UIcon name="i-lucide-archive" class="w-4 h-4" />
        <span>Archivado el {{ formatBillingDate(p.archivedAt) }}. Nadie puede comprarlo; los suscriptores actuales siguen renovando hasta que cancelen.</span>
      </div>
      <div v-else-if="!p.active" class="pd-note">
        <UIcon name="i-lucide-pencil-ruler" class="w-4 h-4" />
        <span><b>Borrador.</b> Los clientes no lo ven. Ya está en Stripe, así que puedes revisarlo allí antes de publicar.</span>
      </div>
      <div v-if="p.kind === 'one_time' && !archived" class="pd-note">
        <UIcon name="i-lucide-info" class="w-4 h-4" />
        <span>El checkout de pago único todavía no existe: este producto se muestra como «Próximamente» aunque esté publicado.</span>
      </div>

      <!-- Variantes -->
      <section class="stc-panel pd-table" style="overflow:hidden">
        <div class="stc-panel-head">
          <div class="stc-panel-title">
            <UIcon :name="oneTime ? 'i-lucide-ticket' : 'i-lucide-layers'" class="w-5 h-5" />
            {{ oneTime ? 'Precio y acceso' : 'Variantes' }}
            <span v-if="!oneTime" class="pd-count">{{ current.length }}</span>
          </div>
          <button v-if="editable && (!oneTime || !current.length)" class="stc-btn gold-soft sm" @click="addOpen = true">
            <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" /> {{ oneTime ? 'Añadir precio' : 'Añadir variante' }}
          </button>
        </div>

        <div v-if="!current.length" class="stc-empty" style="padding:36px 20px">
          <UIcon name="i-lucide-layers" />
          <p>
            <template v-if="oneTime">Sin precio todavía.<template v-if="editable"> Añade el precio y los días de acceso.</template></template>
            <template v-else>Sin variantes todavía.<template v-if="editable"> Añade la de 1 mes primero: las demás calculan su ahorro contra ella.</template></template>
          </p>
        </div>

        <template v-else>
          <div class="pd-thead pd-grid">
            <span class="stc-eyebrow">{{ oneTime ? 'Acceso' : 'Variante' }}</span>
            <span class="stc-eyebrow" style="text-align:right">Monto</span>
            <span class="stc-eyebrow">{{ oneTime ? '' : 'Etiqueta' }}</span>
            <span class="stc-eyebrow">Estado</span>
            <span class="stc-eyebrow pd-col-subs" style="text-align:right">Suscr.</span>
            <span class="stc-eyebrow pd-col-sync">Stripe</span>
            <span v-if="editable" />
          </div>
          <div v-for="v in current" :key="v.id" class="pd-row pd-grid" :class="{ dim: busy === `v-${v.id}` }">
            <div class="min-w-0 pd-v-name">
              <div class="pd-name">{{ variantLabel(v) }}</div>
              <div class="pd-sub">
                {{ v.kind === 'recurring' ? cadenceLabel(v.interval, v.intervalCount) : (v.accessDurationDays ? 'de acceso, desde el pago' : 'Acceso de por vida') }}
              </div>
            </div>
            <div class="pd-amt">
              <span class="stc-mono">{{ formatMoney(v.amount, v.currency) }}</span>
              <span v-if="v.perMonth" class="pd-per stc-mono">{{ formatMoney(v.perMonth, v.currency) }}/mes</span>
            </div>
            <div v-if="oneTime" class="pd-badge" />
            <div v-else class="pd-badge">
              <span v-if="v.badge" class="stc-badge solid">{{ v.badge }}</span>
              <span v-else class="pd-none">—</span>
              <span v-if="badgeNote(v)" class="pd-badge-note">{{ badgeNote(v) }}</span>
            </div>
            <div class="pd-status">
              <span class="stc-badge" :class="variantStatus(v, pendingSwap(v)).tone">{{ variantStatus(v, pendingSwap(v)).label }}</span>
              <span v-if="pendingSwap(v)" class="pd-badge-note">Al ponerla a la venta reemplaza al precio actual</span>
            </div>
            <div class="pd-col-subs pd-subs stc-mono">{{ v.activeSubscriptions }}</div>
            <div class="pd-col-sync">
              <span v-if="v.syncError" class="pd-sync bad" :title="v.syncError"><UIcon name="i-lucide-cloud-alert" class="w-3.5 h-3.5" /> Error</span>
              <span v-else-if="v.stripePriceId" class="pd-sync ok" :title="v.stripePriceId"><UIcon name="i-lucide-cloud-check" class="w-3.5 h-3.5" /> Al día</span>
              <span v-else class="pd-sync bad"><UIcon name="i-lucide-cloud-off" class="w-3.5 h-3.5" /> Falta</span>
            </div>
            <div v-if="editable" class="pd-row-actions">
              <button class="pd-icon" :title="v.active ? 'Quitar de la venta' : 'Poner a la venta'" :aria-label="v.active ? 'Quitar de la venta' : 'Poner a la venta'" :disabled="!!busy" @click="toggleVariant(v)">
                <UIcon :name="v.active ? 'i-lucide-pause' : 'i-lucide-play'" class="w-4 h-4" />
              </button>
              <button class="pd-icon" :title="oneTime ? 'Cambiar precio o días' : 'Cambiar precio'" :aria-label="oneTime ? 'Cambiar precio o días' : 'Cambiar precio'" :disabled="!!busy || !!replacedBy(v)" @click="openReplace(v)">
                <UIcon name="i-lucide-dollar-sign" class="w-4 h-4" />
              </button>
              <button v-if="!oneTime" class="pd-icon" title="Nombre y etiqueta" aria-label="Nombre y etiqueta" :disabled="!!busy" @click="openEdit(v)">
                <UIcon name="i-lucide-tag" class="w-4 h-4" />
              </button>
              <button
                class="pd-icon danger" title="Eliminar (solo si nunca se vendió)" aria-label="Eliminar"
                :disabled="!!busy || v.activeSubscriptions > 0" @click="deleting = v"
              >
                <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </template>

        <div v-if="retired.length" class="pd-retired">
          <button class="pd-retired-toggle" :aria-expanded="showRetired" @click="showRetired = !showRetired">
            <UIcon :name="showRetired ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="w-4 h-4" />
            Precios anteriores ({{ retired.length }})
            <span v-if="!oneTime" class="pd-retired-sub">· {{ retired.reduce((s, v) => s + v.activeSubscriptions, 0) }} suscriptores siguen pagando el precio anterior</span>
            <span v-else class="pd-retired-sub">· quienes compraron antes conservan sus días</span>
          </button>
          <div v-if="showRetired" class="pd-retired-list">
            <div v-for="v in retired" :key="v.id" class="pd-retired-row">
              <span>{{ variantLabel(v) }}</span>
              <span class="stc-mono">{{ formatMoney(v.amount, v.currency) }}</span>
              <span>Retirado {{ formatBillingDate(v.retiredAt) }}</span>
              <span v-if="!oneTime" class="stc-mono">{{ v.activeSubscriptions }} suscr.</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Detalles -->
      <form class="stc-panel" @submit.prevent="saveDetails">
        <div class="stc-panel-head">
          <div class="stc-panel-title"><UIcon name="i-lucide-package" class="w-5 h-5" /> Detalles</div>
        </div>
        <div class="pd-form">
          <BillingProductForm
            ref="formRef" v-model="form" mode="edit"
            :kind-locked="variants.length > 0" :suggestions="tagSuggestions" :disabled="!editable || busy === 'details'"
          />
        </div>
        <div v-if="editable" class="pd-foot">
          <span v-if="formRef?.problem" class="pd-err">{{ formRef.problem }}</span>
          <button type="button" class="stc-btn" :disabled="!dirty || !!busy" @click="resetDetails">Descartar</button>
          <button type="submit" class="stc-btn gold" :disabled="!dirty || !!busy || !!formRef?.problem">
            {{ busy === 'details' ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>

      <!-- Modales -->
      <BillingVariantModal v-model:open="addOpen" :product="p" @saved="refresh()" />

      <UModal v-model:open="replaceOpen" :dismissible="!busy">
        <template #content>
          <form v-if="replacing" class="pm" @submit.prevent="doReplace">
            <div class="pm-head">
              <span class="pm-glyph"><UIcon name="i-lucide-dollar-sign" class="w-5 h-5" /></span>
              <h3 class="pm-title">{{ oneTime ? 'Cambiar precio o días' : `Cambiar precio · ${variantLabel(replacing)}` }}</h3>
            </div>
            <p v-if="oneTime" class="pm-p">
              Se crea un precio nuevo para las compras nuevas.
              <template v-if="replacing.active">Sale a la venta en lugar del actual.</template>
              <template v-else>Queda como borrador, igual que el actual.</template>
              Quienes ya compraron conservan los <b>{{ replacing.accessDurationDays ?? '∞' }} días</b> que pagaron.
            </p>
            <p v-else class="pm-p">
              Stripe no permite editar un precio, así que se crea uno nuevo de
              <b>{{ formatInterval(replacing.interval, replacing.intervalCount).toLowerCase() }}</b>.
              <template v-if="replacing.active">Sale a la venta en lugar del actual.</template>
              <template v-else>Queda como borrador, igual que el actual.</template>
            </p>
            <p v-if="!oneTime && replacing.activeSubscriptions" class="pm-p">
              Los <b>{{ replacing.activeSubscriptions }}</b> suscriptores actuales siguen pagando
              <b>{{ formatMoney(replacing.amount, replacing.currency) }}</b>: el cambio solo aplica a compras nuevas.
            </p>
            <label class="pm-field">
              <span class="pm-label">Monto nuevo (USD)</span>
              <input v-model="replaceText" class="stc-input stc-mono" inputmode="decimal" autofocus>
            </label>
            <label v-if="oneTime" class="pm-field">
              <span class="pm-label">Días de acceso <small>contados desde el pago</small></span>
              <input v-model.number="replaceDays" type="number" min="1" max="3650" class="stc-input stc-mono" style="max-width:140px">
            </label>
            <p v-if="replaceText && !replaceAmount" class="pm-err">Escribe el monto en dólares, por ejemplo 237.60.</p>
            <p v-else-if="!replaceDaysValid" class="pm-err">Los días de acceso van de 1 a 3650.</p>
            <div class="pm-foot">
              <button type="button" class="stc-btn" :disabled="!!busy" @click="replacing = null">Cancelar</button>
              <button type="submit" class="stc-btn gold" :disabled="!!busy || !replaceBody">
                {{ busy ? 'Guardando…' : oneTime ? 'Guardar cambio' : 'Cambiar precio' }}
              </button>
            </div>
          </form>
        </template>
      </UModal>

      <UModal v-model:open="editOpen" :dismissible="!busy">
        <template #content>
          <form v-if="editing" class="pm" @submit.prevent="doEdit">
            <div class="pm-head">
              <span class="pm-glyph"><UIcon name="i-lucide-tag" class="w-5 h-5" /></span>
              <h3 class="pm-title">Nombre y etiqueta</h3>
            </div>
            <label class="pm-field">
              <span class="pm-label">Nombre visible <small>vacío = «{{ variantLabel({ ...editing, nickname: null }) }}»</small></span>
              <input v-model="editNickname" class="stc-input" maxlength="80">
            </label>
            <div class="pm-field">
              <span class="pm-label">Etiqueta en la pestaña</span>
              <div class="stc-seg" style="width:max-content;max-width:100%">
                <button type="button" :class="{ on: editMode === 'auto' }" @click="editMode = 'auto'">Automática</button>
                <button type="button" :class="{ on: editMode === 'custom' }" @click="editMode = 'custom'">Personalizada</button>
                <button type="button" :class="{ on: editMode === 'hidden' }" @click="editMode = 'hidden'">Ocultar</button>
              </div>
              <span class="pm-hint">
                <template v-if="editMode === 'auto'">{{ editing.savingsPercent ? `Muestra «Ahorra ${editing.savingsPercent}%» y se recalcula si cambia el precio base.` : 'Sin ahorro calculado: no se muestra nada.' }}</template>
                <template v-else-if="editMode === 'custom'">No se recalcula: revísala si cambias el precio de 1 mes.</template>
                <template v-else>No se muestra ninguna etiqueta.</template>
              </span>
              <input v-if="editMode === 'custom'" v-model="editText" class="stc-input" maxlength="24" placeholder="Mejor precio">
            </div>
            <p v-if="editProblem" class="pm-err">{{ editProblem }}</p>
            <div class="pm-foot">
              <button type="button" class="stc-btn" :disabled="!!busy" @click="editing = null">Cancelar</button>
              <button type="submit" class="stc-btn gold" :disabled="!!busy || !!editProblem">{{ busy ? 'Guardando…' : 'Guardar' }}</button>
            </div>
          </form>
        </template>
      </UModal>

      <UModal v-model:open="deleteOpen" :dismissible="!busy">
        <template #content>
          <div v-if="deleting" class="pm">
            <div class="pm-head">
              <span class="pm-glyph danger"><UIcon name="i-lucide-trash-2" class="w-5 h-5" /></span>
              <h3 class="pm-title">{{ oneTime ? 'Eliminar precio' : 'Eliminar variante' }}</h3>
            </div>
            <p class="pm-p">
              Se elimina <b>{{ variantLabel(deleting) }} · {{ formatMoney(deleting.amount, deleting.currency) }}</b> y su precio en Stripe se archiva.
              Solo funciona si nunca se vendió; si ya tiene ventas, quítala de la venta en su lugar.
            </p>
            <div class="pm-foot">
              <button class="stc-btn" :disabled="!!busy" @click="deleting = null">Cancelar</button>
              <button class="stc-btn danger" :disabled="!!busy" @click="doDelete">{{ busy ? 'Eliminando…' : 'Eliminar' }}</button>
            </div>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="confirmRemove" :dismissible="!busy">
        <template #content>
          <div class="pm">
            <div class="pm-head">
              <span class="pm-glyph danger"><UIcon :name="variants.length ? 'i-lucide-archive' : 'i-lucide-trash-2'" class="w-5 h-5" /></span>
              <h3 class="pm-title">{{ variants.length ? 'Archivar producto' : 'Eliminar producto' }}</h3>
            </div>
            <p v-if="variants.length" class="pm-p">
              <b>{{ p.name }}</b> deja de venderse y sus variantes se retiran de la venta, aquí y en Stripe.
              <template v-if="p.activeSubscriptions">Los <b>{{ p.activeSubscriptions }}</b> suscriptores actuales siguen renovando hasta que cancelen.</template>
              No se puede desarchivar.
            </p>
            <p v-else class="pm-p"><b>{{ p.name }}</b> no tiene variantes, así que se elimina por completo.</p>
            <div class="pm-foot">
              <button class="stc-btn" :disabled="!!busy" @click="confirmRemove = false">Cancelar</button>
              <button class="stc-btn danger" :disabled="!!busy" @click="remove">
                {{ busy ? 'Un momento…' : variants.length ? 'Archivar' : 'Eliminar' }}
              </button>
            </div>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="confirmPublish" :dismissible="!busy">
        <template #content>
          <div class="pm">
            <div class="pm-head">
              <span class="pm-glyph"><UIcon name="i-lucide-eye" class="w-5 h-5" /></span>
              <h3 class="pm-title">Publicar sin variantes a la venta</h3>
            </div>
            <p class="pm-p">Ninguna variante está a la venta, así que la página del producto dirá que no hay planes disponibles. ¿Publicar igualmente?</p>
            <div class="pm-foot">
              <button class="stc-btn" @click="confirmPublish = false">Cancelar</button>
              <button class="stc-btn gold" :disabled="!!busy" @click="confirmPublish = false; run('publish', 'Producto publicado', () => patchProduct({ active: true }))">Publicar</button>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>

<style scoped>
.pd-page { display: flex; flex-direction: column; gap: 16px; max-width: 1180px; width: 100%; }
.pd-alert { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; color: var(--red); border-color: var(--red-line); background: var(--red-dim); }
.pd-alert-t { font-weight: 600; font-size: 14px; }
.pd-alert-p { font-size: 13px; color: var(--dim); margin-top: 3px; }

.pd-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; padding: 20px 22px; }
.pd-title { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
.pd-title .stc-display { font-size: 30px; line-height: 1.05; }
.pd-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; font-size: 12.5px; color: var(--dim); }
.pd-discord { display: inline-flex; align-items: center; gap: 5px; }
.pd-discord .iconify { color: #5865f2; }
.pd-actions { display: flex; flex-wrap: wrap; gap: 8px; }

.pd-note {
  display: flex; align-items: flex-start; gap: 9px; font-size: 12.5px; line-height: 1.5; color: var(--dim);
  border: 1px dashed var(--line-2); border-radius: var(--r-sm); padding: 11px 13px;
}
.pd-note .iconify { flex-shrink: 0; margin-top: 2px; }
.pd-note b { color: var(--text); font-weight: 600; }
.pd-note.err { color: var(--red); border-style: solid; border-color: var(--red-line); background: var(--red-dim); }
.pd-note.err b { color: inherit; }

.pd-count { font-size: 12px; color: var(--faint); font-weight: 500; }
.pd-grid {
  display: grid;
  grid-template-columns: minmax(140px, 1.2fr) 130px minmax(130px, 1fr) minmax(120px, 1fr) 60px 90px 150px;
  align-items: center; gap: 12px;
}
.pd-thead { padding: 12px 20px; border-bottom: 1px solid var(--line); }
.pd-row { padding: 12px 20px; border-bottom: 1px solid var(--line); transition: opacity .14s; }
.pd-row:last-of-type { border-bottom: none; }
.pd-row.dim { opacity: .5; }
.pd-name { font-size: 13.5px; font-weight: 600; color: var(--text); }
.pd-sub { font-size: 11.5px; color: var(--faint); margin-top: 2px; }
.pd-amt { text-align: right; font-size: 13.5px; font-weight: 600; color: var(--text); }
.pd-per { display: block; font-size: 11px; font-weight: 400; color: var(--gold-soft); margin-top: 2px; }
.pd-badge, .pd-status { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.pd-badge-note { font-size: 11px; color: var(--faint); line-height: 1.35; }
.pd-none { color: var(--faint); }
.pd-subs { text-align: right; font-size: 13px; color: var(--text); }
.pd-sync { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; }
.pd-sync.ok { color: var(--green); }
.pd-sync.bad { color: var(--red); }
.pd-row-actions { display: flex; justify-content: flex-end; gap: 4px; }
.pd-icon {
  width: 32px; height: 32px; display: grid; place-items: center; border-radius: var(--r-sm); cursor: pointer;
  color: var(--dim); border: 1px solid var(--line); background: transparent; transition: .14s;
}
.pd-icon:hover:not(:disabled) { color: var(--gold-soft); border-color: var(--gold-ring); background: var(--gold-wash); }
.pd-icon.danger:hover:not(:disabled) { color: var(--red); border-color: var(--red-line); background: var(--red-dim); }
.pd-icon:disabled { opacity: .35; cursor: not-allowed; }

.pd-retired { border-top: 1px solid var(--line); }
.pd-retired-toggle { display: flex; align-items: center; gap: 6px; width: 100%; padding: 12px 20px; font-size: 12.5px; color: var(--dim); cursor: pointer; text-align: left; }
.pd-retired-toggle:hover { color: var(--text); }
.pd-retired-sub { color: var(--faint); }
.pd-retired-list { padding: 0 20px 12px 42px; display: flex; flex-direction: column; gap: 6px; }
.pd-retired-row { display: grid; grid-template-columns: minmax(100px, 1fr) 110px minmax(130px, 1fr) 80px; gap: 12px; font-size: 12.5px; color: var(--faint); }

.pd-form { padding: 20px 22px; }
.pd-foot { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 10px; padding: 14px 22px; border-top: 1px solid var(--line); }
.pd-err { font-size: 12.5px; color: var(--red); margin-right: auto; }

/* Sized by the panel, not the window: the sidebar takes part of the width. */
.pd-table { container-type: inline-size; }
@container (max-width: 1000px) {
  .pd-grid { grid-template-columns: minmax(130px, 1.2fr) 120px minmax(120px, 1fr) minmax(110px, 1fr) 150px; }
  .pd-col-subs, .pd-col-sync { display: none; }
}
@container (max-width: 680px) {
  .pd-thead { display: none; }
  .pd-row.pd-grid { grid-template-columns: 1fr auto; gap: 8px 10px; padding: 14px 16px; }
  .pd-v-name { grid-column: 1; grid-row: 1; }
  .pd-amt { grid-column: 2; grid-row: 1; }
  .pd-badge { grid-column: 1; grid-row: 2; }
  .pd-status { grid-column: 2; grid-row: 2; align-items: flex-end; text-align: right; }
  .pd-row-actions { grid-column: 1 / -1; grid-row: 3; justify-content: flex-start; }
  .pd-retired-list { padding-left: 20px; }
  .pd-retired-row { grid-template-columns: 1fr auto; }
}

/* modales */
.pm { padding: 24px; display: flex; flex-direction: column; gap: 14px; }
.pm-head { display: flex; align-items: center; gap: 12px; }
.pm-glyph {
  width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center;
  color: var(--gold); background: var(--gold-wash); border: 1px solid var(--gold-ring);
}
.pm-glyph.danger { color: var(--red); background: var(--red-dim); border-color: var(--red-line); }
.pm-title { font-family: var(--disp); font-size: 22px; font-weight: 700; letter-spacing: .015em; text-transform: uppercase; color: var(--text); }
.pm-p { font-size: 13.5px; color: var(--dim); line-height: 1.55; }
.pm-p b { color: var(--text); font-weight: 600; }
.pm-field { display: flex; flex-direction: column; gap: 7px; }
.pm-label { font-size: 12px; font-weight: 600; color: var(--text); }
.pm-label small { font-weight: 400; color: var(--faint); margin-left: 4px; }
.pm-hint { font-size: 12px; color: var(--faint); }
.pm-err { font-size: 12.5px; color: var(--red); }
.pm-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
</style>
