<script setup lang="ts">
export interface ProductFormValue {
  name: string
  slug: string
  description: string
  kind: 'recurring' | 'one_time'
  tags: string[]
  grantsDiscord: boolean
  discordRoleId: string
}

const form = defineModel<ProductFormValue>({ required: true })
const props = defineProps<{
  /** create: slug follows the name until edited. edit: slug is fixed (it is in public URLs). */
  mode: 'create' | 'edit'
  /** the type cannot change once the product has variants */
  kindLocked?: boolean
  disabled?: boolean
  suggestions?: string[]
}>()

const uid = useId()
const slugTouched = ref(false)

function slugify(s: string) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

watch(() => form.value.name, (name) => {
  if (props.mode === 'create' && !slugTouched.value) form.value.slug = slugify(name)
})

/** First problem with the form, in Spanish, or null. The pages block saving on it. */
const problem = computed(() => {
  const f = form.value
  if (!f.name.trim()) return 'Escribe el nombre del producto.'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug)) return 'El slug solo puede tener minúsculas, números y guiones.'
  if (f.grantsDiscord && !/^\d{15,21}$/.test(f.discordRoleId.trim())) return 'El ID del rol de Discord son 15 a 21 dígitos.'
  return null
})
defineExpose({ problem })
</script>

<template>
  <div class="pf">
    <div class="pf-row two">
      <label class="pf-field">
        <span class="pf-label">Nombre</span>
        <input v-model="form.name" class="stc-input" maxlength="120" placeholder="Acceso grupo Delta" :disabled="disabled">
      </label>
      <label class="pf-field">
        <span class="pf-label">Slug <small>URL pública: /s/{{ form.slug || '…' }}</small></span>
        <input
          v-model="form.slug"
          class="stc-input stc-mono"
          maxlength="60"
          placeholder="delta"
          :disabled="disabled || mode === 'edit'"
          @input="slugTouched = true"
        >
      </label>
    </div>

    <label class="pf-field">
      <span class="pf-label">Descripción <small>visible en la página del producto</small></span>
      <textarea v-model="form.description" class="stc-input pf-area" rows="3" maxlength="2000" :disabled="disabled" />
    </label>

    <div class="pf-field">
      <span class="pf-label">Tipo de cobro</span>
      <div class="stc-seg pf-seg" role="radiogroup" aria-label="Tipo de cobro">
        <button
          type="button" role="radio" :aria-checked="form.kind === 'recurring'"
          :class="{ on: form.kind === 'recurring' }" :disabled="disabled || kindLocked"
          @click="form.kind = 'recurring'"
        >
          <UIcon name="i-lucide-repeat" class="w-3.5 h-3.5" /> Suscripción
        </button>
        <button
          type="button" role="radio" :aria-checked="form.kind === 'one_time'"
          :class="{ on: form.kind === 'one_time' }" :disabled="disabled || kindLocked"
          @click="form.kind = 'one_time'"
        >
          <UIcon name="i-lucide-receipt" class="w-3.5 h-3.5" /> Pago único
        </button>
      </div>
      <span class="pf-hint">
        <template v-if="kindLocked">El tipo no se puede cambiar porque el producto ya tiene variantes.</template>
        <template v-else-if="form.kind === 'recurring'">Se renueva sola. Variantes: 1, 3, 6 o 12 meses.</template>
        <template v-else>Un solo cargo. El pago único todavía no se puede comprar en el checkout.</template>
      </span>
    </div>

    <div class="pf-field">
      <label class="pf-label" :for="`${uid}-tags`">Etiquetas <small>internas, para ordenar y filtrar. No las ven los clientes</small></label>
      <BillingTagInput v-model="form.tags" :input-id="`${uid}-tags`" :suggestions="suggestions" :disabled="disabled" />
    </div>

    <div class="pf-field">
      <label class="pf-check">
        <input v-model="form.grantsDiscord" type="checkbox" :disabled="disabled">
        <span>
          <b>Da acceso a Discord</b>
          <small>
            {{ form.kind === 'recurring'
              ? 'El rol se da al pagar y se quita cuando la suscripción deja de estar pagada.'
              : 'El rol dura los días que diga cada variante (o para siempre).' }}
          </small>
        </span>
      </label>
      <input
        v-if="form.grantsDiscord"
        v-model="form.discordRoleId"
        class="stc-input stc-mono pf-role"
        inputmode="numeric"
        maxlength="21"
        placeholder="ID del rol, p. ej. 1189234567890123456"
        aria-label="ID del rol de Discord"
        :disabled="disabled"
      >
    </div>
  </div>
</template>

<style scoped>
.pf { display: flex; flex-direction: column; gap: 18px; }
.pf-row.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 640px) { .pf-row.two { grid-template-columns: minmax(0, 1fr); } }
.pf-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.pf-label { font-size: 12px; font-weight: 600; color: var(--text); }
.pf-label small { font-weight: 400; color: var(--faint); margin-left: 6px; }
.pf-hint { font-size: 12px; color: var(--faint); }
.pf-area { resize: vertical; min-height: 76px; line-height: 1.5; }
.pf-seg { width: max-content; max-width: 100%; }
.pf-seg button { display: inline-flex; align-items: center; gap: 6px; }
.pf-seg button:disabled { cursor: not-allowed; opacity: .6; }
.stc-input:disabled { opacity: .7; cursor: not-allowed; }
.pf-check { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
.pf-check input { width: 16px; height: 16px; margin-top: 2px; accent-color: var(--gold); flex-shrink: 0; }
.pf-check b { display: block; font-size: 13.5px; font-weight: 600; color: var(--text); }
.pf-check small { display: block; font-size: 12px; color: var(--dim); margin-top: 2px; }
.pf-role { max-width: 360px; margin-left: 26px; width: calc(100% - 26px); }
</style>
