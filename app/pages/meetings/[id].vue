<script setup lang="ts">
const route  = useRoute()
const toast  = useToast()

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

// ── Table ───────────────────────────────────────────────────────
const columns = [
    { accessorKey: 'username', header: 'Usuario' },
    { accessorKey: 'roles',    header: 'Roles' },
    { accessorKey: '_id',      header: 'Discord ID' },
    { id: 'actions',           header: '' },
]

const colorMap: Record<string, any> = {
    'Alpha.': 'warning',
    'Alpha':  'warning',
    'Delta':  'info',
    'Delta.': 'info',
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
    <div class="p-6 max-w-6xl mx-auto">
        <div class="mb-8 flex justify-between items-center">
            <UButton to="/meetings" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
                Volver a Meetings
            </UButton>
        </div>

        <!-- Skeleton -->
        <div v-if="pending" class="space-y-6">
            <UCard>
                <div class="space-y-2">
                    <USkeleton class="h-8 w-64" />
                    <USkeleton class="h-4 w-48" />
                </div>
            </UCard>
            <USkeleton class="h-96 w-full" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            <h3 class="font-bold text-lg mb-2">Error al cargar el meeting</h3>
            <p>{{ error.message }}</p>
            <UButton to="/meetings" class="mt-4" color="neutral" size="sm">Regresar</UButton>
        </div>

        <div v-else-if="meeting" class="space-y-8">
            <!-- Meeting Info Header -->
            <UCard>
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                            <UIcon name="i-heroicons-video-camera" />
                            Detalles de la sesión
                        </div>
                        <h1 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                            {{ meeting.name }}
                        </h1>
                        <UBadge variant="subtle">{{ meeting.meetingId }}</UBadge>
                        <p class="text-gray-500 flex items-center gap-2">
                            <UIcon name="i-heroicons-calendar" />
                            {{ formatDate(meeting.occurredAt) }}
                        </p>
                    </div>

                    <div class="flex flex-col items-center p-4 rounded-xl bg-primary/5 border border-primary/10 min-w-[140px]">
                        <span class="text-3xl font-black text-primary">{{ meeting.participants?.length || 0 }}</span>
                        <span class="text-xs font-bold uppercase tracking-wider text-primary/70 text-center">Asistentes</span>
                    </div>
                </div>
            </UCard>

            <!-- Participants Table -->
            <div class="space-y-4">
                <div class="flex items-center justify-between px-2">
                    <h2 class="text-2xl font-bold flex items-center gap-2">
                        <UIcon name="i-heroicons-users" class="text-primary" />
                        Lista de Asistencia
                    </h2>
                    <UButton
                        v-if="meeting.participants?.length"
                        color="error"
                        variant="outline"
                        icon="i-heroicons-trash"
                        size="sm"
                        @click="confirmClearAll = true"
                    >
                        Eliminar todos
                    </UButton>
                </div>

                <UCard :ui="{ body: { padding: 'p-0' } }">
                    <UTable :data="meeting.participants || []" :columns="columns" class="w-full">

                        <template #username-cell="{ row }">
                            <div class="flex items-center gap-3 py-1">
                                <UAvatar :alt="row.original.username" size="sm" :ui="{ rounded: 'rounded-lg' }" />
                                <span class="font-medium text-gray-900 dark:text-white">{{ row.original.username }}</span>
                            </div>
                        </template>

                        <template #roles-cell="{ row }">
                            <div class="flex flex-wrap gap-1.5">
                                <template v-for="role in (row.original.roles || [])" :key="role">
                                    <UBadge v-if="colorMap[role]" :color="colorMap[role]" variant="subtle" size="sm" class="capitalize">
                                        {{ role }}
                                    </UBadge>
                                </template>
                                <UPopover v-if="row.original.roles?.filter((r: string) => !colorMap[r]).length" mode="hover">
                                    <UBadge color="neutral" variant="soft" size="sm" class="cursor-help">
                                        +{{ row.original.roles.filter((r: string) => !colorMap[r]).length }}
                                    </UBadge>
                                    <template #content>
                                        <div class="p-2 max-w-xs flex flex-wrap gap-1">
                                            <UBadge
                                                v-for="role in row.original.roles.filter((r: string) => !colorMap[r])"
                                                :key="role" color="neutral" variant="outline" size="xs"
                                            >
                                                {{ role }}
                                            </UBadge>
                                        </div>
                                    </template>
                                </UPopover>
                            </div>
                        </template>

                        <template #_id-cell="{ row }">
                            <code class="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                {{ row.original._id }}
                            </code>
                        </template>

                        <template #actions-cell="{ row }">
                            <div class="flex justify-end gap-2">
                                <UTooltip text="Ver perfil completo">
                                    <UButton
                                        :to="`/discord-users/${row.original._id}`"
                                        icon="i-heroicons-user"
                                        color="neutral"
                                        variant="ghost"
                                    />
                                </UTooltip>
                                <UTooltip text="Eliminar del meeting">
                                    <UButton
                                        icon="i-heroicons-trash"
                                        color="error"
                                        variant="ghost"
                                        @click="promptRemove(row.original)"
                                    />
                                </UTooltip>
                            </div>
                        </template>

                        <template #empty-state>
                            <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                                <UIcon name="i-heroicons-users" class="text-4xl mb-2" />
                                <p>No se registraron participantes para este meeting.</p>
                            </div>
                        </template>
                    </UTable>
                </UCard>
            </div>
        </div>

        <!-- ── Confirm remove single participant ── -->
        <UModal v-model:open="showRemoveModal" :dismissible="!isDeleting">
            <template #content>
                <div class="p-6 space-y-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                            <UIcon name="i-heroicons-trash" class="w-5 h-5 text-red-500" />
                        </div>
                        <h3 class="text-lg font-semibold">Eliminar registrante</h3>
                    </div>
                    <p class="text-gray-500 text-sm">
                        ¿Estás seguro que deseas eliminar a
                        <span class="font-semibold text-white">{{ confirmUser?.username }}</span>
                        de este meeting? Esta acción no se puede deshacer.
                    </p>
                    <div class="flex justify-end gap-3 pt-2">
                        <UButton color="neutral" variant="ghost" :disabled="isDeleting" @click="confirmUser = null">
                            Cancelar
                        </UButton>
                        <UButton color="error" :loading="isDeleting" icon="i-heroicons-trash" @click="removeParticipant">
                            Eliminar
                        </UButton>
                    </div>
                </div>
            </template>
        </UModal>

        <!-- ── Confirm clear all ── -->
        <UModal v-model:open="confirmClearAll" :dismissible="!isDeleting">
            <template #content>
                <div class="p-6 space-y-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                            <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500" />
                        </div>
                        <h3 class="text-lg font-semibold">Eliminar todos los registrantes</h3>
                    </div>
                    <p class="text-gray-500 text-sm">
                        Esto eliminará a los
                        <span class="font-semibold text-white">{{ meeting?.participants?.length }}</span>
                        participantes de este meeting. Esta acción no se puede deshacer.
                    </p>
                    <div class="flex justify-end gap-3 pt-2">
                        <UButton color="neutral" variant="ghost" :disabled="isDeleting" @click="confirmClearAll = false">
                            Cancelar
                        </UButton>
                        <UButton color="error" :loading="isDeleting" icon="i-heroicons-trash" @click="clearAllParticipants">
                            Eliminar todos
                        </UButton>
                    </div>
                </div>
            </template>
        </UModal>
    </div>
</template>
