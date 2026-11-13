<script setup lang="ts">
import {
  ALPHA_SIGNAL_LABELS_ES,
  ALPHA_SIGNAL_TONE,
  PRIORITY_LABELS_ES,
  PRIORITY_TONE,
  actionTypeLabel,
  categoryLabel,
  type DeltaAnalysisResult,
  type Priority,
} from '#shared/deltaAnalysis'

useSeoMeta({
  title: 'Seguimientos - STC Control',
  description: 'Cola de seguimientos generada por el análisis de conversaciones.',
})

interface FollowUpEntry {
  _id: string
  discordUserId: string
  imageUrl?: string | null
  adminUsername: string
  createdAt: string
  analysisResult: DeltaAnalysisResult
  followUpStatus: 'pending' | 'done'
  followUpPriority: Priority | null
  recontactDate?: string | null
  followUpDoneAt?: string | null
  followUpDoneBy?: string | null
  discordUser?: { _id: string, username: string, avatarUrl?: string | null } | null
}

type StatusFilter = 'pending' | 'done'
const status = ref<StatusFilter>('pending')

const { data: entries, pending, refresh } = await useFetch<FollowUpEntry[]>('/api/journal/follow-ups', {
  query: computed(() => ({ status: status.value })),
  default: () => [],
})

const toast = useToast()
const actingId = ref<string | null>(null)

async function setStatus(entry: FollowUpEntry, next: StatusFilter, opts: { undoable?: boolean } = {}) {
  actingId.value = entry._id
  try {
    await $fetch(`/api/journal/follow-ups/${entry._id}`, {
      method: 'PATCH',
      body: { status: next },
    })
    await refresh()
    toast.add({
      title: next === 'done' ? 'Seguimiento marcado como hecho' : 'Seguimiento reabierto',
      color: next === 'done' ? 'success' : 'neutral',
      ...(opts.undoable
        ? { actions: [{ label: 'Deshacer', color: 'neutral', variant: 'outline', onClick: () => { setStatus(entry, next === 'done' ? 'pending' : 'done') } }] }
        : {}),
    })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.statusMessage || e?.message || '', color: 'error' })
  } finally {
    actingId.value = null
  }
}

async function copyMessage(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: 'Mensaje copiado', color: 'success' })
  } catch {
    toast.add({ title: 'No se pudo copiar el mensaje', color: 'error' })
  }
}

const today = new Date().toISOString().slice(0, 10)

/** Due today or earlier, and still open. */
function isOverdue(entry: FollowUpEntry) {
  if (!entry.recontactDate || entry.followUpStatus !== 'pending') return false
  return new Date(entry.recontactDate).toISOString().slice(0, 10) <= today
}

