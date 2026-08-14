<script setup lang="ts">
const route = useRoute()
const toast = useToast()

const { data: meeting, pending, error, refresh } = useFetch(`/api/meetings/${route.params.id}`)

useSeoMeta({
  title: computed(() => meeting.value ? `${meeting.value.name} - STC Control` : 'Meeting - STC Control'),
  description: computed(() => meeting.value ? `Detalles y asistentes del meeting ${meeting.value.name}.` : 'Detalles del meeting.'),
  ogTitle: computed(() => meeting.value ? `${meeting.value.name} - STC Control` : 'Meeting - STC Control'),
})

// ── Confirmation state ──────────────────────────────────────────
const confirmUser     = ref<{ _id: string, username: string } | null>(null)
const confirmClearAll = ref(false)
const isDeleting      = ref(false)

const showRemoveModal = computed({
    get: () => !!confirmUser.value,
    set: (v) => { if (!v) confirmUser.value = null },
})

function promptRemove(user: { _id: string, username: string }) {
    confirmUser.value = user
}

async function removeParticipant() {
    if (!confirmUser.value) return
    isDeleting.value = true
    try {
        await $fetch(`/api/meetings/${route.params.id}`, {
            method: 'PATCH',
            body: { action: 'remove', userId: confirmUser.value._id },
        })
        toast.add({ title: `${confirmUser.value.username} eliminado del meeting.`, color: 'success' })
        confirmUser.value = null
        await refresh()
    } catch (e: any) {
        toast.add({ title: 'Error al eliminar', description: e.message, color: 'error' })
    } finally {
        isDeleting.value = false
    }
}

async function clearAllParticipants() {
    isDeleting.value = true
    try {
        await $fetch(`/api/meetings/${route.params.id}`, {
            method: 'PATCH',
            body: { action: 'clear' },
        })
        toast.add({ title: 'Todos los registrantes han sido eliminados.', color: 'success' })
        confirmClearAll.value = false
        await refresh()
    } catch (e: any) {
        toast.add({ title: 'Error al limpiar', description: e.message, color: 'error' })
    } finally {
        isDeleting.value = false
    }
}

// ── Roles ───────────────────────────────────────────────────────
const roleClass: Record<string, string> = {
    'Alpha.': 'gold',
    'Alpha':  'gold',
    'Delta':  'blue',
    'Delta.': 'blue',
}

function knownRoles(roles: string[] = []) {
    return roles.filter(r => roleClass[r])
}
function otherRoles(roles: string[] = []) {
    return roles.filter(r => !roleClass[r])
}

function initial(name: string) {
    return (name || '?').replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?'
}

