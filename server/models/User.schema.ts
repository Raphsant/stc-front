import { defineMongooseModel } from '#nuxt/mongoose'

export const User = defineMongooseModel({
  name: 'User',
  schema: {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
})
