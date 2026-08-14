<script setup lang="ts">
useSeoMeta({
  title: 'Estado del Sistema - STC Control',
  description: 'Estado en tiempo real del bot de Discord y los servicios del Stock Trading Club.',
  ogTitle: 'Estado del Sistema - STC Control',
})

const nuxtApp = useNuxtApp()
const { data: status, pending, error, refresh } = await useFetch('https://stc.snuuy.com/health', {
  method: 'GET',
  key: 'bot-status',
  getCachedData(key){
    return nuxtApp.payload.data[key] || nuxtApp.static.data[key]
  }
})

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

const isUp = computed(() => status.value?.status === 'UP')
const discordConnected = computed(() => status.value?.discord === 'Connected')

const checkedAt = ref('')
function stampCheck() {
  checkedAt.value = new Date().toLocaleTimeString('es-ES')
}

// Auto-refresh status every 30 seconds
onMounted(() => {
  stampCheck()
  const interval = setInterval(async () => {
    await refresh()
    stampCheck()
  }, 30000)
  onUnmounted(() => clearInterval(interval))
})

async function manualRefresh() {
  await refresh()
  stampCheck()
}
</script>

<template>
  <div class="st-page">
    <!-- Cabecera -->
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Estado del sistema</div>
        <div class="stc-page-sub">Salud en tiempo real del bot y los servicios conectados.</div>
      </div>
      <button class="stc-btn" :disabled="pending" @click="manualRefresh">
        <UIcon name="i-lucide-refresh-cw" class="w-4 h-4" :class="{ 'st-spin': pending }" />
        Actualizar
      </button>
    </div>

    <!-- Error de conexión -->
    <section v-if="error" class="stc-panel st-alert">
      <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 flex-shrink-0" />
      <div>
        <div class="st-alert-t">Bot fuera de línea</div>
        <p class="st-alert-p">
          No se pudo conectar con el servicio del bot de Discord. Verifica que el proceso esté corriendo.
        </p>
      </div>
    </section>

    <!-- Carga -->
    <div v-else-if="pending && !status" class="st-stack">
      <USkeleton class="h-32 w-full rounded-[10px]" />
      <USkeleton class="h-20 w-full rounded-[10px]" />
      <USkeleton class="h-20 w-full rounded-[10px]" />
    </div>

    <div v-else-if="status" class="st-stack">
      <!-- Núcleo del bot -->
      <section class="stc-panel st-hero">
        <div class="st-hero-top">
          <span class="stc-eyebrow">Núcleo del bot</span>
          <span class="stc-badge" :class="isUp ? 'green' : 'red'">
            <span class="stc-dot" :class="isUp ? 'green' : 'red'" />
            {{ status.status }}
          </span>
        </div>
        <div class="st-hero-body">
          <div class="st-hero-glyph" :class="{ down: !isUp }">
            <UIcon :name="isUp ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="w-7 h-7" />
          </div>
          <div class="min-w-0">
            <div class="st-hero-title">
              {{ isUp ? 'Funcionando con normalidad' : 'Problemas detectados' }}
            </div>
            <div class="st-hero-note stc-mono">
              Última comprobación: {{ checkedAt || '—' }}
            </div>
          </div>
        </div>
      </section>

      <!-- Conexión Discord -->
      <section class="stc-panel st-row">
        <div class="st-row-l">
          <div class="st-row-glyph">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:19px;height:19px">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.19.372-.287a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.097.246.193.373.287a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </div>
          <div>
            <div class="st-row-t">Conexión con Discord</div>
            <div class="st-row-p stc-mono">{{ status.discord }}</div>
          </div>
        </div>
        <span class="stc-dot" :class="discordConnected ? 'green' : 'gold'" />
      </section>

      <!-- Uptime -->
      <section class="stc-panel st-row">
        <div class="st-row-l">
          <div class="st-row-glyph gold">
            <UIcon name="i-lucide-clock" class="w-[19px] h-[19px]" />
          </div>
          <div>
            <div class="st-row-t">Tiempo activo</div>
            <div class="st-row-p stc-mono">desde el último reinicio</div>
          </div>
        </div>
        <span class="st-uptime">{{ formatUptime(status.uptime) }}</span>
      </section>
    </div>

    <div class="st-back">
      <NuxtLink to="/" class="stc-link-all">
        <UIcon name="i-lucide-arrow-left" class="w-3.5 h-3.5" />
        Volver al dashboard
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.st-page  { max-width: 760px; width: 100%; display: flex; flex-direction: column; gap: 20px; }
.st-stack { display: flex; flex-direction: column; gap: 14px; }

.st-spin { animation: st-rot .9s linear infinite; }
@keyframes st-rot { to { transform: rotate(360deg); } }

/* alerta */
.st-alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  color: var(--red);
  border-color: var(--red-line);
  background: var(--red-dim);
}
.st-alert-t { font-weight: 600; font-size: 14px; }
.st-alert-p { font-size: 13px; color: var(--dim); margin-top: 3px; }

/* héroe */
.st-hero { padding: 0; overflow: hidden; }
.st-hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 20px;
  border-bottom: 1px solid var(--line);
}
.st-hero-body { display: flex; align-items: center; gap: 16px; padding: 22px 20px; }
.st-hero-glyph {
  width: 52px; height: 52px;
  border-radius: 12px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: var(--green);
  background: var(--green-dim);
  border: 1px solid var(--green-line);
}
.st-hero-glyph.down {
  color: var(--red);
  background: var(--red-dim);
  border-color: var(--red-line);
}
.st-hero-title {
  font-family: var(--disp);
  font-size: 28px;
  font-weight: 800;
  letter-spacing: .01em;
  line-height: 1.05;
  text-transform: uppercase;
  color: var(--text);
}
.st-hero-note { font-size: 12px; color: var(--faint); margin-top: 4px; }

/* filas */
.st-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 20px;
}
.st-row-l { display: flex; align-items: center; gap: 13px; min-width: 0; }
.st-row-glyph {
  width: 40px; height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: var(--dim);
  background: var(--inset);
  border: 1px solid var(--line);
}
.st-row-glyph.gold {
  color: var(--gold);
  background: var(--gold-wash);
  border-color: var(--gold-ring);
}
.st-row-t { font-size: 14px; font-weight: 600; color: var(--text); }
.st-row-p { font-size: 12px; color: var(--faint); margin-top: 2px; }

.st-uptime {
  font-family: var(--disp);
  font-variant-numeric: tabular-nums;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: .01em;
  color: var(--gold);
  white-space: nowrap;
}

.st-back { display: flex; justify-content: center; padding-top: 4px; }
</style>
