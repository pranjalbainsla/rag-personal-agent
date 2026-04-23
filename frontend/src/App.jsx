import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { parseMarkdown, renderParsedMarkdown } from "@/lib/markdown.jsx"

const API = "http://localhost:8000"

export default function App() {
  const [tab, setTab] = useState("chat")
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hey! I'm your assistant. Ask me for jobs, tasks, or just chat." }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState([])
  const [tasks, setTasks] = useState([])
  const [notification, setNotification] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    const es = new EventSource("http://localhost:8000/stream")

    es.onmessage = (event) => {
      if (event.data === "heartbeat") return  // ignore keepalives

      try {
        const new_jobs = JSON.parse(event.data)
        console.log(new_jobs.notified_at)
        const latency = new_jobs.notified_at ? Date.now() - (new_jobs.notified_at * 1000) : 0
        console.log(`SSE delivery latency: ${latency}ms`)
        setNotification(`${new_jobs.count} new jobs for you!`)

        // auto dismiss after 5 seconds
        setTimeout(() => setNotification(null), 5000)
      } catch (e) {
        console.error("Failed to parse SSE event", e)
      }
    }

    es.onerror = (err) => {
      console.error("SSE connection error", err)
    }

    // cleanup on unmount
    return () => es.close()
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  useEffect(() => {
    if (tab === "jobs") fetchJobs()
    if (tab === "tasks") fetchTasks()
  }, [tab])

  const fetchJobs = async () => {
    const res = await fetch(`${API}/jobs`)
    const data = await res.json()
    setJobs(data)
  }

  const fetchTasks = async () => {
    const res = await fetch(`${API}/tasks`)
    const data = await res.json()
    setTasks(data)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: "user", content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    const history = newMessages.slice(0, -1).map(m => ({
      role: m.role, content: m.content
    }))
    const res = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input, history })
    })
    const data = await res.json()
    setMessages([...newMessages, { role: "assistant", content: data.reply }])
    setLoading(false)
  }

  const markSeen = async (id) => {
    await fetch(`${API}/jobs/${id}/seen`, { method: "PATCH" })
    setJobs(jobs.filter(j => j.id !== id))
  }

  const markDone = async (id) => {
    await fetch(`${API}/tasks/${id}/done`, { method: "PATCH" })
    setTasks(tasks.filter(t => t.id !== id))
  }

  const priorityConfig = {
    0: { color: "bg-red-100 text-red-700", label: "P0" },
    1: { color: "bg-amber-100 text-amber-700", label: "P1" },
    2: { color: "bg-green-100 text-green-700", label: "P2" }
  }

  return (
    <div id="root" className="h-screen">
      
        <div className="w-full max-w-3xl mx-auto flex flex-col h-full">
          {notification && (
            <div className="fixed top-4 right-4 z-100 max-w-sm">
              <div className="bg-slate-900 text-white rounded-xl p-4 pr-12 shadow-lg border border-slate-800/50">
                {notification}
                <button 
                  onClick={() => setNotification(null)} 
                  className="absolute top-2 right-2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {/* Tabs */}
          <div className="flex-0 p-4 border-b border-slate-200">
            <div className="relative inline-flex gap-10 rounded-2xl p-1 
                            bg-white/20 backdrop-blur-2xl 
                            border border-white/30 
                            shadow-[0_8px_30px_rgba(0,0,0,0.08)]">

              {/* subtle inner glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl 
                              bg-gradient-to-b from-white/40 via-white/10 to-transparent" />

              {["chat", "jobs", "tasks"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                    tab === t
                      ? "bg-gradient-to-b from-gray-200/60 to-gray-100/30 text-gray-900 shadow-md ring-1 ring-rose-300/50 backdrop-blur-md"
                      : "text-slate-600 hover:bg-white/40 hover:text-slate-900"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Tab */}
          {tab === "chat" && (
            <div className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 w-full px-4 py-2 overflow-y-auto">
            
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"} no-scrollbar`}
                    >
                      {m.role === "assistant" && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src="https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka" />
                          <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                      )}
                      {m.role === "user" ? (
                        <Card className="max-w-xs lg:max-w-md px-4 py-3 my-4 
                                        bg-gradient-to-b from-slate-200/70 to-slate-100/40 
                                        text-slate-900 border border-white/40 
                                        backdrop-blur-xl shadow-sm 
                                        rounded-3xl rounded-tr-sm">
                          <div className="text-sm leading-relaxed text-left">
                            {renderParsedMarkdown(parseMarkdown(m.content))}
                          </div>
                        </Card>
                      ) : (
                        <div className="max-w-xs lg:max-w-md text-left text-slate-700">
                          <div className="text-sm leading-relaxed text-left">
                            {renderParsedMarkdown(parseMarkdown(m.content))}
                          </div>
                        </div>
                      )}
                      {m.role === "user" && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src="https://api.dicebear.com/9.x/lorelei/svg?seed=Luna" />
                          <AvatarFallback>You</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Bot" />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                      <div className="text-sm text-slate-500 italic">typing...</div>
                    </div>
                  )}
                  <div ref={bottomRef} />
  
              </ScrollArea>

              {/* Message Input */}
              <div className="mb-8 flex-0">

                <div className="flex gap-3 items-end 
                                rounded-2xl p-2 
                                bg-white/20 backdrop-blur-2xl 
                                border border-white/30 
                                shadow-[0_8px_30px_rgba(0,0,0,0.1)]">

                  {/* subtle inner glow */}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl 
                                  bg-gradient-to-b from-white/40 via-white/10 to-transparent" />

                  <Textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder="Chat, or try: remember:pref async teams only / task:0 Apply to X"
                    className="flex-1 resize-none min-h-12 max-h-32 
                              bg-transparent border-none outline-none 
                              focus:outline-none focus:ring-0 focus:border-none 
                              text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0"
                  />

                  <Button
                    onClick={sendMessage}
                    disabled={loading}
                    className="mb-2 self-end px-6 rounded-xl 
                              bg-gradient-to-b from-slate-200/70 to-slate-100/40 
                              text-slate-900 
                              border border-white/40 
                              shadow-sm hover:shadow-md 
                              hover:bg-slate-200/60 
                              transition-all"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Jobs Tab */}
          {tab === "jobs" && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3 pr-4">
                {jobs.length === 0 && (
                  <p className="text-slate-500 text-center py-8">No new jobs. Run the scraper!</p>
                )}
                {jobs.map(j => (
                  <Card key={j.id} className="p-4 border border-slate-200">
                    <div className="flex justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{j.title}</h3>
                        <p className="text-sm text-slate-600 mt-1">{j.company} · {j.source}</p>
                        <a
                          href={j.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                        >
                          View job →
                        </a>
                      </div>
                      <Button
                        onClick={() => markSeen(j.id)}
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0"
                      >
                        Mark seen
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Tasks Tab */}
          {tab === "tasks" && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3 pr-4">
                {tasks.length === 0 && (
                  <p className="text-slate-500 text-center py-8">No pending tasks!</p>
                )}
                {tasks.map(t => (
                  <Card key={t.id} className="p-4 border border-slate-200 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${priorityConfig[t.priority].color}`}>
                        {priorityConfig[t.priority].label}
                      </span>
                      <span className="text-sm text-slate-900">{t.content}</span>
                    </div>
                    <Button
                      onClick={() => markDone(t.id)}
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0"
                    >
                      Done ✓
                    </Button>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}

        </div>
  
    </div>
  )
}