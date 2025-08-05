import { Subscription, PublishOptions, NatsConnection, RequestOptions } from '@nats-io/nats-core'
import { assign, sendParent, setup } from 'xstate'
import { SubjectSubscriptionConfig, subjectConsolidateState, subjectRequest, subjectPublish } from '../actions/subject'

export type PublishParams = {
  payload: Uint8Array | string
  options?: PublishOptions
  onPublishResult?: (result: { ok: true } | { ok: false; error: Error }) => void
}

// internal events and events from nats connection
type InternalEvents = { type: 'ERROR'; error: Error }

// events which can be sent to the machine from the user
export type ExternalEvents =
  | { type: 'SUBJECT.CONNECTED' }
  | { type: 'SUBJECT.DISCONNECTED' }
  | { type: 'SUBJECT.CONNECT'; connection: NatsConnection }
  | { type: 'SUBJECT.SUBSCRIBE'; subjectConfig: SubjectSubscriptionConfig }
  | { type: 'SUBJECT.UNSUBSCRIBE'; subject: string }
  | { type: 'SUBJECT.UNSUBSCRIBE_ALL' }
  | {
      type: 'SUBJECT.REQUEST'
      subject: string
      payload: any
      opts?: RequestOptions
      callback: (data: any) => void
    }
  | {
      type: 'SUBJECT.PUBLISH'
      subject: string
      payload: any
      opts?: PublishOptions
      onPublishResult?: (result: { ok: true } | { ok: false; error: Error }) => void
    }

export type Events = InternalEvents | ExternalEvents

export interface Context {
  uid: string
  subscriptions: Map<string, Subscription>
  subscriptionConfigs: Map<string, SubjectSubscriptionConfig>
  queuedPublishes: { subject: string; params: PublishParams }[]
  maxQueueLength?: number
  maxMessages?: number
  cachedConnection: NatsConnection | null
}

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
    cachedConnection: null,
  },
  on: {
    'SUBJECT.SUBSCRIBE': {
      actions: assign(({ context, event }) => {
        const newConfigs = new Map(context.subscriptionConfigs)
        newConfigs.set(event.subjectConfig.subject, event.subjectConfig)
        return {
          subscriptionConfigs: newConfigs,
        }
      }),
    },
    'SUBJECT.UNSUBSCRIBE': {
      actions: assign(({ context, event }) => {
        const newConfigs = new Map(context.subscriptionConfigs)
        newConfigs.delete(event.subject)
        return {
          subscriptionConfigs: newConfigs,
        }
      }),
    },
    'SUBJECT.UNSUBSCRIBE_ALL': {
      actions: assign({ subscriptionConfigs: new Map() }),
    },
  },
  states: {
    subject_idle: {
      entry: [
        assign({
          subscriptions: new Map<string, Subscription>(),
        }),
      ],
      on: {
        'SUBJECT.CONNECT': {
          target: 'subject_syncing',
          actions: [
            assign({
              cachedConnection: ({ event }) => event.connection,
            }),
          ],
        },
      },
    },
    subject_disconnecting: {
      entry: [
        ({ context }) => {
          context.cachedConnection?.close()
        },
        assign({
          cachedConnection: null,
        }),
      ],
      target: 'subject_idle',
    },
    subject_connected: {
      entry: [sendParent({ type: 'SUBJECT.CONNECTED' })],
      on: {
        'SUBJECT.DISCONNECTED': {
          target: 'subject_disconnecting',
        },
        'SUBJECT.REQUEST': {
          actions: assign(({ event, context }) => {
            subjectRequest({
              input: {
                connection: context.cachedConnection!,
                subject: event.subject,
                payload: event.payload,
                opts: event.opts,
                callback: event.callback,
              },
            })
            return {}
          }),
        },
        'SUBJECT.PUBLISH': {
          actions: assign(({ event, context }) => {
            subjectPublish({
              input: {
                connection: context.cachedConnection!,
                subject: event.subject,
                payload: event.payload,
                options: event.opts,
                onPublishResult: event.onPublishResult,
              },
            })
            return {}
          }),
        },
      },
    },
    subject_syncing: {
      entry: [
        assign(({ context }) =>
          subjectConsolidateState({
            input: {
              connection: context.cachedConnection!,
              currentSubscriptions: context.subscriptions,
              targetSubscriptions: context.subscriptionConfigs,
            },
          })
        ),
      ],
      always: {
        target: 'subject_connected',
      },
    },
    subject_error: {
      on: {
        'SUBJECT.CONNECT': {
          target: 'subject_syncing',
        },
        '*': {
          actions: [
            ({ event }: { event: any }) => {
              console.error('subject received unexpected event', event)
            },
          ],
        },
      },
    },
  },
})
