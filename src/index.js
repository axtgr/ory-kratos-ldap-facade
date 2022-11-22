import ldap from 'ldapjs'

let config = {
  port: Number(process.env.PORT || 1389),
  kratosPublicUrl: process.env.KRATOS_PUBLIC_URL,
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

async function requestKratos(target, method = 'GET', body = undefined) {
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

async function logInKratos(identifier, password) {
  let flow = await requestKratos('self-service/login/api')

  let { action, method = 'POST' } = flow.ui || {}

  if (!action) {
    throw new Error('Unrecognized response format')
  }

  return requestKratos(action, method, { method: 'password', identifier, password })
}

let server = ldap.createServer()

server.bind(`${config.usersDn},${config.baseDn}`, async (req, res, next) => {
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

server.listen(config.port, () => {
  console.log(`LDAP server listening at ${server.url}`)
  console.log(`Configuration:\n${JSON.stringify(config, null, 4)}`)
})
