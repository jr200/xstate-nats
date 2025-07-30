import { Subscription, PublishOptions, NatsConnection } from "@nats-io/nats-core";
import { enqueueActions, sendParent, setup } from "xstate";
import { SubjectSubscriptionConfig, subjectSubscribe, subjectUnsubscribe } from "../actions/subject";

export type PublishParams = {
  payload: Uint8Array | string
  options?: PublishOptions
  onPublishResult?: (result: { ok: true } | { ok: false; error: Error }) => void
}

export type ReceivedMessage = {
  subject: string
  payload: any
  timestamp: number
}

export interface Context {
  uid: string
  subscriptions: Map<string, Subscription>
  subscriptionConfigs: Map<string, SubjectSubscriptionConfig>
  queuedPublishes: { subject: string; params: PublishParams }[]
  receivedMessages: ReceivedMessage[]
  maxQueueLength?: number
  maxMessages?: number
}

// internal events and events from nats connection
type InternalEvents = 
 | { type: 'ERROR'; error: Error }
 | { type: 'MESSAGE_RECEIVED'; subject: string; payload: any }

// events which can be sent to the machine from the user
export type ExternalEvents =
  | { type: 'SUBJECT.INITIALISE' }
  | { type: 'SUBJECT.SUBSCRIBE'; connection: NatsConnection; subjectConfig: SubjectSubscriptionConfig }
  | { type: 'SUBJECT.UNSUBSCRIBE'; subject: string }
  | { type: 'SUBJECT.CLEAR_SUBSCRIBE' }

export type Events = InternalEvents | ExternalEvents

export const subjectManagerLogic = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
}).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlgFcAjAKzEwBcB9XCAGzAGIBlAVQCEAUgFEAwgBVGASQByksZICCAGUlchAbQAMAXUSgADgHtYuerkP49IAB6IATJs0kAnAFYAzAEY7rgDQgAT3tXTxJNAA53KOiYrwBfOP80LDxCUgoaOiYCU1x0VlwTfCgOa1h6dHowEnQAMyqAJ2RXRyIOZJwCYjIqWgZmfFz8woIoLV0kECMTMwsrWwQANk0AFhJPNy8ffyCEHzsSV0jY2M8EpIxOtJ7M-swLQgZIbn5hcUZePi4RACVJPg0Ois01yc0mC08jnCJAA7O4Vu4YX5AvYVjDDnZ4YjXOcQB1Ut0Mn0mPd8I8qhAXoJRBIeNJPt8-gDxsDjKDLODEEiDu5FjDPOEkTtEJ4Yc5cfiuulellGKTyc9Pm8JCIlEIFD8PvxGf9ARMDGzZhzQAs4a4SHY7ItXIttiiEN5oTjcfhDBA4FZJWlWTNzMabIgALSLYUIYMSy4E6W3bJsMA+9nzRArOyhy3QiInU4RlJSm7EgZDApFKAJo1JhArTzmzTV23I3bpsLHLNRM6JPGRvNE2XyrKQMt+iswpEkRaChv2eGHHNXQkyu4WWCGAoQSpgRjldeDsEmkWY0IrFYebyTvZomcdr3zmOMMANBqGBo7-0LFaLC0CoX26KHFuthIEiAA */
    entry: [
      (event) => {
        console.log('CREATED subject machine', event)
      }
    ],
    initial: 'subject_idle',
    context: {
      uid: new Date().toISOString(),
      subscriptions: new Map<string, Subscription>(),
      subscriptionConfigs: new Map<string, SubjectSubscriptionConfig>(),
      queuedPublishes: [],
      receivedMessages: [],
      maxQueueLength: 1000,
      maxMessages: 100, // Keep last 100 messages
    },
    states: {
      subject_idle: {
        entry: [
          (event) => {
            console.log('SUBJECT IDLE', event)
          }
        ],
        on: {
          'SUBJECT.INITIALISE': {
            target: 'subject_initialising',
          },
        },
      },
      subject_initialising: {
        entry: [
          (event) => {
            console.log('SUBJECT INITIALISING', event)
          }
        ],
        after: {
          500: {
            target: 'subject_connected',
          },
        },
      },
      subject_connected: {
        entry: [
          (event) => {
            console.log('SUBJECT CONNECTED', event)
          },
          sendParent({ type: 'SUBJECT_MANAGER_READY' }),
        ],
        on: {
          'SUBJECT.SUBSCRIBE': {
            actions: enqueueActions(({ context, enqueue, event }) => {
              context.subscriptionConfigs.set(event.subjectConfig.subject, event.subjectConfig)
              const newConfigs = new Map(context.subscriptionConfigs)
              newConfigs.set(event.subjectConfig.subject, event.subjectConfig)

              enqueue.assign({
                subscriptionConfigs: newConfigs,
              })
              
              enqueue.assign({
                subscriptions: ({context}) => subjectSubscribe({
                  input: {
                    existingSubscriptions: context.subscriptions,
                    connection: event.connection,
                    newSubscriptionConfig: event.subjectConfig,
                  }
                })
              })
            }),
          },
          'SUBJECT.UNSUBSCRIBE': {
            actions: enqueueActions(({ context, enqueue, event }) => {
              const newConfigs = new Map(context.subscriptionConfigs)
              newConfigs.delete(event.subject)
              enqueue.assign({
                subscriptionConfigs: newConfigs,
              })
              
              enqueue.assign({
                subscriptions: ({context}) => subjectUnsubscribe({
                  input: {
                    existingSubscriptions: context.subscriptions,
                    subject: event.subject,
                  }
                })
              })
            }),
          },
          'SUBJECT.CLEAR_SUBSCRIBE': {
            actions: enqueueActions(({ enqueue }) => {
              enqueue.assign({
                subscriptionConfigs: new Map(),
              })
            }),
          },
        },
      },
      subject_error:{},
    },
  })
