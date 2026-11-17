<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: d, pending, error, refresh } = useFetch<any>(() => `/api/billing/orders/${id.value}`)

useSeoMeta({
  title: computed(() => `Orden ${shortId(d.value?.order?.id ?? id.value)} - STC Control`),
  description: 'Detalle de una orden de stc-billing.',
})

const currency = computed(() => d.value?.order?.currency)
const money = (minor: number | null | undefined) => formatMoney(minor, currency.value)

const paidTotal = computed(() =>
  (d.value?.payments ?? [])
    .filter((p: any) => p.status === 'succeeded' || p.status === 'refunded')
    .reduce((sum: number, p: any) => sum + p.amount - (p.amountRefunded || 0), 0),
)

const couponLabel = computed(() => {
  const c = d.value?.coupon
  if (!c) return null
  const off = c.percentOff ? `${c.percentOff}%` : formatMoney(c.amountOff, c.currency)
  const dur = c.duration === 'forever' ? 'siempre' : c.duration === 'repeating' ? `${c.durationPeriods} periodos` : 'una vez'
  return `${c.code.toUpperCase()} · ${off} · ${dur}`
})

function paymentReason(p: any) {
  if (p.billingReason) return BILLING_REASON[p.billingReason] ?? p.billingReason
  return p.orderId ? 'Primer pago' : 'Cobro'
}

// Order, charges, subscription changes and Discord role changes on one timeline, newest first.
const timeline = computed(() => {
  const v = d.value
  if (!v) return []
  const ev: { at: string; icon: string; tone: string; title: string; sub?: string }[] = []
  ev.push({ at: v.order.createdAt, icon: 'i-lucide-shopping-cart', tone: 'neutral', title: 'Orden creada', sub: `Checkout con ${PROVIDER_LABEL[v.order.provider] ?? v.order.provider}` })
  if (v.order.paidAt) ev.push({ at: v.order.paidAt, icon: 'i-lucide-badge-check', tone: 'green', title: 'Orden pagada', sub: money(v.order.total) })
  for (const p of v.payments) {
    const ok = p.status === 'succeeded'
    ev.push({
      at: p.attemptedAt,
      icon: ok ? 'i-lucide-circle-dollar-sign' : p.status === 'failed' ? 'i-lucide-circle-x' : 'i-lucide-undo-2',
      tone: statusMeta(PAYMENT_STATUS, p.status).tone,
      title: `${paymentReason(p)} · ${statusMeta(PAYMENT_STATUS, p.status).label.toLowerCase()}`,
      sub: [money(p.amount), p.failureMessage].filter(Boolean).join(' · '),
    })
  }
  const s = v.subscription
  if (s?.canceledAt) ev.push({ at: s.canceledAt, icon: 'i-lucide-calendar-x', tone: 'gold', title: 'Suscripción cancelada', sub: s.cancelAtPeriodEnd ? `Acceso hasta ${formatBillingDate(s.paidThrough)}` : undefined })
  if (s?.endedAt) ev.push({ at: s.endedAt, icon: 'i-lucide-circle-stop', tone: 'neutral', title: 'Suscripción terminada' })
  if (s?.revokedAt) ev.push({ at: s.revokedAt, icon: 'i-lucide-shield-x', tone: 'red', title: 'Acceso revocado', sub: s.revokedReason ?? undefined })
  for (const a of v.roleChanges) {
    ev.push({
      at: a.createdAt,
      icon: a.action === 'grant' ? 'i-lucide-user-plus' : 'i-lucide-user-minus',
      tone: statusMeta(ROLE_ACTION_STATUS, a.status).tone,
      title: `${ROLE_ACTION[a.action] ?? a.action} · ${statusMeta(ROLE_ACTION_STATUS, a.status).label.toLowerCase()}`,
      sub: [a.reason, a.lastError].filter(Boolean).join(' · ') || undefined,
    })
  }
  // Same instant (order paid + first charge): later-pushed events happened later, so they go first.
  return ev
    .map((e, i) => ({ e, i }))
    .sort((a, b) => new Date(b.e.at).getTime() - new Date(a.e.at).getTime() || b.i - a.i)
    .map(x => x.e)
})

