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
const { data: tagSuggestions } = useFetch<string[]>('/api/billing/products/tags', { default: () => [] })

async function create() {
  if (formRef.value?.problem || saving.value) return
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
    const issue = syncProblems(result.sync)
    toast.add(issue
      ? { title: 'Producto guardado, pero no se sincronizó', description: issue, color: 'warning' }
      : { title: 'Producto creado como borrador', description: 'Añade sus variantes y publícalo cuando esté listo.', color: 'success' })
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
      <div class="np-foot">
        <span v-if="formRef?.problem && form.name" class="np-err">{{ formRef.problem }}</span>
        <NuxtLink to="/billing/products" class="stc-btn">Cancelar</NuxtLink>
        <button type="submit" class="stc-btn gold" :disabled="saving || !!formRef?.problem">
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
.np-err { font-size: 12.5px; color: var(--red); margin-right: auto; }
</style>
