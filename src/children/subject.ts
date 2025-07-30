import { Subscription, PublishOptions, NatsConnection } from '@nats-io/nats-core'
import { assign, sendParent, setup } from 'xstate'
import { SubjectSubscriptionConfig, subjectConsolidateState } from '../actions/subject'

export type PublishParams = {
  payload: Uint8Array | string
  options?: PublishOptions
  onPublishResult?: (result: { ok: true } | { ok: false; error: Error }) => void
}

export interface Context {
  uid: string
  subscriptions: Map<string, Subscription>
  subscriptionConfigs: Map<string, SubjectSubscriptionConfig>
  queuedPublishes: { subject: string; params: PublishParams }[]
  maxQueueLength?: number
  maxMessages?: number
}

// internal events and events from nats connection
type InternalEvents =
  | { type: 'ERROR'; error: Error }

// events which can be sent to the machine from the user
export type ExternalEvents =
  | { type: 'SUBJECT.CONNECTED' }
  | { type: 'SUBJECT.DISCONNECTED' }
  | { type: 'SUBJECT.SYNC'; connection: NatsConnection }

  | { type: 'SUBJECT.SUBSCRIBE'; connection: NatsConnection; subjectConfig: SubjectSubscriptionConfig }
  | { type: 'SUBJECT.UNSUBSCRIBE'; connection: NatsConnection; subject: string }
  | { type: 'SUBJECT.CLEAR_SUBSCRIBE'; connection: NatsConnection }

  | { type: 'SUBJECT.REQUEST'; connection: NatsConnection; subject: string; payload: any }

export type Events = InternalEvents | ExternalEvents

export const subjectManagerLogic = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlgFcAjAKzEwBcB9XCAGzAGIBlAVQCEAUgFEAwgBVGASQByksZICCAGUlchAbQAMAXUSgADgHtYuerkP49IAB6IATJs0kAnAFYAzAEY7rgDQgAT3tXTxJNAA53KOiYrwBfOP80LDxCUgoaOiYCU1x0VlwTfCgOa1h6dHowEnQAMyqAJ2RXRyIOZJwCYjIqWgZmfFz8woIoLV0kECMTMwsrWwQANk0AFhJPNy8ffyCEHzsSV0jY2M8EpIxOtJ7M-swLQgZIbn5hcUZePi4RACVJPg0Ois01yc0mC08jnCJAA7O4Vu4YX5AvYVjDDnZ4YjXOcQB1Ut0Mn0mPd8I8qhAXoJRBIeNJPt8-gDxsDjKDLODEEiDu5FjDPOEkTtEJ4Yc5cfiuulellGKTyc9Pm8JCIlEIFD8PvxGf9ARMDGzZhzQAs4a4SHY7ItXIttiiEN5oTjcfhDBA4FZJWlWTNzMabIgALSLYUIYMSy4E6W3bJsMA+9nzRArOyhy3QiInU4RlJSm7EgZDApFKAJo1JhArTzmzTV23I3bpsLHLNRM6JPGRvNE2XyrKQMt+iswpEkRaChv2eGHHNXQkyu4WWCGAoQSpgRjldeDsEmkWY0IrFYebyTvZomcdr3zmOMMANBqGBo7-0LFaLC0CoX26KHFuthIEiAA */
  initial: 'subject_idle',
  context: {
    uid: new Date().toISOString(),
    subscriptions: new Map<string, Subscription>(),
    subscriptionConfigs: new Map<string, SubjectSubscriptionConfig>(),
    queuedPublishes: [],
    maxQueueLength: 1000,
    maxMessages: 100, // Keep last 100 messages
  },
  states: {
    subject_idle: {
      entry: [
        assign({
          subscriptions: new Map<string, Subscription>(),
        })
      ],
      on: {
        'SUBJECT.SYNC': {
          target: 'subject_syncing',
        },
      },
    },
    subject_connected: {
      entry: [
        sendParent({ type: 'SUBJECT.CONNECTED' }),
      ],
      on: {
        'SUBJECT.REQUEST': {
          actions: assign(({ context, event }) => {
            console.log('SUBJECT.REQUEST', context, event)
            return {}
          }),
        },
        'SUBJECT.DISCONNECTED': {
          target: 'subject_idle',
        },
        'SUBJECT.SUBSCRIBE': {
          actions: assign(({ context, event }) => {
            return {
              subscriptionConfigs: new Map(context.subscriptionConfigs).set(
                event.subjectConfig.subject,
                event.subjectConfig
              ),
            }
          }),
          target: 'subject_syncing',
        },
        'SUBJECT.UNSUBSCRIBE': {
          actions: assign(({ context, event }) => {
            const newConfigs = new Map(context.subscriptionConfigs)
            newConfigs.delete(event.subject)
            return {
              subscriptionConfigs: newConfigs,
            }
          }),
          target: 'subject_syncing',
        },
        'SUBJECT.CLEAR_SUBSCRIBE': {
          actions: assign({ subscriptionConfigs: new Map() }),
          target: 'subject_syncing',
        },
        'SUBJECT.SYNC': {
          target: 'subject_syncing',
        },
      },
    },
    subject_syncing: {
      entry: [
          assign(({ context, event }) =>
            subjectConsolidateState({
              input: {
                connection: (event as any).connection as NatsConnection,
                currentSubscriptions: context.subscriptions,
                targetSubscriptions: context.subscriptionConfigs,
              },
            })
          )
      ],
      always:
        {
          target: 'subject_connected',
        },
    },
    subject_error: {
      on: {
        'SUBJECT.SYNC': {
          target: 'subject_syncing',
        },
      },
    },
  },
})
