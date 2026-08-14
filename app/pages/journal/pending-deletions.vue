<script setup lang="ts">
const toast = useToast()

useSeoMeta({ title: 'Eliminaciones pendientes - STC Control' })

const { data: entries, pending, refresh } = await useFetch('/api/journal/pending-deletions', {
  default: () => [],
})

const processingId = ref<string | null>(null)

async function approve(entry: any) {
  processingId.value = entry._id
  try {
    await $fetch(`/api/discord-users/${entry.discordUserId}/journal/${entry._id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Entrada eliminada', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error al eliminar', description: e?.statusMessage || '', color: 'error' })
  } finally {
    processingId.value = null
  }
}

async function reject(entry: any) {
  processingId.value = entry._id
  try {
    await $fetch(`/api/discord-users/${entry.discordUserId}/journal/${entry._id}`, { method: 'PATCH' })
    await refresh()
    toast.add({ title: 'Marca retirada', color: 'neutral' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.statusMessage || '', color: 'error' })
  } finally {
    processingId.value = null
  }
}
</script>

<template>
  <div class="pd-page">
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Eliminaciones pendientes</div>
        <div class="stc-page-sub">Entradas de bitácora marcadas para eliminación.</div>
      </div>
      <span v-if="!pending" class="stc-badge" :class="entries.length ? 'gold' : 'neutral'">
        {{ entries.length }} {{ entries.length === 1 ? 'entrada' : 'entradas' }}
      </span>
    </div>

    <div v-if="pending" class="pd-stack">
      <USkeleton v-for="n in 4" :key="n" class="h-28 w-full rounded-[10px]" />
    </div>

    <div v-else-if="!entries.length" class="stc-panel pd-clear">
      <span class="pd-clear-glyph">
        <UIcon name="i-lucide-check" class="w-6 h-6" />
      </span>
      <p>No hay entradas pendientes de eliminación.</p>
    </div>

    <div v-else class="pd-stack">
      <article v-for="entry in entries" :key="entry._id" class="stc-panel pd-card">
        <div class="pd-body">
          <!-- Usuario + autor -->
          <div class="pd-head">
            <UIcon name="i-lucide-flag" class="w-4 h-4 flex-shrink-0" style="color:var(--gold)" />
            <NuxtLink :to="`/discord-users/${entry.discordUserId}`" class="pd-user">
              {{ entry.discordUser?.username ?? entry.discordUserId }}
            </NuxtLink>
            <span class="pd-sep">·</span>
            <span class="pd-author">escrito por <b>{{ entry.adminUsername }}</b></span>
          </div>

          <!-- Vista previa -->
          <p v-if="entry.type === 'text'" class="pd-preview">{{ entry.content }}</p>
          <div v-else class="pd-img-note">
            <UIcon name="i-lucide-image" class="w-3.5 h-3.5" />
            Entrada de imagen
          </div>

          <!-- Quién la marcó -->
          <p class="pd-marked">
            Marcado por <b>{{ entry.markedForDeletionBy }}</b>
            · {{ formatRelativeTime(entry.markedForDeletionAt) }}
          </p>
        </div>

        <!-- Acciones -->
        <div class="pd-actions">
          <button class="stc-btn sm danger" :disabled="processingId === entry._id" @click="approve(entry)">
            <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
            Eliminar
          </button>
          <button class="stc-btn sm" :disabled="processingId === entry._id" @click="reject(entry)">
            <UIcon name="i-lucide-undo-2" class="w-3.5 h-3.5" />
            Rechazar
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.pd-page  { display: flex; flex-direction: column; gap: 20px; max-width: 860px; width: 100%; }
.pd-stack { display: flex; flex-direction: column; gap: 12px; }

/* estado limpio */
.pd-clear {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 56px 24px;
  text-align: center;
  font-size: 13.5px;
  color: var(--dim);
}
.pd-clear-glyph {
  width: 48px; height: 48px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: var(--green);
  background: var(--green-dim);
  border: 1px solid var(--green-line);
}

/* tarjeta */
.pd-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px;
  border-left: 2px solid var(--gold);
}
.pd-body { flex: 1; min-width: 0; }

.pd-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.pd-user {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
}
.pd-user:hover { color: var(--gold-soft); }
.pd-sep    { color: var(--faint); }
.pd-author { font-size: 12px; color: var(--faint); }
.pd-author b { color: var(--dim); font-weight: 600; }

.pd-preview {
  font-size: 13.5px;
  color: var(--dim);
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.pd-img-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-style: italic;
  color: var(--faint);
}
.pd-marked { font-size: 11.5px; color: var(--faint); margin-top: 10px; }
.pd-marked b { color: var(--dim); font-weight: 600; }

.pd-actions { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }

@media (max-width: 640px) {
  .pd-card { flex-direction: column; gap: 14px; }
  .pd-actions { flex-direction: row; width: 100%; }
  .pd-actions .stc-btn { flex: 1; }
}
</style>
