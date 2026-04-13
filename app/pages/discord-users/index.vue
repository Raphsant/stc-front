<script setup lang="ts">
const dateFrom = ref('')
const dateTo = ref('')

const { data: users, pending, error } = await useFetch('/api/discord-users', {
  query: computed(() => ({
    ...(dateFrom.value ? { from: dateFrom.value } : {}),
    ...(dateTo.value ? { to: dateTo.value } : {}),
  }))
})

const q = ref('')
const selectedRoles = ref<string[]>([])
const excludeKnownRoles = ref(false)
const zeroMeetings = ref(false)
const meetingSort = ref<'asc' | 'desc' | null>(null)

function clearDateFilter() {
  dateFrom.value = ''
  dateTo.value = ''
}

function cycleMeetingSort() {
  if (meetingSort.value === null) meetingSort.value = 'asc'
  else if (meetingSort.value === 'asc') meetingSort.value = 'desc'
  else meetingSort.value = null
}

const meetingSortIcon = computed(() => {
  if (meetingSort.value === 'asc') return 'i-heroicons-chevron-up'
  if (meetingSort.value === 'desc') return 'i-heroicons-chevron-down'
  return 'i-heroicons-chevron-up-down'
})
const page = ref(1)
const limit = ref(10)

function toggleRole(role: string) {
  excludeKnownRoles.value = false
  const idx = selectedRoles.value.indexOf(role)
  if (idx === -1) selectedRoles.value = [...selectedRoles.value, role]
  else selectedRoles.value = selectedRoles.value.filter(r => r !== role)
}

function toggleExclude() {
  excludeKnownRoles.value = !excludeKnownRoles.value
  if (excludeKnownRoles.value) selectedRoles.value = []
}

// 1. Filter the full list based on search, role, and meeting count
const filteredRows = computed(() => {
  const allUsers = users.value || []

  return allUsers.filter((user: any) => {
    const hasKnownRole = roleFilter.some(known =>
      user.roles?.some((role: string) => role.toLowerCase().includes(known.toLowerCase()))
    )
    if (excludeKnownRoles.value && hasKnownRole) return false
    if (zeroMeetings.value && (user.meetingCount ?? 0) !== 0) return false

    const matchesRoles = selectedRoles.value.length === 0 || selectedRoles.value.every(selected =>
      user.roles?.some((role: string) => role.toLowerCase().includes(selected.toLowerCase()))
    )
    const matchesQuery = !q.value || user.username?.toLowerCase().includes(q.value.toLowerCase())
    return matchesRoles && matchesQuery
  })
})

// 2. Sort the filtered list
const sortedRows = computed(() => {
  if (!meetingSort.value) return filteredRows.value
  return [...filteredRows.value].sort((a: any, b: any) => {
    const av = a.meetingCount ?? 0
    const bv = b.meetingCount ?? 0
    return meetingSort.value === 'asc' ? av - bv : bv - av
  })
})

// 3. Slice for the current page
const paginatedRows = computed(() => {
  const start = (page.value - 1) * limit.value
  const end = start + limit.value
  return sortedRows.value.slice(start, end)
})

