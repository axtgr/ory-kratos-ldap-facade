import ldap from 'ldapjs'

let config = {
  port: Number(process.env.PORT || 1389),
  kratosPublicUrl: process.env.KRATOS_PUBLIC_URL,
  kratosAdminUrl: process.env.KRATOS_ADMIN_URL,
  baseDn: process.env.LDAP_BASE_DN,
  usersDn: process.env.LDAP_USERS_DN || 'users',
  idAttribute: process.env.LDAP_ID_ATTRIBUTE,
}

if (!config.kratosPublicUrl) {
  console.error('KRATOS_PUBLIC_URL env variable is required')
  process.exit(1)
}

if (!config.baseDn) {
  console.error('LDAP_BASE_DN env variable is required')
  process.exit(1)
}

if (!config.kratosAdminUrl) {
  console.warn("KRATOS_ADMIN_URL is not set. Search requests won't work")
}

const USERS_DN = `${config.usersDn},${config.baseDn}`

/**
 * Converts a Kratos identity into an LDAP entry
 */
function identityToLdapEntry(identity) {
  return {
    dn: `id=${identity.id},${USERS_DN}`,
    attributes: {
      id: identity.id,
      uid: identity.id,
      schemaId: identity.schema_id,
      objectClass: identity.schema_id,
      ...identity.traits,
    },
  }
}

/**
 * Checks if a request is authenticated (bound)
 */
function isAuthenticated(req, res, next) {
  if (req.connection.ldap.bindDN.equals('cn=anonymous')) {
    return next(new ldap.InsufficientAccessRightsError())
  }

  return next()
}

async function requestKratos(base, target, method = 'GET', body = undefined) {
  let url = new URL(target, base)
  let response = await fetch(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
  let json

  try {
    json = await response.json()
  } catch (err) {
    if (!response.ok) {
      throw new Error(response.statusText)
    } else {
      throw new Error(err.message)
    }
  }

  if (!response.ok) {
    let errorMessage =
      json.error?.reason ||
      json.error?.message ||
      json.ui?.messages?.find((m) => m?.type === 'error')?.text ||
      'Unknown error'
    throw new Error(errorMessage)
  }

  return json
}

async function requestPublicApi(target, method = 'GET', body = undefined) {
  return requestKratos(config.kratosPublicUrl, target, method, body)
}

async function requestAdminApi(target, method = 'GET', body = undefined) {
  return requestKratos(config.kratosAdminUrl, target, method, body)
}

async function logInKratos(identifier, password) {
  let flow = await requestPublicApi('self-service/login/api')

  let { action, method = 'POST' } = flow.ui || {}

  if (!action) {
    throw new Error('Unrecognized response format')
  }

  return requestPublicApi(action, method, { method: 'password', identifier, password })
}

let server = ldap.createServer()

server.bind(USERS_DN, async (req, res, next) => {
  if (req.dn.rdns.length !== 3) {
    return next(new ldap.InvalidCredentialsError())
  }

  let rdn = req.dn.rdns[0]
  let identifier = config.idAttribute
    ? rdn.attrs?.[config.idAttribute]?.value
    : rdn.attrs?.username?.value ||
      rdn.attrs?.uid?.value ||
      rdn.attrs?.cn?.value ||
      rdn.attrs?.sAMAccountName?.value ||
      rdn.attrs?.email?.value ||
      rdn.attrs?.mail?.value
  let password = req.credentials

  if (!identifier) {
    return next(new ldap.InvalidCredentialsError('An identifier attribute is required'))
  }

  if (!password) {
    return next(new ldap.InvalidCredentialsError('Password is required'))
  }

  try {
    await logInKratos(identifier, password)
  } catch (err) {
    return next(new ldap.OperationsError(err.message))
  }

  res.end()
  return next()
})

server.search(USERS_DN, [isAuthenticated], async (req, res, next) => {
  let identities

  try {
    identities = await requestAdminApi('identities')
  } catch (err) {
    return next(new ldap.OperationsError(err.message))
  }

  identities
    .map((identity) => identityToLdapEntry(identity))
    .filter((entry) => req.filter.matches(entry.attributes))
    .forEach((entry) => res.send(entry))

  res.end()
  return next()
})

server.listen(config.port, () => {
  console.log(`LDAP server listening at ${server.url}`)
  console.log(`Configuration:\n${JSON.stringify(config, null, 4)}`)
})
