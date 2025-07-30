import { fromPromise } from "xstate"
import { ConnectionOptions, NatsConnection, wsconnect } from "@nats-io/nats-core"

export const connectToNats = fromPromise(async ({ input, self }: { input: { opts: ConnectionOptions }; self: any }): Promise<NatsConnection> => {
    console.log('CONNECTING TO NATS', input.opts)
    const nc = await wsconnect(input.opts)

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
  })


export const disconnectNats = fromPromise(async ({ input }: { input: { connection: NatsConnection | null } }) => {
  console.log('DISCONNECTING FROM NATS', input)
  if (input.connection) {
    await input.connection.drain()
    await input.connection.close()
  }
})
