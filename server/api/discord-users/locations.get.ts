// Country → province → city tree with member counts, for the Usuarios location
// filter. Built from DiscordUser.cfLocation (synced nightly by stcbot) and
// scoped to the same status filter as the list.

type Named = { key: string | null; name: string | null; count: number }
type Bucket = { count: number; names: Map<string, number> }

// Several spellings can share a key (e.g. "Malaga" / "Málaga") — show the most common.
function topName(names: Map<string, number>): string | null {
    let best: string | null = null
    let max = 0
    for (const [name, n] of names) if (n > max) { best = name; max = n }
    return best
}

function bump(map: Map<string, Bucket>, key: string, name: string | null, n: number) {
    const b = map.get(key) ?? { count: 0, names: new Map() }
    b.count += n
    if (name) b.names.set(name, (b.names.get(name) ?? 0) + n)
    map.set(key, b)
}

// Unknown ("Sin provincia") always last, then by count, then alphabetically.
const byCount = (a: Named, b: Named) =>
    Number(a.name === null) - Number(b.name === null) ||
    b.count - a.count ||
    (a.name ?? '').localeCompare(b.name ?? '')

export default defineEventHandler(async (event) => {
    const { status } = getQuery(event)
    const match: any = {}
    if (status === 'active') match.removedAt = null
    if (status === 'removed') match.removedAt = { $ne: null }

    try {
        const rows = await DiscordUser.aggregate([
            { $match: match },
            {
                $group: {
                    _id: {
                        country: '$cfLocation.country',
                        regionKey: '$cfLocation.regionKey',
                        region: '$cfLocation.region',
                        cityKey: '$cfLocation.cityKey',
                        city: '$cfLocation.city',
                    },
                    count: { $sum: 1 },
                },
            },
        ])

        let noneCount = 0
        const countries = new Map<string, { count: number; regions: Map<string, Bucket>; cities: Map<string, Map<string, Bucket>> }>()
        for (const { _id: g, count } of rows) {
            if (!g.country) { noneCount += count; continue }
            const c = countries.get(g.country) ?? { count: 0, regions: new Map(), cities: new Map() }
            c.count += count
            const rk = g.regionKey ?? 'none'
            bump(c.regions, rk, g.region, count)
            if (g.cityKey) {
                if (!c.cities.has(rk)) c.cities.set(rk, new Map())
                bump(c.cities.get(rk)!, g.cityKey, g.city, count)
            }
            countries.set(g.country, c)
        }

        return {
            noneCount,
            countries: [...countries].map(([code, c]) => ({
                code,
                count: c.count,
                regions: [...c.regions].map(([key, r]) => ({
                    key,
                    name: key === 'none' ? null : topName(r.names),
                    count: r.count,
                    cities: [...(c.cities.get(key) ?? [])]
                        .map(([ck, city]) => ({ key: ck, name: topName(city.names), count: city.count }))
                        .sort(byCount),
                })).sort(byCount),
            })).sort((a, b) => b.count - a.count),
        }
    } catch (e: any) {
        console.error(e)
        throw createError({ status: 500, statusText: 'Error fetching locations' })
    }
})
