<script setup lang="ts">
const isMoreOpen = ref(false)
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
  { label: 'Reportes',   icon: 'i-lucide-file-bar-chart',   to: '/reports' },
  { label: 'Meetings',   icon: 'i-lucide-list',             to: '/meetings' },
  { label: 'Seguimientos', icon: 'i-lucide-clipboard-check', to: '/journal/follow-ups' },
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

// ── Mobile bottom nav ──
// Los 4 destinos de uso diario van en la píldora; el resto vive en la hoja "Más".
const PRIMARY_PATHS = ['/', '/discord-users', '/reports', '/journal/follow-ups']
const MOBILE_LABELS: Record<string, string> = { '/': 'Inicio' }

const primaryTabs = computed(() =>
  PRIMARY_PATHS
    .map(p => navItems.value.find(i => i.to === p))
    .filter((i): i is NonNullable<typeof i> => !!i)
    .map(i => ({ ...i, label: MOBILE_LABELS[i.to] ?? i.label })),
)
const moreItems = computed(() => navItems.value.filter(i => !PRIMARY_PATHS.includes(i.to)))
const isMoreActive = computed(() => isMoreOpen.value || moreItems.value.some(i => isActive(i.to)))

watch(() => route.fullPath, () => { isMoreOpen.value = false })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') isMoreOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
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
        <!-- Left: brand mark (mobile) + title -->
        <div class="flex items-center gap-3 md:gap-4 min-w-0">
          <img
            src="/brand/stc-mark.png"
            alt="Stocks Trading Club"
            width="28"
            height="28"
            class="md:hidden flex-shrink-0"
          >
          <div class="min-w-0">
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
            class="stc-top-icon hidden! md:grid!"
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
        <div class="stc-page flex flex-col px-4 pt-5 md:pt-6 md:px-8" style="gap:18px; max-width:1620px">
          <slot />
        </div>
      </div>
    </main>
  </div>

  <!-- ── Mobile: floating pill nav + "Más" sheet ── -->
  <!-- Solo cliente: un Teleport renderizado en SSR rompe la hidratación. -->
  <ClientOnly>
  <Teleport to="body">
    <nav class="stc-pill md:hidden" aria-label="Navegación principal">
      <NuxtLink
        v-for="item in primaryTabs"
        :key="item.to"
        :to="item.to"
        class="stc-pill-item"
        :class="{ active: isActive(item.to) && !isMoreOpen }"
        :aria-label="item.label"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <UIcon :name="item.icon" class="stc-pill-icon" />
        <span class="stc-pill-label">{{ item.label }}</span>
      </NuxtLink>
      <button
        type="button"
        class="stc-pill-item"
        :class="{ active: isMoreActive }"
        aria-label="Más"
        :aria-expanded="isMoreOpen"
        @click="isMoreOpen = !isMoreOpen"
      >
        <UIcon :name="isMoreOpen ? 'i-lucide-x' : 'i-lucide-ellipsis'" class="stc-pill-icon" />
        <span class="stc-pill-label">Más</span>
      </button>
    </nav>

    <Transition name="stc-fade">
      <div v-if="isMoreOpen" class="stc-sheet-backdrop md:hidden" @click="isMoreOpen = false" />
    </Transition>
    <Transition name="stc-sheet">
      <div v-if="isMoreOpen" class="stc-sheet md:hidden" role="dialog" aria-label="Más opciones">
        <div class="stc-sheet-grip" />

        <div class="stc-eyebrow" style="padding:0 4px; margin-bottom:10px">Más</div>
        <div class="stc-sheet-grid">
          <NuxtLink
            v-for="item in moreItems"
            :key="item.to"
            :to="item.to"
            class="stc-sheet-tile"
            :class="{ active: isActive(item.to) }"
          >
            <UIcon :name="item.icon" class="w-5 h-5" />
            <span>{{ item.label }}</span>
          </NuxtLink>
          <button
            type="button"
            class="stc-sheet-tile"
            @click="colorMode.preference = isDark ? 'light' : 'dark'"
          >
            <UIcon :name="isDark ? 'i-lucide-sun' : 'i-lucide-moon'" class="w-5 h-5" />
            <span>{{ isDark ? 'Modo claro' : 'Modo oscuro' }}</span>
          </button>
        </div>

        <div class="stc-user-card" style="margin-top:14px">
          <div class="stc-user-av">{{ userInitial }}</div>
          <div class="flex-1 min-w-0" style="line-height:1.25">
            <div class="font-semibold text-[13px] truncate" style="color:var(--text)">
              {{ (session?.user as any)?.username }}
            </div>
            <div class="text-[11px]" style="color:var(--faint)">
              {{ isSuperAdmin ? 'Superadmin' : 'Admin' }} · v{{ appVersion }}
            </div>
          </div>
          <button class="stc-ibtn" title="Cerrar sesión" @click="logout">
            <UIcon name="i-lucide-log-out" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
  </ClientOnly>
</template>

<style scoped>
.stc-fade-enter-active, .stc-fade-leave-active { transition: opacity .2s; }
.stc-fade-enter-from, .stc-fade-leave-to { opacity: 0; }
.stc-sheet-enter-active, .stc-sheet-leave-active { transition: transform .26s cubic-bezier(.2,.8,.2,1); }
.stc-sheet-enter-from, .stc-sheet-leave-to { transform: translateY(100%); }
</style>
