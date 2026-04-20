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

            ]
        },
        pageTransition: {name: 'page', mode: 'out-in'},
        layoutTransition: {name: 'layout', mode: 'out-in'},
    }, runtimeConfig: {
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
        uri: process.env.MONGODB_URI,
        options: {},
        modelsDir: "models",
        devtools: true,
    },
})
