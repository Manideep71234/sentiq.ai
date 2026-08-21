import os
import sys
import json
import time
import asyncio
import re
from pathlib import Path
from playwright.async_api import async_playwright, Page, Request, Response

# Ensure we have a place to store screenshots
ARTIFACTS_DIR = Path(os.environ.get("ARTIFACTS_DIR", "./audit_artifacts"))
ARTIFACTS_DIR.mkdir(exist_ok=True, parents=True)

class AuditState:
    def __init__(self):
        self.console_errors = []
        self.failed_requests = []
        self.data_leaks = []
        self.current_user_id = None
        self.other_user_id = None
        self.visited_urls = set()

audit_state = AuditState()

def check_for_leaks(response_url: str, body: str):
    # 1. Check for passwords / hashes
    if re.search(r'"password"\s*:\s*".+"', body, re.IGNORECASE) or \
       re.search(r'"password_hash"\s*:\s*".+"', body, re.IGNORECASE) or \
       re.search(r'"encrypted_password"\s*:\s*".+"', body, re.IGNORECASE):
        audit_state.data_leaks.append(f"Leak: Password field found in response from {response_url}")
        
    # 2. Check for API keys
    if re.search(r'"(?:sk-[a-zA-Z0-9]{32,}|gsk_[a-zA-Z0-9]{32,})"', body):
        audit_state.data_leaks.append(f"Leak: Raw API key found in response from {response_url}")
        
    # 3. Check for cross-user data leakage
    # We assume standard JSON structure where user ID might be leaked.
    if audit_state.other_user_id:
        # Avoid simple ID matches if it's just a number, but check if it's a specific object
        if f'"user_id":{audit_state.other_user_id}' in body or f'"user_id": {audit_state.other_user_id}' in body:
            audit_state.data_leaks.append(f"Leak: Data belonging to User {audit_state.other_user_id} found in response from {response_url} while logged in as User {audit_state.current_user_id}")

async def handle_response(response: Response):
    # We only care about JSON/XHR responses
    if "application/json" in response.headers.get("content-type", ""):
        if not response.ok:
            audit_state.failed_requests.append(f"{response.status} {response.url}")
        try:
            body = await response.text()
            check_for_leaks(response.url, body)
            
            # Extract user_id on /auth/me for reference
            if "/auth/me" in response.url and '"id"' in body:
                try:
                    data = json.loads(body)
                    if "id" in data:
                        audit_state.current_user_id = data["id"]
                except:
                    pass
        except Exception:
            pass

async def handle_console(msg):
    if msg.type == "error":
        audit_state.console_errors.append(msg.text)

async def run_tab_audit(page: Page, tab_name: str, test_action=None):
    print(f"Auditing tab: {tab_name}...")
    await page.wait_for_timeout(2000)
    
    if test_action:
        try:
            await test_action(page)
            await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Error executing action on {tab_name}: {e}")
            audit_state.console_errors.append(f"Action failed on {tab_name}: {e}")
            
    # Screenshot
    screenshot_path = ARTIFACTS_DIR / f"{tab_name.replace(' ', '_').lower()}.png"
    await page.screenshot(path=str(screenshot_path))
    print(f"Saved screenshot for {tab_name}")

async def cleanup_test_data(page: Page):
    print("Running explicit cleanup of 'Audit Test' data...")
    # Delete test chat sessions
    await page.click("text=Chat")
    await page.wait_for_timeout(1000)
    # The delete button logic is tricky in UI. Let's just execute a JS fetch to delete everything with "Audit Test"
    await page.evaluate("""async () => {
        // Cleanup Chats
        const chatRes = await fetch('/chat/sessions');
        if (chatRes.ok) {
            const chats = await chatRes.json();
            for (const chat of chats) {
                if (chat.title && chat.title.includes('Audit Test')) {
                    await fetch(`/chat/sessions/${chat.id}`, {method: 'DELETE'});
                }
            }
        }
        
        // Cleanup Documents
        const docRes = await fetch('/documents');
        if (docRes.ok) {
            const docs = await docRes.json();
            for (const doc of docs) {
                if (doc.title && doc.title.includes('Audit Test')) {
                    await fetch(`/documents/${doc.id}`, {method: 'DELETE'});
                }
            }
        }
        
        // Cleanup Notes
        const noteRes = await fetch('/notes');
        if (noteRes.ok) {
            const notes = await noteRes.json();
            for (const note of notes) {
                if (note.title && note.title.includes('Audit Test')) {
                    await fetch(`/notes/${note.id}`, {method: 'DELETE'});
                }
            }
        }
        
        // Cleanup Events
        const calRes = await fetch('/calendar');
        if (calRes.ok) {
            const events = await calRes.json();
            for (const event of events) {
                if (event.summary && event.summary.includes('Audit Test')) {
                    await fetch(`/calendar/${event.id}`, {method: 'DELETE'});
                }
            }
        }
    }""")
    print("Cleanup complete.")

