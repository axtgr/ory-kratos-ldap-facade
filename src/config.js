function stringToBoolean(value) {
  return ['true', 'yes', 'on', '1'].includes(value?.toLowerCase())
}

function composeConfig(envVars) {
  if (!envVars.KRATOS_PUBLIC_URL) {
    console.error('KRATOS_PUBLIC_URL env variable is required')
    process.exit(1)
  }

  if (!envVars.KRATOS_ADMIN_URL) {
    console.warn("KRATOS_ADMIN_URL is not set. Search requests won't work")
  }

  /** Log level to use (one of 'fatal', 'error', 'warn', 'info', 'debug', 'trace' or 'silent') */
  let logLevel =
    envVars.LOG_LEVEL || (envVars.NODE_ENV === 'production' ? 'error' : 'debug')

  /** Port to start the LDAP server at */
  let port = Number(envVars.PORT || 1389)

  /** LDAP DN to use as a base for all identities  */
  let identitiesDn = envVars.IDENTITIES_DN || 'ou=identities'

  /** Whether to require authentication for search requests */
  let protectedSearch = stringToBoolean(envVars.PROTECTED_SEARCH)

  /** Whether to allow passing a session token instead of a password when binding */
  let allowSessionTokenAsPassword = stringToBoolean(
    envVars.ALLOW_SESSION_TOKEN_AS_PASSWORD
  )

  /** Kratos's session cookie name used to pass a session token */
  let kratosSessionCookie = envVars.KRATOS_SESSION_COOKIE

  /** Kratos's public API URL */
  let kratosPublicUrl = envVars.KRATOS_PUBLIC_URL

  /** Kratos's admin API URL */
  let kratosAdminUrl = envVars.KRATOS_ADMIN_URL

  return {
    port,
    logLevel,
    identitiesDn,
    protectedSearch,
    allowSessionTokenAsPassword,
    kratosSessionCookie,
    kratosPublicUrl,
    kratosAdminUrl,
  }
}

export { composeConfig }
