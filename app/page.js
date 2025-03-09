// app/page.js
'use client';
import { useState, useRef, useEffect } from 'react';
import { FiUploadCloud, FiSend, FiFileText, FiSun, FiMoon, FiVolume2, FiMenu, FiX, FiRefreshCw, FiVolumeX } from 'react-icons/fi';

export default function DocumentChat() {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false); // Track if speech is active
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const synth = useRef(null); // Ref for speech synthesis

  useEffect(() => {
    synth.current = window.speechSynthesis;
  }, []);

  // Text-to-speech with female voice
  const speak = (text) => {
    if (synth.current.speaking) {
      synth.current.cancel(); // Stop any ongoing speech
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.current.getVoices();
    const femaleVoice = voices.find(v => 
      v.name.includes('Female') || 
      v.name.includes('Zira') || 
      v.lang === 'en-US'
    );

    utterance.voice = femaleVoice || voices[0];
    utterance.rate = 1.1;
    utterance.pitch = 1.2;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    synth.current.speak(utterance);
  };

  // Stop speech
  const stopSpeech = () => {
    if (synth.current.speaking) {
      synth.current.cancel();
      setIsSpeaking(false);
    }
  };

  // Default responses
  const getDefaultResponse = (message) => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('hi') || lowerMessage.includes('hello')) {
      return "Hello! I'm DocAI, your document assistant. How can I help you today?";
    }
    if (lowerMessage.includes('thank you') || lowerMessage.includes('thanks')) {
      return "You're welcome! Let me know if you need anything else.";
    }
    return null;
  };

  // Create new chat
  const createNewChat = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      setIsLoading(true);
      setProcessingStage('Uploading document...');
      
      try {
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 10, 90));
        }, 300);

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'process-document',
            documentBase64: base64,
            documentName: file.name
          }),
        });

        clearInterval(progressInterval);
        setUploadProgress(100);
        setProcessingStage('Analyzing content...');

        const { extractedInfo, documentUrl } = await response.json();
        
        const newChat = {
          id: Date.now(),
          document: { name: file.name, url: documentUrl },
          messages: [
            {
              role: 'assistant',
              content: "Hello! I'm DocAI. I've analyzed your document and ready to answer questions. Ask me anything!",
              timestamp: new Date().toISOString()
            }
          ],
          extractedInfo
        };

        setChats(prev => [newChat, ...prev]);
        setActiveChat(newChat.id);
        setSidebarOpen(false);
      } catch (error) {
        alert('Error processing document');
      } finally {
        setIsLoading(false);
        setUploadProgress(0);
        setProcessingStage('');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle question submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeChat) return;

    const currentChat = chats.find(c => c.id === activeChat);
    const defaultResponse = getDefaultResponse(input);
    
    if (defaultResponse) {
      setChats(prev => prev.map(chat => 
        chat.id === activeChat 
          ? { ...chat, messages: [...chat.messages, {
              role: 'user',
              content: input,
              timestamp: new Date().toISOString()
            }, {
              role: 'assistant',
              content: defaultResponse,
              timestamp: new Date().toISOString()
            }] }
          : chat
      ));
      setInput('');
      speak(defaultResponse);
      return;
    }

    setIsLoading(true);
    setChats(prev => prev.map(chat => 
      chat.id === activeChat 
        ? { ...chat, messages: [...chat.messages, {
            role: 'user',
            content: input,
            timestamp: new Date().toISOString()
          }] }
        : chat
    ));
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask-question',
          question: input,
          extractedInfo: currentChat.extractedInfo
        }),
      });

      const { response: aiResponse } = await response.json();
      setChats(prev => prev.map(chat => 
        chat.id === activeChat 
          ? { ...chat, messages: [...chat.messages, {
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date().toISOString()
            }] }
          : chat
      ));
      speak(aiResponse);
    } catch (error) {
      setChats(prev => prev.map(chat => 
        chat.id === activeChat 
          ? { ...chat, messages: [...chat.messages, {
              role: 'assistant',
              content: 'Error processing request',
              timestamp: new Date().toISOString()
            }] }
          : chat
      ));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeChat]);

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-gray-600' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 z-20 transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0 w-64' : 'translate-x-0 w-64'}
        ${darkMode ? 'bg-gray-800 border-r border-gray-700' : 'bg-white border-r border-gray-200'}`}>
        
        <div className="h-full flex flex-col">
          <div className="p-4">
            <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-600'}`}>
              Chat History
            </h2>
            <button
              onClick={() => fileInputRef.current.click()}
              className={`w-full mb-4 p-2 rounded-lg flex items-center justify-center gap-2 transition-all
                ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-blue-100 hover:bg-blue-200 text-blue-600'}`}
            >
              <FiUploadCloud className="w-4 h-4" />
              New Chat
            </button>
            <div className="overflow-y-auto flex-1 pr-2">
              {chats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => {
                    setActiveChat(chat.id);
                    setSidebarOpen(false);
                  }}
                  className={`p-3 rounded-lg cursor-pointer transition-all mb-2
                    ${chat.id === activeChat 
                      ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                      : (darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}`}
                >
                  <p className="truncate text-sm font-medium">{chat.document.name}</p>
                  <p className="text-xs text-opacity-75 mt-1">
                    {new Date(chat.messages[0].timestamp).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-64'}`}>
        {/* Top Bar */}
        <div className={`p-4 border-b flex items-center justify-between
          ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
          
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {sidebarOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
          </button>
          
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            Doc<span className="text-blue-500">AI</span>
          </h1>
          
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-full transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            {darkMode ? <FiSun className="w-5 h-5 text-yellow-400" /> : <FiMoon className="w-5 h-5 text-gray-600" />}
          </button>
        </div>

        {/* Chat Area */}
        <div className="h-[calc(100vh-136px)] overflow-y-auto p-4 space-y-4">
          {activeChat ? (
            chats.find(c => c.id === activeChat).messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-2xl p-6 rounded-2xl relative group transition-all
                  ${msg.role === 'user' 
                    ? (darkMode ? 'bg-blue-400' : 'bg-blue-400 text-white')
                    : (darkMode ? 'bg-gray-100' : 'bg-gray-100')}
                  shadow-lg`}>
                  
                  <div className="flex items-center gap-2 mb-2">
                    {msg.role === 'assistant' && <FiFileText className="w-4 h-4 opacity-75" />}
                    <span className="text-sm font-medium">
                      {msg.role === 'user' ? 'You' : 'DocAI'}
                    </span>
                    <button 
                      onClick={() => speak(msg.content)}
                      className="ml-auto opacity-75 hover:opacity-100 transition-opacity"
                    >
                      <FiVolume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <span className="absolute bottom-1 right-1 text-xs opacity-50">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className={`h-full flex flex-col items-center justify-center text-center px-4
              ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <FiUploadCloud className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg">Upload a document to start chatting</p>
              <p className="text-sm mt-2 opacity-75">Supported format: PDF</p>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className={`p-4 border-t ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={e => e.target.files[0] && createNewChat(e.target.files[0])}
              className="hidden"
              accept=".pdf"
            />
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask your question..."
              className={`flex-1 p-3 rounded-xl transition-all
                ${darkMode 
                  ? 'bg-gray-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500' 
                  : 'bg-gray-50 text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-blue-400'}
                outline-none`}
              disabled={!activeChat || isLoading}
            />
            <button
              type="submit"
              disabled={!activeChat || isLoading}
              className={`p-3 rounded-xl flex items-center justify-center transition-all
                ${darkMode 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                  : 'bg-blue-500 hover:bg-blue-400 text-white'}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <FiRefreshCw className="animate-spin w-5 h-5" />
              ) : (
                <FiSend className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50`}>
          <div className={`p-8 rounded-2xl flex flex-col items-center ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="relative w-24 h-24 mb-4">
              <div className="absolute inset-0 flex items-center justify-center">
                <FiRefreshCw className={`animate-spin w-12 h-12 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              </div>
              <svg className="absolute inset-0" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  className={`stroke-current ${darkMode ? 'text-gray-700' : 'text-gray-200'}`}
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  className="stroke-current text-blue-500"
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - uploadProgress / 100)}`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
            </div>
            <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              {processingStage}
            </h3>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {uploadProgress}% Completed
            </p>
            <p className={`text-xs mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              This usually takes 10-30 seconds depending on document size
            </p>
          </div>
        </div>
      )}

      {/* Stop Speech Button */}
      {isSpeaking && (
        <button
          onClick={stopSpeech}
          className={`fixed bottom-4 right-4 p-3 rounded-full flex items-center justify-center transition-all
            ${darkMode ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-500 hover:bg-red-400 text-white'}
            shadow-lg z-50`}
        >
          <FiVolumeX className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}