async def perform_audit(playwright, user_credentials, other_user_id=None):
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context()
    page = await context.new_page()
    
    page.on("response", handle_response)
    page.on("console", handle_console)
    
    url = "https://sentiq-ai.vercel.app"
    print(f"Navigating to {url}")
    await page.goto(url)
    
    # Login
    await page.wait_for_selector("input[placeholder='Username']")
    await page.fill("input[placeholder='Username']", user_credentials['username'])
    await page.fill("input[placeholder='Password']", user_credentials['password'])
    await page.click("button:has-text('Login')")
    
    await page.wait_for_selector("text=Sentiq.AI", timeout=10000)
    
    audit_state.other_user_id = other_user_id
    
    # Walkthrough Tabs
    
    # 1. Chat
    async def chat_action(p):
        await p.fill("textarea", "Audit Test Message")
        await p.keyboard.press("Enter")
    await run_tab_audit(page, "Chat", chat_action)
    
    # 2. Research
    await page.click("text=Research")
    async def research_action(p):
        await p.fill("input[placeholder*='research']", "Audit Test Research")
        await p.keyboard.press("Enter")
    await run_tab_audit(page, "Research", research_action)
    
    # 3. Documents
    await page.click("text=Documents")
    async def doc_action(p):
        await p.click("button:has-text('New')")
        # Ensure focus is on title to rename to 'Audit Test Doc'
        # Fallback to JS creation if UI is complex
        await p.evaluate("fetch('/documents', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({title: 'Audit Test Doc', doc_type: 'markdown'})})")
        await p.reload()
    await run_tab_audit(page, "Documents", doc_action)
    
    # 4. Email
    await page.click("text=Email")
    await run_tab_audit(page, "Email")
    
    # 5. Notes
    await page.click("text=Notes")
    async def note_action(p):
        await p.click("button:has-text('New Note')")
        await p.fill("input[placeholder='Note Title']", "Audit Test Note")
        await p.click("button:has-text('Save Note')")
    await run_tab_audit(page, "Notes", note_action)
    
    # 6. Calendar
    await page.click("text=Calendar")
    async def cal_action(p):
        # Create an event via JS API for reliability
        await p.evaluate("""fetch('/calendar', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({summary: 'Audit Test Event', start_date_iso: new Date().toISOString(), end_date_iso: new Date(Date.now() + 3600000).toISOString()})
        })""")
        await p.reload()
    await run_tab_audit(page, "Calendar", cal_action)
    
    # 7. Compare
    await page.click("text=Compare")
    await run_tab_audit(page, "Compare")
    
    # 8. Studio
    await page.click("text=Studio")
    await run_tab_audit(page, "Studio")
    
    # 9. API Keys
    await page.click("text=API Keys")
    await run_tab_audit(page, "API Keys")
    
    # 10. Settings/Profile
    await page.click("text=Manage Profile")
    await run_tab_audit(page, "Profile")
    
    # Cleanup
    await cleanup_test_data(page)
    
    # Logout
    await page.click("text=Logout")
    await page.wait_for_timeout(2000)
    
    current_uid = audit_state.current_user_id
    await browser.close()
    return current_uid

async def main():
    if len(sys.argv) != 5:
        print("Usage: python live_audit.py <user1> <pass1> <user2> <pass2>")
        sys.exit(1)
        
    user1 = {"username": sys.argv[1], "password": sys.argv[2]}
    user2 = {"username": sys.argv[3], "password": sys.argv[4]}
    
    async with async_playwright() as p:
        print("=== Starting Audit Phase 1 (User 1) ===")
        uid1 = await perform_audit(p, user1)
        
        print(f"\n=== Starting Audit Phase 2 (User 2) ===")
        # Run second user, providing user1's ID to check for cross-account leakage
        uid2 = await perform_audit(p, user2, other_user_id=uid1)
        
    # Generate Report
    report_content = f"# Live Integrity & Data-Safety Audit Report\n\n"
    report_content += f"## Network & Security Flags\n"
    
    if audit_state.data_leaks:
        report_content += "### 🚨 Data Leakage Detected\n"
        for leak in set(audit_state.data_leaks):
            report_content += f"- {leak}\n"
    else:
        report_content += "### ✅ No Data Leakage Detected\n"
        report_content += "- No passwords or hashes found in API responses.\n"
        report_content += "- No raw API keys exposed.\n"
        report_content += "- No cross-user data leakage observed.\n\n"
        
    report_content += f"## Console Errors & Failed Requests\n"
    if audit_state.console_errors:
        report_content += "### Console Errors\n```\n" + "\n".join(set(audit_state.console_errors)) + "\n```\n\n"
    if audit_state.failed_requests:
        report_content += "### Failed Network Requests\n```\n" + "\n".join(set(audit_state.failed_requests)) + "\n```\n\n"
        
    report_content += "## UI Screenshots\n"
    for img in sorted(ARTIFACTS_DIR.glob("*.png")):
        report_content += f"### {img.stem.title()}\n![{img.stem}]({img.resolve().as_posix()})\n\n"
        
    report_path = ARTIFACTS_DIR / "audit_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
        
    print(f"\nAudit complete. Report generated at {report_path}")

if __name__ == "__main__":
    asyncio.run(main())
