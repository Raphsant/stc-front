<script setup lang="ts">
const isMobileMenuOpen = ref(false)
const route = useRoute()
const { session } = useUserSession()
const colorMode = useColorMode()
const { public: { appVersion } } = useRuntimeConfig()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

const isSuperAdmin = computed(() => (session.value?.user as any)?.role === 'superadmin')

const navItems = computed(() => [
  { label: 'Dashboard',  icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Usuarios',   icon: 'i-lucide-users',            to: '/discord-users' },
  { label: 'Meetings',   icon: 'i-lucide-list',             to: '/meetings' },
  { label: 'Logs',       icon: 'i-lucide-file-text',        to: '/logs' },
  { label: 'Bot Status', icon: 'i-lucide-radio',            to: '/status' },
  { label: 'Changelog',  icon: 'i-lucide-scroll-text',      to: '/changelog' },
  ...(isSuperAdmin.value ? [{ label: 'Eliminaciones', icon: 'i-lucide-flag', to: '/journal/pending-deletions' }] : []),
])

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(to + '/')
}

const currentRouteName = computed(() => {
  const item = navItems.value.find(i => isActive(i.to))
  return item?.label ?? 'Dashboard'
})

const userInitial = computed(() => {
  const u = (session.value?.user as any)?.username ?? ''
  return u.charAt(0).toUpperCase()
})

const isDark = computed(() => colorMode.value === 'dark')
</script>

<template>
  <div class="flex h-screen overflow-hidden">

    <!-- ── Sidebar ── -->
    <aside
      class="stc-sidebar hidden md:flex w-[248px] flex-shrink-0 flex-col h-full"
      style="padding: 20px 14px"
    >
      <!-- Brand -->
      <div class="stc-brand" style="padding:6px 10px 4px; margin-bottom:24px">
        <div class="stc-brand-mark">
          <img src="/brand/stc-mark.png" alt="Stocks Trading Club" width="34" height="34">
        </div>
        <span class="stc-brand-name">STC <em>Control</em></span>
      </div>

      <!-- Nav label -->
      <div class="stc-eyebrow" style="padding:0 12px; margin:2px 0 9px">Menú</div>

      <!-- Nav items -->
      <nav class="flex flex-col" style="gap:2px">
        <NuxtLink
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          class="stc-nav-item"
          :class="{ active: isActive(item.to) }"
        >
          <UIcon :name="item.icon" class="w-[17px] h-[17px] flex-shrink-0" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- User card -->
      <div class="mt-auto" style="padding-top:14px">
        <div class="stc-user-card">
          <div class="stc-user-av">{{ userInitial }}</div>
          <div class="flex-1 min-w-0" style="line-height:1.25">
            <div class="font-semibold text-[13px] truncate" style="color:var(--text)">
              {{ (session?.user as any)?.username }}
            </div>
            <div class="text-[11px] truncate" style="color:var(--faint)">
              {{ isSuperAdmin ? 'Superadmin' : 'Admin' }}
            </div>
          </div>
          <button class="stc-ibtn" title="Cerrar sesión" @click="logout">
            <UIcon name="i-lucide-log-out" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- ── Main ── -->
    <main class="flex-1 min-w-0 flex flex-col h-full overflow-hidden">

      <!-- Topbar -->
      <header class="stc-topbar flex items-center justify-between px-4 py-3.5 md:px-8 md:py-[18px]">
        <!-- Left: mobile menu + title -->
        <div class="flex items-center gap-4">
          <button
            class="md:hidden stc-top-icon"
            style="width:36px; height:36px"
            @click="isMobileMenuOpen = true"
          >
            <UIcon name="i-lucide-menu" class="w-[17px] h-[17px]" />
          </button>
          <div>
            <h1 class="stc-topbar-title">{{ currentRouteName }}</h1>
            <div class="hidden md:block stc-eyebrow" style="margin-top:3px">
              Stocks Trading Club · Panel de control
            </div>
          </div>
        </div>

        <!-- Right: version, theme, bell -->
        <div class="flex items-center" style="gap:10px">
          <NuxtLink to="/changelog" class="stc-ver">v{{ appVersion }}</NuxtLink>

          <button
            class="stc-top-icon"
            :title="isDark ? 'Modo claro' : 'Modo oscuro'"
            @click="colorMode.preference = isDark ? 'light' : 'dark'"
          >
            <UIcon
              :name="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
              class="w-[17px] h-[17px]"
            />
          </button>

          <button class="stc-top-icon" title="Notificaciones">
            <span class="nd" />
            <UIcon name="i-lucide-bell" class="w-[17px] h-[17px]" />
          </button>
        </div>
      </header>

      <!-- Page content -->
      <div class="stc-scroll flex-1 overflow-y-auto">
        <div class="flex flex-col px-4 pt-6 pb-11 md:px-8" style="gap:18px; max-width:1620px">
          <slot />
        </div>
      </div>
    </main>
  </div>

  <!-- Mobile slide-over -->
  <Teleport to="body">
    <Transition name="stc-slide">
      <div v-if="isMobileMenuOpen" class="fixed inset-0 z-50 flex">
        <div class="absolute inset-0 bg-black/60" @click="isMobileMenuOpen = false" />
        <aside
          class="stc-sidebar relative w-72 flex flex-col h-full z-10"
          style="padding: 20px 14px"
        >
          <div class="flex items-center justify-between mb-6">
            <div class="stc-brand">
              <div class="stc-brand-mark">
                <img src="/brand/stc-mark.png" alt="Stocks Trading Club" width="34" height="34">
              </div>
              <span class="stc-brand-name">STC <em>Control</em></span>
            </div>
            <button class="stc-top-icon" style="width:32px; height:32px" @click="isMobileMenuOpen = false">
              <UIcon name="i-lucide-x" class="w-4 h-4" />
            </button>
          </div>

          <div class="stc-eyebrow" style="padding:0 12px; margin:2px 0 9px">Menú</div>

          <nav class="flex flex-col" style="gap:2px">
            <NuxtLink
              v-for="item in navItems"
              :key="item.label"
              :to="item.to"
              class="stc-nav-item"
              :class="{ active: isActive(item.to) }"
              @click="isMobileMenuOpen = false"
            >
              <UIcon :name="item.icon" class="w-[17px] h-[17px] flex-shrink-0" />
              {{ item.label }}
            </NuxtLink>
          </nav>

          <div class="mt-auto" style="padding-top:14px">
            <div class="stc-user-card">
              <div class="stc-user-av">{{ userInitial }}</div>
              <div class="flex-1 min-w-0" style="line-height:1.25">
                <div class="font-semibold text-[13px] truncate" style="color:var(--text)">
                  {{ (session?.user as any)?.username }}
                </div>
                <div class="text-[11px]" style="color:var(--faint)">
                  {{ isSuperAdmin ? 'Superadmin' : 'Admin' }}
                </div>
              </div>
              <button class="stc-ibtn" @click="logout">
                <UIcon name="i-lucide-log-out" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.stc-slide-enter-active, .stc-slide-leave-active { transition: opacity .2s; }
.stc-slide-enter-from, .stc-slide-leave-to { opacity: 0; }
</style>
