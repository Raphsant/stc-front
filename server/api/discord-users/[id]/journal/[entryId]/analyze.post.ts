// Manually-triggered Delta Conversation Analysis of a journal image entry
// (Discord/WhatsApp chat screenshot). Scores the thread against the STC Delta →
// Alpha playbook and stores the follow-up record on the entry.
// See server/utils/ai.ts and shared/deltaAnalysis.ts.
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const entryId = getRouterParam(event, 'entryId')

    const session = await getUserSession(event)
    if (!session?.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const entry = await Bitacora.findOne({ _id: entryId, discordUserId: id })
    if (!entry) {
        throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
    }
    if ((entry as any).type !== 'image') {
        throw createError({ statusCode: 400, statusMessage: 'Only image entries can be analyzed' })
    }
    // Cheap double-click guard — an in-flight run would otherwise bill twice.
    if ((entry as any).analysisStatus === 'pending') {
        throw createError({ statusCode: 409, statusMessage: 'Análisis ya en curso' })
    }

    ;(entry as any).analysisStatus = 'pending'
    await entry.save()

    try {
        const { buffer, contentType } = await getObjectBuffer((entry as any).content)
        const result = await analyzeConversation(buffer, contentType, {
            currentDate: new Date().toISOString().slice(0, 10),
            agentName: (entry as any).adminUsername || 'unknown',
        })

        ;(entry as any).analysisResult = result
        ;(entry as any).analysisStatus = 'done'
        ;(entry as any).analyzedAt = new Date()
        ;(entry as any).analysisError = null

        // Promote the workflow fields. A re-analysis starts a fresh follow-up,
        // so any previous "done" attribution is cleared.
        const needsFollowUp = result.follow_up.action_type !== 'no_action_needed'
        ;(entry as any).followUpStatus = needsFollowUp ? 'pending' : null
        ;(entry as any).followUpPriority = result.priority
        ;(entry as any).recontactDate = result.suggested_recontact_date
            ? new Date(result.suggested_recontact_date)
            : null
        ;(entry as any).followUpDoneAt = null
        ;(entry as any).followUpDoneBy = null

        await entry.save()

        return entry.toObject()
    } catch (err: any) {
        ;(entry as any).analysisStatus = 'error'
        ;(entry as any).analysisError = err?.statusMessage || err?.message || 'Analysis failed'
        await entry.save()
        throw createError({
            statusCode: 502,
            statusMessage: 'No se pudo analizar la conversación',
        })
    }
})
