import ldap from 'ldapjs'
import { identityToLdapEntry } from './helpers.js'

/**
 * Checks if a request is authenticated (bound)
 */
function isAuthenticated(req, res, next) {
  if (req.connection.ldap.bindDN.equals('cn=anonymous')) {
    return next(new ldap.InsufficientAccessRightsError())
  }

  return next()
}

class LdapServer {
  constructor(options) {
    this.logger = options.logger
    this.kratosClient = options.kratosClient
    this.identitiesDn = options.identitiesDn
    this.protectedSearch = options.protectedSearch
    this.port = options.port
  }

  /**
   * Handles LDAP bind requests
   */
  async _bind(req, res, next) {
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
      await this.kratosClient.logIn(identifier, password)
    } catch (err) {
      return next(new ldap.OperationsError(err.message))
    }

    res.end()
    return next()
  }

  /**
   * Handles LDAP search requests
   */
  async _search(req, res, next) {
    let schemas, identities

    try {
      ;[schemas, identities] = await Promise.all([
        this.kratosClient.fetchSchemas(),
        this.kratosClient.fetchIdentities(),
      ])
    } catch (err) {
      return next(new ldap.OperationsError(err.message))
    }

    identities
      .filter((identity) => schemas[identity.schema_id])
      .map((identity) => {
        return identityToLdapEntry(
          identity,
          schemas[identity.schema_id],
          this.identitiesDn
        )
      })
      .filter((entry) => entry && req.filter.matches(entry.attributes))
      .forEach((entry) => res.send(entry))

    res.end()
    return next()
  }

  start(cb) {
    let server = ldap.createServer({ log: this.logger })
    server.bind(this.identitiesDn, this._bind.bind(this))
    server.search(
      this.identitiesDn,
      this.protectedSearch ? [isAuthenticated] : [],
      this._search.bind(this)
    )
    server.listen(this.port, cb)
  }
}

export default LdapServer
