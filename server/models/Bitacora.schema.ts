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
  },
  options: { timestamps: true, collection: 'bitacoras' },
})
