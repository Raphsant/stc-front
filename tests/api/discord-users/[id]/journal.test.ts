import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

vi.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed-get-url'),
}))

// Signing needs Nuxt runtime config, which isn't available here — stub it so
// each key maps to a recognisable URL.
vi.mock('#server/utils/s3', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    createDownloadUrl: vi.fn(async (key: string) => `https://signed.example/${key}`),
}))

let getHandler: (event: any) => Promise<any>
let postHandler: (event: any) => Promise<any>
let Bitacora: any
let DiscordUser: any

const getUserSession = vi.fn()

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ Bitacora } = await import('#server/models/Bitacora.schema'))
    //@ts-ignore
    ;({ DiscordUser } = await import('#server/models/DiscordUser.schema'))
    vi.stubGlobal('Bitacora', Bitacora)
    vi.stubGlobal('DiscordUser', DiscordUser)
    vi.stubGlobal('getUserSession', getUserSession)

    const getMod = await import('#server/api/discord-users/[id]/journal.get')
    const postMod = await import('#server/api/discord-users/[id]/journal.post')
    getHandler = getMod.default as any
    postHandler = postMod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

beforeEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
    )
    vi.mocked(globalThis.getRouterParam).mockReset()
    vi.mocked(globalThis.readBody).mockReset()
    getUserSession.mockReset()
})

describe('GET /api/discord-users/:id/journal', () => {
    it('returns an empty array when there are no entries', async () => {
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-1')
        const result = await getHandler({})
        expect(result).toEqual([])
    })

    it('returns entries for the user sorted by createdAt desc', async () => {
        await Bitacora.create({
            discordUserId: 'u-1', type: 'text', content: 'first',
            adminId: 'a-1', adminUsername: 'admin1', createdAt: new Date('2025-01-01'),
        })
        await Bitacora.create({
            discordUserId: 'u-1', type: 'text', content: 'second',
            adminId: 'a-1', adminUsername: 'admin1', createdAt: new Date('2025-02-01'),
        })

        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-1')
        const result = await getHandler({})

        expect(result).toHaveLength(2)
        expect(result[0].content).toBe('second')
        expect(result[1].content).toBe('first')
    })

    it('scopes results to the requested discord user', async () => {
        await Bitacora.create({
            discordUserId: 'u-1', type: 'text', content: 'mine',
            adminId: 'a-1', adminUsername: 'admin1',
        })
        await Bitacora.create({
            discordUserId: 'u-2', type: 'text', content: 'other',
            adminId: 'a-1', adminUsername: 'admin1',
        })

        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-1')
        const result = await getHandler({})

        expect(result).toHaveLength(1)
        expect(result[0].content).toBe('mine')
    })

    it('returns one signed URL per screenshot of a multi-image entry', async () => {
        await Bitacora.create({
            discordUserId: 'u-1', type: 'image', content: 'bitacora/u-1/a.png',
            images: ['bitacora/u-1/a.png', 'bitacora/u-1/b.png'],
            adminId: 'a-1', adminUsername: 'admin1',
        })

        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-1')
        const [entry] = await getHandler({})

        expect(entry.imageUrls).toEqual([
            'https://signed.example/bitacora/u-1/a.png',
            'https://signed.example/bitacora/u-1/b.png',
        ])
        expect(entry.imageUrl).toBe(entry.imageUrls[0])
    })

    it('returns a single-item imageUrls for a legacy image entry', async () => {
        await Bitacora.create({
            discordUserId: 'u-1', type: 'image', content: 'bitacora/u-1/old.png',
            adminId: 'a-1', adminUsername: 'admin1',
        })

        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-1')
        const [entry] = await getHandler({})

        expect(entry.imageUrls).toEqual(['https://signed.example/bitacora/u-1/old.png'])
        expect(entry.imageUrl).toBe('https://signed.example/bitacora/u-1/old.png')
    })

    it('throws 400 when id is missing', async () => {
        vi.mocked(globalThis.getRouterParam).mockReturnValue(undefined)
        await expect(getHandler({})).rejects.toMatchObject({ statusCode: 400 })
    })
})

