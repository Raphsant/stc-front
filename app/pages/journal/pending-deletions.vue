<script setup lang="ts">
const { loggedIn, session } = useUserSession()
const toast = useToast()
const badgeVariant = useBadgeVariant()

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
  <div class="p-4 md:p-6 max-w-3xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Eliminaciones pendientes</h1>
        <p class="text-sm text-gray-500 mt-1">Entradas de bitácora marcadas para eliminación.</p>
      </div>
      <UBadge v-if="!pending" :variant="badgeVariant" :color="entries.length ? 'warning' : 'neutral'" size="lg">
        {{ entries.length }} {{ entries.length === 1 ? 'entrada' : 'entradas' }}
      </UBadge>
    </div>

    <div v-if="pending" class="space-y-3">
      <USkeleton v-for="n in 4" :key="n" class="h-28 w-full" />
    </div>

    <div
      v-else-if="!entries.length"
      class="text-center py-16 text-gray-400 space-y-2"
    >
      <UIcon name="i-heroicons-check-circle" class="text-4xl text-green-500" />
      <p>No hay entradas pendientes de eliminación.</p>
    </div>

    <div v-else class="space-y-4">
      <UCard
        v-for="entry in entries"
        :key="entry._id"
        class="border border-amber-400/40 dark:border-amber-600/30"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <!-- User + author -->
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <UIcon name="i-heroicons-flag" class="text-amber-500 shrink-0" />
              <NuxtLink
                :to="`/discord-users/${entry.discordUserId}`"
                class="font-semibold text-sm text-gray-900 dark:text-white hover:underline"
              >
                {{ entry.discordUser?.username ?? entry.discordUserId }}
              </NuxtLink>
              <span class="text-xs text-gray-400">·</span>
              <span class="text-xs text-gray-500">escrito por <strong>{{ entry.adminUsername }}</strong></span>
            </div>

            <!-- Content preview -->
            <p
              v-if="entry.type === 'text'"
              class="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 whitespace-pre-wrap break-words"
            >
              {{ entry.content }}
            </p>
            <div v-else class="flex items-center gap-1.5 text-xs text-gray-400 italic">
              <UIcon name="i-heroicons-photo" />
              <span>Entrada de imagen</span>
            </div>

            <!-- Who marked it + when -->
            <p class="text-xs text-gray-400 mt-2">
              Marcado por <strong>{{ entry.markedForDeletionBy }}</strong>
              · {{ formatRelativeTime(entry.markedForDeletionAt) }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2 shrink-0">
            <UButton
              size="xs"
              color="error"
              variant="soft"
              icon="i-heroicons-trash"
              :loading="processingId === entry._id"
              @click="approve(entry)"
            >
              Eliminar
            </UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              icon="i-heroicons-arrow-uturn-left"
              :loading="processingId === entry._id"
              @click="reject(entry)"
            >
              Rechazar
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
