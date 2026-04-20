<script setup lang="ts">
useSeoMeta({
  title: 'Changelog - STC Control',
  description: 'Historial de versiones y cambios del sistema STC Control.',
  ogTitle: 'Changelog - STC Control',
})

const { data: entries } = await useAsyncData('changelog', () =>
  queryCollection('changelog').order('date', 'DESC').all()
)
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold text-neutral-50">Changelog</h1>
      <p class="text-neutral-400 mt-1">Historial de versiones y cambios del sistema.</p>
    </div>

    <div v-if="!entries?.length" class="flex flex-col items-center justify-center py-24 text-neutral-500">
      <UIcon name="i-heroicons-document-text" class="w-10 h-10 mb-3" />
      <p>No hay entradas de changelog aún.</p>
    </div>

    <div v-else class="relative">
      <!-- Timeline line -->
      <div class="absolute left-[7px] top-2 bottom-2 w-px bg-cream-400 dark:bg-neutral-800 hidden sm:block" />

      <div class="space-y-8">
        <div
          v-for="entry in entries"
          :key="entry.version"
          class="sm:pl-10 relative"
        >
          <!-- Timeline dot -->
          <div class="absolute left-0 top-2 w-3.5 h-3.5 rounded-full bg-primary-500 ring-4 ring-cream-100 dark:ring-neutral-950 hidden sm:block" />

          <UCard class="dark:bg-neutral-900/50 dark:border-neutral-800">
            <template #header>
              <div class="flex flex-wrap items-center gap-3">
                <UBadge color="primary" variant="solid" class="font-mono text-sm px-3 py-1">
                  v{{ entry.version }}
                </UBadge>
                <span v-if="entry.title" class="font-semibold text-neutral-900 dark:text-neutral-100 text-base">
                  {{ entry.title }}
                </span>
                <span class="ml-auto flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
                  <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
                  {{ new Date(entry.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) }}
                </span>
              </div>
            </template>

            <div class="prose dark:prose-invert prose-sm max-w-none
              dark:prose-headings:text-neutral-200 prose-headings:font-semibold
              prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-h2:first:mt-0
              prose-ul:my-1 prose-li:my-0.5
              dark:prose-li:text-neutral-300 dark:prose-p:text-neutral-300
              dark:prose-strong:text-neutral-100">
              <ContentRenderer :value="entry" />
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>
