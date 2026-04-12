import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body

  if (!username || !password) {
    throw createError({ status: 400, statusText: 'Username and password are required' })
  }

  const user = await User.findOne({ username: username.toLowerCase() })
  if (!user) {
    throw createError({ status: 401, statusText: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw createError({ status: 401, statusText: 'Invalid credentials' })
  }

  await setUserSession(event, {
    user: {
      id: String(user._id),
      username: user.username,
    },
  })

  return { username: user.username }
})