function formatDate(date: string) {
    if (!date) return ''
    return new Date(date).toLocaleString('es-ES', {
        weekday: 'long', month: 'long', day: 'numeric',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
}
</script>

<template>
    <div class="md-page">
        <NuxtLink to="/meetings" class="stc-link-all" style="align-self:flex-start">
            <UIcon name="i-lucide-arrow-left" class="w-3.5 h-3.5" />
            Volver a Meetings
        </NuxtLink>

        <!-- Carga -->
        <template v-if="pending">
            <USkeleton class="h-32 w-full rounded-[10px]" />
            <USkeleton class="h-96 w-full rounded-[10px]" />
        </template>

        <!-- Error -->
        <section v-else-if="error" class="stc-panel md-alert">
            <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 flex-shrink-0" />
            <div>
                <div class="md-alert-t">Error al cargar el meeting</div>
                <p class="md-alert-p">{{ error.message }}</p>
                <NuxtLink to="/meetings" class="stc-btn sm" style="margin-top:12px">Regresar</NuxtLink>
            </div>
        </section>

        <template v-else-if="meeting">
            <!-- Cabecera de la sesión -->
            <section class="stc-panel md-hero">
                <div class="min-w-0">
                    <div class="stc-eyebrow" style="display:flex; align-items:center; gap:7px; color:var(--gold)">
                        <UIcon name="i-lucide-video" class="w-3.5 h-3.5" />
                        Detalles de la sesión
                    </div>
                    <h1 class="md-title">{{ meeting.name }}</h1>
                    <div class="md-meta">
                        <span class="stc-badge neutral stc-mono">ID {{ meeting.meetingId }}</span>
                        <span class="md-date stc-mono">
                            <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
                            {{ formatDate(meeting.occurredAt) }}
                        </span>
                    </div>
                </div>

                <div class="md-count">
                    <span class="md-count-n">{{ meeting.participants?.length || 0 }}</span>
                    <span class="stc-eyebrow">Asistentes</span>
                </div>
            </section>

            <!-- Lista de asistencia -->
            <section class="stc-panel" style="overflow:hidden">
                <div class="stc-panel-head">
                    <h2 class="stc-panel-title">
                        <UIcon name="i-lucide-users" class="w-[18px] h-[18px]" />
                        Lista de asistencia
                    </h2>
                    <button
                        v-if="meeting.participants?.length"
                        class="stc-btn sm danger"
                        @click="confirmClearAll = true"
                    >
                        <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
                        Eliminar todos
                    </button>
                </div>

                <div v-if="!meeting.participants?.length" class="stc-empty">
                    <UIcon name="i-lucide-users" />
                    <p>No se registraron participantes para este meeting.</p>
                </div>

                <template v-else>
                    <div class="md-thead md-grid">
                        <span class="stc-eyebrow">Usuario</span>
                        <span class="stc-eyebrow">Roles</span>
                        <span class="stc-eyebrow md-col-id">Discord ID</span>
                        <span class="stc-eyebrow" style="text-align:right">Acciones</span>
                    </div>

                    <div v-for="p in meeting.participants" :key="p._id" class="md-trow md-grid">
                        <div class="md-user">
                            <span class="md-av">
                                <img v-if="p.avatarUrl" :src="p.avatarUrl" :alt="p.username">
                                <template v-else>{{ initial(p.username) }}</template>
                            </span>
                            <span class="md-uname">{{ p.username }}</span>
                        </div>

                        <div class="md-roles">
                            <span
                                v-for="role in knownRoles(p.roles)"
                                :key="role"
                                class="stc-badge"
                                :class="roleClass[role]"
                            >{{ role }}</span>
                            <span
                                v-if="otherRoles(p.roles).length"
                                class="stc-badge neutral"
                                :title="otherRoles(p.roles).join(', ')"
                            >+{{ otherRoles(p.roles).length }}</span>
                            <span v-if="!p.roles?.length" class="stc-badge outline">Ninguno</span>
                        </div>

                        <div class="md-col-id">
                            <code class="md-id stc-code">{{ p._id }}</code>
                        </div>

                        <div class="md-actions">
                            <NuxtLink :to="`/discord-users/${p._id}`" class="stc-icon-btn" title="Ver perfil completo">
                                <UIcon name="i-lucide-user" class="w-[15px] h-[15px]" />
                            </NuxtLink>
                            <button class="stc-icon-btn danger" title="Eliminar del meeting" @click="promptRemove(p)">
                                <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
                            </button>
                        </div>
                    </div>
                </template>
            </section>
        </template>

        <!-- ── Confirm remove single participant ── -->
        <UModal v-model:open="showRemoveModal" :dismissible="!isDeleting">
            <template #content>
                <div class="md-modal">
                    <div class="md-modal-head">
                        <span class="md-modal-glyph">
                            <UIcon name="i-lucide-trash-2" class="w-5 h-5" />
                        </span>
                        <h3 class="md-modal-title">Eliminar registrante</h3>
                    </div>
                    <p class="md-modal-p">
                        ¿Estás seguro que deseas eliminar a
                        <b>{{ confirmUser?.username }}</b>
                        de este meeting? Esta acción no se puede deshacer.
                    </p>
                    <div class="md-modal-foot">
                        <button class="stc-btn" :disabled="isDeleting" @click="confirmUser = null">Cancelar</button>
                        <button class="stc-btn danger" :disabled="isDeleting" @click="removeParticipant">
                            <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
                            {{ isDeleting ? 'Eliminando…' : 'Eliminar' }}
                        </button>
                    </div>
                </div>
            </template>
        </UModal>

        <!-- ── Confirm clear all ── -->
        <UModal v-model:open="confirmClearAll" :dismissible="!isDeleting">
            <template #content>
                <div class="md-modal">
                    <div class="md-modal-head">
                        <span class="md-modal-glyph">
                            <UIcon name="i-lucide-triangle-alert" class="w-5 h-5" />
                        </span>
                        <h3 class="md-modal-title">Eliminar todos los registrantes</h3>
                    </div>
                    <p class="md-modal-p">
                        Esto eliminará a los
                        <b>{{ meeting?.participants?.length }}</b>
                        participantes de este meeting. Esta acción no se puede deshacer.
                    </p>
                    <div class="md-modal-foot">
                        <button class="stc-btn" :disabled="isDeleting" @click="confirmClearAll = false">Cancelar</button>
                        <button class="stc-btn danger" :disabled="isDeleting" @click="clearAllParticipants">
                            <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
                            {{ isDeleting ? 'Eliminando…' : 'Eliminar todos' }}
                        </button>
                    </div>
                </div>
            </template>
        </UModal>
    </div>
</template>

<style scoped>
.md-page { display: flex; flex-direction: column; gap: 18px; max-width: 1180px; width: 100%; }

/* alerta */
.md-alert {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 18px;
    color: var(--red);
    border-color: var(--red-line);
    background: var(--red-dim);
}
.md-alert-t { font-weight: 600; font-size: 14px; }
.md-alert-p { font-size: 13px; color: var(--dim); margin-top: 3px; }

/* héroe */
.md-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    padding: 22px 24px;
}
.md-title {
    font-family: var(--disp);
    font-size: 38px;
    font-weight: 800;
    letter-spacing: .004em;
    line-height: 1.04;
    text-transform: uppercase;
    color: var(--text);
    margin: 8px 0 12px;
}
.md-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.md-date {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    color: var(--dim);
    text-transform: capitalize;
}

.md-count {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 132px;
    padding: 16px 20px;
    border-radius: var(--r);
    background: var(--gold-wash);
    border: 1px solid var(--gold-ring);
}
.md-count-n {
    font-family: var(--disp);
    font-variant-numeric: tabular-nums;
    font-size: 46px;
    font-weight: 800;
    line-height: .95;
    color: var(--gold);
}

/* tabla */
.md-grid {
    display: grid;
    grid-template-columns: minmax(200px, 1.6fr) minmax(150px, 1.2fr) minmax(180px, 1.2fr) 92px;
    align-items: center;
    gap: 14px;
}
.md-thead { padding: 14px 24px; border-bottom: 1px solid var(--line); }
.md-trow {
    padding: 12px 24px;
    border-bottom: 1px solid var(--line);
    transition: background .14s;
}
.md-trow:last-child { border-bottom: none; }
.md-trow:hover { background: rgba(255,255,255,.022); }
html:not(.dark) .md-trow:hover { background: rgba(0,0,0,.02); }

.md-user { display: flex; align-items: center; gap: 12px; min-width: 0; }
.md-av {
    width: 34px; height: 34px;
    border-radius: 8px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    font-family: var(--disp);
    font-weight: 800;
    font-size: 16px;
    color: var(--text);
    background: #161616;
    border: 1px solid var(--line);
}
html:not(.dark) .md-av { background: #2a2a2a; color: #f0f0f0; }
.md-av img { width: 100%; height: 100%; object-fit: cover; }
.md-uname {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.md-roles { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.md-id {
    display: inline-block;
    max-width: 100%;
    font-size: 11px;
    color: var(--faint);
    background: var(--inset);
    border: 1px solid var(--line);
    border-radius: 5px;
    padding: 3px 7px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.md-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }

/* modales */
.md-modal { padding: 24px; }
.md-modal-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.md-modal-glyph {
    width: 38px; height: 38px;
    border-radius: 9px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    color: var(--red);
    background: var(--red-dim);
    border: 1px solid var(--red-line);
}
.md-modal-title {
    font-family: var(--disp);
    font-size: 23px;
    font-weight: 700;
    letter-spacing: .015em;
    text-transform: uppercase;
    color: var(--text);
}
.md-modal-p { font-size: 13.5px; color: var(--dim); line-height: 1.55; }
.md-modal-p b { color: var(--text); font-weight: 600; }
.md-modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }

@media (max-width: 900px) {
    .md-grid { grid-template-columns: minmax(180px, 1.6fr) minmax(130px, 1fr) 92px; }
    .md-col-id { display: none; }
}
@media (max-width: 640px) {
    .md-hero  { padding: 18px 16px; }
    .md-title { font-size: 30px; }
    .md-count { width: 100%; }
    .md-thead { display: none; }
    .md-trow.md-grid {
        grid-template-columns: 1fr auto;
        gap: 8px 10px;
        padding: 14px 16px;
        align-items: start;
    }
    .md-user    { grid-column: 1; grid-row: 1; }
    .md-roles   { grid-column: 1; grid-row: 2; }
    .md-actions { grid-column: 2; grid-row: 1 / 3; align-self: center; }
}
</style>
