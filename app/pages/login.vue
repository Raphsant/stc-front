<template>
  <div class="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
    <UCard class="w-full max-w-sm bg-neutral-900 border border-neutral-800">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-bolt-20-solid" class="w-6 h-6 text-primary-500" />
          <span class="text-lg font-bold tracking-tight">STC Control</span>
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="login">
        <UFormField label="Username" name="username">
          <UInput
            v-model="form.username"
            placeholder="username"
            autocomplete="username"
            :disabled="loading"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            :disabled="loading"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />

        <UButton
          type="submit"
          color="primary"
          block
          :loading="loading"
          label="Sign in"
        />
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { fetch: refreshSession } = useUserSession()

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')

async function login() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: form,
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
