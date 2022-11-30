import ldap from 'ldapjs'
import { port, identitiesDn, protectedSearch } from './config'
import { logInKratos, fetchIdentities, fetchSchemas } from './kratosClient'
import { identityToLdapEntry } from './helpers'

/**
 * Checks if a request is authenticated (bound)
 */
function isAuthenticated(req, res, next) {
  if (req.connection.ldap.bindDN.equals('cn=anonymous')) {
    return next(new ldap.InsufficientAccessRightsError())
  }

  return next()
}

/**
 * Handles LDAP bind requests
 */
async function bind(req, res, next) {
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
}

/**
 * Handles LDAP search requests
 */
async function search(req, res, next) {
  let schemas, identities

  try {
    ;[schemas, identities] = await Promise.all([fetchSchemas(), fetchIdentities()])
  } catch (err) {
    return next(new ldap.OperationsError(err.message))
  }

  identities
    .filter((identity) => schemas[identity.schema_id])
    .map((identity) => {
      return identityToLdapEntry(identity, schemas[identity.schema_id], identitiesDn)
    })
    .filter((entry) => entry && req.filter.matches(entry.attributes))
    .forEach((entry) => res.send(entry))

  res.end()
  return next()
}

function startLdapServer(logger, cb) {
  let server = ldap.createServer({ log: logger })
  server.bind(identitiesDn, bind)
  server.search(identitiesDn, protectedSearch ? [isAuthenticated] : [], search)
  server.listen(port, () => cb(server))
}

export { startLdapServer }