const copied = ref<string | null>(null)
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = text
    setTimeout(() => { if (copied.value === text) copied.value = null }, 1400)
  } catch { /* clipboard blocked: nothing to do */ }
}
</script>

<template>
  <div class="od-page">
    <NuxtLink to="/billing/orders" class="stc-link-all" style="align-self:flex-start">
      <UIcon name="i-lucide-arrow-left" class="w-3.5 h-3.5" />
      Volver a Órdenes
    </NuxtLink>

    <section v-if="error" class="stc-panel od-alert">
      <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 flex-shrink-0" />
      <div>
        <div class="od-alert-t">{{ error.statusCode === 404 ? 'Orden no encontrada' : 'Error' }}</div>
        <p class="od-alert-p">{{ error.data?.message || error.statusMessage || error.message }}</p>
      </div>
    </section>

    <template v-else-if="pending && !d">
      <USkeleton class="h-28 w-full rounded-[10px]" />
      <div class="od-grid">
        <USkeleton class="h-96 w-full rounded-[10px]" />
        <USkeleton class="h-96 w-full rounded-[10px]" />
      </div>
    </template>

    <template v-else-if="d">
      <!-- Cabecera -->
      <section class="stc-panel od-head">
        <div class="min-w-0">
          <div class="stc-eyebrow">Orden</div>
          <div class="od-title">
            <span class="stc-display">#{{ shortId(d.order.id) }}</span>
            <span class="stc-badge" :class="statusMeta(ORDER_STATUS, d.order.status).tone">
              {{ statusMeta(ORDER_STATUS, d.order.status).label }}
            </span>
            <span class="stc-badge neutral">{{ PROVIDER_LABEL[d.order.provider] ?? d.order.provider }}</span>
          </div>
          <div class="od-meta stc-mono">
            {{ formatBillingDateTime(d.order.createdAt) }}
            <template v-if="d.order.paidAt"> · pagada {{ formatBillingDateTime(d.order.paidAt) }}</template>
          </div>
        </div>
        <div class="od-head-r">
          <div class="od-total stc-mono">{{ money(d.order.total) }}</div>
          <div class="od-head-actions">
            <button class="stc-btn sm" @click="copy(d.order.id)">
              <UIcon :name="copied === d.order.id ? 'i-lucide-check' : 'i-lucide-copy'" class="w-3.5 h-3.5" />
              {{ copied === d.order.id ? 'Copiado' : 'Copiar ID' }}
            </button>
            <button class="stc-btn sm" :disabled="pending" title="Actualizar" @click="refresh()">
              <UIcon name="i-lucide-refresh-cw" class="w-3.5 h-3.5" :class="{ 'animate-spin': pending }" />
            </button>
          </div>
        </div>
      </section>

      <div class="od-grid">
        <!-- Columna principal -->
        <div class="od-col">
          <!-- Resumen -->
          <section class="stc-panel">
            <div class="stc-panel-head">
              <div class="stc-panel-title"><UIcon name="i-lucide-receipt" class="w-5 h-5" /> Resumen</div>
              <a v-if="d.links.order" :href="d.links.order" target="_blank" rel="noopener" class="stc-link-all">
                Ver en {{ PROVIDER_LABEL[d.order.provider] }} <UIcon name="i-lucide-external-link" class="w-3.5 h-3.5" />
              </a>
            </div>
            <div class="od-line">
              <span class="od-line-ic"><UIcon name="i-lucide-package" class="w-4 h-4" /></span>
              <div class="min-w-0 flex-1">
                <div class="od-line-name">{{ d.service.name }}</div>
                <div class="od-line-sub">
                  {{ d.price.nickname || formatInterval(d.price.interval, d.price.intervalCount) }}
                  · {{ formatMoney(d.price.amount, d.price.currency) }}
                  {{ d.price.interval ? `/ ${formatInterval(d.price.interval, d.price.intervalCount).toLowerCase()}` : '' }}
                  <template v-if="d.price.kind === 'one_time'">
                    · {{ d.price.accessDurationDays ? `${d.price.accessDurationDays} días de acceso` : 'acceso de por vida' }}
                  </template>
                </div>
              </div>
              <div class="od-line-amt stc-mono">{{ money(d.order.subtotal) }}</div>
            </div>
            <div class="od-sums">
              <div class="od-sum"><span>Subtotal</span><span class="stc-mono">{{ money(d.order.subtotal) }}</span></div>
              <div v-if="d.order.discount || d.coupon" class="od-sum">
                <span>Descuento <span v-if="couponLabel" class="stc-badge gold od-coupon">{{ couponLabel }}</span></span>
                <span class="stc-mono od-disc">−{{ money(d.order.discount) }}</span>
              </div>
              <div class="od-sum od-sum-total"><span>Total</span><span class="stc-mono">{{ money(d.order.total) }}</span></div>
              <div v-if="d.payments.length" class="od-sum od-sum-paid">
                <span>Cobrado en total (todos los pagos)</span><span class="stc-mono">{{ money(paidTotal) }}</span>
              </div>
            </div>
          </section>

          <!-- Transacciones -->
          <section class="stc-panel">
            <div class="stc-panel-head">
              <div class="stc-panel-title"><UIcon name="i-lucide-credit-card" class="w-5 h-5" /> Transacciones</div>
              <span class="stc-badge neutral stc-mono">{{ d.payments.length }}</span>
            </div>
            <div v-if="!d.payments.length" class="stc-empty" style="padding:28px 20px">
              <UIcon name="i-lucide-credit-card" />
              <p>El procesador todavía no ha intentado ningún cobro.</p>
            </div>
            <div v-for="p in d.payments" :key="p.id" class="od-pay">
              <div class="min-w-0 flex-1">
                <div class="od-pay-top">
                  <span class="od-pay-reason">{{ paymentReason(p) }}</span>
                  <span class="stc-badge" :class="statusMeta(PAYMENT_STATUS, p.status).tone">{{ statusMeta(PAYMENT_STATUS, p.status).label }}</span>
                </div>
                <div class="od-pay-sub stc-mono">
                  {{ formatBillingDateTime(p.attemptedAt) }} · {{ p.providerInvoiceId || p.providerRef }}
                </div>
                <div v-if="p.failureMessage || p.failureCode" class="od-pay-err">
                  {{ p.failureMessage || p.failureCode }}<template v-if="p.failureMessage && p.failureCode"> ({{ p.failureCode }})</template>
                </div>
                <div v-if="p.nextRetryAt" class="od-pay-note">Próximo reintento {{ formatBillingDateTime(p.nextRetryAt) }}</div>
                <div v-if="p.amountRefunded" class="od-pay-note">Reembolsado {{ formatMoney(p.amountRefunded, p.currency) }}</div>
              </div>
              <div class="od-pay-r">
                <span class="od-pay-amt stc-mono" :class="{ struck: p.status === 'failed' }">{{ formatMoney(p.amount, p.currency) }}</span>
                <a v-if="d.links.payments[p.id]" :href="d.links.payments[p.id]" target="_blank" rel="noopener" class="stc-icon-btn" title="Abrir en el procesador">
                  <UIcon name="i-lucide-external-link" class="w-[15px] h-[15px]" />
                </a>
              </div>
            </div>
          </section>

          <!-- Actividad -->
          <section class="stc-panel">
            <div class="stc-panel-head">
              <div class="stc-panel-title"><UIcon name="i-lucide-history" class="w-5 h-5" /> Actividad</div>
            </div>
            <ol class="od-tl">
              <li v-for="(e, i) in timeline" :key="i" class="od-tl-item">
                <span class="od-tl-ic" :class="e.tone"><UIcon :name="e.icon" class="w-3.5 h-3.5" /></span>
                <div class="min-w-0 flex-1">
                  <div class="od-tl-title">{{ e.title }}</div>
                  <div v-if="e.sub" class="od-tl-sub">{{ e.sub }}</div>
                </div>
                <span class="od-tl-at stc-mono">{{ formatBillingDateTime(e.at) }}</span>
              </li>
            </ol>
          </section>
        </div>

        <!-- Columna lateral -->
        <div class="od-col">
          <!-- Cliente -->
          <section class="stc-panel">
            <div class="stc-panel-head">
              <div class="stc-panel-title"><UIcon name="i-lucide-user" class="w-5 h-5" /> Cliente</div>
              <NuxtLink v-if="d.customer.discordId" :to="`/discord-users/${d.customer.discordId}`" class="stc-link-all">
                Ver perfil <UIcon name="i-lucide-arrow-up-right" class="w-3.5 h-3.5" />
              </NuxtLink>
            </div>
            <dl class="od-kv">
              <div><dt>Discord</dt><dd>{{ d.customer.discordUsername || '—' }}</dd></div>
              <div><dt>Email</dt><dd class="od-break">{{ d.customer.email || '—' }}</dd></div>
              <div><dt>Discord ID</dt><dd class="stc-mono">{{ d.customer.discordId || 'Sin reclamar' }}</dd></div>
              <div v-if="d.customer.stripeCustomerId">
                <dt>Stripe</dt>
                <dd class="stc-mono">
                  <a v-if="d.links.customer" :href="d.links.customer" target="_blank" rel="noopener" class="od-ext">{{ d.customer.stripeCustomerId }}</a>
                  <template v-else>{{ d.customer.stripeCustomerId }}</template>
                </dd>
              </div>
              <div v-if="d.customer.paypalPayerId"><dt>PayPal</dt><dd class="stc-mono">{{ d.customer.paypalPayerId }}</dd></div>
              <div><dt>Cliente desde</dt><dd>{{ formatBillingDate(d.customer.createdAt) }}</dd></div>
            </dl>
          </section>

          <!-- Suscripción -->
          <section v-if="d.subscription" class="stc-panel">
            <div class="stc-panel-head">
              <div class="stc-panel-title"><UIcon name="i-lucide-repeat" class="w-5 h-5" /> Suscripción</div>
              <a v-if="d.links.subscription" :href="d.links.subscription" target="_blank" rel="noopener" class="stc-link-all">
                {{ PROVIDER_LABEL[d.subscription.provider] }} <UIcon name="i-lucide-external-link" class="w-3.5 h-3.5" />
              </a>
            </div>
            <div class="od-sub-status">
              <span class="stc-badge" :class="statusMeta(SUBSCRIPTION_STATUS, d.subscription.status).tone">
                {{ statusMeta(SUBSCRIPTION_STATUS, d.subscription.status).label }}
              </span>
              <span class="od-next" :class="subscriptionNextStep(d.subscription).tone">{{ subscriptionNextStep(d.subscription).text }}</span>
            </div>
            <dl class="od-kv">
              <div><dt>Pagado hasta</dt><dd>{{ formatBillingDate(d.subscription.paidThrough) }}</dd></div>
              <div>
                <dt>Periodo actual</dt>
                <dd>{{ formatBillingDate(d.subscription.currentPeriodStart) }} – {{ formatBillingDate(d.subscription.currentPeriodEnd) }}</dd>
              </div>
              <div v-if="d.subscription.paymentMethodLast4">
                <dt>Método de pago</dt>
                <dd class="od-cap">{{ d.subscription.paymentMethodBrand }} ···· {{ d.subscription.paymentMethodLast4 }}</dd>
              </div>
              <div v-if="d.subscription.canceledAt"><dt>Cancelada</dt><dd>{{ formatBillingDateTime(d.subscription.canceledAt) }}</dd></div>
              <div><dt>Estado en {{ PROVIDER_LABEL[d.subscription.provider] }}</dt><dd class="stc-mono">{{ d.subscription.providerStatus || '—' }}</dd></div>
              <div><dt>ID</dt><dd class="stc-mono od-break">{{ d.subscription.providerSubscriptionId }}</dd></div>
              <div v-if="d.subscription.origin === 'import'"><dt>Origen</dt><dd>Importada</dd></div>
              <div><dt>Última sincronización</dt><dd>{{ formatBillingDateTime(d.subscription.lastSyncedAt) }}</dd></div>
            </dl>
          </section>

          <!-- Acceso -->
          <section class="stc-panel">
            <div class="stc-panel-head">
              <div class="stc-panel-title"><UIcon name="i-lucide-key-round" class="w-5 h-5" /> Acceso</div>
              <span v-if="d.entitlement" class="stc-badge" :class="statusMeta(ACCESS_STATUS, d.entitlement.status).tone">
                {{ statusMeta(ACCESS_STATUS, d.entitlement.status).label }}
              </span>
            </div>
            <dl v-if="d.entitlement" class="od-kv">
              <div><dt>Desde</dt><dd>{{ formatBillingDate(d.entitlement.startsAt) }}</dd></div>
              <div><dt>Hasta</dt><dd>{{ d.entitlement.endsAt ? formatBillingDate(d.entitlement.endsAt) : 'Mientras siga pagando' }}</dd></div>
              <div v-if="d.entitlement.revokedReason"><dt>Motivo</dt><dd>{{ d.entitlement.revokedReason }}</dd></div>
              <div><dt>Rol de Discord</dt><dd class="stc-mono">{{ d.service.discordRoleId || 'Sin rol' }}</dd></div>
            </dl>
            <div v-else class="stc-empty" style="padding:24px 20px">
              <p>Esta orden no ha dado acceso todavía.</p>
            </div>
          </section>

          <!-- Otras órdenes -->
          <section v-if="d.otherOrders.length" class="stc-panel">
            <div class="stc-panel-head">
              <div class="stc-panel-title"><UIcon name="i-lucide-list" class="w-5 h-5" /> Otras órdenes</div>
            </div>
            <NuxtLink v-for="o in d.otherOrders" :key="o.id" :to="`/billing/orders/${o.id}`" class="od-other">
              <div class="min-w-0 flex-1">
                <div class="od-other-name">{{ o.serviceName }}</div>
                <div class="od-other-sub stc-mono">#{{ shortId(o.id) }} · {{ formatBillingDate(o.createdAt) }}</div>
              </div>
              <span class="stc-mono od-other-amt">{{ formatMoney(o.total, o.currency) }}</span>
              <span class="stc-badge" :class="statusMeta(ORDER_STATUS, o.status).tone">{{ statusMeta(ORDER_STATUS, o.status).label }}</span>
            </NuxtLink>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.od-page { display: flex; flex-direction: column; gap: 18px; }

