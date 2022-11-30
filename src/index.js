import { startLdapServer } from './server'
import * as config from './config'

startLdapServer((server) => {
  console.log(`LDAP server listening at ${server.url}`)
  console.log()
  console.log(`Configuration:\n${JSON.stringify(config, null, 4)}`)
})
