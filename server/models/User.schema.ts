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
    role: {
      type: String,
      // What each role may see of the billing metrics: shared/permissions.ts.
      enum: ['admin', 'finance', 'superadmin'],
      default: 'admin',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
})
