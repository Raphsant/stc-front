<script setup lang="ts">
const route = useRoute()
const { data: meeting, pending, error } = useFetch(`/api/meetings/${route.params.id}`)

const columns = [
  {
    accessorKey: 'username',
    header: 'Usuario',
  },
  {
    accessorKey: 'roles',
    header: 'Roles',
  },
  {
    accessorKey: '_id',
    header: 'Discord ID',
  },
  {
    id: 'actions',
    header: '',
  }
]

const colorMap: Record<string, any> = {
  'Alpha.': 'warning',
  'Alpha': 'warning',
  'Delta': 'info',
  'Delta.': 'info',
}

function formatDate(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleString('es-ES', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="mb-8 flex justify-between items-center">
      <UButton to="/meetings" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
        Volver a Meetings
      </UButton>
    </div>

    <div v-if="pending" class="space-y-6">
      <UCard>
        <div class="space-y-2">
          <USkeleton class="h-8 w-64" />
          <USkeleton class="h-4 w-48" />
        </div>
      </UCard>
      <USkeleton class="h-96 w-full" />
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
      <h3 class="font-bold text-lg mb-2">Error al cargar el meeting</h3>
      <p>{{ error.message }}</p>
      <UButton to="/meetings" class="mt-4" color="neutral" size="sm">Regresar</UButton>
    </div>

    <div v-else-if="meeting" class="space-y-8">
      <!-- Meeting Info Header -->
      <UCard>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-1">
            <div class="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
              <UIcon name="i-heroicons-video-camera" />
              Detalles de la sesión
            </div>
            <h1 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              {{ meeting.name }}
            </h1>
            <UBadge variant="subtle">{{meeting.meetingId}}</UBadge>
            <p class="text-gray-500 flex items-center gap-2">
              <UIcon name="i-heroicons-calendar" />
              {{ formatDate(meeting.occurredAt) }}
            </p>
          </div>
          
          <div class="flex flex-col items-center p-4 rounded-xl bg-primary/5 border border-primary/10 min-w-[140px]">
            <span class="text-3xl font-black text-primary">{{ meeting.participants?.length || 0 }}</span>
            <span class="text-xs font-bold uppercase tracking-wider text-primary/70 text-center">Asistentes</span>
          </div>
        </div>
      </UCard>

      <!-- Participants Table -->
      <div class="space-y-4">
        <h2 class="text-2xl font-bold flex items-center gap-2 px-2">
          <UIcon name="i-heroicons-users" class="text-primary" />
          Lista de Asistencia
        </h2>

        <UCard :ui="{ body: { padding: 'p-0' } }">
          <UTable
            :data="meeting.participants || []"
            :columns="columns"
            class="w-full"
          >
            <template #username-cell="{ row }">
              <div class="flex items-center gap-3 py-1">
                <UAvatar
                  :alt="row.original.username"
                  size="sm"
                  :ui="{ rounded: 'rounded-lg' }"
                />
                <span class="font-medium text-gray-900 dark:text-white">{{ row.original.username }}</span>
              </div>
            </template>

            <template #roles-cell="{ row }">
              <div class="flex flex-wrap gap-1.5">
                <template v-for="role in (row.original.roles || [])" :key="role">
                  <UBadge
                    v-if="colorMap[role]"
                    :color="colorMap[role]"
                    variant="subtle"
                    size="sm"
                    class="capitalize"
                  >
                    {{ role }}
                  </UBadge>
                </template>
                
                <UPopover v-if="row.original.roles?.filter((r: string) => !colorMap[r]).length" mode="hover">
                  <UBadge
                    color="neutral"
                    variant="soft"
                    size="sm"
                    class="cursor-help"
                  >
                    +{{ row.original.roles.filter((r: string) => !colorMap[r]).length }}
                  </UBadge>

                  <template #content>
                    <div class="p-2 max-w-xs">
                      <div class="flex flex-wrap gap-1">
                        <UBadge
                          v-for="role in row.original.roles.filter((r: string) => !colorMap[r])"
                          :key="role"
                          color="neutral"
                          variant="outline"
                          size="xs"
                        >
                          {{ role }}
                        </UBadge>
                      </div>
                    </div>
                  </template>
                </UPopover>
              </div>
            </template>

            <template #_id-cell="{ row }">
              <code class="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                {{ row.original._id }}
              </code>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex justify-end">
                <UTooltip text="Ver perfil completo">
                  <UButton
                    :to="`/discord-users/${row.original._id}`"
                    icon="i-heroicons-user"
                    color="neutral"
                    variant="ghost"
                  />
                </UTooltip>
              </div>
            </template>

            <template #empty-state>
              <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                <UIcon name="i-heroicons-users" class="text-4xl mb-2" />
                <p>No se registraron participantes para este meeting.</p>
              </div>
            </template>
          </UTable>
        </UCard>
      </div>
    </div>
  </div>
</template>
