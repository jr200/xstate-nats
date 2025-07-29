import React from 'react'
import { MachineExample } from './components/MachineExample'

function App() {
  return (
    <div>
      <div className='App'>
        <h1>xstate-nats Test App</h1>
        <p>Testing xstate-nats machine</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <MachineExample />
        </div>
      </div>
    </div>
  )
}

export default App
