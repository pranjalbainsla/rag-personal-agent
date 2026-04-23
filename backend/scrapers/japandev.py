import httpx
from database import supabase
import os
import json
import asyncio
import asyncpg
import time
from dotenv import load_dotenv
load_dotenv()

URL = "https://meili.japan-dev.com/multi-search"

HEADERS = {
    "Authorization": f"Bearer {os.getenv('JAPANDEV_API_KEY')}",
    "Content-Type": "application/json",
    "Origin": "https://japan-dev.com",
    "Referer": "https://japan-dev.com/"
}
PAYLOAD = {
    "queries": [
        {
            "indexUid": "Job_production",
            "q": "",
            "filter": [
                "",
                ["japanese_level_enum=japanese_level_not_required"],
                ["seniority_level=seniority_level_new_grad", "seniority_level=seniority_level_junior"]
            ],
            "limit": 100,
            "offset": 0,
            "attributesToHighlight": ["*"]
        }
    ]
}
async def notify_new_jobs(ctx, saved: int):
    async with ctx.pool.acquire() as conn:
        payload = json.dumps({
            "count": saved,
            "notified_at": time.time()
        }).replace("'", "''")
        await conn.execute(f"NOTIFY new_job, '{payload}'")


async def scrape_japandev(ctx):
    print("Scraping japan-dev.com (new grad filter)...")

    try:
        response = httpx.post(URL, json=PAYLOAD, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch japan-dev: {e}")
        return

    data = response.json()
    hits = data["results"][0]["hits"]

    if not hits:
        print("No results returned")
        return

    saved = 0
    new_jobs = []

    for hit in hits:
        try:
            title = hit["title"]
            company = hit["company_name"]
            company_slug = hit["company"]["slug"]
            job_slug = hit["slug"]
            url = f"https://japan-dev.com/jobs/{company_slug}/{job_slug}"
            tags = hit.get("skill_names", [])

            # check if job already exists
            existing = supabase.table("jobs").select("id").eq("url", url).execute()
            
            if not existing.data:  # only notify for genuinely new jobs
                supabase.table("jobs").upsert({
                    "source": "japandev",
                    "title": title,
                    "company": company,
                    "url": url,
                    "tags": tags
                }, on_conflict="url").execute()

                new_jobs.append({"title": title, "company": company, "source": "japandev", "url": url})
                print(title)
                saved += 1

        except Exception as e:
            print(f"Error saving job: {e}")
            continue
    # fire notifications for new jobs
    print(saved)
    if saved > 0:
        try:
            await notify_new_jobs(ctx, saved)
        except Exception as e:
            print("Notify failed:", e)

    print(f"japandev: saved {saved} new grad jobs")

async def run_scraper(ctx):
    await asyncio.sleep(30)
    while True:
        try:
            await scrape_japandev(ctx)
        except Exception as e:
            print("Scraper error:", e)

        print("sleeping for 60 seconds")
        await asyncio.sleep(60)