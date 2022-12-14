class KratosClient {
  constructor({ publicApiUrl, adminApiUrl, sessionCookie = 'ory_kratos_session' }) {
    this.publicApiUrl = publicApiUrl
    this.adminApiUrl = adminApiUrl
    this.sessionCookie = sessionCookie
  }

  /**
   * Sends an HTTP request to Kratos
   */
  async _request(base, target, method = 'GET', body = undefined, headers = undefined) {
    let url = new URL(target, base)
    let response = await fetch(url, {
      method,
      body: JSON.stringify(body),
      headers: {
        ...headers,
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
  async requestPublicApi(
    target,
    method = 'GET',
    body = undefined,
    headers = undefined
  ) {
    return this._request(this.publicApiUrl, target, method, body, headers)
  }

  /**
   * Requests Kratos's admin API
   */
  async requestAdminApi(target, method = 'GET', body = undefined, headers = undefined) {
    return this._request(this.adminApiUrl, target, method, body, headers)
  }

  /**
   * Logs into Kratos using the self-service login flow
   */
  async logIn(identifier, password) {
    let flow = await this.requestPublicApi('self-service/login/api')

    let { action, method = 'POST' } = flow.ui || {}

    if (!action) {
      throw new Error('Unrecognized response format')
    }

    return this.requestPublicApi(action, method, {
      method: 'password',
      identifier,
      password,
    })
  }

  /**
   * Retrieves all existing identities from Kratos
   */
  async fetchIdentities() {
    return this.requestAdminApi('identities')
  }

  /**
   * Retrieves identity schemas from Kratos
   */
  async fetchSchemas() {
    let schemas = await this.requestPublicApi('schemas')
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

  /**
   * Retrieves a session by its token
   */
  async whoami(sessionToken) {
    return this.requestPublicApi('sessions/whoami', 'GET', undefined, {
      Cookie: `${this.sessionCookie}=${sessionToken}`,
    })
  }
}

export default KratosClient
