export interface AuthConfig {
  type: 'decentralised' | 'userpass' | 'token'
  sentinelB64?: string
  user?: string
  pass?: string
  token?: string
}
