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
  },
  options: { timestamps: true, collection: 'bitacoras' },
})
