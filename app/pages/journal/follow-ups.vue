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

async function setStatus(entry: FollowUpEntry, next: StatusFilter) {
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
</script>

<template>
  <div class="fu-page">
    <div class="stc-page-head">
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

    <div v-if="pending" class="fu-stack">
      <USkeleton v-for="n in 4" :key="n" class="h-40 w-full rounded-[10px]" />
    </div>

    <div v-else-if="!entries.length" class="stc-panel stc-empty">
      <UIcon :name="status === 'pending' ? 'i-lucide-check-check' : 'i-lucide-inbox'" />
      <p v-if="status === 'pending'">No hay seguimientos pendientes. Todo al día.</p>
      <p v-else>Aún no se ha marcado ningún seguimiento como hecho.</p>
    </div>

    <div v-else class="fu-stack">
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
</style>
