<template>
  <div class="min-h-screen bg-cream-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 flex flex-col md:flex-row">
    <!-- Sidebar for Desktop -->
    <aside class="hidden md:flex w-64 flex-col bg-cream-200 dark:bg-neutral-900 border-r border-cream-400 dark:border-neutral-800">
      <div class="p-6">
        <div class="flex items-center gap-2 mb-8">
          <UIcon name="i-heroicons-bolt-20-solid" class="w-8 h-8 text-primary-500" />
          <span class="text-xl font-bold tracking-tight">STC Control</span>
        </div>

        <nav class="space-y-2">
          <UButton
            v-for="item in navItems"
            :key="item.label"
            :icon="item.icon"
            :label="item.label"
            :to="item.to"
            variant="ghost"
            block
            class="justify-start"
            color="neutral"
            :active-class="`bg-primary-500/10 text-primary-500`"
          />
        </nav>
      </div>

      <div class="mt-auto p-6 border-t border-cream-400 dark:border-neutral-800">
        <div class="flex items-center gap-3">
          <UAvatar :alt="session.user?.username" size="sm" />
          <div class="flex flex-col overflow-hidden flex-1">
            <span class="text-sm font-medium truncate">{{ session.user?.username }}</span>
            <span class="text-xs text-neutral-500 dark:text-neutral-400 truncate text-primary-500/80">Admin</span>
          </div>
          <UButton
            icon="i-heroicons-arrow-right-on-rectangle-20-solid"
            color="neutral"
            variant="ghost"
            size="xs"
            title="Sign out"
            @click="logout"
          />
        </div>
      </div>
    </aside>

    <!-- Mobile Header -->
    <header class="md:hidden flex items-center justify-between p-4 bg-cream-200 dark:bg-neutral-900 border-b border-cream-400 dark:border-neutral-800">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-bolt-20-solid" class="w-6 h-6 text-primary-500" />
        <span class="font-bold">STC</span>
      </div>
      <UButton
        icon="i-heroicons-bars-3-20-solid"
        variant="ghost"
        color="neutral"
        @click="isMobileMenuOpen = true"
      />
    </header>

    <!-- Mobile Menu Slide-over -->
    <USlideover v-model:open="isMobileMenuOpen" title="STC Control">
      <template #content>
        <div class="flex flex-col h-full p-4">
          <div class="space-y-2 flex-1">
            <UButton
              v-for="item in navItems"
              :key="item.label"
              :icon="item.icon"
              :label="item.label"
              :to="item.to"
              variant="ghost"
              block
              class="justify-start"
              color="neutral"
              @click="isMobileMenuOpen = false"
            />
          </div>

          <div class="border-t border-cream-400 dark:border-neutral-800 pt-4 mt-4">
            <div class="flex items-center gap-3">
              <UAvatar :alt="session.user?.username" size="sm" />
              <div class="flex flex-col overflow-hidden flex-1">
                <span class="text-sm font-medium truncate">{{ session.user?.username }}</span>
                <span class="text-xs text-neutral-500 dark:text-neutral-400 text-primary-500/80">Admin</span>
              </div>
              <UButton
                icon="i-heroicons-arrow-right-on-rectangle-20-solid"
                color="neutral"
                variant="ghost"
                size="xs"
                title="Sign out"
                @click="logout"
              />
            </div>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col h-screen overflow-hidden">
      <!-- Top Bar -->
      <header class="hidden md:flex h-16 items-center justify-between px-8 bg-cream-200/50 dark:bg-neutral-900/50 backdrop-blur-sm border-b border-cream-400 dark:border-neutral-800">
        <h1 class="text-lg font-semibold">{{ currentRouteName }}</h1>
        <div class="flex items-center gap-4">
          <UBadge color="success" variant="soft" class="font-mono">v0.1.1-beta</UBadge>
          <UColorModeButton color="neutral" variant="ghost" />
          <UButton icon="i-heroicons-bell-20-solid" color="neutral" variant="ghost" />
        </div>
      </header>

      <!-- Page Content -->
      <div class="flex-1 overflow-y-auto p-4 md:p-8">
        <slot />
        <footer class="mt-12 pt-4 border-t border-cream-400 dark:border-neutral-800 text-center text-xs text-neutral-500 dark:text-neutral-600">
          Made by Sunny for Stock Trading Club
        </footer>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const isMobileMenuOpen = ref(false)
const route = useRoute()
const { session } = useUserSession()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

const navItems = [
  { label: 'Dashboard', icon: 'i-heroicons-squares-2x2-20-solid', to: '/' },
  { label: 'Usuarios', icon: 'i-heroicons-user-group-solid', to: '/discord-users' },
  { label: 'Meetings', icon: 'i-heroicons-list-bullet-20-solid', to: '/meetings' },
  { label: 'Logs', icon: 'i-heroicons-document-text-solid', to: '/logs' },
  { label: 'Bot Status', icon: 'i-heroicons-signal-20-solid', to: '/status' },
  { label: 'Changelog', icon: 'i-heroicons-document-text-20-solid', to: '/changelog' },
]

const currentRouteName = computed(() => {
  const item = navItems.find(i => route.path === i.to || route.path.startsWith(i.to + '/'))
  return item ? item.label : 'Dashboard'
})
</script>

