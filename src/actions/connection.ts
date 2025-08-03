import { fromPromise } from 'xstate'
import { ConnectionOptions, credsAuthenticator, Msg, NatsConnection, wsconnect } from '@nats-io/nats-core'
import { KvEntry } from '@nats-io/kv'
import { type AuthConfig } from './types'

const makeAuthConfig = (auth?: AuthConfig) => {
  if (!auth) {
    return {}
  }

  if (auth.type === 'decentralised') {
    const decodedSentinel = atob(auth!.sentinelB64!)
    return {
      authenticator: credsAuthenticator(new TextEncoder().encode(decodedSentinel)),
      user: auth.user,
      pass: auth.pass,
    }
  } else if (auth.type === 'userpass') {
    return {
      user: auth.user,
      pass: auth.pass,
    }
  } else if (auth.type === 'token') {
    return {
      token: auth.token,
    }
  }

  throw new Error(`Unsupported auth config type ${auth.type}`)
}

export const connectToNats = fromPromise(
  async ({
    input,
    self,
  }: {
    input: { opts: ConnectionOptions; auth?: AuthConfig }
    self: any
  }): Promise<NatsConnection> => {
    const mergedOpts: ConnectionOptions = {
      ...input.opts,
      ...makeAuthConfig(input.auth),
    }
    console.log('CONNECTING TO NATS', mergedOpts)
    const nc = await wsconnect(mergedOpts)

    // Emit status events into the machine
    ;(async () => {
      for await (const status of nc.status()) {
        console.log('Received nats-server status', status)

        switch (status.type) {
          case 'disconnect':
            self.send({ type: 'DISCONNECTED' })
            break
          case 'reconnect':
            self.send({ type: 'RECONNECT' })
            break
          case 'error':
            console.log('ERROR', status)
            // self.send({ type: 'FAIL', error: status.error })
            break
          case 'close':
            self.send({ type: 'CLOSE' })
            break
          case 'ldm':
            // self.send({ type: 'LDM' })
            break
          case 'ping':
            console.log('Received ping, sending pong')
            break
          case 'forceReconnect':
            self.send({ type: 'RECONNECT' })
            break
          case 'reconnecting':
            self.send({ type: 'RECONNECTING' })
            break
          case 'slowConsumer':
            // self.send({ type: 'SLOW_CONSUMER' })
            break
          case 'staleConnection':
            // self.send({ type: 'STALE_CONNECTION' })
            break
          case 'update':
            // self.send({ type: 'UPDATE' })
            break
        }
      }
      console.log('END STATUS LOOP')
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
