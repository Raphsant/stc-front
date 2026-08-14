<script setup lang="ts">
useSeoMeta({ title: 'Puntos de dolor - STC Control' })

interface CategoryRow {
  category: string
  count: number
  userCount: number
  severity: { alta: number; media: number; baja: number }
  examples: { detail: string; severity: string; discordUserId: string; createdAt: string }[]
}

const { data, pending } = await useFetch<{ categories: CategoryRow[]; analyzedCount: number }>(
  '/api/journal/pain-points',
  { default: () => ({ categories: [], analyzedCount: 0 }) },
)

// Spanish labels — mirrors CATEGORY_LABELS in server/utils/painPoints.ts.
const CATEGORY_LABELS: Record<string, string> = {
  precio: 'Precio / valor',
  tiempo: 'Falta de tiempo',
  contenido: 'Contenido',
  soporte: 'Soporte / atención',
  comunidad: 'Comunidad',
  plataforma: 'Plataforma / técnico',
  expectativas: 'Expectativas',
  resultados: 'Resultados / progreso',
  competencia: 'Competencia',
  personal: 'Circunstancias personales',
  otro: 'Otro',
}

function label(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat
}

const maxCount = computed(() =>
  Math.max(1, ...data.value.categories.map(c => c.count)),
)

function severityTone(sev: string) {
  return sev === 'alta' ? 'red' : sev === 'media' ? 'gold' : 'neutral'
}
</script>

<template>
  <div class="pp-page">
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Puntos de dolor</div>
        <div class="stc-page-sub">
          Razones recurrentes de desinterés extraídas de las capturas analizadas.
        </div>
      </div>
      <span v-if="!pending" class="stc-badge gold stc-mono">
        {{ data.analyzedCount }} {{ data.analyzedCount === 1 ? 'captura' : 'capturas' }}
      </span>
    </div>

    <div v-if="pending" class="pp-stack">
      <USkeleton v-for="n in 5" :key="n" class="h-28 w-full rounded-[10px]" />
    </div>

    <div v-else-if="!data.categories.length" class="stc-panel stc-empty">
      <UIcon name="i-lucide-chart-column" />
      <p>Aún no hay capturas analizadas.<br>Analiza imágenes desde la bitácora de un usuario.</p>
    </div>

    <div v-else class="pp-stack">
      <section v-for="cat in data.categories" :key="cat.category" class="stc-panel pp-card">
        <!-- Cabecera -->
        <div class="pp-head">
          <div class="pp-head-l">
            <span class="pp-name">{{ label(cat.category) }}</span>
            <span class="stc-badge neutral stc-mono">
              {{ cat.count }} {{ cat.count === 1 ? 'mención' : 'menciones' }}
            </span>
            <span class="pp-users stc-mono">
              · {{ cat.userCount }} {{ cat.userCount === 1 ? 'cliente' : 'clientes' }}
            </span>
          </div>
          <div class="pp-sev">
            <span v-if="cat.severity.alta" class="stc-badge red">{{ cat.severity.alta }} alta</span>
            <span v-if="cat.severity.media" class="stc-badge gold">{{ cat.severity.media }} media</span>
            <span v-if="cat.severity.baja" class="stc-badge neutral">{{ cat.severity.baja }} baja</span>
          </div>
        </div>

        <!-- Barra de frecuencia -->
        <div class="stc-meter" style="margin:12px 0 14px">
          <i :style="{ width: `${(cat.count / maxCount) * 100}%` }" />
        </div>

        <!-- Ejemplos recientes -->
        <ul class="pp-list">
          <li v-for="(ex, i) in cat.examples" :key="i" class="pp-ex">
            <span class="stc-badge" :class="severityTone(ex.severity)">{{ ex.severity }}</span>
            <span class="pp-detail">{{ ex.detail }}</span>
            <NuxtLink :to="`/discord-users/${ex.discordUserId}`" class="pp-link">ver</NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pp-page  { display: flex; flex-direction: column; gap: 20px; max-width: 900px; width: 100%; }
.pp-stack { display: flex; flex-direction: column; gap: 12px; }

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
.pp-sev   { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.pp-list { display: flex; flex-direction: column; gap: 7px; }
.pp-ex {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 13px;
  color: var(--dim);
  line-height: 1.5;
}
.pp-ex .stc-badge { margin-top: 1px; flex-shrink: 0; text-transform: capitalize; }
.pp-detail { flex: 1; min-width: 0; }
.pp-link {
  flex-shrink: 0;
  margin-top: 1px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--gold-soft);
  text-decoration: none;
}
.pp-link:hover { text-decoration: underline; }
</style>
