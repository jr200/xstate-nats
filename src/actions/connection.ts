import { fromPromise } from 'xstate'
import { ConnectionOptions, credsAuthenticator, Msg, NatsConnection, wsconnect } from '@nats-io/nats-core'
import { KvEntry } from '@nats-io/kv'
import { type AuthConfig } from './types'

const makeAuthConfig = (authConfig?: AuthConfig) => {
  if (!authConfig) {
    return {}
  }

  if (authConfig.type === 'decentralised') {
    return {
      authenticator: credsAuthenticator(new TextEncoder().encode(authConfig.sentinel)),
      user: authConfig.user,
      pass: authConfig.pass,
    }
  }

  throw new Error(`Unsupported auth config type ${authConfig.type}`)
}

export const connectToNats = fromPromise(
  async ({
    input,
    self,
  }: {
    input: { opts: ConnectionOptions; authConfig?: AuthConfig }
    self: any
  }): Promise<NatsConnection> => {
    const mergedOpts = { ...input.opts, ...makeAuthConfig(input.authConfig) }
    console.log('CONNECTING TO NATS', mergedOpts)
    const nc = await wsconnect(mergedOpts)

    // Emit status events into the machine
    ;(async () => {
      for await (const status of nc.status()) {
        switch (status.type) {
          case 'disconnect':
            self.send({ type: 'DISCONNECTED' })
            break
          case 'reconnect':
            self.send({ type: 'RECONNECT' })
            break
          case 'error':
            self.send({ type: 'FAIL', error: status.error })
            break
          case 'close':
            self.send({ type: 'CLOSE' })
            break
          case 'ldm':
            self.send({ type: 'LDM' })
            break
          case 'ping':
            self.send({ type: 'PING' })
            console.log('PING', status)
            break
          case 'forceReconnect':
            self.send({ type: 'RECONNECT' })
            break
          case 'reconnecting':
            self.send({ type: 'RECONNECTING' })
            break
          case 'slowConsumer':
            self.send({ type: 'SLOW_CONSUMER' })
            break
          case 'staleConnection':
            self.send({ type: 'STALE_CONNECTION' })
            break
          case 'update':
            self.send({ type: 'UPDATE' })
            break
        }
      }
    })()

    return nc
  }
)

export const disconnectNats = fromPromise(async ({ input }: { input: { connection: NatsConnection | null } }) => {
  if (input.connection) {
    await input.connection.drain()
    await input.connection.close()
  }
})

export const parseNatsResult = (msg: Msg | KvEntry | null | Error) => {
  if (!msg) {
    return null
  }

  if (msg instanceof Error) {
    return msg
  }

  let data
  try {
    data = msg.json()
  } catch (jsonError) {
    // If JSON parsing fails, use the raw string
    data = msg.string()
  }
  return data
}
