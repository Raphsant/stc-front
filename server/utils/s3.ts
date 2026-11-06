import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let client: S3Client | null = null

function readConfig() {
    const cfg = useRuntimeConfig()
    return {
        region: (cfg.awsRegion as string) || '',
        accessKeyId: (cfg.awsAccessKeyId as string) || '',
        secretAccessKey: (cfg.awsSecretAccessKey as string) || '',
        bucket: (cfg.s3Bucket as string) || '',
    }
}

// Client options that don't depend on runtime config, so they can be asserted
// in a test without a Nuxt context.
//
// Since v3.729 the AWS SDK adds a CRC32 checksum to PutObject by default. For a
// PRESIGNED url that checksum is computed at signing time, when there is no
// body yet — so it bakes in the checksum of an EMPTY payload
// (x-amz-checksum-crc32=AAAAAA==) and S3 then rejects the browser's upload with
// BadDigest. Presigned uploads are already integrity-protected by TLS and by
// the signature, so opt back out.
export const S3_CLIENT_DEFAULTS = {
    requestChecksumCalculation: 'WHEN_REQUIRED',
} as const

function getClient() {
    if (!client) {
        const { region, accessKeyId, secretAccessKey } = readConfig()
        client = new S3Client({
            region,
            credentials: { accessKeyId, secretAccessKey },
            ...S3_CLIENT_DEFAULTS,
        })
    }
    return client
}

function getBucket() {
    const { bucket } = readConfig()
    if (!bucket) {
        throw createError({ statusCode: 500, statusMessage: 'S3 bucket not configured' })
    }
    return bucket
}

export const BITACORA_PREFIX = 'bitacora/'

export const ALLOWED_IMAGE_MIME = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
])

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export function extForMime(mime: string): string {
    switch (mime) {
        case 'image/png': return 'png'
        case 'image/jpeg': return 'jpg'
        case 'image/webp': return 'webp'
        case 'image/gif': return 'gif'
        default: return 'bin'
    }
}

export function isBitacoraKey(key: string, discordUserId: string): boolean {
    if (typeof key !== 'string') return false
    const prefix = `${BITACORA_PREFIX}${discordUserId}/`
    if (!key.startsWith(prefix)) return false
    const rest = key.slice(prefix.length)
    return /^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|gif)$/.test(rest)
}

export async function createUploadUrl(key: string, contentType: string, expiresIn = 60): Promise<string> {
    const cmd = new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        ContentType: contentType,
    })
    return getSignedUrl(getClient(), cmd, { expiresIn })
}

export async function createDownloadUrl(key: string, expiresIn = 300): Promise<string> {
    const cmd = new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
    })
    return getSignedUrl(getClient(), cmd, { expiresIn })
}

// Fetch the raw bytes of an object. Used to feed image data to the AI for
// analysis — the bucket is private, so we pull server-side rather than exposing
// a public URL.
export async function getObjectBuffer(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    const cmd = new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
    })
    const res = await getClient().send(cmd)
    if (!res.Body) {
        throw createError({ statusCode: 502, statusMessage: 'Empty object body from S3' })
    }
    // In the Node runtime the SDK returns a stream with this helper.
    const bytes = await (res.Body as any).transformToByteArray()
    return {
        buffer: Buffer.from(bytes),
        contentType: res.ContentType || 'application/octet-stream',
    }
}
