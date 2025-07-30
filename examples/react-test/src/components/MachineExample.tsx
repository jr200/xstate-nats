import React, { useState } from 'react'
import { natsMachine, safeStringify } from 'xstate-nats'
import { useActor, useSelector } from '@xstate/react'

export const MachineExample = () => {
  const [state, send, actor] = useActor(natsMachine)
  const [subjectInput, setSubjectInput] = useState('test.hello')
  const [receivedMessages, setReceivedMessages] = useState<any[]>([])
  // Fix: Use useSelector to properly subscribe to child actor state changes
  const subjectRef = useSelector(actor, (state) => state.children.subject)
  const subjectState = useSelector(subjectRef, (state) => state)

  const kvRef = useSelector(actor, (state) => state.children.kv)
  const kvState = useSelector(kvRef, (state) => state)

  // Extract active subscriptions and received messages with better error handling
  const activeSubscriptions = subjectState?.context?.subscriptionConfigs 
    ? Array.from(subjectState.context.subscriptionConfigs.keys())
    : []

  const handleConfigure = async () => {
    try {
      const response = await fetch('/config.json')
      const config = await response.json()
      send({ type: 'CONFIGURE', config })
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  const handleSubscribe = () => {
    if (subjectInput.trim()) {
      send({
        type: 'SUBJECT.SUBSCRIBE',
        connection: state.context.connection!,
        subjectConfig: {
          subject: subjectInput.trim(),
          kind: 'subscribe',
          callback: (data) => {
            setReceivedMessages([...receivedMessages, {
              subject: subjectInput.trim(),
              payload: data,
              timestamp: Date.now()
            }])
            console.log(`Received message on ${subjectInput}:`, data)
          },
          timeout: 3000
        }
      })
      setSubjectInput('') // Clear input after subscribing
    }
  }

  const handleUnsubscribeAll = () => {
    send({ type: 'SUBJECT.CLEAR_SUBSCRIBE' })
  }

  const handleUnsubscribeOne = (subject: string) => {
    send({
      type: 'SUBJECT.UNSUBSCRIBE',
      subject
    })
  }

  const handleClear = () => {
    setSubjectInput('')
  }

  const isConnected = state.matches('connected')
  const canSubscribe = isConnected && subjectInput.trim().length > 0
  const hasSubscriptions = activeSubscriptions.length > 0
  
  return (
    <div className='min-h-screen bg-gray-50 p-4'>
      {/* Canvas at the top */}
      <div className='mb-8'>
        <div className='bg-white rounded-xl shadow-lg p-4 border border-gray-200'>
          <h2 className='text-2xl font-bold text-gray-800 mb-4'>NATS XState Machine</h2>
          <div className='bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-64'>
            <pre>{state.value}</pre>
          </div>
        </div>
      </div>

      {/* Subscription Controls */}
      <div className='mb-8'>
        <div className='bg-white rounded-xl shadow-lg p-4 border border-gray-200'>
          <h3 className='text-lg font-semibold text-gray-800 mb-4'>Subscription Controls</h3>
          <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-end'>
            <div className='flex-1'>
              <label htmlFor='subject-input' className='block text-sm font-medium text-gray-700 mb-2'>
                Subject
              </label>
              <input
                id='subject-input'
                type='text'
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                placeholder='Enter NATS subject (e.g., test.hello)'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                disabled={!isConnected}
              />
            </div>
            <div className='flex gap-2'>
              <button
                onClick={handleClear}
                disabled={!subjectInput.trim()}
                className='bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200'
              >
                Clear
              </button>
              <button
                onClick={handleSubscribe}
                disabled={!canSubscribe}
                className='bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200'
              >
                Subscribe
              </button>
              <button
                onClick={handleUnsubscribeAll}
                disabled={!hasSubscriptions}
                className='bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200'
              >
                Unsubscribe All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Subscriptions and Received Messages */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8'>
        {/* Active Subscriptions */}
        <div className='bg-white rounded-xl shadow-lg p-4 border border-gray-200'>
          <h3 className='text-lg font-semibold text-gray-800 mb-3'>Active Subscriptions</h3>
          {activeSubscriptions.length === 0 ? (
            <div className='text-gray-500 text-center py-8'>No active subscriptions</div>
          ) : (
            <div className='space-y-2'>
              {activeSubscriptions.map((subject) => (
                <div key={subject} className='flex items-center justify-between bg-gray-50 p-3 rounded-lg'>
                  <span className='font-mono text-sm text-gray-700'>{subject}</span>
                  <button
                    onClick={() => handleUnsubscribeOne(subject)}
                    className='text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded transition-colors duration-200'
                    title='Unsubscribe from this subject'
                  >
                    <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Received Messages */}
        <div className='bg-white rounded-xl shadow-lg p-4 border border-gray-200'>
          <h3 className='text-lg font-semibold text-gray-800 mb-3'>Received Messages</h3>
          {receivedMessages.length === 0 ? (
            <div className='text-gray-500 text-center py-8'>No messages received</div>
          ) : (
            <div className='space-y-3 max-h-64 overflow-auto'>
              {receivedMessages.map((message, index) => (
                <div key={index} className='bg-gray-50 p-3 rounded-lg'>
                  <div className='flex items-center justify-between mb-2'>
                    <span className='font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded'>
                      {message.subject}
                    </span>
                    <span className='text-xs text-gray-500'>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className='text-xs text-gray-700 whitespace-pre-wrap overflow-auto'>
                    {typeof message.payload === 'string' 
                      ? message.payload 
                      : JSON.stringify(message.payload, null, 2)
                    }
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4 Cards below */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {/* Main State Card */}
        <div className='bg-white rounded-xl shadow-lg p-4 border border-gray-200'>
          <h3 className='text-lg font-semibold text-gray-800 mb-3'>Main State</h3>
          <div className='bg-gray-50 p-3 rounded-lg'>
            <pre className='text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-64'>
              {safeStringify(state, 2)}
            </pre>
          </div>
        </div>

        {/* Subject State Card */}
        <div className='bg-white rounded-xl shadow-lg p-4 border border-gray-200'>
          <h3 className='text-lg font-semibold text-gray-800 mb-3'>Subject</h3>
          <div className='bg-gray-50 p-3 rounded-lg'>
            <pre className='text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-64'>
              {safeStringify(subjectState, 2)}
            </pre>
          </div>
        </div>

        {/* KV State Card */}
        <div className='bg-white rounded-xl shadow-lg p-4 border border-gray-200'>
          <h3 className='text-lg font-semibold text-gray-800 mb-3'>Key-Value Store</h3>
          <div className='bg-gray-50 p-3 rounded-lg'>
            <pre className='text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-64'>
              {safeStringify(kvState, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className='mt-8 flex justify-center gap-4'>
        <button 
          onClick={handleConfigure}
          disabled = {!state.can({ type: 'CONFIGURE', config: { opts: {}, maxRetries: 0 } })}
          className='bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200'
        >
          Configure
        </button>
        <button 
          onClick={() => send({ type: 'CONNECT' })}
          disabled = {!state.can({ type: 'CONNECT' })}
          className='bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200'
        >
          Connect to NATS
        </button>
        <button 
          onClick={() => send({ type: 'DISCONNECT' })}
          disabled = {!state.can({ type: 'DISCONNECT' })}
          className='bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200'
        >
          Disconnect
        </button>
        <button 
          onClick={() => send({ type: 'RESET' })}
          disabled = {!state.can({ type: 'RESET' })}
          className='bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200'
        >
          Reset
        </button>
      </div>
    </div>
  )
}
