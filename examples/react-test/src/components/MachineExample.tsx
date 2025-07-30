import React, { useState } from 'react'
import { natsMachine, safeStringify } from 'xstate-nats'
import { useActor, useSelector } from '@xstate/react'

export const MachineExample = () => {
  const [state, send, actor] = useActor(natsMachine)
  const [subjectInput, setSubjectInput] = useState('test.hello')
  const [receivedMessages, setReceivedMessages] = useState<any[]>([])
  // Fix: Use useSelector to properly subscribe to child actor state changes
  const subjectRef = useSelector(actor, state => state.children.subject)
  const subjectState = useSelector(subjectRef, state => state)

  const kvRef = useSelector(actor, state => state.children.kv)
  const kvState = useSelector(kvRef, state => state)

  // Request-reply state
  const [requestPayload, setRequestPayload] = useState('{"message": "Hello, NATS!"}')
  const [requestReplies, setRequestReplies] = useState<any[]>([])

  // Publish state
  const [publishResults, setPublishResults] = useState<any[]>([])

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
      const currentSubject = subjectInput.trim()
      send({
        type: 'SUBJECT.SUBSCRIBE',
        connection: state.context.connection!,
        subjectConfig: {
          subject: currentSubject,
          callback: data => {
            setReceivedMessages(prevMessages => [
              {
                subject: currentSubject,
                payload: data,
                timestamp: Date.now(),
              },
              ...prevMessages,
            ])
          },
        },
      })
    }
  }

  const handleRequestReply = () => {
    if (subjectInput.trim() && requestPayload.trim()) {
      try {
        send({
          type: 'SUBJECT.REQUEST',
          connection: state.context.connection!,
          subject: subjectInput.trim(),
          payload: requestPayload,
          callback: (reply: any) => {
            setRequestReplies(prevReplies => [
              {
                subject: subjectInput.trim(),
                request: requestPayload,
                reply,
                timestamp: Date.now(),
              },
              ...prevReplies,
            ])
          },
        })
      } catch (error) {
        console.error('Invalid JSON payload:', error)
        alert('Invalid JSON payload. Please check your input.')
      }
    }
  }

  const handlePublish = () => {
    if (subjectInput.trim() && requestPayload.trim()) {
      try {
        send({
          type: 'SUBJECT.PUBLISH',
          connection: state.context.connection!,
          subject: subjectInput.trim(),
          payload: requestPayload,
          onPublishResult: (result: { ok: true } | { ok: false; error: Error }) => {
            setPublishResults(prevResults => [
              {
                subject: subjectInput.trim(),
                payload: requestPayload,
                result,
                timestamp: Date.now(),
              },
              ...prevResults,
            ])
          },
        })
      } catch (error) {
        console.error('Invalid JSON payload:', error)
        alert('Invalid JSON payload. Please check your input.')
      }
    }
  }

  const handleUnsubscribeAll = () => {
    send({ type: 'SUBJECT.CLEAR_SUBSCRIBE', connection: state.context.connection! })
  }

  const handleUnsubscribeOne = (subject: string) => {
    send({
      type: 'SUBJECT.UNSUBSCRIBE',
      connection: state.context.connection!,
      subject,
    })
  }

  const handleClearAllMessages = () => {
    setRequestReplies([])
    setReceivedMessages([])
    setPublishResults([])
  }

  const isConnected = state.matches('connected')
  const canSubscribe = isConnected && subjectInput.trim().length > 0
  const hasSubscriptions = activeSubscriptions.length > 0
  const canRequestReply = isConnected && subjectInput.trim().length > 0 && requestPayload.trim().length > 0
  const canPublish = isConnected && subjectInput.trim().length > 0 && requestPayload.trim().length > 0

  return (
    <div className='min-h-screen bg-gray-50 flex'>
      {/* Main content area */}
      <div className='flex-1 p-4 mr-96'>
        <div className='mb-8'>
          {/* Canvas at the top */}
          <div className='flex justify-center gap-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200'>
            <div className='min-w-96 bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-64'>
              <pre>{state.value}</pre>
            </div>
            <button
              onClick={handleConfigure}
              disabled={!state.can({ type: 'CONFIGURE', config: { opts: {}, maxRetries: 0 } })}
              className='bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200'
            >
              Configure
            </button>
            <button
              onClick={() => send({ type: 'CONNECT' })}
              disabled={!state.can({ type: 'CONNECT' })}
              className='bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200'
            >
              Connect to NATS
            </button>
            <button
              onClick={() => send({ type: 'DISCONNECT' })}
              disabled={!state.can({ type: 'DISCONNECT' })}
              className='bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200'
            >
              Disconnect
            </button>
            <button
              onClick={() => send({ type: 'RESET' })}
              disabled={!state.can({ type: 'RESET' })}
              className='bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200'
            >
              Reset
            </button>
          </div>
        </div>

        {/* Subscription + Request-Reply Controls Side by Side */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8'>
          {/* Left Panel - Active Subscriptions + Messages & Results */}
          <div className='bg-white rounded-xl shadow-lg p-4 border border-gray-200 flex flex-col gap-8'>
            {/* Active Subscriptions */}
            <div>
              <h3 className='text-lg font-semibold text-gray-800 mb-3'>Active Subscriptions</h3>
              {activeSubscriptions.length === 0 ? (
                <div className='text-gray-500 text-center py-8'>No active subscriptions</div>
              ) : (
                <div className='space-y-2'>
                  {activeSubscriptions.map(subject => (
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

            {/* Messages */}
            <div>
              <h3 className='text-lg font-semibold text-gray-800 mb-3'>Messages</h3>
              {receivedMessages.length === 0 && requestReplies.length === 0 && publishResults.length === 0 ? (
                <div className='text-gray-500 text-center py-8'>No messages</div>
              ) : (
                <div className='space-y-4 max-h-96 overflow-auto'>
                  {/* Subscription Received Messages */}
                  {receivedMessages.map((message, index) => (
                    <div key={`subscription-${index}`} className='bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg'>
                      <div className='flex items-center justify-between mb-3'>
                        <div className='flex items-center gap-2'>
                          <span className='font-mono text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded'>
                            {message.subject}
                          </span>
                          <span className='text-xs text-blue-600 bg-blue-200 px-2 py-1 rounded font-medium'>
                            SUBSCRIPTION
                          </span>
                        </div>
                        <span className='text-xs text-gray-500'>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div>
                        <h4 className='text-sm font-semibold text-gray-700 mb-2'>Message:</h4>
                        <pre className='text-xs text-gray-700 bg-white p-2 rounded border whitespace-pre-wrap overflow-auto'>
                          {typeof message.payload === 'string'
                            ? message.payload
                            : JSON.stringify(message.payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}

                  {/* Request-Reply Results */}
                  {requestReplies.map((result, index) => (
                    <div key={`request-${index}`} className='bg-purple-50 border-l-4 border-purple-400 p-4 rounded-lg'>
                      <div className='flex items-center justify-between mb-3'>
                        <div className='flex items-center gap-2'>
                          <span className='font-mono text-sm text-purple-600 bg-purple-100 px-2 py-1 rounded'>
                            {result.subject}
                          </span>
                          <span className='text-xs text-purple-600 bg-purple-200 px-2 py-1 rounded font-medium'>
                            REQUEST-REPLY
                          </span>
                        </div>
                        <span className='text-xs text-gray-500'>{new Date(result.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div>
                          <h4 className='text-sm font-semibold text-gray-700 mb-2'>Request:</h4>
                          <pre className='text-xs text-gray-700 bg-white p-2 rounded border whitespace-pre-wrap overflow-auto'>
                            {JSON.stringify(result.request, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h4 className='text-sm font-semibold text-gray-700 mb-2'>Reply:</h4>
                          <pre className='text-xs text-gray-700 bg-white p-2 rounded border whitespace-pre-wrap overflow-auto'>
                            {typeof result.reply === 'string' ? result.reply : JSON.stringify(result.reply, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Publish Results */}
                  {publishResults.map((result, index) => (
                    <div key={`publish-${index}`} className='bg-green-50 border-l-4 border-green-400 p-4 rounded-lg'>
                      <div className='flex items-center justify-between mb-3'>
                        <div className='flex items-center gap-2'>
                          <span className='font-mono text-sm text-green-600 bg-green-100 px-2 py-1 rounded'>
                            {result.subject}
                          </span>
                          <span className='text-xs text-green-600 bg-green-200 px-2 py-1 rounded font-medium'>
                            PUBLISH
                          </span>
                        </div>
                        <span className='text-xs text-gray-500'>{new Date(result.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div>
                          <h4 className='text-sm font-semibold text-gray-700 mb-2'>Payload:</h4>
                          <pre className='text-xs text-gray-700 bg-white p-2 rounded border whitespace-pre-wrap overflow-auto'>
                            {JSON.stringify(result.payload, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h4 className='text-sm font-semibold text-gray-700 mb-2'>Result:</h4>
                          <pre className='text-xs text-gray-700 bg-white p-2 rounded border whitespace-pre-wrap overflow-auto'>
                            {result.result.ok ? (
                              <span className='text-green-600'>✓ Published successfully</span>
                            ) : (
                              <span className='text-red-600'>✗ Error: {result.result.error?.message}</span>
                            )}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Combined Controls */}
          <div className='bg-white rounded-xl shadow-lg p-4 border border-gray-200 flex flex-col gap-8'>
            {/* Subscription Controls */}
            <div>
              <h3 className='text-lg font-semibold text-gray-800 mb-4'>Control Panel</h3>
              <div className='flex flex-col gap-4'>
                <div>
                  <label htmlFor='subject-input' className='block text-sm font-medium text-gray-700 mb-2'>
                    Subject
                  </label>
                  <input
                    id='subject-input'
                    type='text'
                    value={subjectInput}
                    onChange={e => setSubjectInput(e.target.value)}
                    placeholder='Enter NATS subject (e.g., test.hello)'
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    disabled={!isConnected}
                  />
                </div>
                <div>
                  <label htmlFor='request-payload' className='block text-sm font-medium text-gray-700 mb-2'>
                    Payload (JSON)
                  </label>
                  <textarea
                    id='request-payload'
                    value={requestPayload}
                    onChange={e => setRequestPayload(e.target.value)}
                    placeholder='Enter JSON payload'
                    rows={3}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm'
                    disabled={!isConnected}
                  />
                </div>
                <div className='flex gap-2'>
                  <button
                    onClick={handleSubscribe}
                    disabled={!canSubscribe}
                    className='bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200'
                  >
                    Subscribe
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={!canPublish}
                    className='bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200'
                  >
                    Publish
                  </button>
                  <button
                    onClick={handleRequestReply}
                    disabled={!canRequestReply}
                    className='bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200'
                  >
                    Send Request
                  </button>
                  <div className='flex gap-8' />
                  <button
                    onClick={handleUnsubscribeAll}
                    disabled={!hasSubscriptions}
                    className='bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200'
                  >
                    Unsubscribe All
                  </button>
                  <button
                    onClick={handleClearAllMessages}
                    disabled={requestReplies.length + receivedMessages.length + publishResults.length === 0}
                    className='bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200'
                  >
                    Clear Messages
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Combined State Panel */}
        <div className='h-screen w-96 bg-white shadow-lg border-l border-gray-200 p-4 overflow-y-auto fixed right-0 top-0 flex flex-col z-20'>
          <h3 className='text-lg font-semibold text-gray-800 mb-4 sticky top-0 bg-white pb-2'>System State</h3>

          {/* Main State */}
          <div className='mb-6'>
            <h4 className='text-md font-semibold text-gray-700 mb-2'>Root State</h4>
            <div className='bg-gray-50 p-3 rounded-lg'>
              <pre className='text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-48'>
                {safeStringify(state, 2)}
              </pre>
            </div>
          </div>

          {/* Subject State */}
          <div className='mb-6'>
            <h4 className='text-md font-semibold text-gray-700 mb-2'>Subject State</h4>
            <div className='bg-gray-50 p-3 rounded-lg'>
              <pre className='text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-48'>
                {safeStringify(subjectState, 2)}
              </pre>
            </div>
          </div>

          {/* KV State */}
          <div>
            <h4 className='text-md font-semibold text-gray-700 mb-2'>KV State</h4>
            <div className='bg-gray-50 p-3 rounded-lg'>
              <pre className='text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-48'>
                {safeStringify(kvState, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
