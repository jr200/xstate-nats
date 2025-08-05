import { fromPromise } from 'xstate'
import { ConnectionOptions, credsAuthenticator, Msg, NatsConnection, wsconnect } from '@nats-io/nats-core'
import { KvEntry } from '@nats-io/kv'
import { type AuthConfig } from './types'
import { sendParent } from 'xstate'

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
  async ({ input }: { input: { opts: ConnectionOptions; auth?: AuthConfig } }): Promise<NatsConnection> => {
    const mergedOpts: ConnectionOptions = {
      ...input.opts,
      ...makeAuthConfig(input.auth),
    }
    console.log('CONNECTING TO NATS', mergedOpts)
    const nc = await wsconnect(mergedOpts)

    // bug: self refers to 'this' promise, which is short-lived....
    // TODO: Emit status events into the machine instead
    ;(async () => {
      for await (const status of nc.status()) {
        console.log('Received nats-server status', status)

        switch (status.type) {
          case 'disconnect':
            sendParent({ type: 'DISCONNECTED' })
            break
          case 'reconnect':
            sendParent({ type: 'RECONNECT' })
            break
          case 'error':
            console.log('ERROR', status)
            sendParent({ type: 'FAIL', error: status.error })
            break
          case 'close':
            sendParent({ type: 'CLOSE' })
            break
          case 'ldm':
            console.debug('LDM', status)
            break
          case 'ping':
            console.debug('Received ping, pong sent automatically')
            break
          case 'forceReconnect':
            sendParent({ type: 'RECONNECT' })
            break
          case 'reconnecting':
            sendParent({ type: 'RECONNECTING' })
            break
          case 'slowConsumer':
            console.debug('SLOW_CONSUMER', status)
            break
          case 'staleConnection':
            console.debug('STALE_CONNECTION', status)
            break
          case 'update':
            console.debug('UPDATE', status)
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
