<script setup lang="ts">
import { ROLE_LABEL, STAFF_ROLES, type StaffRole } from '#shared/permissions'

// The stc-front staff accounts and their roles. Superadmin only: the server routes
// (/api/staff/users, /api/auth/register) refuse anyone else; hiding the page here
// is a courtesy, not the check.

useSeoMeta({ title: 'Cuentas - STC Control', description: 'Cuentas del personal de STC Control y sus roles.' })

interface Account { id: string; username: string; role: StaffRole; createdAt: string | null }

const { session, fetch: refetchSession } = useUserSession()
const me = computed(() => session.value?.user as { id?: string; role?: string } | undefined)
const allowed = computed(() => me.value?.role === 'superadmin')

const ROLE_HINT: Record<StaffRole, string> = {
  admin: 'Soporte: métricas en conteos, sin dólares ni CSV.',
  finance: 'Todas las métricas y CSV, excepto Conciliación.',
  superadmin: 'Todo, incluidas estas cuentas, productos y Conciliación.',
}
const ROLE_TONE: Record<StaffRole, string> = { admin: 'outline', finance: 'blue', superadmin: 'gold' }

const { data, pending, error, refresh } = useFetch<{ users: Account[] }>('/api/staff/users', {
  immediate: allowed.value,
  default: () => ({ users: [] }),
})
const users = computed(() => data.value?.users ?? [])
const superadmins = computed(() => users.value.filter((u) => u.role === 'superadmin').length)

const saving = ref<string | null>(null)
const message = ref<{ tone: 'red' | 'green'; text: string } | null>(null)
const errText = (e: any) => e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || 'Error'

function isLastSuperadmin(u: Account) {
  return u.role === 'superadmin' && superadmins.value <= 1
}

async function setRole(u: Account, role: StaffRole) {
  if (role === u.role) return
  const self = u.id === me.value?.id
  if (self && role !== 'superadmin' && !confirm('Vas a quitarte el rol de superadmin. Dejarás de ver esta página. ¿Continuar?')) {
    await refresh()
    return
  }
  saving.value = u.id
  message.value = null
  try {
    await $fetch(`/api/staff/users/${u.id}`, { method: 'PATCH', body: { role } })
    message.value = { tone: 'green', text: `${u.username} ahora es ${ROLE_LABEL[role]}.` }
    if (self) {
      await refetchSession()
      if (role !== 'superadmin') return navigateTo('/')
    }
  } catch (e) {
    message.value = { tone: 'red', text: errText(e) }
  } finally {
    saving.value = null
    await refresh()
  }
}

