// https://nuxt.com/docs/api/configuration/nuxt-config

import {readFileSync} from "node:fs";

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    future: {
        compatibilityVersion: 4,
    },
    app: {
        head: {
            link: [
                {rel: 'icon', type: 'image/x-icon', href: '/faviconstc.ico'},
                {rel: 'icon', type: 'image/png', href: '/brand/stc-mark.png'},
                {rel: 'apple-touch-icon', href: '/brand/stc-mark.png'},
                {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
                {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: ''},
                {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800;900&family=Inter:wght@400;500;600;700&display=swap'
                },
            ]
        },
        pageTransition: {name: 'page'},
        layoutTransition: {name: 'layout'},
    }, runtimeConfig: {
        awsRegion: process.env.MY_AWS_REGION,
        awsAccessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
        s3Bucket: process.env.S3_BUCKET,
        anthropicApiKey: process.env.NUXT_ANTHROPIC_API_KEY,
        public: {
            appVersion: pkg.version
        }
    },
    devtools: {enabled: true},
    modules: ['@nuxt/ui', 'nuxt-mongoose', 'nuxt-auth-utils', '@nuxt/content'],
    css: ['~/assets/css/main.css'],
    colorMode: {
        preference: 'dark',
        classSuffix: ''
    }, mongoose: {
        uri: '',
        options: {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
            maxPoolSize: 5,
            minPoolSize: 0,
            heartbeatFrequencyMS: 10000,
        },
        modelsDir: "models",
        devtools: true,
    },
})
