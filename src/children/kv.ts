import { createMachine } from 'xstate'

export const kvManagerLogic = createMachine({
  entry: [
    event => {
      console.log('CREATED kv machine', event)
    },
  ],
  initial: 'idle',
  states: {
    idle: {},
  },
})
