<script setup lang="ts">
const badgeVariant = useBadgeVariant()

useSeoMeta({
  title: 'Usuarios - STC Control',
  description: 'Directorio de miembros del Discord del Stock Trading Club.',
  ogTitle: 'Usuarios de Discord - STC Control',
})

const dateFrom = ref('')
const dateTo = ref('')

const { data: users, pending, error } = useFetch('/api/discord-users', {
  query: computed(() => ({
    ...(dateFrom.value ? { from: dateFrom.value } : {}),
    ...(dateTo.value ? { to: dateTo.value } : {}),
  }))
})

const q = ref('')
const selectedRoles = ref<string[]>([])
const excludeKnownRoles = ref(false)
const zeroMeetings = ref(false)

type SortKey = 'recent' | 'meetings' | 'messages30d' | 'lifetime'
const sortBy = ref<SortKey>('recent')
const sortDir = ref<'asc' | 'desc'>('desc')

function clearDateFilter() {
  dateFrom.value = ''
  dateTo.value = ''
}

function setSort(key: SortKey) {
  if (sortBy.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortBy.value = key
    sortDir.value = 'desc'
  }
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recientes' },
  { key: 'meetings', label: 'Reuniones' },
  { key: 'messages30d', label: 'Mensajes 30d' },
  { key: 'lifetime', label: 'Mensajes total' },
]

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

function sortValue(user: any, key: SortKey): number {
  switch (key) {
    case 'recent': {
      const msg = user.lastMessageAt ? new Date(user.lastMessageAt).getTime() : 0
      const mtg = user.lastMeetingAt ? new Date(user.lastMeetingAt).getTime() : 0
      return Math.max(msg, mtg)
    }
    case 'meetings': return user.meetingCount ?? 0
    case 'messages30d': return user.messages30d ?? 0
    case 'lifetime': return user.messageCount ?? 0
  }
}

const sortedRows = computed(() => {
  const rows = [...filteredRows.value]
  rows.sort((a: any, b: any) => {
    const av = sortValue(a, sortBy.value)
    const bv = sortValue(b, sortBy.value)
    if (av === bv) return (a.username || '').localeCompare(b.username || '')
    return sortDir.value === 'asc' ? av - bv : bv - av
  })
  return rows
})

const paginatedRows = computed(() => {
  const start = (page.value - 1) * limit.value
  const end = start + limit.value
  return sortedRows.value.slice(start, end)
})

watch([q, selectedRoles, excludeKnownRoles, zeroMeetings, dateFrom, dateTo, sortBy, sortDir], () => {
  page.value = 1
})

const columns = [
  { accessorKey: 'username', header: 'Usuario' },
  { accessorKey: 'roles', header: 'Roles' },
  { accessorKey: 'activity', header: 'Actividad' },
  { accessorKey: 'lastActive', header: 'Última actividad' },
  { id: 'actions', header: '' },
]

const colorMap: Record<string, any> = {
  'Alpha.': 'warning',
  'Alpha': 'warning',
  'Delta': 'info',
  'Delta.': 'info',
}

const stateDotClass: Record<string, string> = {
  active: 'bg-green-500',
  slipping: 'bg-amber-500',
  inactive: 'bg-red-500',
  dormant: 'bg-gray-400',
}

function userEngagement(user: any) {
  return getEngagementState(user.lastMessageAt, user.lastMeetingAt)
}

