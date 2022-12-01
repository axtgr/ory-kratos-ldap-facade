import scope from './scope.js'

let { config, server } = scope()()

server.start(() => {
  console.log(`LDAP server listening at ${server.url}`)
  console.log()
  console.log(`Configuration:\n${JSON.stringify(config, null, 4)}`)
})
