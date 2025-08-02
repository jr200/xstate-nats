export interface AuthConfig {
  type: 'decentralised' | 'userpass' | 'token'
  sentinel?: string
  user?: string
  pass?: string
  token?: string
}
