import requests
import csv
from io import StringIO
from collections import Counter

# Fetch the logs CSV
url = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logs_result-fctMKMUxJU9OVshcvoe4Fnlpp2S90Z.csv"
response = requests.get(url)
csv_data = StringIO(response.text)

# Parse CSV
reader = csv.DictReader(csv_data)
logs = list(reader)

print(f"[v0] Total log entries: {len(logs)}")
print("\n" + "="*80)

# Filter for /welcome requests
welcome_logs = [log for log in logs if '/welcome' in log.get('requestPath', '')]
print(f"\n[v0] /welcome requests: {len(welcome_logs)}")

if welcome_logs:
    print("\n[v0] /welcome request details:")
    for log in welcome_logs[:10]:  # Show first 10
        print(f"  - Time: {log.get('TimeUTC')}")
        print(f"    Status: {log.get('responseStatusCode')}")
        print(f"    Type: {log.get('type')}")
        print(f"    Message: {log.get('message')}")
        print()

# Check for errors
error_logs = [log for log in logs if log.get('level') == 'error' or int(log.get('responseStatusCode', 200)) >= 400]
print(f"\n[v0] Error logs: {len(error_logs)}")

if error_logs:
    print("\n[v0] Recent errors:")
    for log in error_logs[-10:]:  # Show last 10 errors
        print(f"  - Time: {log.get('TimeUTC')}")
        print(f"    Path: {log.get('requestPath')}")
        print(f"    Status: {log.get('responseStatusCode')}")
        print(f"    Message: {log.get('message')}")
        print()

# Status code distribution
status_codes = Counter(log.get('responseStatusCode') for log in logs)
print("\n[v0] Status code distribution:")
for code, count in status_codes.most_common():
    print(f"  {code}: {count}")

# Check for middleware errors
middleware_errors = [log for log in logs if 'Auth error' in log.get('message', '')]
print(f"\n[v0] Middleware auth errors: {len(middleware_errors)}")

# Check for specific error messages
error_messages = Counter(log.get('message') for log in logs if log.get('message'))
print("\n[v0] Top error messages:")
for msg, count in error_messages.most_common(10):
    if msg and ('error' in msg.lower() or 'failed' in msg.lower()):
        print(f"  [{count}x] {msg}")