function formatDay(date?: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const overdueCount = computed(() => (entries.value ?? []).filter(isOverdue).length)

// ══ Móvil (<768px): bandeja agrupada por fecha ══
const DAY = 86_400_000
const startOfDay = (d: Date | string) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
/** Días hasta la fecha de recontacto (negativo = vencido), o null si no hay. */
function daysUntil(entry: FollowUpEntry) {
  if (!entry.recontactDate) return null
  return Math.round((startOfDay(entry.recontactDate) - startOfDay(new Date())) / DAY)
}

const groups = computed(() => {
  const list = entries.value ?? []
  if (status.value === 'done') return [{ key: 'done', label: 'Hechos', tone: 'dim', items: list }]
  const byDate = (a: FollowUpEntry, b: FollowUpEntry) => (daysUntil(a) ?? 1e9) - (daysUntil(b) ?? 1e9)
  const sorted = [...list].sort(byDate)
  const out = [
    { key: 'overdue', label: 'Vencidos', tone: 'red', items: sorted.filter(e => (daysUntil(e) ?? 1) < 0) },
    { key: 'today', label: 'Hoy', tone: 'gold', items: sorted.filter(e => daysUntil(e) === 0) },
    { key: 'next', label: 'Próximos', tone: 'dim', items: sorted.filter(e => (daysUntil(e) ?? -1) > 0) },
    { key: 'none', label: 'Sin fecha', tone: 'dim', items: sorted.filter(e => daysUntil(e) === null) },
  ]
  return out.filter(g => g.items.length)
})

function dueLabel(entry: FollowUpEntry) {
  if (entry.followUpStatus === 'done') {
    return entry.followUpDoneAt
      ? new Date(entry.followUpDoneAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      : '—'
  }
  const d = daysUntil(entry)
  if (d === null) return '—'
  if (d === 0) return 'Hoy'
  if (d === -1) return 'ayer'
  if (d < 0) return `${-d} d`
  if (d === 1) return 'mañana'
  return new Date(entry.recontactDate!).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
function dueTone(entry: FollowUpEntry) {
  if (entry.followUpStatus === 'done') return 'dim'
  const d = daysUntil(entry)
  return d === null ? 'dim' : d < 0 ? 'red' : d === 0 ? 'gold' : 'dim'
}
const displayName = (e: FollowUpEntry) => e.discordUser?.username ?? e.analysisResult.customer_name ?? e.discordUserId

// ── Deslizar a la derecha: marcar hecho (o reabrir en "Hechos") ──
const SWIPE_COMMIT = 110
const swipe = reactive({ id: '', x0: 0, y0: 0, dx: 0, axis: '' as '' | 'x' | 'y', committing: '' })
let justSwiped = false

function rowOffset(id: string) {
  if (swipe.committing === id) return 480
  return swipe.id === id && swipe.axis === 'x' ? swipe.dx : 0
}
function onDown(e: PointerEvent, id: string) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  Object.assign(swipe, { id, x0: e.clientX, y0: e.clientY, dx: 0, axis: '' })
}
function onMove(e: PointerEvent) {
  if (!swipe.id) return
  const mx = e.clientX - swipe.x0
  const my = e.clientY - swipe.y0
  if (!swipe.axis) {
    if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
    swipe.axis = Math.abs(mx) > Math.abs(my) && mx > 0 ? 'x' : 'y'
    if (swipe.axis === 'x') (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  if (swipe.axis === 'x') swipe.dx = Math.max(0, mx)
}
async function onUp(entry: FollowUpEntry) {
  if (!swipe.id) return
  const wasX = swipe.axis === 'x'
  const commit = wasX && swipe.dx >= SWIPE_COMMIT
  Object.assign(swipe, { id: '', axis: '', dx: 0 })
  if (wasX) {
    justSwiped = true
    setTimeout(() => { justSwiped = false }, 0)
  }
  if (!commit) return
  swipe.committing = entry._id
  await setStatus(entry, entry.followUpStatus === 'pending' ? 'done' : 'pending', { undoable: true })
  swipe.committing = ''
}

// ── Hoja de detalle ──
const detailId = ref<string | null>(null)
const detail = computed(() => (entries.value ?? []).find(e => e._id === detailId.value) ?? null)
function openDetail(entry: FollowUpEntry) {
  if (justSwiped) return
  detailId.value = entry._id
}
watch(entries, () => { if (detailId.value && !detail.value) detailId.value = null })

async function copyAndOpenDiscord(entry: FollowUpEntry) {
  const msg = entry.analysisResult.follow_up.suggested_message_es
  if (msg) await copyMessage(msg)
  window.location.href = `discord://-/users/${entry.discordUserId}`
}
async function markFromDetail(entry: FollowUpEntry) {
  const next = entry.followUpStatus === 'pending' ? 'done' : 'pending'
  detailId.value = null
  await setStatus(entry, next, { undoable: true })
}
</script>

<template>
  <div class="fu-page">
    <div class="stc-page-head fu-desk">
      <div>
        <div class="stc-page-title">Seguimientos</div>
        <div class="stc-page-sub">
          Próxima acción para cada conversación analizada, ordenada por prioridad y fecha de recontacto.
        </div>
      </div>
      <div class="fu-head-right">
        <span v-if="!pending && overdueCount" class="stc-badge red">
          <UIcon name="i-lucide-alarm-clock" class="w-3 h-3" />
          {{ overdueCount }} vencido{{ overdueCount === 1 ? '' : 's' }}
        </span>
        <div class="stc-seg">
          <button :class="{ on: status === 'pending' }" @click="status = 'pending'">Pendientes</button>
          <button :class="{ on: status === 'done' }" @click="status = 'done'">Hechos</button>
        </div>
      </div>
    </div>

    <div v-if="pending" class="fu-stack fu-desk">
      <USkeleton v-for="n in 4" :key="n" class="h-40 w-full rounded-[10px]" />
    </div>

    <div v-else-if="!entries.length" class="stc-panel stc-empty fu-desk">
      <UIcon :name="status === 'pending' ? 'i-lucide-check-check' : 'i-lucide-inbox'" />
      <p v-if="status === 'pending'">No hay seguimientos pendientes. Todo al día.</p>
      <p v-else>Aún no se ha marcado ningún seguimiento como hecho.</p>
    </div>

    <div v-else class="fu-stack fu-desk">
      <article
        v-for="entry in entries"
        :key="entry._id"
        class="stc-panel fu-card"
        :class="{ overdue: isOverdue(entry) }"
      >
        <!-- Cabecera: usuario + clasificación -->
        <div class="fu-head">
          <NuxtLink :to="`/discord-users/${entry.discordUserId}`" class="fu-user">
            <span class="fu-av">
              <img
                v-if="entry.discordUser?.avatarUrl"
                :src="entry.discordUser.avatarUrl"
                :alt="entry.discordUser.username"
              >
              <template v-else>
                {{ (entry.discordUser?.username ?? entry.analysisResult.customer_name ?? '?').charAt(0).toUpperCase() }}
              </template>
            </span>
            <span class="min-w-0">
              <span class="fu-name">
                {{ entry.discordUser?.username ?? entry.analysisResult.customer_name ?? entry.discordUserId }}
              </span>
              <span class="fu-sub stc-mono">
                registrado por {{ entry.adminUsername }}
              </span>
            </span>
          </NuxtLink>

          <div class="fu-tags">
            <span class="stc-badge" :class="PRIORITY_TONE[entry.followUpPriority ?? 'medium']">
              {{ PRIORITY_LABELS_ES[entry.followUpPriority ?? 'medium'] }}
            </span>
            <span class="stc-badge gold">{{ categoryLabel(entry.analysisResult.best_fit_category) }}</span>
            <span class="stc-badge" :class="ALPHA_SIGNAL_TONE[entry.analysisResult.alpha_fit_signal]">
              Alpha: {{ ALPHA_SIGNAL_LABELS_ES[entry.analysisResult.alpha_fit_signal] }}
            </span>
          </div>
        </div>

        <!-- Acción -->
        <div class="fu-action">
          <span class="stc-badge solid">{{ actionTypeLabel(entry.analysisResult.follow_up.action_type) }}</span>
          <span v-if="entry.recontactDate" class="fu-date stc-mono" :class="{ due: isOverdue(entry) }">
            <UIcon name="i-lucide-calendar-clock" class="w-3.5 h-3.5" />
            {{ formatDay(entry.recontactDate) }}
          </span>
        </div>

        <p v-if="entry.analysisResult.follow_up.objective" class="fu-obj">
          {{ entry.analysisResult.follow_up.objective }}
        </p>

        <blockquote v-if="entry.analysisResult.key_customer_quote" class="fu-quote">
          {{ entry.analysisResult.key_customer_quote }}
        </blockquote>

        <!-- Mensaje listo para enviar -->
        <div v-if="entry.analysisResult.follow_up.suggested_message_es" class="fu-msg">
          <p class="fu-msg-text">{{ entry.analysisResult.follow_up.suggested_message_es }}</p>
          <button
            class="stc-btn sm"
            title="Copiar mensaje"
            @click="copyMessage(entry.analysisResult.follow_up.suggested_message_es)"
          >
            <UIcon name="i-lucide-copy" class="w-3.5 h-3.5" />
            Copiar
          </button>
        </div>

        <!-- Pie: atribución + acción -->
        <div class="fu-foot">
          <span v-if="entry.followUpStatus === 'done'" class="fu-done stc-mono">
            <UIcon name="i-lucide-check" class="w-3.5 h-3.5" />
            Hecho por {{ entry.followUpDoneBy ?? '—' }}
            <template v-if="entry.followUpDoneAt"> · {{ formatDay(entry.followUpDoneAt) }}</template>
          </span>
          <span v-else class="fu-why">{{ entry.analysisResult.recontact_rationale }}</span>

          <div class="fu-btns">
            <NuxtLink :to="`/discord-users/${entry.discordUserId}`" class="stc-btn sm">
              <UIcon name="i-lucide-user" class="w-3.5 h-3.5" />
              Ver perfil
            </NuxtLink>
            <button
              v-if="entry.followUpStatus === 'pending'"
              class="stc-btn sm gold"
              :disabled="actingId === entry._id"
              @click="setStatus(entry, 'done')"
            >
              <UIcon name="i-lucide-check" class="w-3.5 h-3.5" />
              Marcar hecho
            </button>
            <button
              v-else
              class="stc-btn sm"
              :disabled="actingId === entry._id"
              @click="setStatus(entry, 'pending')"
            >
              <UIcon name="i-lucide-undo-2" class="w-3.5 h-3.5" />
              Reabrir
            </button>
          </div>
        </div>
      </article>
    </div>
    <!-- ══ Móvil (<768px): bandeja agrupada por fecha ══════════ -->
    <div class="fm">
      <div class="stc-seg fm-seg">
        <button :class="{ on: status === 'pending' }" @click="status = 'pending'">
          Pendientes<span v-if="status === 'pending' && !pending" class="fm-n stc-mono">{{ entries.length }}</span>
        </button>
        <button :class="{ on: status === 'done' }" @click="status = 'done'">Hechos</button>
      </div>

      <div v-if="pending" class="stc-panel fm-list">
        <div v-for="n in 5" :key="n" class="fm-row fm-skel">
          <USkeleton class="w-10 h-10 rounded-[10px] flex-shrink-0" />
          <div class="flex-1 space-y-1.5"><USkeleton class="h-3.5 w-36 rounded" /><USkeleton class="h-3 w-48 rounded" /></div>
        </div>
      </div>

      <div v-else-if="!entries.length" class="stc-panel stc-empty">
        <UIcon :name="status === 'pending' ? 'i-lucide-check-check' : 'i-lucide-inbox'" />
        <p v-if="status === 'pending'">No hay seguimientos pendientes. Todo al día.</p>
        <p v-else>Aún no se ha marcado ningún seguimiento como hecho.</p>
      </div>

      <template v-else>
        <p v-if="status === 'pending'" class="fm-hint">
          <UIcon name="i-lucide-move-right" class="w-3.5 h-3.5" />Desliza a la derecha para marcar como hecho
        </p>
        <section v-for="g in groups" :key="g.key" class="fm-group">
          <h2 class="fm-gh" :class="g.tone">{{ g.label }} <span class="stc-mono">· {{ g.items.length }}</span></h2>
          <div class="stc-panel fm-list">
            <div
              v-for="entry in g.items" :key="entry._id" class="fm-swipe"
              :class="{ gone: swipe.committing === entry._id }"
            >
              <div class="fm-under" :class="entry.followUpStatus === 'pending' ? 'done' : 'reopen'" :style="{ opacity: Math.min(1, rowOffset(entry._id) / 60) }">
                <UIcon :name="entry.followUpStatus === 'pending' ? 'i-lucide-check' : 'i-lucide-undo-2'" class="w-5 h-5" />
                {{ entry.followUpStatus === 'pending' ? 'Hecho' : 'Reabrir' }}
              </div>
              <button
                type="button" class="fm-row"
                :class="{ dragging: swipe.id === entry._id && swipe.axis === 'x', armed: swipe.id === entry._id && swipe.dx >= SWIPE_COMMIT }"
                :style="{ transform: `translateX(${rowOffset(entry._id)}px)` }"
                :disabled="actingId === entry._id"
                @pointerdown="onDown($event, entry._id)"
                @pointermove="onMove"
                @pointerup="onUp(entry)"
                @pointercancel="onUp(entry)"
                @click="openDetail(entry)"
              >
                <span class="fm-av">
                  <img v-if="entry.discordUser?.avatarUrl" :src="entry.discordUser.avatarUrl" alt="" draggable="false">
                  <template v-else>{{ displayName(entry).charAt(0).toUpperCase() }}</template>
                </span>
                <span class="fm-body">
                  <span class="fm-top">
                    <span class="fm-name">{{ displayName(entry) }}</span>
                    <span class="fm-action">{{ actionTypeLabel(entry.analysisResult.follow_up.action_type) }}</span>
                  </span>
                  <span class="fm-obj">{{ entry.analysisResult.follow_up.objective || entry.analysisResult.recontact_rationale }}</span>
                </span>
                <span class="fm-due stc-mono" :class="dueTone(entry)">{{ dueLabel(entry) }}</span>
              </button>
            </div>
          </div>
        </section>
      </template>

      <!-- Hoja de detalle -->
      <ClientOnly>
      <Teleport to="body">
        <Transition name="fm-fade">
          <div v-if="detail" class="fm-backdrop" @click="detailId = null" />
        </Transition>
        <Transition name="fm-sheet">
          <div v-if="detail" class="fm-sheet" role="dialog" :aria-label="`Seguimiento de ${displayName(detail)}`">
            <span class="fm-grip" aria-hidden="true" />
            <div class="fm-sheet-body">
              <div class="fm-d-head">
                <span class="fm-av lg">
                  <img v-if="detail.discordUser?.avatarUrl" :src="detail.discordUser.avatarUrl" alt="">
                  <template v-else>{{ displayName(detail).charAt(0).toUpperCase() }}</template>
                </span>
                <div class="min-w-0">
                  <div class="fm-d-name">{{ displayName(detail) }}</div>
                  <div class="fm-d-by stc-mono">registrado por {{ detail.adminUsername }}</div>
                </div>
              </div>
              <div class="fm-d-tags">
                <span class="stc-badge" :class="PRIORITY_TONE[detail.followUpPriority ?? 'medium']">{{ PRIORITY_LABELS_ES[detail.followUpPriority ?? 'medium'] }}</span>
                <span class="stc-badge gold">{{ categoryLabel(detail.analysisResult.best_fit_category) }}</span>
                <span class="stc-badge" :class="ALPHA_SIGNAL_TONE[detail.analysisResult.alpha_fit_signal]">Alpha: {{ ALPHA_SIGNAL_LABELS_ES[detail.analysisResult.alpha_fit_signal] }}</span>
              </div>

              <div class="fm-d-action">
                <span class="stc-badge solid">{{ actionTypeLabel(detail.analysisResult.follow_up.action_type) }}</span>
                <span v-if="detail.recontactDate" class="fm-d-date stc-mono" :class="dueTone(detail)">
                  <UIcon name="i-lucide-calendar-clock" class="w-3.5 h-3.5" />
                  {{ dueTone(detail) === 'red' ? 'Vencido · ' : '' }}{{ formatDay(detail.recontactDate) }}
                </span>
              </div>
              <p v-if="detail.analysisResult.follow_up.objective" class="fm-d-obj">{{ detail.analysisResult.follow_up.objective }}</p>
              <blockquote v-if="detail.analysisResult.key_customer_quote" class="fm-d-quote">{{ detail.analysisResult.key_customer_quote }}</blockquote>
              <div v-if="detail.analysisResult.follow_up.suggested_message_es" class="fm-d-msg">
                <span class="stc-eyebrow">Mensaje sugerido</span>
                <p>{{ detail.analysisResult.follow_up.suggested_message_es }}</p>
              </div>
              <p v-if="detail.followUpStatus === 'done'" class="fm-d-why">
                <UIcon name="i-lucide-check" class="w-3.5 h-3.5" />Hecho por {{ detail.followUpDoneBy ?? '—' }}<template v-if="detail.followUpDoneAt"> · {{ formatDay(detail.followUpDoneAt) }}</template>
              </p>
              <p v-else-if="detail.analysisResult.recontact_rationale" class="fm-d-why"><b>Por qué:</b> {{ detail.analysisResult.recontact_rationale }}</p>
            </div>

            <div class="fm-sheet-foot">
              <button type="button" class="stc-btn gold fm-primary" @click="copyAndOpenDiscord(detail)">
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.19.372-.287a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.097.246.193.373.287a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                {{ detail.analysisResult.follow_up.suggested_message_es ? 'Copiar y abrir Discord' : 'Abrir Discord' }}
              </button>
              <NuxtLink :to="`/discord-users/${detail.discordUserId}`" class="stc-btn">
                <UIcon name="i-lucide-user" class="w-4 h-4" />Ver perfil
              </NuxtLink>
              <button
                type="button" class="stc-btn" :class="detail.followUpStatus === 'pending' ? 'fm-done' : ''"
                :disabled="actingId === detail._id" @click="markFromDetail(detail)"
              >
                <UIcon :name="detail.followUpStatus === 'pending' ? 'i-lucide-check' : 'i-lucide-undo-2'" class="w-4 h-4" />
                {{ detail.followUpStatus === 'pending' ? 'Marcar hecho' : 'Reabrir' }}
              </button>
            </div>
          </div>
        </Transition>
      </Teleport>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
.fu-page  { display: flex; flex-direction: column; gap: 20px; max-width: 980px; width: 100%; }
.fu-stack { display: flex; flex-direction: column; gap: 12px; }
.fu-head-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.fu-card {
  padding: 16px 18px;
  border-left: 2px solid var(--line-2);
}
.fu-card.overdue { border-left-color: var(--red); }

/* cabecera */
.fu-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.fu-user {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  text-decoration: none;
}
.fu-av {
  width: 36px; height: 36px;
  border-radius: 9px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-family: var(--disp);
  font-weight: 800;
  font-size: 17px;
  color: var(--gold);
  background: var(--gold-wash);
  border: 1px solid var(--gold-ring);
}
.fu-av img { width: 100%; height: 100%; object-fit: cover; }
.fu-name {
  display: block;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fu-user:hover .fu-name { color: var(--gold-soft); }
.fu-sub { display: block; font-size: 11px; color: var(--faint); margin-top: 2px; }

.fu-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

/* acción */
.fu-action {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.fu-date {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--dim);
}
.fu-date.due { color: var(--red); font-weight: 600; }

.fu-obj { font-size: 13px; color: var(--dim); line-height: 1.55; margin-top: 10px; }

.fu-quote {
  margin: 11px 0 0;
  padding: 8px 12px;
  border-left: 2px solid var(--gold);
  background: var(--inset);
  border-radius: 0 var(--r-xs) var(--r-xs) 0;
  font-size: 12.5px;
  font-style: italic;
  color: var(--text);
  overflow-wrap: anywhere;
}

.fu-msg {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 13px;
  border-radius: var(--r-sm);
  background: var(--gold-wash);
  border: 1px solid var(--gold-ring);
}
.fu-msg-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text);
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.fu-msg .stc-btn { flex-shrink: 0; }

/* pie */
.fu-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid var(--line);
}
.fu-why  { font-size: 11.5px; color: var(--faint); flex: 1; min-width: 180px; }
.fu-done {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--green);
  flex: 1;
  min-width: 180px;
}
.fu-btns { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

@media (max-width: 640px) {
  .fu-card { padding: 14px; }
  .fu-btns { width: 100%; }
  .fu-btns .stc-btn { flex: 1; }
}

/* ══ Móvil (<768px): bandeja por fecha (.fm-*) ════════════ */
.fm { display: none; }
@media (max-width: 767px) {
  .fu-page { gap: 14px; }
  .fu-desk { display: none !important; }
  .fm { display: flex; flex-direction: column; gap: 14px; }
}

.fm-seg button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; font-size: 13.5px; }
.fm-n { font-size: 11.5px; padding: 1px 6px; border-radius: 999px; background: rgba(0,0,0,.18); }
.fm-hint { display: flex; align-items: center; gap: 6px; margin: -4px 2px -6px; font-size: 12px; color: var(--faint); }

.fm-group { display: flex; flex-direction: column; gap: 8px; }
.fm-gh {
  padding: 0 2px; font-family: var(--ui); font-size: 11px; font-weight: 700;
  letter-spacing: .14em; text-transform: uppercase; color: var(--dim);
}
.fm-gh span { font-weight: 500; letter-spacing: 0; }
.fm-gh.red  { color: var(--red); }
.fm-gh.gold { color: var(--gold); }

.fm-list { overflow: hidden; }
.fm-swipe { position: relative; overflow: hidden; border-top: 1px solid var(--line); transition: opacity .2s; }
.fm-swipe:first-child { border-top: 0; }
.fm-swipe.gone { opacity: 0; }

.fm-under {
  position: absolute; inset: 0; display: flex; align-items: center; gap: 8px; padding-left: 18px;
  font-size: 13.5px; font-weight: 700;
}
.fm-under.done   { background: var(--green-dim); color: var(--green); }
.fm-under.reopen { background: var(--gold-wash); color: var(--gold-soft); }
/* Pasado el umbral: color sólido para indicar que al soltar se aplica */
.fm-swipe:has(.fm-row.armed) .fm-under.done   { background: var(--green); color: #052e16; }
.fm-swipe:has(.fm-row.armed) .fm-under.reopen { background: var(--gold); color: var(--gold-ink); }

.fm-row {
  position: relative; z-index: 1; width: 100%;
  display: flex; align-items: center; gap: 12px; min-height: 68px; padding: 11px 14px;
  border: 0; background: var(--panel); color: inherit; text-align: left; font-family: var(--ui);
  cursor: pointer; touch-action: pan-y; user-select: none; -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform .24s cubic-bezier(.2,.8,.2,1), background .15s;
}
.fm-row.dragging { transition: none; }
.fm-row:active { background: var(--panel-2); }
.fm-row:disabled { opacity: .6; }
.fm-skel { pointer-events: none; border-top: 1px solid var(--line); }
.fm-skel:first-child { border-top: 0; }

.fm-av {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 10px; overflow: hidden;
  display: grid; place-items: center; font-family: var(--disp); font-weight: 800; font-size: 18px;
  color: var(--gold-ink); background: linear-gradient(150deg, var(--gold-soft), var(--gold));
}
.fm-av img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.fm-av.lg { width: 48px; height: 48px; border-radius: 12px; font-size: 22px; }

.fm-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.fm-top { display: flex; align-items: center; gap: 7px; min-width: 0; }
.fm-name { font-size: 15px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; min-width: 0; }
.fm-action {
  flex-shrink: 0; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 1px 6px; border-radius: 5px; font-size: 10.5px; font-weight: 700;
  color: var(--gold-ink); background: var(--gold);
}
.fm-obj { font-size: 12.5px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fm-due { flex-shrink: 0; font-size: 13px; font-weight: 600; color: var(--dim); }
.fm-due.red  { color: var(--red); }
.fm-due.gold { color: var(--gold-soft); }

/* Hoja de detalle (teletransportada a body) */
.fm-backdrop { position: fixed; inset: 0; z-index: 70; background: rgba(0,0,0,.6); }
.fm-sheet {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 75;
  display: flex; flex-direction: column; max-height: 90vh; max-height: 90dvh;
  background: var(--panel); border-top: 1px solid var(--line-2); border-radius: 20px 20px 0 0;
}
.fm-grip { display: block; width: 38px; height: 4px; margin: 10px auto 6px; border-radius: 4px; background: var(--line-2); }
.fm-sheet-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 6px 18px 14px; }
.fm-d-head { display: flex; align-items: center; gap: 12px; }
.fm-d-name { font-family: var(--disp); font-size: 24px; font-weight: 800; text-transform: uppercase; line-height: 1.05; color: var(--text); }
.fm-d-by { font-size: 12px; color: var(--faint); margin-top: 3px; }
.fm-d-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.fm-d-action { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 16px; }
.fm-d-date { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--dim); }
.fm-d-date.red  { color: var(--red); }
.fm-d-date.gold { color: var(--gold-soft); }
.fm-d-obj { margin-top: 10px; font-size: 14px; line-height: 1.55; color: var(--text); }
.fm-d-quote {
  margin: 12px 0 0; padding: 8px 12px; border-left: 2px solid var(--gold); border-radius: 0 6px 6px 0;
  background: var(--inset); font-size: 13px; font-style: italic; line-height: 1.5; color: var(--dim);
}
.fm-d-msg { margin-top: 12px; padding: 12px; border-radius: var(--r-sm); border: 1px solid var(--line-2); background: var(--inset); }
.fm-d-msg p { margin-top: 6px; font-size: 13.5px; line-height: 1.55; color: var(--text); white-space: pre-line; }
.fm-d-why { display: flex; gap: 6px; margin-top: 12px; font-size: 12.5px; line-height: 1.5; color: var(--faint); }
.fm-d-why b { color: var(--dim); font-weight: 600; flex-shrink: 0; }
.fm-sheet-foot {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  padding: 12px 18px calc(14px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line);
}
.fm-sheet-foot .stc-btn { min-height: 44px; justify-content: center; }
.fm-primary { grid-column: 1 / -1; min-height: 48px !important; font-size: 14.5px; }
.fm-done { color: var(--green); border-color: var(--green-line); }

.fm-fade-enter-active, .fm-fade-leave-active { transition: opacity .2s; }
.fm-fade-enter-from, .fm-fade-leave-to { opacity: 0; }
.fm-sheet-enter-active, .fm-sheet-leave-active { transition: transform .26s cubic-bezier(.2,.8,.2,1); }
.fm-sheet-enter-from, .fm-sheet-leave-to { transform: translateY(100%); }
</style>
