function stringToBoolean(value) {
  return ['true', 'yes', 'on', '1'].includes(value.toLowerCase())
}

if (!process.env.KRATOS_PUBLIC_URL) {
  console.error('KRATOS_PUBLIC_URL env variable is required')
  process.exit(1)
}

if (!process.env.KRATOS_ADMIN_URL) {
  console.warn("KRATOS_ADMIN_URL is not set. Search requests won't work")
}

/** Log level to use (one of 'fatal', 'error', 'warn', 'info', 'debug', 'trace' or 'silent') */
let logLevel =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'debug')

/** Port to start the LDAP server at */
let port = Number(process.env.PORT || 1389)

/** LDAP DN to use as a base for all identities  */
let identitiesDn = process.env.IDENTITIES_DN || 'ou=identities'

/** Whether to require authentication for search requests */
let protectedSearch = stringToBoolean(process.env.PROTECTED_SEARCH)

/** Kratos's public API URL */
let kratosPublicUrl = process.env.KRATOS_PUBLIC_URL

/** Kratos's admin API URL */
let kratosAdminUrl = process.env.KRATOS_ADMIN_URL

export {
  logLevel,
  port,
  identitiesDn,
  protectedSearch,
  kratosPublicUrl,
  kratosAdminUrl,
}