// 4. Reset to page 1 when filters change
watch([q, selectedRoles, excludeKnownRoles, zeroMeetings, dateFrom, dateTo], () => {
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
    accessorKey: 'lastMeeting',
    header: 'Última reunión',
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
  <div class="p-4 md:p-6">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-start md:items-end">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Usuarios de Discord</h1>
        <p class="text-gray-500 mt-1 text-sm">Lista de miembros del Discord.</p>
      </div>
      <span class="text-sm text-gray-400 mt-1">
        {{ filteredRows.length }} {{ filteredRows.length === 1 ? 'usuario' : 'usuarios' }}
      </span>
    </div>

    <!-- Filters -->
    <div class="mb-6 flex flex-col gap-3">
      <UInput
        v-model="q"
        icon="i-heroicons-magnifying-glass"
        placeholder="Buscar usuario..."
        class="w-full md:w-64"
      >
        <template v-if="q" #trailing>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="xs" @click="q = ''" />
        </template>
      </UInput>

      <div class="flex flex-wrap items-center justify-between gap-y-3">
        <!-- Left: role + meeting filters -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-gray-500">Rol:</span>
          <UButton
            v-for="r in roleFilter"
            :key="r"
            size="sm"
            :color="colorMap[r]"
            :variant="selectedRoles.includes(r) ? 'solid' : 'outline'"
            @click="toggleRole(r)"
          >
            {{ r }}
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            :variant="excludeKnownRoles ? 'solid' : 'outline'"
            @click="toggleExclude"
          >
            Ninguno
          </UButton>
          <UButton
            v-if="selectedRoles.length || excludeKnownRoles"
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark"
            @click="selectedRoles = []; excludeKnownRoles = false"
          />

          <div class="h-5 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />

          <UButton
            size="sm"
            color="error"
            :variant="zeroMeetings ? 'solid' : 'outline'"
            icon="i-heroicons-calendar-x-mark"
            @click="zeroMeetings = !zeroMeetings"
          >
            Sin reuniones
          </UButton>

          <UButton
            size="sm"
            color="neutral"
            :variant="meetingSort ? 'solid' : 'outline'"
            :trailing-icon="meetingSortIcon"
            class="md:hidden"
            @click="cycleMeetingSort"
          >
            Reuniones
          </UButton>
        </div>

        <!-- Right: date range filter -->
        <div class="flex items-end gap-2 w-full sm:w-auto">
          <div class="flex flex-col gap-1 flex-1 sm:flex-none">
            <span class="text-xs text-gray-400">Desde</span>
            <UInput v-model="dateFrom" type="date" size="sm" class="w-full sm:w-36" />
          </div>
          <div class="flex flex-col gap-1 flex-1 sm:flex-none">
            <span class="text-xs text-gray-400">Hasta</span>
            <UInput v-model="dateTo" type="date" size="sm" class="w-full sm:w-36" />
          </div>
          <UButton
            v-if="dateFrom || dateTo"
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark"
            class="mb-0.5"
            @click="clearDateFilter"
          />
        </div>
      </div>
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

    <!-- Desktop table -->
    <UCard class="hidden md:block" :ui="{ body: { padding: 'p-0' } }">
      <UTable :data="paginatedRows" :columns="columns" :loading="pending" class="w-full">
        <template #username-cell="{ row }">
          <div class="flex items-center gap-3 py-1">
            <UAvatar :alt="row.original.username" size="sm" :ui="{ rounded: 'rounded-lg' }" />
            <span class="font-medium text-gray-900 dark:text-white">{{ row.original.username }}</span>
          </div>
        </template>

        <template #roles-cell="{ row }">
          <div class="flex flex-wrap gap-1.5">
            <template v-for="role in (row.original.roles || [])" :key="role">
              <UBadge v-if="colorMap[role]" :color="colorMap[role]" variant="subtle" size="md" class="capitalize">
                {{ role }}
              </UBadge>
            </template>
            <UPopover v-if="row.original.roles?.filter((r: string) => !colorMap[r]).length" mode="hover">
              <UBadge color="neutral" variant="soft" size="md" class="cursor-help">
                +{{ row.original.roles.filter((r: string) => !colorMap[r]).length }}
              </UBadge>
              <template #content>
                <div class="p-2 max-w-xs flex flex-wrap gap-1">
                  <UBadge v-for="role in row.original.roles.filter((r: string) => !colorMap[r])" :key="role" color="neutral" variant="outline" size="md">
                    {{ role }}
                  </UBadge>
                </div>
              </template>
            </UPopover>
          </div>
        </template>

        <template #meetingCount-header>
          <UButton variant="ghost" size="xs" :trailing-icon="meetingSortIcon" :color="meetingSort ? 'primary' : 'neutral'" @click="cycleMeetingSort">
            Meetings
          </UButton>
        </template>

        <template #meetingCount-cell="{ row }">
          <UBadge :color="row.original.meetingCount > 0 ? 'primary' : 'neutral'" variant="flat" class="min-w-[2.5rem] justify-center">
            {{ row.original.meetingCount }}
          </UBadge>
        </template>

        <template #lastMeeting-cell="{ row }">
          <UBadge v-if="row.original.lastMeeting" color="primary" variant="subtle">
            {{ new Date(row.original.lastMeeting).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) }}
          </UBadge>
          <UBadge v-else color="error" variant="subtle">Sin reuniones</UBadge>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-2">
            <UTooltip text="View profile">
              <UButton :to="`/discord-users/${row.original._id}`" icon="i-heroicons-user" color="neutral" variant="ghost" />
            </UTooltip>
            <UTooltip text="View user meetings">
              <UButton :to="`/meetings?userId=${row.original._id}`" icon="i-heroicons-calendar-days" color="neutral" variant="ghost" />
            </UTooltip>
          </div>
        </template>

        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-12 text-gray-500">
            <UIcon name="i-heroicons-users" class="text-4xl mb-2" />
            <p v-if="q">No users found matching "{{ q }}"</p>
            <p v-else>No users found in the directory.</p>
          </div>
        </template>
      </UTable>

      <div v-if="filteredRows.length > limit" class="flex justify-center border-t border-gray-200 dark:border-gray-800 py-4">
        <UPagination v-model:page="page" :total="filteredRows.length" :items-per-page="limit" />
      </div>
    </UCard>

    <!-- Mobile card list -->
    <div class="md:hidden">
      <div v-if="pending" class="flex justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="text-3xl text-gray-400 animate-spin" />
      </div>

      <div v-else-if="paginatedRows.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-500">
        <UIcon name="i-heroicons-users" class="text-4xl mb-2" />
        <p v-if="q">No users found matching "{{ q }}"</p>
        <p v-else>No users found in the directory.</p>
      </div>

      <div v-else class="flex flex-col gap-3">
        <UCard v-for="user in paginatedRows" :key="user._id" class="w-full">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <UAvatar :alt="user.username" size="md" :ui="{ rounded: 'rounded-lg' }" class="shrink-0" />
              <div class="min-w-0">
                <p class="font-semibold text-gray-900 dark:text-white truncate">{{ user.username }}</p>
                <div class="flex flex-wrap gap-1 mt-1">
                  <template v-for="role in (user.roles || [])" :key="role">
                    <UBadge v-if="colorMap[role]" :color="colorMap[role]" variant="subtle" size="sm" class="capitalize">
                      {{ role }}
                    </UBadge>
                  </template>
                  <UBadge v-if="user.roles?.filter((r: string) => !colorMap[r]).length" color="neutral" variant="soft" size="sm">
                    +{{ user.roles.filter((r: string) => !colorMap[r]).length }}
                  </UBadge>
                </div>
              </div>
            </div>

            <div class="flex gap-1 shrink-0">
              <UButton :to="`/discord-users/${user._id}`" icon="i-heroicons-user" color="neutral" variant="ghost" size="sm" />
              <UButton :to="`/meetings?userId=${user._id}`" icon="i-heroicons-calendar-days" color="neutral" variant="ghost" size="sm" />
            </div>
          </div>

          <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <UIcon name="i-heroicons-video-camera" class="text-gray-400 shrink-0" />
            <span class="text-sm text-gray-500">{{ user.meetingCount }} {{ user.meetingCount === 1 ? 'reunión' : 'reuniones' }}</span>
            <div class="ml-auto">
              <UBadge v-if="user.lastMeeting" color="primary" variant="subtle" size="sm">
                {{ new Date(user.lastMeeting).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) }}
              </UBadge>
              <UBadge v-else color="error" variant="subtle" size="sm">Sin reuniones</UBadge>
            </div>
          </div>
        </UCard>
      </div>

      <div v-if="filteredRows.length > limit" class="flex justify-center mt-6">
        <UPagination v-model:page="page" :total="filteredRows.length" :items-per-page="limit" />
      </div>
    </div>
  </div>
</template>