function lastActiveDate(user: any): Date | null {
  const msg = user.lastMessageAt ? new Date(user.lastMessageAt).getTime() : 0
  const mtg = user.lastMeetingAt ? new Date(user.lastMeetingAt).getTime() : 0
  const max = Math.max(msg, mtg)
  return max ? new Date(max) : null
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

      <!-- Sort bar -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-gray-500">Ordenar:</span>
        <UButton
          v-for="opt in sortOptions"
          :key="opt.key"
          size="xs"
          color="neutral"
          :variant="sortBy === opt.key ? 'solid' : 'outline'"
          :trailing-icon="sortBy === opt.key ? (sortDir === 'desc' ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up') : undefined"
          @click="setSort(opt.key)"
        >
          {{ opt.label }}
        </UButton>
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

    <!-- Skeleton -->
    <UCard v-if="pending" :ui="{ body: { padding: 'p-4' } }">
      <div class="space-y-3">
        <div v-for="i in 8" :key="i" class="flex items-center gap-4">
          <USkeleton class="h-8 w-8 rounded-lg shrink-0" />
          <USkeleton class="h-4 w-36" />
          <div class="flex gap-1.5 ml-2">
            <USkeleton class="h-5 w-14 rounded-full" />
            <USkeleton class="h-5 w-14 rounded-full" />
          </div>
          <USkeleton class="h-5 w-10 rounded-full ml-auto" />
          <USkeleton class="h-5 w-20 rounded-full" />
          <USkeleton class="h-7 w-7 rounded-md" />
          <USkeleton class="h-7 w-7 rounded-md" />
        </div>
      </div>
    </UCard>

    <!-- Desktop table -->
    <UCard v-else class="hidden md:block" :ui="{ body: { padding: 'p-0' } }">
      <UTable :data="paginatedRows" :columns="columns" :loading="pending" class="w-full">
        <template #username-cell="{ row }">
          <div class="flex items-center gap-3 py-1">
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="stateDotClass[userEngagement(row.original).state]"
              :title="userEngagement(row.original).label"
            />
            <UAvatar :alt="row.original.username" size="sm" :ui="{ rounded: 'rounded-lg' }" />
            <span class="font-medium text-gray-900 dark:text-white">{{ row.original.username }}</span>
          </div>
        </template>

        <template #roles-cell="{ row }">
          <div class="flex flex-wrap gap-1.5">
            <template v-for="role in (row.original.roles || [])" :key="role">
              <UBadge v-if="colorMap[role]" :color="colorMap[role]" :variant="badgeVariant" size="md" class="capitalize">
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

        <template #activity-cell="{ row }">
          <div class="flex flex-col gap-0.5 tabular-nums text-sm">
            <span class="text-gray-700 dark:text-gray-300">
              <span class="font-semibold">{{ row.original.meetingCount ?? 0 }}</span>
              <span class="text-gray-400"> mtgs</span>
              <span class="text-gray-300 dark:text-gray-700 mx-1">·</span>
              <span class="font-semibold">{{ row.original.messages30d ?? 0 }}</span>
              <span class="text-gray-400"> msgs/30d</span>
            </span>
            <span class="text-xs text-gray-400">
              {{ row.original.messageCount ?? 0 }} msgs total
            </span>
          </div>
        </template>

        <template #lastActive-cell="{ row }">
          <UBadge
            v-if="lastActiveDate(row.original)"
            :color="userEngagement(row.original).color"
            :variant="badgeVariant"
          >
            {{ formatRelativeTime(lastActiveDate(row.original)) }}
          </UBadge>
          <UBadge v-else color="neutral" :variant="badgeVariant">Nunca</UBadge>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-2">
            <UTooltip text="Ver perfil">
              <UButton :to="`/discord-users/${row.original._id}`" icon="i-heroicons-user" color="neutral" variant="ghost" />
            </UTooltip>
            <UTooltip text="Ver reuniones">
              <UButton :to="`/meetings?userId=${row.original._id}`" icon="i-heroicons-calendar-days" color="neutral" variant="ghost" />
            </UTooltip>
          </div>
        </template>

        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-12 text-gray-500">
            <UIcon name="i-heroicons-users" class="text-4xl mb-2" />
            <p v-if="q">No se encontraron usuarios para "{{ q }}"</p>
            <p v-else>No hay usuarios en el directorio.</p>
          </div>
        </template>
      </UTable>

      <div v-if="filteredRows.length > limit" class="flex justify-center border-t border-gray-200 dark:border-gray-800 py-4">
        <UPagination v-model:page="page" :total="filteredRows.length" :items-per-page="limit" />
      </div>
    </UCard>

    <!-- Mobile card list -->
    <div class="md:hidden">
      <div v-if="pending" class="flex flex-col gap-3">
        <UCard v-for="i in 5" :key="i">
          <div class="flex items-center gap-3">
            <USkeleton class="h-10 w-10 rounded-lg shrink-0" />
            <div class="flex-1 space-y-2">
              <USkeleton class="h-4 w-32" />
              <USkeleton class="h-3 w-20" />
            </div>
            <USkeleton class="h-7 w-7 rounded-md" />
            <USkeleton class="h-7 w-7 rounded-md" />
          </div>
          <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <USkeleton class="h-4 w-24" />
            <USkeleton class="h-5 w-20 rounded-full ml-auto" />
          </div>
        </UCard>
      </div>

      <div v-else-if="paginatedRows.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-500">
        <UIcon name="i-heroicons-users" class="text-4xl mb-2" />
        <p v-if="q">No se encontraron usuarios para "{{ q }}"</p>
        <p v-else>No hay usuarios en el directorio.</p>
      </div>

      <div v-else class="flex flex-col gap-3">
        <UCard v-for="user in paginatedRows" :key="user._id" class="w-full">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <span
                class="w-2 h-2 rounded-full shrink-0"
                :class="stateDotClass[userEngagement(user).state]"
                :title="userEngagement(user).label"
              />
              <UAvatar :alt="user.username" size="md" :ui="{ rounded: 'rounded-lg' }" class="shrink-0" />
              <div class="min-w-0">
                <p class="font-semibold text-gray-900 dark:text-white truncate">{{ user.username }}</p>
                <div class="flex flex-wrap gap-1 mt-1">
                  <template v-for="role in (user.roles || [])" :key="role">
                    <UBadge v-if="colorMap[role]" :color="colorMap[role]" :variant="badgeVariant" size="sm" class="capitalize">
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

          <div class="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div class="flex items-center gap-1 text-sm text-gray-500">
              <UIcon name="i-heroicons-video-camera" class="text-gray-400 shrink-0" />
              <span class="font-semibold text-gray-700 dark:text-gray-300">{{ user.meetingCount ?? 0 }}</span>
              <span class="text-xs">mtgs</span>
            </div>
            <div class="flex items-center gap-1 text-sm text-gray-500">
              <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="text-gray-400 shrink-0" />
              <span class="font-semibold text-gray-700 dark:text-gray-300">{{ user.messages30d ?? 0 }}</span>
              <span class="text-xs">msgs/30d</span>
            </div>
            <div class="ml-auto">
              <UBadge
                v-if="lastActiveDate(user)"
                :color="userEngagement(user).color"
                :variant="badgeVariant"
                size="sm"
              >
                {{ formatRelativeTime(lastActiveDate(user)) }}
              </UBadge>
              <UBadge v-else color="neutral" :variant="badgeVariant" size="sm">Nunca</UBadge>
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
