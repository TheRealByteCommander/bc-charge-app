import asyncio
import httpx
import time

URL = "https://main.bc-charge.com"
CONCURRENT_USERS = 10
TOTAL_REQUESTS = 100

async def fetch(client):
    start = time.perf_counter()
    try:
        resp = await client.get(URL)
        end = time.perf_counter()
        return resp.status_code, end - start
    except Exception as e:
        return str(e), 0

async def main():
    async with httpx.AsyncClient() as client:
        tasks = []
        # Split total requests among concurrent workers
        for _ in range(TOTAL_REQUESTS):
            tasks.append(fetch(client))
        
        # Run in batches to simulate concurrency
        results = []
        for i in range(0, len(tasks), CONCURRENT_USERS):
            batch = tasks[i:i+CONCURRENT_USERS]
            batch_results = await asyncio.gather(*batch)
            results.extend(batch_results)
            
        # Analyze results
        successes = [r for r in results if r[0] == 200]
        times = [r[1] for r in results if r[1] > 0]
        
        print(f"Total Requests: {len(results)}")
        print(f"Successes: {len(successes)}")
        print(f"Avg Time: {sum(times)/len(times) if times else 0:.4f}s")
        print(f"Min Time: {min(times) if times else 0:.4f}s")
        print(f"Max Time: {max(times) if times else 0:.4f}s")
        if successes < TOTAL_REQUESTS:
            print(f"Errors: {TOTAL_REQUESTS - len(successes)}")

if __name__ == "__main__":
    asyncio.run(main())
