import { kratosPublicUrl, kratosAdminUrl } from './config'

/**
 * Sends an HTTP request to Kratos
 */
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

/**
 * Requests Kratos's public API
 */
async function requestPublicApi(target, method = 'GET', body = undefined) {
  return requestKratos(kratosPublicUrl, target, method, body)
}

/**
 * Requests Kratos's admin API
 */
async function requestAdminApi(target, method = 'GET', body = undefined) {
  return requestKratos(kratosAdminUrl, target, method, body)
}

/**
 * Logs into Kratos using the self-service login flow
 */
async function logInKratos(identifier, password) {
  let flow = await requestPublicApi('self-service/login/api')

  let { action, method = 'POST' } = flow.ui || {}

  if (!action) {
    throw new Error('Unrecognized response format')
  }

  return requestPublicApi(action, method, { method: 'password', identifier, password })
}

/**
 * Retrieves all existing identities from Kratos
 */
async function fetchIdentities() {
  return requestAdminApi('identities')
}

/**
 * Retrieves identity schemas from Kratos
 */
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

export { logInKratos, fetchIdentities, fetchSchemas }
