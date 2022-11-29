import ldap from 'ldapjs'

if (!process.env.KRATOS_PUBLIC_URL) {
  console.error('KRATOS_PUBLIC_URL env variable is required')
  process.exit(1)
}

if (!process.env.KRATOS_ADMIN_URL) {
  console.warn("KRATOS_ADMIN_URL is not set. Search requests won't work")
}

let config = {
  port: Number(process.env.PORT || 1389),
  kratosPublicUrl: process.env.KRATOS_PUBLIC_URL,
  kratosAdminUrl: process.env.KRATOS_ADMIN_URL,
  ldapIdentitiesDn: process.env.LDAP_IDENTITIES_DN || 'ou=identities',
}

/**
 * Returns true if a given trait is defined as an Ory Kratos identifier
 */
function isIdentifierTrait(trait) {
  trait = trait.items || trait
  return trait?.['ory.sh/kratos']?.credentials?.password?.identifier === true
}

/**
 * Returns an array of trait keys defined as Ory Kratos identifiers
 */
function getIdentifierTraitsForSchema(schema) {
  return Object.entries(schema.properties?.traits?.properties || {})
    .filter(([, trait]) => isIdentifierTrait(trait))
    .map(([key]) => key)
}

/**
 * Returns the value of the first valid identifier in a given identity
 */
function getIdentityIdentifier(identity, schema) {
  let identifierTraits = getIdentifierTraitsForSchema(schema)

  for (let identifierTrait of identifierTraits) {
    let rawValue = identity.traits[identifierTrait]
    let value = Array.isArray(rawValue) ? rawValue[0] : rawValue

    if (value) {
      return value
    }
  }
}

/**
 * Converts a Kratos identity into an LDAP entry
 */
function identityToLdapEntry(identity, schema) {
  let identifier = getIdentityIdentifier(identity, schema)

  if (!identifier) {
    return
  }

  return {
    dn: `identifier=${identifier},${config.ldapIdentitiesDn}`,
    attributes: {
      id: identity.id,
      schema_id: identity.schema_id,
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

async function fetchIdentities() {
  return requestAdminApi('identities')
}

async function fetchSchemas() {
  let schemas = await requestPublicApi('schemas')
  return schemas.reduce((result, { id, schema }) => {
    // Not sure why, but sometimes schemas are returned encoded in Base64, and sometimes not.
    schema =
      typeof schema === 'string'
        ? JSON.parse(Buffer.from(schema, 'base64').toString('utf-8'))
        : schema
    result[id] = schema
    return result
  }, {})
}

let server = ldap.createServer()

server.bind(config.ldapIdentitiesDn, async (req, res, next) => {
  let rdn = req.dn.rdns[0]
  let identifier = rdn.attrs?.identifier?.value
  let password = req.credentials

  if (!identifier) {
    return next(
      new ldap.InvalidCredentialsError(
        `RDN must include a non-empty "identifier" attribute ("identifier=VALUE"). The provided RDN was "${rdn.toString()}"`
      )
    )
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

server.search(config.ldapIdentitiesDn, [isAuthenticated], async (req, res, next) => {
  let schemas, identities

  try {
    ;[schemas, identities] = await Promise.all([fetchSchemas(), fetchIdentities()])
  } catch (err) {
    return next(new ldap.OperationsError(err.message))
  }

  identities
    .filter((identity) => schemas[identity.schema_id])
    .map((identity) => identityToLdapEntry(identity, schemas[identity.schema_id]))
    .filter((entry) => entry && req.filter.matches(entry.attributes))
    .forEach((entry) => res.send(entry))

  res.end()
  return next()
})

server.listen(config.port, () => {
  console.log(`LDAP server listening at ${server.url}`)
  console.log()
  console.log(`Configuration:\n${JSON.stringify(config, null, 4)}`)
})