.od-alert {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 16px 18px;
  color: var(--red); border-color: var(--red-line); background: var(--red-dim);
}
.od-alert-t { font-weight: 600; font-size: 14px; }
.od-alert-p { font-size: 13px; color: var(--dim); margin-top: 3px; }

/* cabecera */
.od-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; flex-wrap: wrap;
  padding: 20px 22px;
}
.od-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.od-title .stc-display { font-size: 30px; line-height: 1; color: var(--text); }
.od-meta { font-size: 12px; color: var(--faint); margin-top: 8px; }
.od-head-r { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.od-total { font-size: 28px; font-weight: 700; color: var(--gold-soft); line-height: 1; }
.od-head-actions { display: flex; gap: 6px; }

/* rejilla */
.od-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 18px; align-items: start; }
.od-col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }

/* resumen */
.od-line { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line); }
.od-line-ic {
  width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
  display: grid; place-items: center;
  color: var(--gold); background: var(--gold-wash); border: 1px solid var(--gold-ring);
}
.od-line-name { font-size: 14px; font-weight: 600; color: var(--text); }
.od-line-sub { font-size: 12px; color: var(--faint); margin-top: 2px; }
.od-line-amt { font-size: 14px; color: var(--text); }
.od-sums { padding: 12px 20px 16px; display: flex; flex-direction: column; gap: 8px; }
.od-sum { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px; color: var(--dim); }
.od-coupon { margin-left: 6px; }
.od-disc { color: var(--gold-soft); }
.od-sum-total { padding-top: 10px; border-top: 1px solid var(--line); font-size: 15px; font-weight: 700; color: var(--text); }
.od-sum-paid { font-size: 12px; color: var(--faint); }

