import {defineMongooseModel} from '#nuxt/mongoose'

export const ZoomLog = defineMongooseModel({
    name: 'ZoomLog',
    schema: {
        meetingId: {
            type: String,
            required: true,
        },
        occurredAt: {
            type: Date,
            required: true,
        },
        participants: {
            type: [{type: String, ref: 'DiscordUser'}],
            default: [],
            index: true,
        },
        name: {
            type: String,
            required: true,
        }
    },
    options: {
        collection: 'zoomLogs'
    }
})
