<script setup lang="ts">
// The error or "not for your role" panel every metrics section shares.
const props = defineProps<{ error?: any; what: string }>()
const forbidden = computed(() => props.error?.statusCode === 403 || props.error?.status === 403)
const message = computed(() => props.error?.data?.statusMessage || props.error?.data?.message || props.error?.statusMessage || props.error?.message)
</script>

<template>
  <section class="stc-panel bm-alert" :class="{ quiet: forbidden }">
    <UIcon :name="forbidden ? 'i-lucide-lock' : 'i-lucide-triangle-alert'" class="w-5 h-5 flex-shrink-0" />
    <div>
      <div class="bm-alert-t">{{ forbidden ? 'Sin permiso' : 'Error' }}</div>
      <p class="bm-alert-p">
        <template v-if="forbidden">Tu rol no puede ver {{ what }}.</template>
        <template v-else>No se pudo cargar {{ what }}: {{ message }}</template>
      </p>
    </div>
  </section>
</template>
