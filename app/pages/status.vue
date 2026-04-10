<script setup lang="ts">
const { data: status, pending, error, refresh } = await useFetch('/api/bot/status')

function formatUptime(seconds: number) {
  if (!seconds) return '0s'
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  if (s > 0 || parts.length === 0) parts.push(`${s}s`)
  
  return parts.join(' ')
}

// Auto-refresh status every 30 seconds
onMounted(() => {
  const interval = setInterval(refresh, 30000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto">
    <div class="mb-8 flex justify-between items-center">
      <h1 class="text-3xl font-bold">System Status</h1>
      <UButton 
        icon="i-heroicons-arrow-path" 
        color="gray" 
        variant="ghost" 
        :loading="pending" 
        @click="refresh"
      >
        Refresh
      </UButton>
    </div>

    <div v-if="error" class="mb-6">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="red"
        variant="soft"
        title="Bot Offline"
        description="Could not connect to the Discord bot service. Please check if the bot process is running."
      />
    </div>

    <div v-if="status" class="grid gap-6">
      <!-- Main Status Card -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-500 uppercase tracking-wider">Bot Core</span>
            <UBadge :color="status.status === 'UP' ? 'green' : 'red'" variant="subtle" size="lg" class="capitalize">
              {{ status.status }}
            </UBadge>
          </div>
        </template>
        
        <div class="flex items-center gap-4">
          <div :class="[
            'p-4 rounded-full bg-opacity-10',
            status.status === 'UP' ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'
          ]">
            <UIcon :name="status.status === 'UP' ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'" class="text-3xl" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ status.status === 'UP' ? 'Running smoothly' : 'Service issues detected' }}</p>
            <p class="text-gray-500 text-sm">System checked at {{ new Date().toLocaleTimeString() }}</p>
          </div>
        </div>
      </UCard>

      <!-- Discord Connection Card -->
      <UCard>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-simple-icons-discord" class="text-2xl text-[#5865F2]" />
            <div>
              <p class="font-bold">Discord Connection</p>
              <p class="text-sm text-gray-500">{{ status.discord }}</p>
            </div>
          </div>
          <div :class="[
            'w-3 h-3 rounded-full animate-pulse',
            status.discord === 'Connected' ? 'bg-green-500' : 'bg-yellow-500'
          ]"></div>
        </div>
      </UCard>

      <!-- Uptime Card -->
      <UCard>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-clock" class="text-2xl text-primary" />
            <div>
              <p class="font-bold">Total Uptime</p>
              <p class="text-sm text-gray-500">{{ formatUptime(status.uptime) }}</p>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Loading State -->
    <div v-else-if="pending && !status" class="space-y-4">
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-20 w-full" />
      <USkeleton class="h-20 w-full" />
    </div>

    <div class="mt-8 text-center">
      <UButton to="/" variant="link" color="gray">Return to Dashboard</UButton>
    </div>
  </div>
</template>
