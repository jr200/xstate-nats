import { NatsConnection, Subscription } from '@nats-io/nats-core'

export type SubjectSubscriptionConfig = {
  subject: string
  kind: 'subscribe' | 'requestReply'
  callback: (data: any) => void
  timeout: number
  noMux?: boolean
  replayOnReconnect?: boolean
}

export const subjectConsolidateState = ({
  input,
}: {
  input: {
    connection: NatsConnection | null
    currentSubscriptions: Map<string, Subscription>
    targetSubscriptions: Map<string, SubjectSubscriptionConfig>
  }
}) => {
  const { connection, currentSubscriptions, targetSubscriptions } = input
  if (!connection) {
    throw new Error('NATS connection is not available')
  }

  const syncedSubscriptions = new Map(currentSubscriptions)

  // Unsubscribe from subjects that are in currentSubscriptions but not in targetSubscriptions
  for (const [subject, subscription] of currentSubscriptions) {
    if (!targetSubscriptions.has(subject)) {
      try {
        syncedSubscriptions.delete(subject)
        subscription.unsubscribe()
      } catch (error) {
        console.error(`Error unsubscribing from subject "${subject}"`, error)
      }
    }
  }

  // Subscribe to new subjects that are in targetSubscriptions but not in currentSubscriptions
  for (const [subject, subscriptionConfig] of targetSubscriptions) {
    if (!currentSubscriptions.has(subject)) {
      try {
        const sub = connection.subscribe(subject)

        // Set up the message handler
        ;(async () => {
          try {
            for await (const msg of sub) {
              try {
                if (typeof subscriptionConfig.callback === 'function') {
                  // Try to parse as JSON first, fall back to string
                  let data
                  try {
                    data = msg.json()
                  } catch (jsonError) {
                    // If JSON parsing fails, use the raw string
                    data = msg.string()
                  }
                  subscriptionConfig.callback(data)
                }
              } catch (callbackError) {
                console.error(`Callback error for subject "${subject}"`, callbackError)
              }
            }
          } catch (iteratorError) {
            console.error(`Iterator error for subject "${subject}"`, iteratorError)
          }
        })()

        syncedSubscriptions.set(subject, sub)
      } catch (error) {
        console.error(`Error subscribing to subject "${subject}"`, error)
      }
    }
  }

  return {
    subscriptions: syncedSubscriptions,
  }
}
