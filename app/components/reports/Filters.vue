<script setup lang="ts">
import {
  ENGAGEMENT_HINTS,
  ENGAGEMENT_LABELS,
  ENGAGEMENT_STATES,
  EXPIRY_OPTIONS,
  PLAN_LABELS,
  TIERS,
  TIER_LABELS,
  type ExpiryFilter,
  type PlanStatus,
  type ReportFilters,
} from '#shared/reports'

const props = defineProps<{
  filters: ReportFilters
  locations: { noneCount: number; countries: any[] }
  admins: string[]
}>()
const emit = defineEmits<{ patch: [p: Partial<ReportFilters>] }>()

const f = computed(() => props.filters)
const patch = (p: Partial<ReportFilters>) => emit('patch', p)

function toggle<K extends 'tier' | 'engagement' | 'plan'>(key: K, value: ReportFilters[K][number]) {
  const cur = f.value[key] as string[]
  patch({ [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] } as Partial<ReportFilters>)
}

// ── Search (debounced so typing doesn't refetch on every key) ──
const q = ref(f.value.q)
watch(() => f.value.q, (v) => { if (v !== q.value.trim()) q.value = v })
let qTimer: ReturnType<typeof setTimeout> | undefined
function onSearch() {
  clearTimeout(qTimer)
  qTimer = setTimeout(() => patch({ q: q.value.trim() }), 300)
}
onBeforeUnmount(() => clearTimeout(qTimer))

// ── Location ──
const selectedCountry = computed(() => props.locations.countries.find((c: any) => c.code === f.value.country))
const regionOptions = computed<any[]>(() => selectedCountry.value?.regions ?? [])
const cityOptions = computed<any[]>(() => regionOptions.value.find((r: any) => r.key === f.value.region)?.cities ?? [])
const val = (e: Event) => (e.target as HTMLInputElement | HTMLSelectElement).value

// ── Expiry ──
const expiryChips = EXPIRY_OPTIONS.filter(o => o.value)
function setExpiry(v: ExpiryFilter) {
  patch({ expiry: f.value.expiry === v ? '' : v, expFrom: '', expTo: '' })
}

const planOptions: PlanStatus[] = ['active', 'paused', 'canceled', 'churned', 'none']

function num(e: Event): number | null {
  const v = val(e).trim()
  return /^\d+$/.test(v) ? Number(v) : null
}

// "Más filtros" opens by itself when one of its filters is in use
const moreActive = computed(() =>
  !!(f.value.plan.length || f.value.joinedFrom || f.value.joinedTo || f.value.meetings
    || f.value.meetingsMin !== null || f.value.msgMin !== null || f.value.msgMax !== null
    || f.value.contacted || f.value.contactedBy || f.value.cf))
const moreOpen = ref(moreActive.value)
watch(moreActive, (v) => { if (v) moreOpen.value = true })
</script>

