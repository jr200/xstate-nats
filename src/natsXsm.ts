import { createMachine, setup } from 'xstate'

const connectionMachine = createMachine({})
const subjectMachine = createMachine({})
const kvMachine = createMachine({})

export const natsXsm = setup({
  actors: {
    connection: connectionMachine,
    subject: subjectMachine,
    kv: kvMachine,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5gF8A0IB2B7CdGgAoBbAQwGMALASwzAEp8QAHLWKgFyqw0YA9EAjACZ0AT0FDkU5EA */
  invoke: [
    { src: 'connection', id: 'connection' },
    { src: 'subject', id: 'subject' },
    { src: 'kv', id: 'kv' },
  ],
})
