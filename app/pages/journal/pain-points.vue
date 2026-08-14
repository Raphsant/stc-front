<script setup lang="ts">
import {
  PRIORITY_LABELS_ES,
  PRIORITY_TONE,
  categoryLabel,
  type Priority,
} from '#shared/deltaAnalysis'

useSeoMeta({
  title: 'Categorías de conversación - STC Control',
  description: 'Qué están diciendo los miembros, agregado de todas las conversaciones analizadas.',
})

interface CategoryRow {
  category: string
  count: number
  primaryCount: number
  userCount: number
  examples: {
    quote: string | null
    discordUserId: string
    createdAt: string
    priority: Priority
  }[]
}

const { data, pending } = await useFetch<{ categories: CategoryRow[]; analyzedCount: number }>(
  '/api/journal/categories',
  { default: () => ({ categories: [], analyzedCount: 0 }) },
)

const maxCount = computed(() =>
  Math.max(1, ...data.value.categories.map(c => c.count)),
)
</script>

<template>
  <div class="pp-page">
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Categorías de conversación</div>
        <div class="stc-page-sub">
          Qué están señalando los miembros, agregado de todas las conversaciones analizadas.
        </div>
      </div>
      <div class="pp-head-right">
        <span v-if="!pending" class="stc-badge gold stc-mono">
          {{ data.analyzedCount }} {{ data.analyzedCount === 1 ? 'conversación' : 'conversaciones' }}
        </span>
        <NuxtLink to="/journal/follow-ups" class="stc-btn sm">
          <UIcon name="i-lucide-clipboard-check" class="w-3.5 h-3.5" />
          Ver seguimientos
        </NuxtLink>
      </div>
    </div>

    <div v-if="pending" class="pp-stack">
      <USkeleton v-for="n in 5" :key="n" class="h-28 w-full rounded-[10px]" />
    </div>

    <div v-else-if="!data.categories.length" class="stc-panel stc-empty">
      <UIcon name="i-lucide-chart-column" />
      <p>Aún no hay conversaciones analizadas.<br>Analiza una captura desde la bitácora de un usuario.</p>
    </div>

    <div v-else class="pp-stack">
      <section v-for="cat in data.categories" :key="cat.category" class="stc-panel pp-card">
        <div class="pp-head">
          <div class="pp-head-l">
            <span class="pp-name">{{ categoryLabel(cat.category) }}</span>
            <span class="stc-badge neutral stc-mono">
              {{ cat.count }} {{ cat.count === 1 ? 'conversación' : 'conversaciones' }}
            </span>
            <span class="pp-users stc-mono">
              · {{ cat.userCount }} {{ cat.userCount === 1 ? 'miembro' : 'miembros' }}
            </span>
          </div>
          <span v-if="cat.primaryCount" class="stc-badge gold stc-mono" title="Veces que fue el tema central del hilo">
            {{ cat.primaryCount }} como tema principal
          </span>
        </div>

        <!-- Barra de frecuencia -->
        <div class="stc-meter" style="margin:12px 0 14px">
          <i :style="{ width: `${(cat.count / maxCount) * 100}%` }" />
        </div>

        <!-- Citas recientes -->
        <ul v-if="cat.examples.some(e => e.quote)" class="pp-list">
          <template v-for="(ex, i) in cat.examples" :key="i">
            <li v-if="ex.quote" class="pp-ex">
              <span class="stc-badge" :class="PRIORITY_TONE[ex.priority ?? 'medium']">
                {{ PRIORITY_LABELS_ES[ex.priority ?? 'medium'] }}
              </span>
              <span class="pp-quote">{{ ex.quote }}</span>
              <NuxtLink :to="`/discord-users/${ex.discordUserId}`" class="pp-link">ver</NuxtLink>
            </li>
          </template>
        </ul>
        <p v-else class="pp-noquote">Sin citas registradas para esta categoría.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pp-page  { display: flex; flex-direction: column; gap: 20px; max-width: 920px; width: 100%; }
.pp-stack { display: flex; flex-direction: column; gap: 12px; }
.pp-head-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.pp-card { padding: 16px 18px; }

.pp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.pp-head-l { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.pp-name {
  font-family: var(--disp);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: .015em;
  text-transform: uppercase;
  color: var(--text);
}
.pp-users { font-size: 11.5px; color: var(--faint); }

.pp-list { display: flex; flex-direction: column; gap: 8px; }
.pp-ex {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 13px;
  line-height: 1.5;
}
.pp-ex .stc-badge { margin-top: 1px; flex-shrink: 0; }
.pp-quote {
  flex: 1;
  min-width: 0;
  font-style: italic;
  color: var(--dim);
  overflow-wrap: anywhere;
}
.pp-link {
  flex-shrink: 0;
  margin-top: 1px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--gold-soft);
  text-decoration: none;
}
.pp-link:hover { text-decoration: underline; }
.pp-noquote { font-size: 12px; font-style: italic; color: var(--faint); }
</style>
