import { defineMongooseModel } from '#nuxt/mongoose'

export const MessageActivity = defineMongooseModel({
    name: 'MessageActivity',
    schema: {
        userId: {
            type: String,
            ref: 'DiscordUser',
            required: true,
            index: true,
        },
        date: {
            type: Date,
            required: true,
        },
        channelId: {
            type: String,
            required: true,
        },
        channelName: {
            type: String,
        },
        count: {
            type: Number,
            required: true,
            default: 0,
        },
        charSum: {
            type: Number,
            required: true,
            default: 0,
        },
        lastMessageAt: {
            type: Date,
        },
    },
    options: {
        collection: 'messageActivity',
    },
    hooks(schema) {
        schema.index({ userId: 1, date: 1, channelId: 1 }, { unique: true })
    },
})
