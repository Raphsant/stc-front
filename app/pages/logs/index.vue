<script setup lang="ts">
const { data: logs, pending, error } = await useFetch('/api/logs', {
  query: { limit: 50 }
})

const columns = [
  {
    accessorKey: 'userId',
    header: 'Usuario',
  },
  {
    accessorKey: 'logType',
    header: 'Tipo de Actividad',
  },
  {
    accessorKey: 'meetingId',
    header: 'Meeting / Sesión',
  },
  {
    accessorKey: 'occurredAt',
    header: 'Fecha de Registro',
  },
  {
    id: 'actions',
    header: '',
  }
]

function formatFullDate(date: string | Date) {
  if (!date) return 'n/a'
  const d = new Date(date)
  const datePart = d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).toLowerCase().replace(' ', '')

  return `${datePart} ${timePart}`
}

function formatDateOnly(date: string | Date) {
  if (!date) return 'n/a'
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
}

const logTypeMap: Record<string, { label: string, color: any, icon: string }> = {
  'zoom-register': { label: 'Registro Zoom', color: 'primary', icon: 'i-heroicons-video-camera' },
  'zoom-refresh': { label: 'Actualización Zoom', color: 'blue', icon: 'i-heroicons-arrow-path' },
  'discord-command': { label: 'Comando Discord', color: 'indigo', icon: 'i-heroicons-command-line' },
  'discord-moderation': { label: 'Moderación', color: 'red', icon: 'i-heroicons-shield-check' },
  'clickfunnels': { label: 'ClickFunnels', color: 'orange', icon: 'i-heroicons-funnel' }
}
</script>

<template>
  <div class="p-6">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Registro de Actividad</h1>
      <p class="text-gray-500 mt-1">Historial detallado de todas las acciones del sistema y registros de usuarios.</p>
    </div>

    <div v-if="error" class="mb-6">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        title="Error"
        :description="`No se pudieron cargar los logs: ${error.message}`"
      />
    </div>

    <UCard :ui="{ body: { padding: 'p-0' } }" class="bg-neutral-900/50 border-neutral-800">
      <UTable
        :data="logs || []"
        :columns="columns"
        :loading="pending"
        class="w-full"
      >
        <!-- User Column -->
        <template #userId-cell="{ row }">
          <div class="flex items-center gap-3 py-1">
            <UAvatar
              v-if="row.original.userId"
              :alt="row.original.userId.username"
              size="sm"
              :ui="{ rounded: 'rounded-lg' }"
            />
            <div v-else class="p-2 rounded-lg bg-neutral-800 text-neutral-500">
              <UIcon name="i-heroicons-user" />
            </div>
            <div class="flex flex-col">
              <span class="font-medium text-gray-900 dark:text-white">{{ row.original.userId?.username || 'Usuario Desconocido' }}</span>
              <span class="text-xs text-neutral-500 font-mono">{{ row.original.userId?._id || row.original.userId }}</span>
            </div>
          </div>
        </template>

        <!-- Log Type Column -->
        <template #logType-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <template v-for="type in row.original.logType" :key="type">
              <UBadge
                v-if="logTypeMap[type]"
                :color="logTypeMap[type].color"
                variant="subtle"
                size="sm"
                class="flex items-center gap-1"
              >
                <UIcon :name="logTypeMap[type].icon" class="w-3 h-3" />
                {{ logTypeMap[type].label }}
              </UBadge>
              <UBadge v-else color="neutral" variant="subtle" size="sm">
                {{ type }}
              </UBadge>
            </template>
          </div>
        </template>

        <!-- Meeting Column -->
        <template #meetingId-cell="{ row }">
          <div v-if="row.original.meetingId" class="flex flex-col">
            <div class="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
              <UIcon name="i-heroicons-video-camera" class="text-primary-500 w-4 h-4" />
              {{ row.original.meetingId.name || row.original.meetingId.meetingId }}
            </div>
            <div class="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
              <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
              Meeting del {{ formatDateOnly(row.original.meetingId.occurredAt) }}
            </div>
          </div>
          <span v-else class="text-neutral-500 text-sm italic">N/A</span>
        </template>

        <!-- Registration Date Column -->
        <template #occurredAt-cell="{ row }">
          <div class="flex items-center gap-2 text-neutral-400 text-sm">
            <UIcon name="i-heroicons-clock" class="w-4 h-4" />
            {{ formatFullDate(row.original.occurredAt) }}
          </div>
        </template>

        <!-- Actions Column -->
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-2">
            <UTooltip text="Ver Meeting" v-if="row.original.meetingId?._id">
              <UButton
                :to="`/meetings/${row.original.meetingId._id}`"
                icon="i-heroicons-arrow-top-right-on-square"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </UTooltip>
            <UTooltip text="Ver Usuario" v-if="row.original.userId?._id">
              <UButton
                :to="`/discord-users/${row.original.userId._id}`"
                icon="i-heroicons-user"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </UTooltip>
          </div>
        </template>

        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-12 text-gray-500">
            <UIcon name="i-heroicons-clipboard-document-list" class="text-4xl mb-2" />
            <p>No se encontró actividad registrada.</p>
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
