<template>
  <div class="min-h-screen bg-cream-100 dark:bg-neutral-950 flex items-center justify-center p-4">
    <UAuthForm
      title="STC Control"
      icon="i-heroicons-bolt-20-solid"
      :fields="fields"
      :submit="{ label: 'Iniciar sesión', color: 'primary', block: true }"
      :loading="loading"
      class="w-full max-w-sm"
      @submit="login"
    >
      <template #validation>
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          :title="error"
          class="mb-2"
        />
      </template>
    </UAuthForm>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
useSeoMeta({
  title: 'Login - STC Control',
  description: 'Control de Registros',
  ogTitle: 'STC - Control de Registros',
})

const { fetch: refreshSession } = useUserSession()

const loading = ref(false)
const error = ref('')

const fields = [
  { name: 'username', type: 'text' as const, label: 'Usuario', placeholder: 'username', autocomplete: 'username' },
  { name: 'password', type: 'password' as const, label: 'Contraseña', placeholder: '••••••••', autocomplete: 'current-password' },
]

async function login(event: { data: Record<string, string> }) {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: event.data.username, password: event.data.password },
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
