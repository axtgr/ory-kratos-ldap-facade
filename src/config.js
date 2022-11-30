if (!process.env.KRATOS_PUBLIC_URL) {
  console.error('KRATOS_PUBLIC_URL env variable is required')
  process.exit(1)
}

if (!process.env.KRATOS_ADMIN_URL) {
  console.warn("KRATOS_ADMIN_URL is not set. Search requests won't work")
}

/** Port to start the LDAP server at */
let port = Number(process.env.PORT || 1389)

/** Kratos's public API URL */
let kratosPublicUrl = process.env.KRATOS_PUBLIC_URL

/** Kratos's admin API URL */
let kratosAdminUrl = process.env.KRATOS_ADMIN_URL

/** LDAP DN to use as a base for all identities  */
let ldapIdentitiesDn = process.env.LDAP_IDENTITIES_DN || 'ou=identities'

export { port, kratosPublicUrl, kratosAdminUrl, ldapIdentitiesDn }
