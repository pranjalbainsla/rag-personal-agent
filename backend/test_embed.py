# run this as a one-off test, not in your app yet
from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
client = genai.Client()

result = client.models.embed_content(
        model="gemini-embedding-001",
        contents="I prefer async remote teams"
)

print("\nEmbedding result:")
print(f"Type: {type(result.embeddings)}")        # should be list
print(f"Length: {len(result.embeddings)}")       # should be 768
print(f"First 5 values: {result.embeddings[:5]}")  # first 5 floats