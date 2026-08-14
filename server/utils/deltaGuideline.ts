// STC Delta → Alpha — Agent Training, Cheatsheet & Scripts.
//
// This is the GUIDELINE the analyst prompt scores every conversation against.
// It is the client's playbook (Luminary Growth Systems); keep it verbatim and
// update it here whenever operations ships a new version — analysis and
// follow-ups must stay in sync with whatever the agents are actually trained on.
//
// Stored as a TS module rather than a file read at runtime so nitro bundles it
// into the server build (no fs access needed in production). It is injected
// into the cached system block in server/utils/ai.ts, so any edit here
// invalidates the prompt cache once, then re-warms on the next call.

export const DELTA_GUIDELINE = `# STC Delta → Alpha — Agent Training, Cheatsheet & Scripts
Luminary Growth Systems · Stock Trading Club · Customer Relationship Marketing playbook for community agents

Built from the real Bernardo & Rumi ↔ Delta transcript analyses. English = the why and the coaching; Spanish = every line an agent actually sends (copy-paste ready, tuned to how our members talk).

## How to use this
Three things, in order: (1) a short training every agent reads once, with a personal coaching note for Bernardo and for Rumi; (2) a situation cheatsheet to keep open while chatting; (3) three full scripts that model the right way to lead a conversation toward a strategy call.

One reminder before anything else — agents do not sell Alpha and do not quote the $7,000. Our job is to build the relationship, spot a genuine fit, plant the seed, and warm the member toward a strategy call with the closer (Jan). The closer takes it from there, including price and payment options.

## 1) Agent Training

### The one rule that fixes 80% of what we're leaving on the table
Across both agents' real chats, the single biggest leak is the same: conversations are left dead. Bernardo builds beautiful rapport and then closes on "un abrazo" with no next step (this happened in roughly half of his positive threads). Rumi sends a warm-but-templated check-in and ~95% of members never reply — and the ones who do are met with empathy and then silence.

So the rule, above every other technique:

**Never end a conversation on "un abrazo," "de nada," or silence after a positive or intent signal. Every thread ends with a concrete next step or a planted seed — a diagnostic question, a booked session, or a soft Alpha bridge tied to the member's own words.**

"Estoy bien / todo en orden" and no-reply are openings, not closes.

### A. The mindset: relationship first — but you're growth, not support
We lead with genuine help because it earns the right to recommend. But helping is the floor, not the finish line. A member who feels seen and then hears nothing about where they could go next is a relationship we built and then abandoned.

Support thinks: "Question answered → close the ticket → un abrazo."
Growth thinks: "Question answered → what does this tell me about where they're headed? → leave a forward step or a seed."

Same warmth. One extra move.

### B. Make the member feel seen (this is where we already win — keep it)
- Use their name and reference their actual situation/tenure. The one genuinely personalized outreach in the whole dataset (César: "vi que llevas ya unas semanas en Delta y quería saber cómo te está yendo") is the model. It beats "no te he visto por aquí…" every time — absence-framing quietly says "blast," not "I see you."
- Mirror their emotional register. Bernardo does this beautifully with frustrated members (Cristian, Alex). Match their energy before you guide.
- Radical honesty + the proof anchor. Bernardo's "aún no soy rentable, me queda camino" builds real trust — keep it. But always pair it with Edu's audited track record so authority never hangs: "Lo potente acá no es mi cuenta, es el sistema y el track record auditado de Edu."
- Personal-journey credibility. "Cuando empecé me costaba [X], lo que me cambió fue [Y]." Rumi uses this 0% of the time — it's the most natural bridge to "Alpha is where I got the close guidance that moved me." Build 2–3 of these lines and keep them ready.

### C. Recognize a real Alpha fit — the signals
A member is warm for an Alpha bridge when you see any of these (all pulled from real threads):

- Showing results / happy — e.g. DaniH sharing a green calendar, "todo bien gracias a este grupo." Happy + results = ask. Subir size, te importa si lo comparto con edu, cuentame que hiciste que identificaste que flippeo tu curva.
- Asking for closer guidance / live accompaniment — A. Walmoris wanting to "ver ejecución de cerca," Cristin trading solo with mixed results, Mauri wanting a defined system. They are describing Alpha without naming it.
- Explicit intent — Eduardo: "planeo meterme al ALPHA pronto." David_08: "me gustaría saber el precio del alpha." These are hot leads.
- Frustrated but committed — craving a repeatable system (Mauri, Juan Carlos, Cristian). The pain is the bridge.
- In other communities but chooses STC — Toni ("Edu es el mejor"). Retention + upsell in one.

Not a fit yet: disengaged / never replied, brand-new and still onboarding, or eager-but-budget-blocked with no demo traction. These get nurtured, not pushed (see E).

### D. Delta vs Alpha — explained the way a member actually cares
Don't feature-dump. The difference members feel is access and accompaniment, not a bullet list.

- Delta = you watch. All the modules, premarket sessions, recorded Q&As, live trading sessions to observe. The full foundation.
- Alpha = you participate. Everything in Delta, plus Edu reviews your trades 1-to-1 (trade revision), you ask live in the Q&As, and you trade live with the group, actively. It's the jump from studying the method to having it applied to your own trades with direct feedback.

The move: tie it to the exact thing they're already struggling with. "Eso de definir tus niveles / encontrar un sistema repetible es justo lo que más se pule cuando Edu te revisa tus trades 1 a 1 — eso es literalmente el Alpha."

### E. Plant the seed + warm toward the strategy call (never a pitch)
You're building the bridge, not closing. Two plays:

Curious / satisfied / showing fit (proactive seed): value-first, no pressure.
"A traders en tu punto el Alpha les acelera muchísimo la curva — ¿te gustaría que te cuente cómo funciona, sin compromiso?" If yes → warm them toward a strategy call: "Lo mejor es que lo veas en una llamada corta donde te explican todo a detalle. ¿Te conecto?"

Explicit intent (Eduardo / David_08 type): acknowledge the signal immediately — don't just answer the logistics sub-question.
"Me alegra muchísimo que estés mirando el Alpha 🙌 Lo veo perfecto para tu punto. Lo siguiente es una llamada de estrategia donde te explican el proceso y resuelven cualquier duda — ¿te coordino con Jan?"

On price: don't pitch the number. Acknowledge + frame value + route to the call (where payment plans live).
"El Alpha es la membresía premium con acompañamiento directo de Edu. El detalle de inversión y las opciones de pago se ven en la llamada de estrategia, que es justo donde puedes ver si encaja contigo. ¿Te coordino?"

### F. When NOT to push
- No relationship yet / disengaged → build first, seed later. A bridge before trust reads as a sales blast.
- Budget-blocked but eager (Yor: "no tengo para el Alpha y me gustaría… solo tengo los 3k para mi cuenta") → don't close it with "cuando seas rentable hablamos." Acknowledge the hunger, anchor demo-first, log them for nurture, and keep the door warm: "Vamos a hacerte rentable en demo primero; cuando estés listo te muestro las opciones del Alpha — a veces hay planes que ayudan con el presupuesto."
- A clear "no" → respect it, leave the door open warmly. Never pressure, never false urgency.

### G. The "I'm OK / silence" playbook (the most common situation in our data)
"Estoy bien / todo en orden" → convert to a diagnostic, never accept as a close:
"Me alegra 🙌 Cuéntame, ¿estás en demo o en real? Según dónde estés te paso un recurso que te ahorra tiempo."

Silence (no reply to first touch) → switch channel and lower the ask to one tap:
"¿Sigues activo en Delta? Responde 👍 y te ayudo a re-arrancar en 2 minutos."

Vague doubts ("tengo muchas dudas al operar") → "dime una" + actually solve it or book a Q&A slot. Never answer with "el canal de Q&A existe."

### H. Do's & Don'ts
Do
- End every thread with a forward step or a seed.
- Personalize: name + their real situation.
- Acknowledge an Alpha/price signal before answering the logistics.
- Pair honesty with Edu's audited track record.
- Convert "estoy bien" into a diagnostic.
- Attempt one save + capture the reason on any cancellation.
- Flag fake-Edu impersonators up the chain and reassure the member.

Don't
- Don't close on "un abrazo / de nada" after a positive signal.
- Don't quote the $7,000 or try to close — that's the strategy call.
- Don't feature-dump Delta vs Alpha; tie it to their pain.
- Don't blast an identical template; don't absence-frame ("no te he visto").
- Don't let a stated Alpha interest decay into a generic check-in months later.
- Don't accept a timezone/schedule limit — solve it (recordings + PM-fit) first.

### Personal coaching note — For Bernardo
You are the strongest relationship-builder and resource hub we have — members trust you fast, your empathy with frustrated traders is the best in the dataset, and you genuinely follow up. None of that changes. Your one growth edge is purely commercial: you treat buying signals like support tickets. Eduardo literally said "planeo meterme al ALPHA" and you answered only the Tradervue question. DaniH showed you profits and you closed on "un abrazo." Your fix is small and mechanical: after any positive or intent signal, add one move — a forward question or a soft Alpha/strategy-call seed — before you sign off. And keep your "aún no soy rentable" honesty, but always attach Edu's track record right after it so your authority never dips. You don't need to become salesy; you need to stop ending one message too early.

## 2) Situation Cheatsheet
Left = what's happening (with the real example it came from). Middle = what to send. Right = why.

| Situation | What to send (copy-paste, tune the name) | Why |
|---|---|---|
| Happy + showing results — DaniH shares a green calendar, "todo bien gracias al grupo" | "Esos resultados hablan solos 🔥 Justo a traders en tu punto es a quienes el Alpha les acelera la curva, porque Edu te revisa tus trades 1 a 1. ¿Te cuento cómo funciona, sin compromiso?" | Happy + results = your warmest upsell moment. Don't close on "un abrazo." |
| "Estoy bien / todo en orden" — Toni, Dani, Albert, Miguel | "Me alegra 🙌 Cuéntame, ¿estás en demo o en real? Según dónde estés te paso un recurso que te ahorra tiempo." | Turns a dead-end into a diagnostic that re-opens the conversation. |
| Explicit Alpha intent — Eduardo: "planeo meterme al ALPHA" | "Me alegra muchísimo 🙌 Lo veo perfecto para tu punto. El siguiente paso es una llamada de estrategia donde te explican todo a detalle — ¿te coordino con Jan?" | Acknowledge the signal first; route to the closer. Never answer only the logistics. |
| Asks the Alpha price — David_08: "qué precio tiene el acceso" | "El Alpha es la membresía premium con acompañamiento directo de Edu. La inversión y las opciones de pago se ven en la llamada de estrategia, que es donde confirmas si encaja contigo. ¿Te coordino la llamada?" | Don't pitch the number. Frame value, route to the call. |
| Wants closer accompaniment / live execution — A. Walmoris, Cristin | "Eso que pides — acompañamiento en vivo y ver ejecución de cerca — es justo el corazón del Alpha. ¿Te explico cómo funciona? Creo que es lo que estás buscando." | They're describing Alpha without naming it. Connect the dots. |
| Frustrated, craving a system — Mauri, Juan Carlos, Cristian | "Que ganes unas y pierdas otras es justo lo que se trabaja a fondo en el acompañamiento cercano: tener un sistema repetible. Primero dime, ¿qué parte del play sientes que se te escapa?" | Empathy + diagnostic + the pain is the Alpha bridge. Solve, don't just validate. |
| Vague doubts — Juan Carlos: "tengo muchas dudas al operar" | "Vamos a resolverlas. Dime 1 o 2 de esas dudas que te frenan al operar y te las contesto ahora mismo." | "Tell me one" beats "the Q&A channel exists." Unanswered doubt = churn. |
| Budget-blocked but eager — Yor: "no tengo para el Alpha y me gustaría" | "Me encanta esa hambre. Vamos a hacerte rentable en demo primero, y cuando estés listo te muestro las opciones del Alpha — a veces hay planes que ayudan con el presupuesto. Te tengo en el radar." | Keep warm, log for nurture. Don't let "cuando sea rentable hablamos" close it. |
| Timezone / schedule limit — Wex (Spain), Juan Carlos (turno rotativo) | "Lo montamos a tu favor: las sesiones quedan grabadas y el premarket encaja mejor con tu franja. Dime tu horario y te digo a qué live conectarte." | Solve the constraint; don't accept it. Acceptance validates the exit. |
| In other communities, still chose STC — Toni | "Me encanta que compares y aun así elijas STC. Para traders que ya operan en real como tú, el Alpha es otro nivel de cercanía con Edu — ¿te cuento?" | Retention risk + upsell. Turn a satisfied comparer into a lead. |
| Onboarding fixed, then silence — Dani, Albert, Dennis, Jairo | "Qué bien que ya te funcione todo. ¿Te has podido pasar por algún live? Dime cuándo te viene bien conectarte y te digo cuál te encaja." | Satisfied-after-friction = warm relationship, not a closed ticket. Give one concrete step. |
| Cancellation — Tuchiqui | "Claro que te ayudo. Antes de procesarlo, ¿te puedo preguntar qué te llevó a esta decisión? Si es tiempo, costo o resultados, quizá hay una opción que no conoces (pausa, plan, demo)." | Always attempt one save + capture the reason. Then offboard graciously. |
| Credibility test — Joel: "¿tienes resultados en smallcaps?" | "Te soy honesto: aún me queda camino. Pero lo potente acá no es mi cuenta, es el sistema y el track record auditado de Edu — y en el Alpha lo ves aplicado en vivo, sobre tus propios trades." | Honesty builds trust; the track record keeps authority. |
| Fake-Edu impersonator — Israel MX | "Gracias por avisar — Edu nunca ofrece copy trading por DM. Lo reporto al equipo ahora mismo. Valida siempre el staff en #anuncios." | Brand-trust theme; reassure + report internally. |
| Cold follow-up, no reply — the silent ~30 | "Hola [Nombre] 👋 Pregunta rápida: ¿qué es lo que más te cuesta ahora — (1) el setup, (2) la gestión de riesgo, o (3) el tiempo para conectarte? Responde 1, 2 o 3 y te ayudo." | One-tap choice beats an open "¿alguna duda?". Personalize, then a 2nd/3rd touch. |

## 3) Three Conversation Scripts
Discord-native: short messages, warm, real. [Brackets] are coaching notes, not text to send. Each opens with relationship, surfaces goals, introduces Alpha only after fit, and warms toward the strategy call — the agent invites, the closer sells.

### Script 1 — Highly engaged member, strong fit
Model: a Mauri / DaniH type — active, showing progress, craving a repeatable system.

Miembro: Bro este mes me fue mejor, ya entiendo el playbook bastante. Pero siento que me falta definir bien mi sistema, a veces gano y a veces me descuadro.
Agente: ¡Qué bueno leer eso! 🙌 Ese salto de "entiendo el playbook" a "tengo un sistema repetible" es exactamente el punto donde más gente se traba — y donde más se avanza. [mirror + name the stage]
Agente: Cuéntame, ¿qué parte sientes que se te escapa más: la entrada, dónde pones el stop, o cuándo tomas profits? [diagnostic question — surface the real goal]
Miembro: Sobre todo el profit. No sé si dejar correr o tomar antes.
Agente: Te entiendo perfecto, eso nos lo debatimos todos. A grandes rasgos: si eres paciente, esperas niveles; si eres más ansioso, tomas parte y dejas correr otra parte. Pero lo que de verdad lo afina es ver tus propios trades revisados, no la teoría general. [help first — earn the right]
Miembro: Sí, justo eso me haría falta.
Agente: Y mira, eso que acabas de decir es literalmente el corazón del Alpha: Edu te revisa tus trades 1 a 1 y operas en vivo con el grupo, no solo mirando. Para alguien en tu punto, con resultados y ganas de un sistema, le acelera muchísimo la curva. [Delta→Alpha tied to his exact pain]
Agente: ¿Te gustaría que te cuente cómo funciona? Sin compromiso. [soft seed, low pressure]
Miembro: Sí, me interesa.
Agente: Perfecto. Lo mejor es verlo en una llamada de estrategia corta, donde te explican todo a detalle y ves si encaja contigo. ¿Te coordino con Jan? [warm to the strategy call — agent invites, closer sells]
[If he hesitates:] Agente: Sin prisa — la llamada es justo para resolver dudas, no para comprometerte a nada. Cuando quieras la coordinamos. Mientras, sigue mandándome tus dudas que aquí estoy. [door stays open + thread stays alive]

### Script 2 — Quieter member who needs nurturing first
Model: a Cristin / "todo en orden" / silent type — present but not engaged, or just resolved an onboarding issue.

Agente: Hola [Nombre] 👋 Pregunta rápida para ayudarte mejor: ¿qué es lo que más te cuesta ahora mismo — (1) encontrar el setup, (2) la gestión del riesgo, o (3) el tiempo para conectarte a las sesiones? Responde 1, 2 o 3 y te echo una mano. [choice-based opener — César model, one-tap reply]
Miembro: Pues un poco perdida con las sesiones en directo, no sé bien para qué son. Y opero por mi cuenta, a veces gano a veces pierdo.
Agente: Gracias por contarme 🙌 Te ubico rápido: los live de premarket son para preparar tu watchlist antes de la apertura, y los de Q&A para resolver dudas de toda la comunidad. Aunque sientas que no tienes mucho que aportar, las preguntas de alguien que empieza le sirven a un montón de gente. [reframe the "nothing to contribute" objection]
Agente: Y eso de "a veces gano, a veces pierdo" es justo lo más importante a trabajar: pasar de resultados sueltos a un sistema repetible. [diagnostic — name the real gap]
Miembro: Sí, eso me pasa, no tengo algo fijo.
Agente: ¿Te parece si fijamos un mini-objetivo para las próximas 2 semanas y lo revisamos juntos? Y dime tu horario, así te digo a qué live te conviene entrar para empezar. [concrete next step — never leave it dead]
Miembro: Vale, me apunto 💪
Agente: Genial. Y cuando ya tengas un par de semanas de operativa registradas, te cuento cómo es el acompañamiento más cercano con Edu — donde te revisa tus trades 1 a 1 — por si en algún momento quieres acelerar. Sin prisa. [plant a future Alpha seed, no pressure]
[If silent after first touch, second touch:] Agente: ¿Sigues activo en Delta? Responde 👍 y te ayudo a re-arrancar en 2 minutos. [lower the ask to one tap]

### Script 3 — Interested but price-sensitive / hesitant
Model: a Yor / David_08 type — wants Alpha but worried about cost, or asks the price directly.

Miembro: Oye, ¿cómo funciona el grupo Alpha y qué precio tiene?
Agente: ¡Me alegra que preguntes! 🙌 Te cuento: el Alpha es la membresía premium, donde Edu te revisa tus trades 1 a 1, participas activo en los Q&A y operas en vivo con el grupo — no solo mirando como en Delta. Es el salto de estudiar el método a tenerlo aplicado sobre tus propias operaciones. [Delta→Alpha as access/accompaniment, not a feature list]
Agente: El detalle de inversión y las opciones de pago se ven en una llamada de estrategia, que es justo donde confirmas si encaja contigo. Antes de eso, cuéntame, ¿en qué punto estás ahora — demo o real? [don't quote the number; route to call; diagnose fit]
Miembro: Estoy en demo. La verdad me encantaría entrar al Alpha pero ahora mismo no me da el presupuesto, solo tengo para abrir mi cuenta real.
Agente: Te entiendo perfecto, y me encanta esa hambre — lo importante es que la tienes clara. [acknowledge the desire, don't shut it down]
Agente: Vamos por orden: primero te ayudo a ponerte sólido en demo y a dar el salto a real con buen pie. Y cuando estés listo, te muestro las opciones del Alpha — en la llamada a veces se ven planes o facilidades de pago que ayudan con el presupuesto. [demo-first + keep door warm + payment options live on the call]
Miembro: Eso me sirve un montón, gracias.
Agente: Cuenta con eso 🙌 Te dejo anotado para acompañarte en esa transición de demo a real, y cuando quieras retomamos lo del Alpha. Cualquier duda al operar, me escribes y la vemos al momento. [log for nurture + concrete next step + thread stays alive]
[If he later signals he's ready:] Agente: Por lo que me cuentas, creo que ya es buen momento para que veas el Alpha a detalle en una llamada de estrategia. ¿Te coordino con Jan? [warm to the call when timing is right]
`
