<script setup lang="ts">
const route = useRoute()
const userId = route.params.id

const { data: user, pending, error } = await useFetch(`/api/discord-users/${userId}`)

const colorMap: Record<string, any> = {
  'Alpha.': 'warning',
  'Alpha': 'warning',
  'Delta': 'info',
  'Delta.': 'info',
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="mb-8 flex justify-between items-center">
      <UButton to="/discord-users" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">Back to Directory</UButton>
    </div>

    <div v-if="pending" class="space-y-6">
      <UCard>
        <div class="flex items-center gap-4">
          <USkeleton class="h-16 w-16 rounded-lg" />
          <div class="space-y-2">
            <USkeleton class="h-6 w-48" />
            <USkeleton class="h-4 w-32" />
          </div>
        </div>
      </UCard>
      <USkeleton class="h-64 w-full" />
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg text-center">
      <UIcon name="i-heroicons-exclamation-circle" class="text-4xl text-red-500 mb-2" />
      <h2 class="text-xl font-bold text-red-700 dark:text-red-400">User Not Found</h2>
      <p class="text-red-600 dark:text-red-300 mt-1">{{ error.message }}</p>
      <UButton to="/discord-users" class="mt-4" color="neutral">Return to List</UButton>
    </div>

    <div v-else-if="user" class="space-y-6">
      <!-- Profile Header -->
      <UCard>
        <div class="flex flex-col md:flex-row md:items-center gap-6">
          <UAvatar
            :alt="user.username"
            size="xl"
            :ui="{ rounded: 'rounded-2xl' }"
            class="ring-4 ring-primary/10"
          />
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ user.username }}</h1>
              <UBadge color="neutral" variant="subtle" size="sm">ID: {{ user._id }}</UBadge>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <UBadge
                v-for="role in user.roles"
                :key="role"
                :color="colorMap[role] || 'neutral'"
                :variant="colorMap[role] ? 'subtle' : 'soft'"
                class="capitalize"
              >
                {{ role }}
              </UBadge>
            </div>
          </div>
          <div class="flex flex-col items-center p-4 rounded-xl bg-primary/5 border border-primary/10 min-w-[120px]">
            <span class="text-3xl font-black text-primary">{{ user.meetingCount }}</span>
            <span class="text-xs font-bold uppercase tracking-wider text-primary/70">Meetings</span>
          </div>
        </div>
      </UCard>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Stats Card -->
        <UCard title="Participation">
          <template #header>
            <div class="flex items-center gap-2 font-bold">
              <UIcon name="i-heroicons-chart-bar" class="text-primary" />
              Activity Overview
            </div>
          </template>
          <div class="space-y-4">
            <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <span class="text-gray-500">Total Meetings Attended</span>
              <span class="font-bold text-lg">{{ user.meetingCount }}</span>
            </div>
            <UButton
              :to="`/meetings?userId=${user._id}`"
              icon="i-heroicons-calendar-days"
              block
              color="primary"
            >
              View Full History
            </UButton>
          </div>
        </UCard>

        <!-- User Data Card -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 font-bold">
              <UIcon name="i-heroicons-fingerprint" class="text-primary" />
              Technical Info
            </div>
          </template>
          <div class="space-y-4">
            <div v-if="user.previousUsernames?.length">
              <span class="text-xs font-bold uppercase text-gray-400 block mb-2">Previous Usernames</span>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="prev in user.previousUsernames" :key="prev" variant="outline" size="xs">
                  {{ prev }}
                </UBadge>
              </div>
            </div>
            <div>
              <span class="text-xs font-bold uppercase text-gray-400 block mb-2">Registered Roles ({{ user.roles?.length || 0 }})</span>
              <div class="text-sm text-gray-500 line-clamp-3">
                {{ user.roles?.join(', ') || 'No roles assigned' }}
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
