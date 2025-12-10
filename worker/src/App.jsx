import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

const parseScriptText = (text) => {
  const lines = text.split('\n').filter(line => line.trim())
  return lines.map((line, index) => {
    const lowerLine = line.toLowerCase()
    let sender = 'me'
    let msgText = line

    if (lowerLine.startsWith('me:')) {
      sender = 'me'
      msgText = line.substring(3).trim()
    } else if (lowerLine.startsWith('them:')) {
      sender = 'them'
      msgText = line.substring(5).trim()
    } else if (line.includes(':')) {
      const colonIndex = line.indexOf(':')
      const possibleSender = line.substring(0, colonIndex).toLowerCase().trim()
      if (possibleSender === 'me' || possibleSender === 'them') {
        sender = possibleSender
        msgText = line.substring(colonIndex + 1).trim()
      }
    }

    return { id: index, sender, text: msgText }
  })
}

const defaultScript = `me: Hey, can you help me with something?
them: Of course! What do you need?
me: How do I make pasta?
them: Boil water, add pasta, cook for 8-10 minutes
them: Don't forget to salt the water!
me: Thanks! You're the best`

export default function App() {
  const [contactName, setContactName] = useState('Mom')
  const [contactAvatar, setContactAvatar] = useState('M')
  const [scriptText, setScriptText] = useState(defaultScript)
  const [allMessages, setAllMessages] = useState(() => parseScriptText(defaultScript))
  const [visibleCount, setVisibleCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showTyping, setShowTyping] = useState(false)
  const [currentTime, setCurrentTime] = useState('9:41')
  const [messageDelay, setMessageDelay] = useState(1500)
  const [typingDuration, setTypingDuration] = useState(1200)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [osMode, setOsMode] = useState('iOS')

  const messagesEndRef = useRef(null)
  const timeoutRef = useRef(null)
  const phoneRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [visibleCount, showTyping])

  useEffect(() => {
    if (!isPlaying) return

    if (visibleCount >= allMessages.length) {
      setIsPlaying(false)
      setShowTyping(false)

      if (isRecording) {
        setTimeout(() => {
          stopRecording()
        }, 1000)
      }
      return
    }

    const nextMessage = allMessages[visibleCount]
    const isFirstMessage = visibleCount === 0
    const initialDelay = isFirstMessage ? 500 : 0

    if (nextMessage.sender === 'them') {
      timeoutRef.current = setTimeout(() => {
        setShowTyping(true)
      }, initialDelay)

      const typingTimeout = setTimeout(() => {
        setShowTyping(false)
        setVisibleCount(prev => prev + 1)
      }, initialDelay + typingDuration)

      return () => {
        clearTimeout(timeoutRef.current)
        clearTimeout(typingTimeout)
      }
    } else {
      timeoutRef.current = setTimeout(() => {
        setVisibleCount(prev => prev + 1)
      }, initialDelay + messageDelay)

      return () => {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isPlaying, visibleCount, allMessages, messageDelay, typingDuration, isRecording])

  const startRecording = useCallback(async () => {
    if (!phoneRef.current) return

    try {
      setRecordingStatus('Starting recording...')

      const phoneElement = phoneRef.current
      const canvas = document.createElement('canvas')
      const rect = phoneElement.getBoundingClientRect()
      canvas.width = rect.width * 2
      canvas.height = rect.height * 2
      const ctx = canvas.getContext('2d')

      const stream = canvas.captureStream(30)

      let mimeType = 'video/webm;codecs=vp9'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8'
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm'
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4'
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5000000
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `imessage-conversation-${Date.now()}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setRecordingStatus('Recording saved!')
        setTimeout(() => setRecordingStatus(''), 3000)
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      setRecordingStatus('Recording...')

      const captureFrame = async () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return

        try {
          const html2canvas = (await import('html2canvas')).default
          const capturedCanvas = await html2canvas(phoneElement, {
            scale: 2,
            useCORS: true,
            logging: false,
          })
          ctx.drawImage(capturedCanvas, 0, 0, canvas.width, canvas.height)
        } catch (err) {
          ctx.fillStyle = '#000'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        if (mediaRecorderRef.current?.state === 'recording') {
          requestAnimationFrame(captureFrame)
        }
      }

      captureFrame()

    } catch (err) {
      console.error('Recording error:', err)
      setRecordingStatus('Recording failed. Try screen recording instead.')
      setTimeout(() => setRecordingStatus(''), 3000)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  const handleRecordAndPlay = async () => {
    setVisibleCount(0)
    setShowTyping(false)

    await startRecording()

    setTimeout(() => {
      setIsPlaying(true)
    }, 500)
  }

  const handlePlay = () => {
    setIsPlaying(false)
    setShowTyping(false)
    setVisibleCount(0)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setTimeout(() => {
      setIsPlaying(true)
    }, 200)
  }

  const handlePause = () => {
    setIsPlaying(false)
    setShowTyping(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  const handleReset = () => {
    setIsPlaying(false)
    setShowTyping(false)
    setVisibleCount(0)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (isRecording) {
      stopRecording()
    }
  }

  const handleShowAll = () => {
    setIsPlaying(false)
    setShowTyping(false)
    setVisibleCount(allMessages.length)
  }

  const parseScript = () => {
    const parsed = parseScriptText(scriptText)
    setAllMessages(parsed)
    setVisibleCount(parsed.length)
    setIsPlaying(false)
    setShowTyping(false)
  }

  const visibleMessages = allMessages.slice(0, visibleCount)

  const messageGroups = useMemo(() => {
    const groups = []
    let currentGroup = null

    visibleMessages.forEach((msg, idx) => {
      if (!currentGroup || currentGroup.sender !== msg.sender) {
        currentGroup = { sender: msg.sender, messages: [{ ...msg, isNew: idx === visibleCount - 1 }] }
        groups.push(currentGroup)
      } else {
        currentGroup.messages.push({ ...msg, isNew: idx === visibleCount - 1 })
      }
    })

    return groups
  }, [visibleMessages, visibleCount])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111827', padding: '24px', display: 'flex', gap: '24px' }}>
      {/* Controls Panel */}
      <div style={{ width: '384px', backgroundColor: '#1f2937', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '100vh' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'white', marginBottom: '8px' }}>Fake Text Message Generator</h1>
        <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>Create realistic fake text messages for iPhone. Perfect for videos, presentations, and social media content.</p>

        {/* Contact Settings */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>Contact Name</label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            style={{ width: '100%', backgroundColor: '#374151', color: 'white', borderRadius: '8px', padding: '8px 16px', border: 'none', outline: 'none', boxSizing: 'border-box' }}
            placeholder="Mom"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>Avatar Letter(s)</label>
          <input
            type="text"
            value={contactAvatar}
            onChange={(e) => setContactAvatar(e.target.value.substring(0, 2))}
            style={{ width: '100%', backgroundColor: '#374151', color: 'white', borderRadius: '8px', padding: '8px 16px', border: 'none', outline: 'none', boxSizing: 'border-box' }}
            placeholder="M"
            maxLength={2}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>Time Display</label>
          <input
            type="text"
            value={currentTime}
            onChange={(e) => setCurrentTime(e.target.value)}
            style={{ width: '100%', backgroundColor: '#374151', color: 'white', borderRadius: '8px', padding: '8px 16px', border: 'none', outline: 'none', boxSizing: 'border-box' }}
            placeholder="9:41"
          />
        </div>

        {/* OS Mode Toggle */}
        <div style={{ backgroundColor: '#374151', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>OS Style</h3>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>Switch between iOS and Android layout</p>
            </div>
            <div style={{ display: 'flex', backgroundColor: '#4b5563', borderRadius: '8px', padding: '2px' }}>
              <button
                onClick={() => setOsMode('iOS')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: osMode === 'iOS' ? '#3b82f6' : 'transparent',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                iOS
              </button>
              <button
                onClick={() => setOsMode('Android')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: osMode === 'Android' ? '#3b82f6' : 'transparent',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Android
              </button>
            </div>
          </div>
        </div>

        {/* Dark Mode Toggle */}
        <div style={{ backgroundColor: '#374151', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>Dark Mode</h3>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>Black background for fake text messages</p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                width: '52px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: darkMode ? '#22c55e' : '#4b5563',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background-color 0.2s'
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: 'white',
                position: 'absolute',
                top: '2px',
                left: darkMode ? '26px' : '2px',
                transition: 'left 0.2s'
              }} />
            </button>
          </div>
        </div>

        {/* Timing Controls */}
        <div style={{ backgroundColor: '#374151', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '12px' }}>Timing Controls</h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
              Message Delay: {messageDelay}ms
            </label>
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={messageDelay}
              onChange={(e) => setMessageDelay(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
              Typing Duration: {typingDuration}ms
            </label>
            <input
              type="range"
              min="500"
              max="4000"
              step="100"
              value={typingDuration}
              onChange={(e) => setTypingDuration(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>
        </div>

        {/* Playback Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePlay}
            disabled={isPlaying}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: isPlaying ? '#4b5563' : '#22c55e',
              color: 'white',
              fontWeight: '600',
              cursor: isPlaying ? 'not-allowed' : 'pointer',
              opacity: isPlaying ? 0.6 : 1
            }}
          >
            Play
          </button>
          <button
            onClick={handlePause}
            disabled={!isPlaying}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: !isPlaying ? '#4b5563' : '#f59e0b',
              color: 'white',
              fontWeight: '600',
              cursor: !isPlaying ? 'not-allowed' : 'pointer',
              opacity: !isPlaying ? 0.6 : 1
            }}
          >
            Pause
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleReset}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#6b7280',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
          <button
            onClick={handleShowAll}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#6b7280',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Show All
          </button>
        </div>

        {/* Recording Controls */}
        <div style={{ backgroundColor: '#374151', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '12px' }}>Recording</h3>

          <button
            onClick={isRecording ? stopRecording : handleRecordAndPlay}
            disabled={isPlaying && !isRecording}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: isRecording ? '#ef4444' : '#8b5cf6',
              color: 'white',
              fontWeight: '600',
              cursor: (isPlaying && !isRecording) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isRecording ? (
              <>
                <span className="recording-indicator" style={{ width: '12px', height: '12px', backgroundColor: 'white', borderRadius: '50%' }}></span>
                Stop Recording
              </>
            ) : (
              <>Record & Play</>
            )}
          </button>

          {recordingStatus && (
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>
              {recordingStatus}
            </p>
          )}

          <p style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginTop: '8px' }}>
            Tip: For best results, use your browser's built-in screen recorder or OBS
          </p>
        </div>

        {/* Progress */}
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
          Message {visibleCount} of {allMessages.length}
          {isPlaying && <span style={{ marginLeft: '8px', color: '#22c55e' }}>Playing</span>}
          {isRecording && <span style={{ marginLeft: '8px', color: '#ef4444' }}>Recording</span>}
        </div>

        {/* Script Input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={{ display: 'block', fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>
            Script <span style={{ color: '#6b7280' }}>(me: or them:)</span>
          </label>
          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            style={{
              width: '100%',
              height: '120px',
              backgroundColor: '#374151',
              color: 'white',
              borderRadius: '8px',
              padding: '12px 16px',
              border: 'none',
              outline: 'none',
              fontFamily: 'monospace',
              fontSize: '14px',
              resize: 'none',
              boxSizing: 'border-box'
            }}
            placeholder="me: Hello!&#10;them: Hi there!"
          />
        </div>

        <button
          onClick={parseScript}
          style={{
            width: '100%',
            backgroundColor: '#3b82f6',
            color: 'white',
            fontWeight: '600',
            borderRadius: '12px',
            padding: '12px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Generate Messages
        </button>

        <p style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
          Use "me:" for blue bubbles (right side)<br />
          Use "them:" for gray bubbles (left side)
        </p>
      </div>

      {/* Phone Preview */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative' }} ref={phoneRef}>
          {/* Phone Frame */}
          <div style={{ width: '375px', height: '812px', backgroundColor: 'black', borderRadius: '55px', padding: '14px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            {/* Screen */}
            <div style={{ width: '100%', height: '100%', backgroundColor: darkMode ? (osMode === 'iOS' ? '#000000' : '#121212') : 'white', borderRadius: '41px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              
              {/* Status Bar */}
              {osMode === 'iOS' ? (
                <div style={{ height: '58px', backgroundColor: darkMode ? '#000000' : '#f9fafb', color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 32px 4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>{currentTime}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2 17h2v4H2v-4zm4-5h2v9H6v-9zm4-4h2v13h-2V8zm4-3h2v16h-2V5z" />
                    </svg>
                    <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                    </svg>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '24px', height: '12px', border: `1px solid ${darkMode ? 'white' : 'black'}`, borderRadius: '3px', display: 'flex', alignItems: 'center', padding: '1px' }}>
                        <div style={{ width: '16px', height: '100%', backgroundColor: darkMode ? 'white' : 'black', borderRadius: '2px' }} />
                      </div>
                      <div style={{ width: '2px', height: '6px', backgroundColor: darkMode ? 'white' : 'black', borderRadius: '0 2px 2px 0', marginLeft: '-1px' }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '58px', backgroundColor: darkMode ? '#121212' : 'white', color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 24px 8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{currentTime}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                    </svg>
                    <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="currentColor">
                       <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Navigation Bar / Header */}
              {osMode === 'iOS' ? (
                <div style={{ height: '56px', backgroundColor: darkMode ? '#000000' : '#f9fafb', borderBottom: `1px solid ${darkMode ? '#38383a' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                  <button style={{ color: '#007AFF', display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(to bottom right, #9ca3af, #6b7280)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '14px' }}>
                      {contactAvatar}
                    </div>
                    <span style={{ fontSize: '11px', color: darkMode ? 'white' : '#000', fontWeight: '500' }}>{contactName}</span>
                  </div>
                  <div style={{ width: '24px' }} />
                </div>
              ) : (
                <div style={{ height: '64px', backgroundColor: darkMode ? '#121212' : 'white', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px' }}>
                   <button style={{ color: darkMode ? 'white' : 'black', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                    </svg>
                  </button>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#8e24aa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '500', fontSize: '14px' }}>
                    {contactAvatar}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '16px', color: darkMode ? 'white' : 'black', fontWeight: '500' }}>{contactName}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', color: darkMode ? 'white' : 'black' }}>
                     <svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24" fill="currentColor">
                       <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                     </svg>
                     <svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24" fill="currentColor">
                       <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.44-5.15-3.75-6.59-6.59l1.97-1.57c.27-.27.35-.66.24-1.01-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3.3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .72-.63.72-1.19v-3.44c0-.54-.45-.99-.99-.99z"/>
                     </svg>
                     <svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24" fill="currentColor">
                       <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                     </svg>
                  </div>
                </div>
              )}

              {/* Messages Area */}
              <div style={{ flex: 1, backgroundColor: darkMode ? (osMode === 'iOS' ? '#000000' : '#121212') : 'white', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {messageGroups.map((group, groupIndex) => (
                  <div
                    key={groupIndex}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      alignItems: group.sender === 'me' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {group.messages.map((msg, msgIndex) => {
                      const isFirst = msgIndex === 0
                      const isLast = msgIndex === group.messages.length - 1
                      const isOnly = group.messages.length === 1

                      let borderRadius
                      if (osMode === 'iOS') {
                        if (group.sender === 'me') {
                          if (isOnly) borderRadius = '20px 20px 4px 20px'
                          else if (isFirst) borderRadius = '20px 20px 4px 20px'
                          else if (isLast) borderRadius = '20px 4px 20px 20px'
                          else borderRadius = '20px 4px 4px 20px'
                        } else {
                          if (isOnly) borderRadius = '20px 20px 20px 4px'
                          else if (isFirst) borderRadius = '20px 20px 20px 4px'
                          else if (isLast) borderRadius = '4px 20px 20px 20px'
                          else borderRadius = '4px 20px 20px 4px'
                        }
                      } else {
                        // Android styles
                        if (group.sender === 'me') {
                            borderRadius = '20px 20px 4px 20px'
                        } else {
                            borderRadius = '20px 20px 20px 4px'
                        }
                      }

                      const bg = osMode === 'iOS'
                        ? (group.sender === 'me' ? '#007AFF' : (darkMode ? '#26252a' : '#E9E9EB'))
                        : (group.sender === 'me' ? '#0b57cf' : (darkMode ? '#303030' : '#f2f2f2'))

                      const color = osMode === 'iOS'
                        ? (group.sender === 'me' ? 'white' : (darkMode ? 'white' : 'black'))
                        : (group.sender === 'me' ? 'white' : (darkMode ? '#e3e3e3' : '#1f1f1f'))

                      return (
                        <div
                          key={msg.id}
                          className={msg.isNew ? 'message-animate' : ''}
                          style={{
                            maxWidth: '70%',
                            padding: '8px 12px',
                            borderRadius,
                            backgroundColor: bg,
                            color: color,
                            boxShadow: osMode === 'Android' && group.sender === 'them' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                          }}
                        >
                          <p style={{ fontSize: '16px', lineHeight: 1.3, wordBreak: 'break-word', margin: 0 }}>{msg.text}</p>
                        </div>
                      )
                    })}
                    {osMode === 'Android' && group.sender === 'them' && groupIndex === messageGroups.length - 1 && (
                         <div style={{ fontSize: '11px', color: darkMode ? '#aaaaaa' : '#666666', marginTop: '2px', marginLeft: '4px' }}>Just now</div>
                    )}
                  </div>
                ))}

                {/* Typing Indicator */}
                {showTyping && (
                  <div
                    className="message-animate"
                    style={{ display: 'flex', alignItems: 'flex-start' }}
                  >
                    <div style={{ backgroundColor: osMode === 'iOS' ? (darkMode ? '#26252a' : '#E9E9EB') : (darkMode ? '#303030' : '#f2f2f2'), borderRadius: '20px', padding: '12px 16px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <div className="typing-dot" style={{ width: '8px', height: '8px', backgroundColor: darkMode ? '#636366' : '#8E8E93', borderRadius: '50%' }} />
                      <div className="typing-dot" style={{ width: '8px', height: '8px', backgroundColor: darkMode ? '#636366' : '#8E8E93', borderRadius: '50%' }} />
                      <div className="typing-dot" style={{ width: '8px', height: '8px', backgroundColor: darkMode ? '#636366' : '#8E8E93', borderRadius: '50%' }} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              {osMode === 'iOS' ? (
                <div style={{
                    minHeight: '52px',
                    backgroundColor: darkMode ? '#1c1c1e' : '#f6f6f6',
                    borderTop: `1px solid ${darkMode ? '#38383a' : '#e5e5e5'}`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 8px 8px 4px',
                    gap: '6px'
                }}>
                    <button style={{
                    color: '#007AFF',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                    }}>
                    <svg style={{ width: '28px', height: '28px' }} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                    </svg>
                    </button>

                    <div style={{
                    flex: 1,
                    height: '36px',
                    backgroundColor: darkMode ? '#1c1c1e' : 'white',
                    border: `1px solid ${darkMode ? '#38383a' : '#c8c8c8'}`,
                    borderRadius: '18px',
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                    }}>
                    <span style={{ color: darkMode ? '#8e8e93' : '#8e8e93', fontSize: '16px' }}>iMessage</span>
                    <svg style={{ width: '24px', height: '24px', color: '#8e8e93' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
                        <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round"/>
                    </svg>
                    </div>

                    <button style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                    }}>
                    <svg style={{ width: '28px', height: '28px', color: '#007AFF' }} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                    </button>
                </div>
              ) : (
                <div style={{
                    minHeight: '64px',
                    backgroundColor: darkMode ? '#121212' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    gap: '12px'
                }}>
                   <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: darkMode ? '#303030' : '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <svg style={{ width: '16px', height: '16px', color: darkMode ? 'white' : 'black' }} viewBox="0 0 24 24" fill="currentColor">
                           <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                       </svg>
                   </div>
                   
                   <div style={{ 
                       flex: 1, 
                       height: '44px', 
                       backgroundColor: darkMode ? '#303030' : '#f2f2f2', 
                       borderRadius: '22px', 
                       padding: '0 16px', 
                       display: 'flex', 
                       alignItems: 'center',
                       justifyContent: 'space-between'
                    }}>
                       <span style={{ color: '#757575', fontSize: '16px' }}>Text message</span>
                       <svg style={{ width: '24px', height: '24px', color: '#757575' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                       </svg>
                   </div>
                   
                   <button style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0b57cf'
                    }}>
                        <svg style={{ width: '28px', height: '28px' }} viewBox="0 0 24 24" fill="currentColor">
                           <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                   </button>
                </div>
              )}

              {/* Home Indicator */}
              <div style={{ height: '34px', backgroundColor: darkMode ? (osMode === 'iOS' ? '#000000' : '#121212') : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: osMode === 'iOS' ? '134px' : '72px', height: osMode === 'iOS' ? '5px' : '2px', backgroundColor: darkMode ? '#ffffff' : 'black', borderRadius: '3px', opacity: osMode === 'iOS' ? 1 : 0.4 }} />
              </div>
            </div>
          </div>

          {/* Dynamic Island / Hole Punch */}
          {osMode === 'iOS' ? (
              <div style={{ position: 'absolute', top: '26px', left: '50%', transform: 'translateX(-50%)', width: '120px', height: '35px', backgroundColor: 'black', borderRadius: '20px' }} />
          ) : (
              <div style={{ position: 'absolute', top: '28px', left: '50%', transform: 'translateX(-50%)', width: '20px', height: '20px', backgroundColor: 'black', borderRadius: '50%' }} />
          )}
        </div>
      </div>
    </div>
  )
}