<template>
  <div class="r-form">
    <!-- Buscar -->
    <div class="r-group">
      <label class="stc-eyebrow" for="r-q">Buscar</label>
      <div class="r-search">
        <UIcon name="i-lucide-search" class="r-search-ico" />
        <input id="r-q" v-model="q" class="r-input" type="search" placeholder="Nombre de usuario…" @input="onSearch">
      </div>
    </div>

    <!-- Ubicación -->
    <div class="r-group">
      <span class="stc-eyebrow">Ubicación</span>
      <select
        class="r-input r-select" :class="{ set: f.country }" :value="f.country" aria-label="País"
        @change="patch({ country: val($event), region: '', city: '' })"
      >
        <option value="">Todos los países</option>
        <option v-for="c in locations.countries" :key="c.code" :value="c.code" :selected="c.code === f.country">
          {{ countryLabel(c.code) }} ({{ c.count }})
        </option>
        <option v-if="locations.noneCount" value="none" :selected="f.country === 'none'">Sin ubicación ({{ locations.noneCount }})</option>
      </select>
      <select
        class="r-input r-select" :class="{ set: f.region }" :value="f.region" :disabled="!selectedCountry"
        aria-label="Provincia o estado" @change="patch({ region: val($event), city: '' })"
      >
        <option value="">Todas las provincias</option>
        <option v-for="r in regionOptions" :key="r.key" :value="r.key" :selected="r.key === f.region">
          {{ r.name ?? 'Sin provincia' }} ({{ r.count }})
        </option>
      </select>
      <select
        class="r-input r-select" :class="{ set: f.city }" :value="f.city" :disabled="!cityOptions.length"
        aria-label="Ciudad" @change="patch({ city: val($event) })"
      >
        <option value="">Todas las ciudades</option>
        <option v-for="c in cityOptions" :key="c.key" :value="c.key" :selected="c.key === f.city">{{ c.name }} ({{ c.count }})</option>
      </select>
    </div>

    <!-- Tier -->
    <div class="r-group">
      <span class="stc-eyebrow">Tier</span>
      <div class="r-chips">
        <button
          v-for="t in TIERS" :key="t" type="button" class="r-chip" :class="[{ on: f.tier.includes(t) }, t]"
          :aria-pressed="f.tier.includes(t)" @click="toggle('tier', t)"
        >
          <UIcon name="i-lucide-check" class="r-tick" />{{ TIER_LABELS[t] }}
        </button>
      </div>
    </div>

    <!-- Membresía -->
    <div class="r-group">
      <span class="stc-eyebrow">Membresía</span>
      <div class="r-seg">
        <button type="button" :class="{ on: f.member === 'active' }" @click="patch({ member: 'active' })">En el servidor</button>
        <button type="button" :class="{ on: f.member === 'removed' }" @click="patch({ member: 'removed' })">Eliminados</button>
        <button type="button" :class="{ on: f.member === 'all' }" @click="patch({ member: 'all' })">Todos</button>
      </div>
    </div>

    <!-- Actividad -->
    <div class="r-group">
      <span class="stc-eyebrow">Actividad</span>
      <div class="r-chips">
        <button
          v-for="e in ENGAGEMENT_STATES" :key="e" type="button" class="r-chip" :class="{ on: f.engagement.includes(e) }"
          :aria-pressed="f.engagement.includes(e)" :title="ENGAGEMENT_HINTS[e]" @click="toggle('engagement', e)"
        >
          <UIcon name="i-lucide-check" class="r-tick" />{{ ENGAGEMENT_LABELS[e] }}
          <small>{{ ENGAGEMENT_HINTS[e] }}</small>
        </button>
      </div>
    </div>

    <!-- Vencimiento -->
    <div class="r-group">
      <span class="stc-eyebrow">Vencimiento de membresía</span>
      <div class="r-chips">
        <button
          v-for="o in expiryChips" :key="o.value" type="button" class="r-chip" :class="{ on: f.expiry === o.value }"
          :aria-pressed="f.expiry === o.value" @click="setExpiry(o.value)"
        >
          <UIcon name="i-lucide-check" class="r-tick" />{{ o.label }}
        </button>
      </div>
      <div v-if="f.expiry === 'range'" class="r-pair">
        <div class="r-field">
          <label for="r-exp-from">Desde</label>
          <input id="r-exp-from" class="r-input" type="date" :value="f.expFrom" @change="patch({ expFrom: val($event) })">
        </div>
        <div class="r-field">
          <label for="r-exp-to">Hasta</label>
          <input id="r-exp-to" class="r-input" type="date" :value="f.expTo" @change="patch({ expTo: val($event) })">
        </div>
      </div>
    </div>

    <!-- Más filtros -->
    <details class="r-more" :open="moreOpen" @toggle="moreOpen = ($event.target as HTMLDetailsElement).open">
      <summary>
        <UIcon name="i-lucide-sliders-horizontal" class="w-4 h-4" />
        Más filtros
        <UIcon name="i-lucide-chevron-down" class="r-more-chev w-4 h-4" />
      </summary>

      <div class="r-group">
        <span class="stc-eyebrow">Estado del plan</span>
        <div class="r-chips">
          <button
            v-for="p in planOptions" :key="p" type="button" class="r-chip" :class="{ on: f.plan.includes(p) }"
            :aria-pressed="f.plan.includes(p)" @click="toggle('plan', p)"
          >
            <UIcon name="i-lucide-check" class="r-tick" />{{ PLAN_LABELS[p] }}
          </button>
        </div>
      </div>

      <div class="r-group">
        <span class="stc-eyebrow">Fecha de ingreso</span>
        <div class="r-pair">
          <div class="r-field">
            <label for="r-join-from">Desde</label>
            <input id="r-join-from" class="r-input" type="date" :value="f.joinedFrom" @change="patch({ joinedFrom: val($event) })">
          </div>
          <div class="r-field">
            <label for="r-join-to">Hasta</label>
            <input id="r-join-to" class="r-input" type="date" :value="f.joinedTo" @change="patch({ joinedTo: val($event) })">
          </div>
        </div>
      </div>

      <div class="r-group">
        <span class="stc-eyebrow">Reuniones</span>
        <div class="r-chips">
          <button
            type="button" class="r-chip" :class="{ on: f.meetings === 'none' }" :aria-pressed="f.meetings === 'none'"
            @click="patch({ meetings: f.meetings === 'none' ? '' : 'none', meetingsMin: null })"
          >
            <UIcon name="i-lucide-check" class="r-tick" />Sin reuniones
          </button>
        </div>
        <div class="r-field">
          <label for="r-mtg-min">Mínimo de reuniones</label>
          <input
            id="r-mtg-min" class="r-input" type="number" inputmode="numeric" min="0" placeholder="—"
            :value="f.meetingsMin ?? ''" :disabled="f.meetings === 'none'" @change="patch({ meetingsMin: num($event) })"
          >
        </div>
      </div>

      <div class="r-group">
        <span class="stc-eyebrow">Mensajes en 30 días</span>
        <div class="r-pair">
          <div class="r-field">
            <label for="r-msg-min">Mínimo</label>
            <input
              id="r-msg-min" class="r-input" type="number" inputmode="numeric" min="0" placeholder="—"
              :value="f.msgMin ?? ''" @change="patch({ msgMin: num($event) })"
            >
          </div>
          <div class="r-field">
            <label for="r-msg-max">Máximo</label>
            <input
              id="r-msg-max" class="r-input" type="number" inputmode="numeric" min="0" placeholder="—"
              :value="f.msgMax ?? ''" @change="patch({ msgMax: num($event) })"
            >
          </div>
        </div>
      </div>

      <div class="r-group">
        <span class="stc-eyebrow">Seguimiento</span>
        <div class="r-seg">
          <button type="button" :class="{ on: !f.contacted }" @click="patch({ contacted: '', contactedBy: '' })">Todos</button>
          <button type="button" :class="{ on: f.contacted === 'yes' }" @click="patch({ contacted: 'yes' })">Contactados</button>
          <button type="button" :class="{ on: f.contacted === 'no' }" @click="patch({ contacted: 'no', contactedBy: '' })">Nunca</button>
        </div>
        <select
          v-if="admins.length && f.contacted !== 'no'" class="r-input r-select" :class="{ set: f.contactedBy }"
          :value="f.contactedBy" aria-label="Contactado por" @change="patch({ contactedBy: val($event) })"
        >
          <option value="">Cualquier admin</option>
          <option v-for="a in admins" :key="a" :value="a" :selected="a === f.contactedBy">{{ a }}</option>
        </select>
      </div>

      <div class="r-group">
        <span class="stc-eyebrow">ClickFunnels</span>
        <div class="r-seg">
          <button type="button" :class="{ on: !f.cf }" @click="patch({ cf: '' })">Todos</button>
          <button type="button" :class="{ on: f.cf === 'linked' }" @click="patch({ cf: 'linked' })">Vinculado</button>
          <button type="button" :class="{ on: f.cf === 'unlinked' }" @click="patch({ cf: 'unlinked' })">Sin vincular</button>
        </div>
      </div>
    </details>
  </div>
</template>
