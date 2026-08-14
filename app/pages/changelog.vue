<script setup lang="ts">
useSeoMeta({
  title: 'Changelog - STC Control',
  description: 'Historial de versiones y cambios del sistema STC Control.',
  ogTitle: 'Changelog - STC Control',
})

const { data: entries } = await useAsyncData('changelog', () =>
  queryCollection('changelog').order('date', 'DESC').all()
)

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}
</script>

<template>
  <div class="cl-page">
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Changelog</div>
        <div class="stc-page-sub">Historial de versiones y cambios del sistema.</div>
      </div>
      <span v-if="entries?.length" class="stc-badge gold">
        {{ entries.length }} {{ entries.length === 1 ? 'versión' : 'versiones' }}
      </span>
    </div>

    <div v-if="!entries?.length" class="stc-panel stc-empty">
      <UIcon name="i-lucide-file-text" />
      <p>No hay entradas de changelog aún.</p>
    </div>

    <div v-else class="cl-timeline">
      <article v-for="entry in entries" :key="entry.version" class="cl-item">
        <span class="cl-node" />

        <section class="stc-panel">
          <header class="cl-head">
            <span class="cl-ver stc-mono">v{{ entry.version }}</span>
            <span v-if="entry.title" class="cl-title">{{ entry.title }}</span>
            <span class="cl-date stc-mono">
              <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
              {{ formatDate(entry.date) }}
            </span>
          </header>

          <div class="cl-body">
            <ContentRenderer :value="entry" />
          </div>
        </section>
      </article>
    </div>
  </div>
</template>

<style scoped>
.cl-page { max-width: 900px; width: 100%; display: flex; flex-direction: column; gap: 26px; }

/* ── Línea de tiempo ── */
.cl-timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.cl-timeline::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 10px;
  bottom: 10px;
  width: 1px;
  background: linear-gradient(180deg, var(--gold-line), var(--line) 70%);
}

.cl-item { position: relative; padding-left: 34px; }
.cl-node {
  position: absolute;
  left: 0;
  top: 16px;
  width: 13px; height: 13px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 0 4px var(--bg), 0 0 0 5px var(--gold-line);
}

/* ── Cabecera de entrada ── */
.cl-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}
.cl-ver {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .02em;
  color: var(--gold-ink);
  background: linear-gradient(150deg, var(--gold-soft), var(--gold));
  padding: 4px 11px;
  border-radius: var(--r-xs);
}
.cl-title {
  font-family: var(--disp);
  font-size: 21px;
  font-weight: 700;
  letter-spacing: .015em;
  text-transform: uppercase;
  color: var(--text);
}
.cl-date {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-size: 11.5px;
  color: var(--faint);
  white-space: nowrap;
}

/* ── Contenido markdown ── */
.cl-body { padding: 16px 18px 20px; }

.cl-body :deep(h2) {
  font-family: var(--disp);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: .02em;
  text-transform: uppercase;
  color: var(--gold-soft);
  margin: 20px 0 8px;
}
.cl-body :deep(h2:first-child) { margin-top: 0; }
.cl-body :deep(h3) {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 16px 0 6px;
}
.cl-body :deep(p) {
  font-size: 13.5px;
  color: var(--dim);
  margin: 0 0 10px;
}
.cl-body :deep(ul),
.cl-body :deep(ol) {
  margin: 0 0 10px;
  padding-left: 18px;
  list-style: none;
}
.cl-body :deep(li) {
  position: relative;
  font-size: 13.5px;
  color: var(--dim);
  margin: 5px 0;
  padding-left: 4px;
}
.cl-body :deep(ul > li)::before {
  content: '';
  position: absolute;
  left: -13px;
  top: 8px;
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--gold);
  opacity: .75;
}
.cl-body :deep(ol) { counter-reset: cl; }
.cl-body :deep(ol > li) { counter-increment: cl; }
.cl-body :deep(ol > li)::before {
  content: counter(cl) '.';
  position: absolute;
  left: -18px;
  top: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--gold);
}
.cl-body :deep(strong) { color: var(--text); font-weight: 600; }
.cl-body :deep(a) { color: var(--gold-soft); text-decoration: none; }
.cl-body :deep(a:hover) { text-decoration: underline; }
.cl-body :deep(code) {
  font-family: var(--code);
  font-size: 12px;
  color: var(--gold-soft);
  background: var(--inset);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 1px 5px;
}
.cl-body :deep(pre) {
  font-family: var(--code);
  font-size: 12px;
  color: var(--text);
  background: var(--inset);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 12px 14px;
  overflow-x: auto;
  margin: 0 0 12px;
}
.cl-body :deep(pre code) { border: none; background: none; padding: 0; color: inherit; }
.cl-body :deep(hr) { border: none; border-top: 1px solid var(--line); margin: 16px 0; }

@media (max-width: 640px) {
  .cl-item { padding-left: 26px; }
  .cl-date { margin-left: 0; }
}
</style>
