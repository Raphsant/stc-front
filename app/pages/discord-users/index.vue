<script setup lang="ts">
const q = ref('')
const selectedRole = ref('')
const page = ref(1)
const limit = ref(10)

const {data, pending, error} = await useFetch('/api/discord-users', {
  query: {
    q,
    role: selectedRole,
    page,
    limit
  },
  watch: [q, selectedRole, page, limit]
})

const users = computed(() => data.value?.users || [])
const total = computed(() => data.value?.total || 0)

// Reset page when search or role changes
watch([q, selectedRole], () => {
  page.value = 1
})

const columns = [
  {
    accessorKey: 'username',
    header: 'User',
  },
  {
    accessorKey: 'roles',
    header: 'Roles',
  },
  {
    accessorKey: 'meetingCount',
    header: 'Meetings',
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

const roleFilter = ['Alpha', 'Delta']

</script>

<template>
  <div class="p-6">
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Usuarios de Discord</h1>
        <p class="text-gray-500 mt-1">Lista de miembros del Discord.</p>
      </div>
    </div>
    <div class="mb-2 flex justify-items-start gap-2 items-end">
      <div class="flex items-center gap-4">
        <UInput
            v-model="q"
            icon="i-heroicons-magnifying-glass"
            placeholder="Buscar usuario..."
            class="w-64"
        />
      </div>
    </div>
    <div class="mb-8 flex justify-items-start gap-2 items-end">
      <UBadge class="cursor-pointer" v-for="r in roleFilter" :color="colorMap[r]"
              :variant="selectedRole == r ? 'solid' : 'subtle'" @click="selectedRole = selectedRole === r ? null : r">
        {{ r }}
      </UBadge>
    </div>

    <div v-if="error" class="mb-6">
      <UAlert
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          title="Error"
          :description="`Failed to load users: ${error.message}`"
      />
    </div>

    <UCard :ui="{ body: { padding: 'p-0',} }">
      <UTable
          :data="users"
          :columns="columns"
          :loading="pending"
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
                  size=md
                  class="capitalize"
              >
                {{ role }}
              </UBadge>
            </template>

            <UPopover v-if="row.original.roles?.filter((r: string) => !colorMap[r]).length" mode="hover">
              <UBadge
                  color="neutral"
                  variant="soft"
                  size="md"
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
                        size="md"
                    >
                      {{ role }}
                    </UBadge>
                  </div>
                </div>
              </template>
            </UPopover>
          </div>
        </template>

        <template #meetingCount-cell="{ row }">
          <div class="flex items-center gap-2">
            <UBadge
              :color="row.original.meetingCount > 0 ? 'primary' : 'neutral'"
              variant="flat"
              class="min-w-[2.5rem] justify-center"
            >
              {{ row.original.meetingCount }}
            </UBadge>
          </div>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-2">
            <UTooltip text="View profile">
              <UButton
                :to="`/discord-users/${row.original._id}`"
                icon="i-heroicons-user"
                color="neutral"
                variant="ghost"
              />
            </UTooltip>
            <UTooltip text="View user meetings">
              <UButton
                :to="`/meetings?userId=${row.original._id}`"
                icon="i-heroicons-calendar-days"
                color="neutral"
                variant="ghost"
              />
            </UTooltip>
          </div>
        </template>
        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-12 text-gray-500">
            <UIcon name="i-heroicons-users" class="text-4xl mb-2"/>
            <p v-if="q">No users found matching "{{ q }}"</p>
            <p v-else>No users found in the directory.</p>
          </div>
        </template>
      </UTable>

      <div v-if="total > limit" class="flex justify-center border-t border-gray-200 dark:border-gray-800 py-4">
        <UPagination
          v-model="page"
          :total="total"
          :items-per-page="limit"
        />
      </div>

    </UCard>
  </div>
</template>

