<script setup lang="ts">
definePageMeta({ layout: false })
useSeoMeta({
  title: 'Login - STC Control',
  description: 'Control de Registros',
  ogTitle: 'STC - Control de Registros',
})

const { fetch: refreshSession } = useUserSession()

const loading  = ref(false)
const error    = ref('')
const username = ref('')
const password = ref('')
const showPass = ref(false)

async function login() {
  if (loading.value) return
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await refreshSession()
    await navigateTo('/')
  } catch (e: any) {
    error.value = e?.statusText || e?.data?.statusText || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="lg-wrap">
    <!-- Resplandor dorado tenue -->
    <div class="lg-glow" aria-hidden="true" />

    <form class="lg-card" @submit.prevent="login">
      <div class="lg-brand">
        <img
          class="stc-lockup stc-only-dark"
          src="/brand/stc-lockup-dark.png"
          alt="Stocks Trading Club"
          width="950"
          height="400"
        >
        <img
          class="stc-lockup stc-only-light"
          src="/brand/stc-lockup-light.png"
          alt="Stocks Trading Club"
          width="320"
          height="132"
        >
      </div>
      <div class="stc-eyebrow lg-sub">Panel de control</div>

      <div class="stc-rule" style="margin:20px auto 24px" />

      <div v-if="error" class="lg-error">
        <UIcon name="i-lucide-triangle-alert" class="w-4 h-4 flex-shrink-0" />
        {{ error }}
      </div>

      <label class="lg-field">
        <span class="stc-eyebrow">Usuario</span>
        <input
          v-model="username"
          class="stc-input"
          type="text"
          placeholder="username"
          autocomplete="username"
          required
        >
      </label>

      <label class="lg-field">
        <span class="stc-eyebrow">Contraseña</span>
        <span class="lg-pass">
          <input
            v-model="password"
            class="stc-input"
            :type="showPass ? 'text' : 'password'"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          >
          <button
            type="button"
            class="lg-eye"
            :title="showPass ? 'Ocultar' : 'Mostrar'"
            @click="showPass = !showPass"
          >
            <UIcon :name="showPass ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="w-4 h-4" />
          </button>
        </span>
      </label>

      <button type="submit" class="stc-btn gold block" style="margin-top:22px" :disabled="loading">
        <UIcon v-if="loading" name="i-lucide-loader-circle" class="w-4 h-4 lg-spin" />
        {{ loading ? 'Verificando…' : 'Iniciar sesión' }}
      </button>

      <p class="lg-foot">Acceso restringido al equipo de STC.</p>
    </form>
  </div>
</template>

<style scoped>
.lg-wrap {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #000;
  overflow: hidden;
}
html:not(.dark) .lg-wrap { background: var(--bg); }

.lg-glow {
  position: absolute;
  top: -28%;
  left: 50%;
  transform: translateX(-50%);
  width: min(760px, 130vw);
  height: 560px;
  pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(234,157,19,.14), transparent 68%);
}

.lg-card {
  position: relative;
  width: 100%;
  max-width: 400px;
  padding: 32px 30px 28px;
  border-radius: 14px;
  background: var(--panel);
  border: 1px solid var(--line);
  box-shadow: 0 24px 70px rgba(0,0,0,.6);
}

/* El logotipo oscuro trae ~5% de aire quemado en el PNG; los márgenes
   negativos lo compensan para que ópticamente alinee con el resto. */
.lg-brand { display: flex; justify-content: center; margin: 0 -6px 2px; }
.lg-brand .stc-lockup { width: 100%; max-width: 268px; }
.lg-sub { display: block; text-align: center; margin-top: 2px; }

.lg-error {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--red);
  background: var(--red-dim);
  border: 1px solid var(--red-line);
  border-radius: var(--r-sm);
  padding: 9px 12px;
  margin-bottom: 18px;
}

.lg-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 16px;
}

.lg-pass { position: relative; display: block; }
.lg-pass .stc-input { padding-right: 40px; }
.lg-eye {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px; height: 26px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: var(--faint);
  border-radius: 5px;
  cursor: pointer;
  transition: color .14s;
}
.lg-eye:hover { color: var(--gold-soft); }

.lg-spin { animation: lg-rot .8s linear infinite; }
@keyframes lg-rot { to { transform: rotate(360deg); } }

.lg-foot {
  margin-top: 20px;
  text-align: center;
  font-size: 11px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--faint);
}
</style>
