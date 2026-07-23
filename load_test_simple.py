import asyncio
import urllib.request
import time

URL = "https://main.bc-charge.com"
CONCURRENT_USERS = 10
TOTAL_REQUESTS = 100

def fetch_sync(url):
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            status = response.getcode()
            end = time.perf_counter()
            return status, end - start
    except Exception as e:
        return str(e), 0

async def main():
    loop = asyncio.get_running_loop()
    tasks = []
    for _ in range(TOTAL_REQUESTS):
        tasks.append(loop.run_in_executor(None, fetch_sync, URL))
    
    results = await asyncio.gather(*tasks)
    
    success_count = len([r for r in results if r[0] == 200])
    times = [r[1] for r in results if r[1] > 0]
    
    print(f"Total Requests: {len(results)}")
    print(f"Successes: {success_count}")
    print(f"Avg Time: {sum(times)/len(times) if times else 0:.4f}s")
    print(f"Min Time: {min(times) if times else 0:.4f}s")
    print(f"Max Time: {max(times) if times else 0:.4f}s")
    if success_count < TOTAL_REQUESTS:
        print(f"Errors: {TOTAL_REQUESTS - success_count}")

if __name__ == "__main__":
    asyncio.run(main())
