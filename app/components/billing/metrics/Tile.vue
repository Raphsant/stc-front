<script setup lang="ts">
// One big number with its label, and an optional line under it.
defineProps<{ label: string; icon?: string; value: string; note?: string; gold?: boolean; loading?: boolean; tone?: 'red' | 'gold' | 'green' }>()
</script>

<template>
  <div class="stc-panel stc-tile bm-tile">
    <div class="stc-tile-head">
      <span class="lbl">{{ label }}</span>
      <UIcon v-if="icon" :name="icon" class="w-4 h-4" />
    </div>
    <div class="stc-tile-val bm-tile-val" :class="{ gold }">
      <USkeleton v-if="loading" class="h-8 w-28" />
      <template v-else>{{ value }}</template>
    </div>
    <div class="stc-tile-foot bm-tile-foot" :class="tone">
      <USkeleton v-if="loading" class="h-4 w-24" />
      <slot v-else>{{ note }}</slot>
    </div>
  </div>
</template>
