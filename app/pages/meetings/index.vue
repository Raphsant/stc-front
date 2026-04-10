<script setup lang="ts">
const route = useRoute()
const userId = computed(() => route.query.userId as string)

const { data: meetings, pending, error, refresh } = await useFetch('/api/meetings', {
  query: computed(() => ({ userId: userId.value }))
})

const columns = [
  {
    accessorKey: 'name',
    header: 'Sesión',
  },
  {
    accessorKey: 'occurredAt',
    header: 'Date',
  },
  {
    accessorKey: 'participants',
    header: 'Participants',
  },
  {
    id: 'actions',
    header: '',
  }
]

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(userId, () => refresh())
</script>

<template>
  <div class="p-6">
    <div class="mb-8 flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ userId ? 'Meetings del Usuario' : 'Registro de Meetings' }}
        </h1>
        <p v-if="userId" class="text-gray-500 mt-1 flex items-center gap-2">
          Filtrando en base a usuario: <UBadge variant="subtle" size="sm" color="primary">{{ userId }}</UBadge>
          <UButton to="/meetings" icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="xs" label="Remover Filtro" />
        </p>
      </div>
    </div>

    <div v-if="error" class="mb-6">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        title="Error"
        :description="`Failed to load meetings: ${error.message}`"
      />
    </div>

    <UCard :ui="{ body: { padding: 'p-0' } }">
      <UTable
        :data="meetings || []"
        :columns="columns"
        :loading="pending"
        class="w-full"
      >
        <template #meetingId-cell="{ row }">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-video-camera" class="text-primary text-lg" />
            <span class="font-medium text-gray-900 dark:text-white">{{ row.original.meetingId }}</span>
          </div>
        </template>
        <template #name-cell="{ row }">
          <div>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-video-camera" class="text-primary text-lg" />
             <UTooltip :text="`meeting ID:  ${row.original.meetingId}`" :popper="{ placement: 'top' }">
               <span class="font-medium text-gray-900 dark:text-white">{{ row.original.name }}</span>
             </UTooltip>
            </div>
          </div>
        </template>

        <template #occurredAt-cell="{ row }">
          <span class="text-gray-500">{{ formatDate(row.original.occurredAt) }}</span>
        </template>

        <template #participants-cell="{ row }">
          <div class="flex items-center gap-1 text-gray-500">
            <UIcon name="i-heroicons-users" />
            <span>{{ row.original.participants?.length || 0 }}</span>
          </div>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              :to="`/meetings/${row.original._id}`"
              icon="i-heroicons-chevron-right"
              color="neutral"
              variant="ghost"
            />
          </div>
        </template>

        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-12 text-gray-500">
            <UIcon name="i-heroicons-inbox" class="text-4xl mb-2" />
            <p>No meetings found.</p>
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
