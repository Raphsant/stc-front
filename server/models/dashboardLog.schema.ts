import {defineMongooseModel} from "#nuxt/mongoose";


export const DashBoardLog = defineMongooseModel({
    name: 'DashBoardLog',
    schema: {
        userId: {
            type: String,
            ref: 'DiscordUser',
            index: true,
            required: true,
        },
        occurredAt: {
            type: Date,
            required: true,
        },
        logType: {
            type: [String],
            required: true,
            enum: ['zoom-register', 'zoom-refresh', 'discord-command', 'discord-moderation', 'clickfunnels']
        },
        meetingId:{
            type: String,
            required: false,
            ref: 'ZoomLog',
        },
        count: {
            type: Number,
            required: true,
            default: 1,
        }
    }
})
