import { defineMongooseModel } from '#nuxt/mongoose'

export const Bitacora = defineMongooseModel({
  name: 'Bitacora',
  schema: {
    discordUserId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['text', 'image'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    adminId: {
      type: String,
      required: true,
    },
    adminUsername: {
      type: String,
      required: true,
    },
    markedForDeletion: {
      type: Boolean,
      default: false,
      index: true,
    },
    markedForDeletionAt: {
      type: Date,
      default: null,
    },
    markedForDeletionBy: {
      type: String,
      default: null,
    },
    // AI analysis of image entries (Discord chat screenshots). Populated on
    // demand via POST .../journal/[entryId]/analyze. See server/utils/ai.ts.
    analysisStatus: {
      type: String,
      enum: ['none', 'pending', 'done', 'error'],
      default: 'none',
      index: true,
    },
    analysisResult: {
      // DeltaAnalysisResult (see shared/deltaAnalysis.ts) — the immutable
      // artifact of one analysis run. Object maps to Mongoose's Mixed type, so
      // it stores the result as-is and needs no migration when the prompt
      // schema evolves. Entries analyzed before the Delta rewrite carry the old
      // { summary, sentiment, painPoints } shape and no schema_version; queries
      // gate on 'analysisResult.schema_version' to exclude them.
      type: Object,
      default: null,
    },
    analyzedAt: {
      type: Date,
      default: null,
    },
    analysisError: {
      type: String,
      default: null,
    },
    // Follow-up workflow state, promoted out of analysisResult so it can be
    // indexed, sorted and mutated by the team. analysisResult.status stays
    // 'pending' forever (it describes the AI run) — THIS is the source of truth.
    // null = not in the queue (never analyzed, or action_type no_action_needed).
    followUpStatus: {
      type: String,
      enum: ['pending', 'done', null],
      default: null,
      index: true,
    },
    followUpPriority: {
      type: String,
      enum: ['high', 'medium', 'low', null],
      default: null,
    },
    recontactDate: {
      type: Date,
      default: null,
    },
    followUpDoneAt: {
      type: Date,
      default: null,
    },
    followUpDoneBy: {
      type: String,
      default: null,
    },
  },
  options: { timestamps: true, collection: 'bitacoras' },
})
