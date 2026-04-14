import mongoose, { Schema } from 'mongoose'

export function defineMongooseModel({ name, schema, options }: {
    name: string
    schema: Record<string, any>
    options?: Record<string, any>
}) {
    if (mongoose.models[name]) {
        return mongoose.models[name]
    }
    return mongoose.model(name, new Schema(schema, options))
}
