# from services.briefing import generate_briefing
# from services.memory import save_memory
# from scrapers import run_all_scrapers

#import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from services.memory import save_memory, build_system_prompt
from database import supabase
from clients import client
from context import AppContext
from contextlib import asynccontextmanager
import asyncpg
import asyncio
from scrapers.japandev import run_scraper
from fastapi.responses import StreamingResponse
import os

@asynccontextmanager
async def lifespan(app):
    pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"))
    ctx = AppContext(pool)
    task = asyncio.create_task(run_scraper(ctx))

    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    await pool.close()

app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/chat")
def chat(body: dict):
    message = body.get("message", "").strip()
    history = body.get("history", [])

    # --- prefix: remember ---
    if message.lower().startswith("remember:"):
        parts = message[9:].strip()
        category, _, content = parts.partition(" ")
        category = category.lower().strip()

        valid = {"job", "pref", "app", "note"}
        if category not in valid:
            return {"reply": f"Unknown category '{category}'. Use: job, pref, app, note"}

        save_memory(category, content)
        return {"reply": f"Got it, saved under '{category}' ✓"}

    # --- prefix: task ---
    if message.lower().startswith("task:"):
        parts = message[5:].strip()
        priority_char, _, content = parts.partition(" ")
        try:
            priority = int(priority_char)
            assert priority in (0, 1, 2)
        except:
            return {"reply": "Priority must be 0, 1, or 2. Example: task:0 Apply to Mercari"}

        supabase.table("tasks").insert({
            "content": content,
            "priority": priority
        }).execute()
        return {"reply": f"Task added with priority {priority} ✓"}

    # --- keyword: jobs ---
    if "jobs" in message.lower() or "listings" in message.lower():
        jobs = supabase.table("jobs").select("*").eq("seen", False).order("created_at", desc=True).execute().data
        if not jobs:
            return {"reply": "No new jobs right now. Run the scraper to fetch some!"}
        
        formatted = "\n".join([
            f"• **{j['title']}** at {j['company']} ({j['source']})\n  {j['url']}"
            for j in jobs[:15]
        ])
        return {"reply": f"Here are your latest jobs:\n\n{formatted}"}

    # --- keyword: tasks ---
    if "task" in message.lower():
        priority_filter = None
        if "p0" in message.lower(): priority_filter = 0
        elif "p1" in message.lower(): priority_filter = 1
        elif "p2" in message.lower(): priority_filter = 2

        query = supabase.table("tasks").select("*").eq("done", False).order("priority")
        if priority_filter is not None:
            query = query.eq("priority", priority_filter)
        
        tasks = query.execute().data
        if not tasks:
            return {"reply": "No pending tasks!"}
        
        labels = {0: "🔴", 1: "🟡", 2: "🟢"}
        formatted = "\n".join([f"{labels[t['priority']]} {t['content']}" for t in tasks])
        return {"reply": f"Your tasks:\n\n{formatted}"}

    # gemini
    system = build_system_prompt(query=message)
    history_text = "\n".join([f"{m['role']}: {m['content']}" for m in history])
    full_prompt = f"{system}\n\n{history_text}\nuser: {message}"

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt
    )

    return {"reply": response.text}


@app.get("/jobs")
def get_jobs():
    jobs = supabase.table("jobs").select("*").eq("seen", False).order("created_at", desc=True).execute()
    return jobs.data

@app.patch("/jobs/{job_id}/seen")
def mark_seen(job_id: str):
    supabase.table("jobs").update({"seen": True}).eq("id", job_id).execute()
    return {"ok": True}

@app.get("/tasks")
def get_tasks():
    tasks = supabase.table("tasks").select("*").eq("done", False).order("priority").execute()
    return tasks.data

@app.patch("/tasks/{task_id}/done")
def mark_done(task_id: str):
    supabase.table("tasks").update({"done": True}).eq("id", task_id).execute()
    return {"ok": True}

# endpoint that sends live-updates to the frontend
@app.get("/stream")
async def stream(request: Request):
    async def event_generator():
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"), ssl="require")
        queue = asyncio.Queue()

        # callback fires every time NOTIFY new_job is received
        def handle_notification(conn, pid, channel, payload):
            asyncio.get_event_loop().call_soon_threadsafe(
                queue.put_nowait, payload
            )

        await conn.add_listener("new_job", handle_notification)

        try:
            # send a heartbeat every 30s so the connection stays alive
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield "data: heartbeat\n\n"  # keep connection alive
        finally:
            await conn.remove_listener("new_job", handle_notification)
            await conn.close()
            print("SSE client disconnected, cleaned up")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"  # tells nginx not to buffer SSE
        }
    )