/* transacciones */
.od-pay { display: flex; align-items: flex-start; gap: 14px; padding: 14px 20px; border-bottom: 1px solid var(--line); }
.od-pay:last-child { border-bottom: none; }
.od-pay-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.od-pay-reason { font-size: 13.5px; font-weight: 600; color: var(--text); }
.od-pay-sub { font-size: 11.5px; color: var(--faint); margin-top: 4px; overflow-wrap: anywhere; }
.od-pay-err { font-size: 12px; color: var(--red); margin-top: 4px; }
.od-pay-note { font-size: 12px; color: var(--dim); margin-top: 3px; }
.od-pay-r { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.od-pay-amt { font-size: 14px; font-weight: 600; color: var(--text); }
.od-pay-amt.struck { color: var(--faint); text-decoration: line-through; }

/* actividad */
.od-tl { list-style: none; margin: 0; padding: 8px 20px 14px; }
.od-tl-item { position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; }
.od-tl-item:not(:last-child)::before {
  content: ''; position: absolute; left: 13px; top: 38px; bottom: -10px; width: 1px; background: var(--line);
}
.od-tl-ic {
  width: 27px; height: 27px; border-radius: 50%; flex-shrink: 0;
  display: grid; place-items: center; border: 1px solid var(--line); color: var(--dim);
}
.od-tl-ic.green   { color: var(--green); background: var(--green-dim); border-color: var(--green-line); }
.od-tl-ic.red     { color: var(--red);   background: var(--red-dim);   border-color: var(--red-line); }
.od-tl-ic.gold    { color: var(--gold-soft); background: var(--gold-wash); border-color: var(--gold-ring); }
.od-tl-ic.blue    { color: var(--blue);  background: var(--blue-dim);  border-color: var(--blue-line); }
.od-tl-title { font-size: 13px; font-weight: 500; color: var(--text); padding-top: 4px; }
.od-tl-sub { font-size: 12px; color: var(--faint); margin-top: 2px; overflow-wrap: anywhere; }
.od-tl-at { font-size: 11.5px; color: var(--faint); white-space: nowrap; padding-top: 5px; }

/* pares clave/valor */
.od-kv { margin: 0; padding: 6px 20px 14px; }
.od-kv > div { display: flex; justify-content: space-between; gap: 14px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
.od-kv > div:last-child { border-bottom: none; }
.od-kv dt { font-size: 12px; color: var(--faint); flex-shrink: 0; }
.od-kv dd { margin: 0; font-size: 12.5px; color: var(--text); text-align: right; min-width: 0; }
.od-break { overflow-wrap: anywhere; }
.od-cap { text-transform: capitalize; }
.od-ext { color: var(--gold-soft); text-decoration: none; overflow-wrap: anywhere; }
.od-ext:hover { text-decoration: underline; }

.od-sub-status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 14px 20px 4px; }
.od-next { font-size: 12.5px; }
.od-next.dim  { color: var(--dim); }
.od-next.gold { color: var(--gold-soft); }
.od-next.red  { color: var(--red); }

/* otras órdenes */
.od-other {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 20px; border-bottom: 1px solid var(--line);
  text-decoration: none; transition: background .14s;
}
.od-other:last-child { border-bottom: none; }
.od-other:hover { background: rgba(255,255,255,.025); }
html:not(.dark) .od-other:hover { background: rgba(0,0,0,.025); }
.od-other-name { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.od-other-sub { font-size: 11px; color: var(--faint); margin-top: 2px; }
.od-other-amt { font-size: 12.5px; color: var(--dim); }

@media (max-width: 1100px) {
  .od-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .od-head { padding: 16px; align-items: flex-start; }
  .od-head-r { align-items: flex-start; }
  .od-title .stc-display { font-size: 26px; }
  .od-total { font-size: 24px; }
  .od-line, .od-pay, .od-other { padding-left: 16px; padding-right: 16px; }
  .od-kv, .od-tl, .od-sums { padding-left: 16px; padding-right: 16px; }
  .od-tl-item { flex-wrap: wrap; }
  .od-tl-at { width: 100%; padding: 0 0 0 39px; }
}
</style>
