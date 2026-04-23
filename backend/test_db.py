from database import supabase

# test 1: insert a row
response = supabase.table("memory").insert({
    "category": "pref",
    "key": "test entry",
    "value": "this is a test memory"
}).execute()

print("Insert response:", response.data)

# test 2: read it back
result = supabase.table("memory").select("*").execute()
print("All memory rows:", result.data)