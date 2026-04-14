import { defineVitestConfig } from '@nuxt/test-utils/config'
import { resolve } from 'path'

export default defineVitestConfig({
    test: {
        globalSetup: './tests/global-setup.ts',
        setupFiles: ['./tests/setup.ts'],
        testTimeout: 30000,
        // Test files share an in-memory MongoDB instance — run them sequentially
        // to avoid one file's beforeEach clearing another file's live data.
        fileParallelism: false,
    },
    resolve: {
        alias: {
            '#server': resolve('./server'),
            '#nuxt/mongoose': resolve('./tests/mocks/nuxt-mongoose.ts'),
        },
    },
})
