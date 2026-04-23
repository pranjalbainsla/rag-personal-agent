from clients import client
from database import supabase
from services.similarity import cosine_similarity
import json


def get_embedding(text: str) -> list[float]:
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text
)
    return result.embeddings[0].values

def save_memory(category: str, value: str):
    embedding = get_embedding(value)
    
    supabase.table("memory").insert({
        "category": category,
        "value": value,
        "embedding": embedding
    }).execute()

def build_system_prompt(query: str = None) -> str:
    # if no query, fall back to fetching all memories
    if not query:
        memories = supabase.table("memory").select("category, value").execute().data
        if not memories:
            return "You are a personal assistant helping a new grad developer find jobs and stay organized."
        
        memory_text = "\n".join([f"[{m['category']}] {m['value']}" for m in memories])
        return f"""You are a personal assistant for a new grad developer. 
            Here is everything you know about them:
            {memory_text}
            Be concise and friendly. When they ask for jobs or tasks, fetch and present them clearly."""

    query_embedding = get_embedding(query)
    relevant = get_relevant_memories(query_embedding, top_k=5)

    
    if not relevant:
        return "You are a personal assistant helping a new grad developer."
    
    memory_text = "\n".join([f"[{m['category']}] {m['value']}" for m in relevant])
    return f"You are a personal assistant. Relevant context:\n{memory_text}"

def get_relevant_memories_manual(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    result = supabase.table("memory").select("value, category, embedding").not_.is_("embedding", "null").execute()
    memories = result.data

    if not memories:
        return []
    
    scored = []
    for m in memories:
        if m["embedding"]:
            embedding = json.loads(m["embedding"])
            score = cosine_similarity(query_embedding, embedding)
            scored.append((score, m))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    return [m for _, m in scored[:top_k]]

def get_relevant_memories(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    result = supabase.rpc("match_memories", {
        "query_embedding": query_embedding,
        "match_count": top_k
    }).execute()
    
    return result.data