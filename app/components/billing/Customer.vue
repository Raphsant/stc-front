<script setup lang="ts">
// Customer cell: Discord username + email, linked to the member's profile when we know the Discord id.
defineProps<{ customer: { discordId: string | null; username: string | null; email: string | null } }>()
</script>

<template>
  <NuxtLink v-if="customer.discordId" :to="`/discord-users/${customer.discordId}`" class="bc">
    <span class="bc-name">{{ customer.username || 'Sin Discord' }}</span>
    <span class="bc-sub">{{ customer.email || customer.discordId }}</span>
  </NuxtLink>
  <div v-else class="bc">
    <span class="bc-name">{{ customer.username || 'Sin Discord' }}</span>
    <span class="bc-sub">{{ customer.email || '—' }}</span>
  </div>
</template>

<style scoped>
.bc { display: block; min-width: 0; }
a.bc:hover .bc-name { color: var(--gold-soft); }
.bc-name {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color .14s;
}
.bc-sub {
  display: block;
  font-size: 11.5px;
  color: var(--faint);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