describe('POST /api/discord-users/:id/journal', () => {
    beforeEach(async () => {
        await DiscordUser.create({ _id: 'u-10', username: 'targetuser', roles: [] })
    })

    it('creates a text entry with admin metadata', async () => {
        getUserSession.mockResolvedValue({ user: { id: 'a-99', username: 'sysadmin' } })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')
        vi.mocked(globalThis.readBody).mockResolvedValue({ type: 'text', content: '  hello there  ' })

        const result = await postHandler({})

        expect(result.discordUserId).toBe('u-10')
        expect(result.type).toBe('text')
        expect(result.content).toBe('hello there')
        expect(result.adminId).toBe('a-99')
        expect(result.adminUsername).toBe('sysadmin')
        expect(result.createdAt).toBeTruthy()

        const persisted = await Bitacora.find({ discordUserId: 'u-10' }).lean()
        expect(persisted).toHaveLength(1)
    })

    it('rejects unauthenticated requests with 401', async () => {
        getUserSession.mockResolvedValue(null)
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')
        vi.mocked(globalThis.readBody).mockResolvedValue({ type: 'text', content: 'hi' })

        await expect(postHandler({})).rejects.toMatchObject({ statusCode: 401 })
    })

    it('rejects empty content with 400', async () => {
        getUserSession.mockResolvedValue({ user: { id: 'a-1', username: 'admin' } })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')
        vi.mocked(globalThis.readBody).mockResolvedValue({ type: 'text', content: '   ' })

        await expect(postHandler({})).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects unknown type with 400', async () => {
        getUserSession.mockResolvedValue({ user: { id: 'a-1', username: 'admin' } })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')
        vi.mocked(globalThis.readBody).mockResolvedValue({ type: 'audio', content: 'hi' })

        await expect(postHandler({})).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects image entry with invalid key (wrong prefix)', async () => {
        getUserSession.mockResolvedValue({ user: { id: 'a-1', username: 'admin' } })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')
        vi.mocked(globalThis.readBody).mockResolvedValue({ type: 'image', content: 'evil/u-10/foo.png' })

        await expect(postHandler({})).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects image entry whose key targets a different user', async () => {
        getUserSession.mockResolvedValue({ user: { id: 'a-1', username: 'admin' } })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')
        vi.mocked(globalThis.readBody).mockResolvedValue({
            type: 'image',
            content: 'bitacora/u-99/abc.png',
        })

        await expect(postHandler({})).rejects.toMatchObject({ statusCode: 400 })
    })

    it('accepts image entry with a valid bitacora key', async () => {
        getUserSession.mockResolvedValue({ user: { id: 'a-1', username: 'admin' } })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')
        vi.mocked(globalThis.readBody).mockResolvedValue({
            type: 'image',
            content: 'bitacora/u-10/abc-123.png',
        })

        const result = await postHandler({})
        expect(result.type).toBe('image')
        expect(result.content).toBe('bitacora/u-10/abc-123.png')
        expect(result.images).toEqual(['bitacora/u-10/abc-123.png'])
    })

    it('stores several images on one entry, in the order given', async () => {
        getUserSession.mockResolvedValue({ user: { id: 'a-1', username: 'admin' } })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')
        const images = ['bitacora/u-10/one.png', 'bitacora/u-10/two.jpg', 'bitacora/u-10/three.webp']
        vi.mocked(globalThis.readBody).mockResolvedValue({ type: 'image', images })

        const result = await postHandler({})

        expect(result.images).toEqual(images)
        expect(result.content).toBe(images[0])
        expect(await Bitacora.countDocuments({ discordUserId: 'u-10' })).toBe(1)
    })

    it('rejects more than the maximum number of images with 400', async () => {
        getUserSession.mockResolvedValue({ user: { id: 'a-1', username: 'admin' } })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')
        vi.mocked(globalThis.readBody).mockResolvedValue({
            type: 'image',
            images: Array.from({ length: 7 }, (_, i) => `bitacora/u-10/img-${i}.png`),
        })

        await expect(postHandler({})).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects the whole entry if any image key is invalid or repeated', async () => {
        getUserSession.mockResolvedValue({ user: { id: 'a-1', username: 'admin' } })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')

        for (const images of [
            ['bitacora/u-10/ok.png', 'bitacora/u-99/other-user.png'],
            ['bitacora/u-10/ok.png', 'bitacora/u-10/ok.png'],
            [],
        ]) {
            vi.mocked(globalThis.readBody).mockResolvedValue({ type: 'image', images })
            await expect(postHandler({})).rejects.toMatchObject({ statusCode: 400 })
        }
        expect(await Bitacora.countDocuments({})).toBe(0)
    })

    it('returns 404 when target discord user does not exist', async () => {
        getUserSession.mockResolvedValue({ user: { id: 'a-1', username: 'admin' } })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('ghost')
        vi.mocked(globalThis.readBody).mockResolvedValue({ type: 'text', content: 'hi' })

        await expect(postHandler({})).rejects.toMatchObject({ statusCode: 404 })
    })
})
