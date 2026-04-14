import { defineEventHandler, createError } from 'h3'
import { vi } from 'vitest'

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('getQuery', vi.fn().mockReturnValue({}))
vi.stubGlobal('getRouterParam', vi.fn())
vi.stubGlobal('$fetch', vi.fn())
