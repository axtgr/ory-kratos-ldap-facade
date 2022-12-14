import { scope, singleton } from 'discope'
import pino from 'pino'
import { composeConfig } from './config.js'
import KratosClient from './KratosClient.js'
import LdapServer from './LdapServer.js'

export default scope(() => {
  let config = singleton(() => {
    return composeConfig(process.env)
  })
  let logger = singleton(() => {
    return pino({
      name: 'ory-kratos-ldap-facade',
      level: config().logLevel,
    })
  })
  let kratosClient = singleton(() => {
    let { kratosPublicUrl, kratosAdminUrl, kratosSessionCookie } = config()
    return new KratosClient({
      publicApiUrl: kratosPublicUrl,
      adminApiUrl: kratosAdminUrl,
      sessionCookie: kratosSessionCookie,
    })
  })
  let server = singleton(() => {
    let { port, identitiesDn, protectedSearch, allowSessionTokenAsPassword } = config()
    return new LdapServer({
      port,
      identitiesDn,
      protectedSearch,
      allowSessionTokenAsPassword,
      kratosClient: kratosClient(),
      logger: logger(),
    })
  })
  return { config, server }
})
