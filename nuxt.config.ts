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
            viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
            // PWA: instalable en Android/escritorio (manifest) e iOS (meta apple-*).
            meta: [
                {name: 'theme-color', content: '#000000'},
                {name: 'application-name', content: 'STC Control'},
                {name: 'mobile-web-app-capable', content: 'yes'},
                {name: 'apple-mobile-web-app-capable', content: 'yes'},
                {name: 'apple-mobile-web-app-title', content: 'STC'},
                // Pantalla completa bajo la barra de estado; la topbar compensa con safe-area-inset-top.
                {name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent'},
            ],
            link: [
                {rel: 'manifest', href: '/manifest.webmanifest'},
                {rel: 'icon', type: 'image/x-icon', href: '/faviconstc.ico'},
                {rel: 'icon', type: 'image/png', href: '/brand/stc-mark.png'},
                {rel: 'apple-touch-icon', sizes: '180x180', href: '/icons/apple-touch-icon.png'},
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
        cfToken: process.env.CF2_TOKEN,
        cfWorkspaceId: process.env.WORKSPACE_ID,
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