const form = reactive({ username: '', password: '', role: 'admin' as StaffRole })
const creating = ref(false)
async function create() {
  creating.value = true
  message.value = null
  try {
    const res = await $fetch<{ username: string; role: StaffRole }>('/api/auth/register', { method: 'POST', body: { ...form } })
    message.value = { tone: 'green', text: `Cuenta ${res.username} creada como ${ROLE_LABEL[res.role]}.` }
    Object.assign(form, { username: '', password: '', role: 'admin' })
    await refresh()
  } catch (e) {
    message.value = { tone: 'red', text: errText(e) }
  } finally {
    creating.value = false
  }
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
</script>

<template>
  <div class="sa-page">
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Cuentas</div>
        <div class="stc-page-sub">
          Quién entra a STC Control y con qué rol. Un cambio de rol se aplica en la siguiente acción de esa persona, sin que tenga que volver a iniciar sesión.
        </div>
      </div>
      <button v-if="allowed" class="stc-btn sm" :disabled="pending" title="Actualizar" @click="refresh()">
        <UIcon name="i-lucide-refresh-cw" class="w-3.5 h-3.5" :class="{ 'animate-spin': pending }" />
      </button>
    </div>

    <section v-if="!allowed" class="stc-panel sa-alert">
      <UIcon name="i-lucide-lock" class="w-5 h-5 flex-shrink-0" />
      <p>Solo un superadmin puede ver y cambiar las cuentas.</p>
    </section>

    <template v-else>
      <section v-if="error" class="stc-panel sa-alert">
        <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 flex-shrink-0" />
        <p>No se pudieron cargar las cuentas: {{ errText(error) }}</p>
      </section>

      <p v-if="message" class="sa-msg" :class="message.tone" role="status">{{ message.text }}</p>

      <section class="stc-panel sa-table">
        <div class="sa-row sa-thead">
          <span class="stc-eyebrow">Usuario</span>
          <span class="stc-eyebrow">Rol</span>
          <span class="stc-eyebrow sa-col-date">Creada</span>
        </div>
        <div v-if="pending && !users.length" class="sa-row"><USkeleton class="h-4 w-40" /></div>
        <div v-for="u in users" :key="u.id" class="sa-row">
          <div class="min-w-0">
            <div class="sa-name">
              {{ u.username }}
              <span v-if="u.id === me?.id" class="stc-badge outline">tú</span>
            </div>
            <div class="sa-hint">{{ ROLE_HINT[u.role] }}</div>
          </div>
          <div class="sa-role">
            <select
              class="stc-input sa-select"
              :value="u.role"
              :disabled="saving === u.id"
              :aria-label="`Rol de ${u.username}`"
              @change="setRole(u, ($event.target as HTMLSelectElement).value as StaffRole)"
            >
              <option v-for="r in STAFF_ROLES" :key="r" :value="r" :disabled="isLastSuperadmin(u) && r !== 'superadmin'">
                {{ ROLE_LABEL[r] }}
              </option>
            </select>
            <span v-if="isLastSuperadmin(u)" class="sa-hint" title="Debe quedar al menos un superadmin">Único superadmin</span>
          </div>
          <div class="sa-col-date sa-hint">{{ fmtDate(u.createdAt) }}</div>
        </div>
      </section>

      <section class="stc-panel sa-form">
        <div class="stc-eyebrow">Nueva cuenta</div>
        <form class="sa-form-grid" @submit.prevent="create">
          <input v-model="form.username" class="stc-input" placeholder="Usuario" autocomplete="off" required>
          <input v-model="form.password" class="stc-input" type="password" placeholder="Contraseña (mín. 8)" minlength="8" autocomplete="new-password" required>
          <select v-model="form.role" class="stc-input" aria-label="Rol de la nueva cuenta">
            <option v-for="r in STAFF_ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
          </select>
          <button class="stc-btn gold sm" type="submit" :disabled="creating">
            <UIcon name="i-lucide-user-plus" class="w-3.5 h-3.5" /> Crear
          </button>
        </form>
        <p class="sa-hint">{{ ROLE_HINT[form.role] }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.sa-page { display: flex; flex-direction: column; gap: 20px; }
.sa-alert { display: flex; align-items: center; gap: 12px; padding: 16px 18px; color: var(--dim); font-size: 13.5px; }
.sa-msg { font-size: 13px; padding: 10px 14px; border-radius: 10px; border: 1px solid; }
.sa-msg.green { color: var(--green); background: var(--green-dim); border-color: var(--green-line); }
.sa-msg.red { color: var(--red); background: var(--red-dim); border-color: var(--red-line); }

.sa-table { overflow: hidden; container-type: inline-size; }
.sa-row {
  display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(150px, 1fr) 120px;
  align-items: center; gap: 14px; padding: 13px 22px; border-bottom: 1px solid var(--line);
}
.sa-row:last-child { border-bottom: none; }
.sa-thead { padding-top: 14px; padding-bottom: 14px; }
.sa-name { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--text); }
.sa-hint { font-size: 11.5px; color: var(--faint); margin-top: 3px; }
.sa-role { display: flex; flex-direction: column; }
.sa-select { max-width: 180px; }
@container (max-width: 560px) {
  .sa-row { grid-template-columns: 1fr auto; padding: 13px 16px; }
  .sa-col-date { display: none; }
}

.sa-form { display: flex; flex-direction: column; gap: 10px; padding: 18px 22px; }
.sa-form-grid { display: grid; grid-template-columns: 1fr 1fr 150px auto; gap: 10px; }
@media (max-width: 720px) { .sa-form-grid { grid-template-columns: 1fr; } }
</style>
