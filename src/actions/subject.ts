import { NatsConnection, Subscription } from "@nats-io/nats-core"

export type SubjectSubscriptionConfig = {
    subject: string
    kind: 'subscribe' | 'requestReply'
    callback: (data: any) => void
    timeout: number
    noMux?: boolean
    replayOnReconnect?: boolean
  }
  

export const subjectSubscribe = (({ input }: { 
  input: { 
    connection: NatsConnection | null
    existingSubscriptions: Map<string, Subscription>
    newSubscriptionConfig: SubjectSubscriptionConfig 
  }
}) => {
  const { existingSubscriptions, connection, newSubscriptionConfig } = input
  if (!connection) {
    throw new Error('NATS connection is not available')
  }
  
  const sub = connection.subscribe(newSubscriptionConfig.subject)
  ;(async () => {
    try {
      for await (const msg of sub) {
        console.log('*****RECEIVED MESSAGE', msg)
        try {
          if (typeof newSubscriptionConfig.callback === 'function') {
            // Try to parse as JSON first, fall back to string
            let data
            try {
              data = msg.json()
            } catch (jsonError) {
              // If JSON parsing fails, use the raw string
              data = msg.string()
            }
            newSubscriptionConfig.callback(data)
          }
        } catch (callbackError) {
          console.error(`Callback error for subject "${newSubscriptionConfig.subject}"`, callbackError)
        }
      }
    } catch (iteratorError) {
        console.error(`Iterator error for subject "${newSubscriptionConfig.subject}"`, iteratorError)
    }
  })()

  const result = new Map(existingSubscriptions)
  result.set(newSubscriptionConfig.subject, sub)
  return result
})


export const subjectUnsubscribe = (({ input }: { 
  input: { 
    existingSubscriptions: Map<string, Subscription>
    subject: string 
  }
}) => {
  const { existingSubscriptions, subject } = input

  try {
    existingSubscriptions.get(subject)?.unsubscribe()
  } catch (error) {
    const subjectInfo = subject ? ` for subject "${subject}"` : ''
    console.error(`Unsubscribe error${subjectInfo}`, error)
    throw error
  }

  existingSubscriptions.delete(subject)
  return existingSubscriptions
})



export const subjectConsolidateState = (({ input }: { 
  input: { 
    connection: NatsConnection | null
    currentSubscriptions: Map<string, Subscription>
    targetSubscriptions: Map<string, SubjectSubscriptionConfig>
  }
}) => {
  const { connection, currentSubscriptions, targetSubscriptions } = input
  console.log('*****CONSOLIDATE STATE', connection, currentSubscriptions, targetSubscriptions)

})