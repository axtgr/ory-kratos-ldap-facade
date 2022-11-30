import pino from 'pino'
import { startLdapServer } from './server.js'
import * as config from './config.js'

let logger = pino({ name: 'ory-kratos-ldap-facade', level: config.logLevel })

startLdapServer(logger, (server) => {
  console.log(`LDAP server listening at ${server.url}`)
  console.log()
  console.log(`Configuration:\n${JSON.stringify(config, null, 4)}`)
})
