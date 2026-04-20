// https://nuxt.com/docs/api/configuration/nuxt-config
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
