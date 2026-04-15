import {defineMongooseModel} from "#nuxt/mongoose";
import mongoose from "mongoose";


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
        zoomLogId: {
            type: mongoose.Schema.Types.ObjectId,
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
