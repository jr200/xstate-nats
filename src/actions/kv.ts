import { NatsConnection, QueuedIterator } from '@nats-io/nats-core'
import { Kvm, KvWatchEntry, KvWatchOptions } from '@nats-io/kv'
import { Pair } from '../utils'

export class KvSubscriptionKey extends Pair<string, string> {}

export type KvSubscriptionConfig = {
  bucket: string
  key: string
  callback: (data: any) => void
  replayOnReconnect?: boolean
  opts?: KvWatchOptions
}

export const kvConsolidateState = ({
  input,
}: {
  input: {
    kvm: Kvm | null
    connection: NatsConnection | null
    currentKvSubscriptions: Map<string, QueuedIterator<KvWatchEntry>>
    targetKvSubscriptions: Map<string, KvSubscriptionConfig>
  }
}) => {
  let kvm = input.kvm

  if (!kvm) {
    if (input.connection) {
      kvm = new Kvm(input.connection)
    } else {
      throw new Error('NATS connection or KVM is not available')
    }
  }

  const { currentKvSubscriptions, targetKvSubscriptions } = input
  console.log('kvConsolidateState(), current=', currentKvSubscriptions, 'target=', targetKvSubscriptions, 'kvm=', kvm)
  const syncedSubscriptions = new Map(currentKvSubscriptions)

  return {
    kvm: kvm,
    subscriptions: syncedSubscriptions,
  }
}
