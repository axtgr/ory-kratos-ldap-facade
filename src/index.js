import ldap from 'ldapjs'

let config = {
  port: Number(process.env.PORT || 1389),
  kratosPublicUrl: process.env.KRATOS_PUBLIC_URL,
  baseDn: process.env.LDAP_BASE_DN,
  usersDn: process.env.LDAP_USERS_DN || 'users',
}

if (!config.kratosPublicUrl) {
  console.error('KRATOS_PUBLIC_URL env variable is required')
  process.exit(1)
}

if (!config.baseDn) {
  console.error('LDAP_BASE_DN env variable is required')
  process.exit(1)
}

async function request(target, method = 'GET', body = undefined) {
  let url = new URL(target, config.kratosPublicUrl)
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
      throw new ldap.OperationsError(response.statusText)
    } else {
      throw new ldap.OperationsError(err.message)
    }
  }

  if (!response.ok) {
    let errorMessage =
      json.error?.reason ||
      json.error?.message ||
      json.ui?.messages?.find((m) => m?.type === 'error')?.text ||
      'Unknown error'

    throw new ldap.OperationsError(errorMessage)
  }

  return json
}

let server = ldap.createServer()

server.bind(`${config.usersDn},${config.baseDn}`, async (req, res, next) => {
  if (req.dn.rdns.length !== 3) {
    return next(new ldap.InvalidCredentialsError())
  }

  let rdn = req.dn.rdns[0]
  let identifier =
    rdn.attrs?.username?.value ||
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

  let flow

  try {
    flow = await request('self-service/login/api')
  } catch (err) {
    return next(err)
  }

  let { action, method = 'POST' } = flow.ui || {}

  if (!action) {
    return next(new ldap.OperationsError('Unrecognized response format'))
  }

  try {
    await request(action, method, { method: 'password', identifier, password })
  } catch (err) {
    return next(err)
  }

  return next()
})

server.listen(config.port, () => {
  console.log(`LDAP server listening at ${server.url}`)
  console.log(`Configuration:\n${JSON.stringify(config, null, 4)}`)
})