import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body

  if (!username || !password) {
    throw createError({ status: 400, statusText: 'Username and password are required' })
  }

  if (password.length < 8) {
    throw createError({ status: 400, statusText: 'Password must be at least 8 characters' })
  }

  const existing = await User.findOne({ username: username.toLowerCase() })
  if (existing) {
    throw createError({ status: 409, statusText: 'Username already taken' })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await User.create({ username: username.toLowerCase(), passwordHash })

  return { id: user._id, username: user.username }
})
