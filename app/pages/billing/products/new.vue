<script setup lang="ts">
import type { ProductFormValue } from '~/components/billing/ProductForm.vue'

useSeoMeta({ title: 'Nuevo producto - STC Control' })

const { session } = useUserSession()
const canEdit = computed(() => (session.value?.user as any)?.role === 'superadmin')
const toast = useToast()

const form = ref<ProductFormValue>({
  name: '', slug: '', description: '', kind: 'recurring', tags: [], grantsDiscord: true, discordRoleId: '',
})
const formRef = ref<{ problem: string | null } | null>(null)
const saving = ref(false)

// One-time products (events) have a single price and N days of access, set here
// so the event is complete in one step. Subscriptions add variants afterwards.
const oneTime = computed(() => form.value.kind === 'one_time')
const amountText = ref('')
const days = ref<number>(7)
const amount = computed(() => parseMoneyInput(amountText.value))
const priceProblem = computed(() => {
  if (!oneTime.value) return null
  if (!amount.value) return 'Escribe el precio en dólares, por ejemplo 49.00.'
  if (!Number.isInteger(days.value) || days.value < 1 || days.value > 3650) return 'Los días de acceso van de 1 a 3650.'
  return null
})
const problem = computed(() => formRef.value?.problem || priceProblem.value)
const { data: tagSuggestions } = useFetch<string[]>('/api/billing/products/tags', { default: () => [] })

async function create() {
  if (problem.value || saving.value) return
  saving.value = true
  try {
    const f = form.value
    const result = await $fetch<any>('/api/billing/products', {
      method: 'POST',
      body: {
        slug: f.slug,
        name: f.name.trim(),
        description: f.description.trim() || null,
        kind: f.kind,
        tags: f.tags,
        discordRoleId: f.grantsDiscord ? f.discordRoleId.trim() : null,
        active: false,
      },
    })
    let issue = syncProblems(result.sync)
    if (oneTime.value) {
      try {
        const price = await $fetch<any>(`/api/billing/products/${result.service.id}/variants`, {
          method: 'POST',
          body: { amount: amount.value, currency: 'USD', accessDurationDays: days.value, active: false },
        })
        issue = issue || syncProblems(price.sync)
      } catch (e: any) {
        // The product exists; its page offers «Añadir precio».
        toast.add({ title: 'Producto creado, pero sin precio', description: e?.data?.message || e?.statusMessage || e?.message || '', color: 'warning' })
        await navigateTo(`/billing/products/${result.service.id}`)
        return
      }
    }
    toast.add(issue
      ? { title: 'Producto guardado, pero no se sincronizó', description: issue, color: 'warning' }
      : {
          title: 'Producto creado como borrador',
          description: oneTime.value ? 'Revisa el precio y publícalo cuando esté listo.' : 'Añade sus variantes y publícalo cuando esté listo.',
          color: 'success',
        })
    await navigateTo(`/billing/products/${result.service.id}`)
  } catch (e: any) {
    toast.add({ title: 'No se pudo crear el producto', description: e?.data?.message || e?.statusMessage || e?.message || '', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="np-page">
    <NuxtLink to="/billing/products" class="stc-link-all" style="align-self:flex-start">
      <UIcon name="i-lucide-arrow-left" class="w-3.5 h-3.5" />
      Volver a Productos
    </NuxtLink>

    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Nuevo producto</div>
        <div class="stc-page-sub">Se crea como borrador y se copia a Stripe. Los clientes no lo ven hasta que lo publiques.</div>
      </div>
    </div>

    <section v-if="!canEdit" class="stc-panel np-p">
      <div class="stc-empty">
        <UIcon name="i-lucide-lock" />
        <p>Solo un superadmin puede crear productos.</p>
      </div>
    </section>

    <form v-else class="stc-panel np-p" @submit.prevent="create">
      <BillingProductForm ref="formRef" v-model="form" mode="create" :suggestions="tagSuggestions" :disabled="saving" />
      <div v-if="oneTime" class="np-price">
        <label class="np-field">
          <span class="np-label">Precio (USD)</span>
          <span class="np-amount">$ <input v-model="amountText" class="stc-input stc-mono" inputmode="decimal" placeholder="49.00" :disabled="saving"></span>
        </label>
        <label class="np-field">
          <span class="np-label">Días de acceso <small>desde el pago; luego se quita el rol</small></span>
          <span class="np-amount"><input v-model.number="days" type="number" min="1" max="3650" class="stc-input stc-mono" :disabled="saving"> días</span>
        </label>
      </div>
      <div class="np-foot">
        <span v-if="problem && form.name" class="np-err">{{ problem }}</span>
        <NuxtLink to="/billing/products" class="stc-btn">Cancelar</NuxtLink>
        <button type="submit" class="stc-btn gold" :disabled="saving || !!problem">
          {{ saving ? 'Creando…' : 'Crear borrador' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.np-page { display: flex; flex-direction: column; gap: 18px; max-width: 820px; width: 100%; }
.np-p { padding: 22px; }
.np-foot { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }
.np-price { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; padding-top: 18px; border-top: 1px dashed var(--line-2); }
@media (max-width: 640px) { .np-price { grid-template-columns: minmax(0, 1fr); } }
.np-field { display: flex; flex-direction: column; gap: 7px; }
.np-label { font-size: 12px; font-weight: 600; color: var(--text); }
.np-label small { font-weight: 400; color: var(--faint); margin-left: 6px; }
.np-amount { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--dim); }
.np-amount .stc-input { max-width: 160px; }
.np-err { font-size: 12.5px; color: var(--red); margin-right: auto; }
</style>
