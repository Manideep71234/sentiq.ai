import time
import json
from playwright.sync_api import sync_playwright

def run_audit():
    results = {
        "errors": [],
        "network_errors": [],
        "ttft": None,
        "mobile_ui": {}
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Listen for console errors
        page.on("console", lambda msg: results["errors"].append({"type": msg.type, "text": msg.text}) if msg.type in ["error", "warning"] else None)
        
        # Listen for failed network requests
        page.on("response", lambda res: results["network_errors"].append({"url": res.url, "status": res.status}) if res.status >= 400 else None)
        
        print("Navigating to http://localhost:5173...")
        page.goto("http://localhost:5173")
        page.wait_for_load_state("domcontentloaded")
        time.sleep(2)
        
        # Check if login is required
        if page.locator('text="Login"').is_visible() or page.locator('input[type="password"]').is_visible():
            print("Logging in...")
            page.fill('input[type="text"]', "testuser")
            page.fill('input[type="password"]', "password123")
            page.click('button:has-text("Login")')
            time.sleep(3)
            
            # If still on login, register
            if page.locator('input[type="password"]').is_visible():
                print("Registering...")
                page.click('button:has-text("Register")')
                time.sleep(3)

        print("Visiting tabs...")
        tabs = [
            'Research', 'Documents', 'Email', 'Notes & Tasks', 'Calendar', 
            'Compare Models', 'API Keys', 'Settings'
        ]
        
        for tab in tabs:
            try:
                page.click(f'text="{tab}"', timeout=3000)
                time.sleep(0.5)
            except Exception as e:
                print(f"Could not click tab {tab}")

        print("Testing Chat TTFT...")
        try:
            page.click('text="Chat"')
            time.sleep(0.5)
            # Send a message
            input_sel = 'textarea'
            page.fill(input_sel, "Hello!")
            start_time = time.time()
            page.keyboard.press("Enter")
            
            # Wait for assistant response indicator
            page.wait_for_selector('.ai-message', timeout=15000)
            ttft = time.time() - start_time
            results["ttft"] = ttft
            print(f"TTFT: {ttft} seconds")
        except Exception as e:
            print("Chat test failed:", e)

        print("Testing Mobile UI...")
        try:
            # Resize to mobile
            page.set_viewport_size({"width": 375, "height": 812})
            time.sleep(1)
            
            # Check if sidebar is hidden or scrollable
            sidebar_box = page.locator('.sidebar').bounding_box()
            results["mobile_ui"]["sidebar_overflow"] = sidebar_box is not None
            
            # Check chat input auto-expand by typing a lot of text
            page.click('text="Chat"')
            time.sleep(0.5)
            input_locator = page.locator('textarea')
            initial_height = input_locator.bounding_box()["height"]
            input_locator.fill("This is a long message\n" * 10)
            time.sleep(0.5)
            final_height = input_locator.bounding_box()["height"]
            
            results["mobile_ui"]["input_expands"] = final_height > initial_height
            
        except Exception as e:
            print("Mobile UI test failed:", e)

        browser.close()
        
    with open("audit_results.json", "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    run_audit()
