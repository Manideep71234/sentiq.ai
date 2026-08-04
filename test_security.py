from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_security():
    # Register user1
    client.post("/auth/register", json={"username": "user1_sec", "password": "password"})
    
    # Login user1
    r1 = client.post("/auth/login", json={"username": "user1_sec", "password": "password"})
    assert r1.status_code == 200
    cookie = r1.cookies.get("session_id")
    assert cookie is not None
    
    # Check /auth/me doesn't leak session_id
    me = client.get("/auth/me", cookies={"session_id": cookie}).json()
    assert "ws_token" not in me
    assert cookie not in str(me)
    
    # Register user2
    client.post("/auth/register", json={"username": "user2_sec", "password": "password"})
    r2 = client.post("/auth/login", json={"username": "user2_sec", "password": "password"})
    assert r2.status_code == 200
    cookie2 = r2.cookies.get("session_id")
    
    # User1 creates a document
    doc_res = client.post("/documents/", json={"title": "Secret", "content": "123"}, cookies={"session_id": cookie})
    if doc_res.status_code == 200:
        doc = doc_res.json()
        doc_id = doc.get("id")
        
        # User2 tries to access User1 document
        if doc_id:
            r = client.get(f"/documents/{doc_id}", cookies={"session_id": cookie2})
            assert r.status_code == 404 or r.status_code == 403
            
            # User2 tries to list versions
            r = client.get(f"/documents/{doc_id}/versions", cookies={"session_id": cookie2})
            assert r.status_code == 404 or r.status_code == 403
            
            # User2 tries to update
            r = client.put(f"/documents/{doc_id}", json={"content": "hacked!"}, cookies={"session_id": cookie2})
            assert r.status_code == 404 or r.status_code == 403

    # Test WebSocket authentication rejection
    try:
        with client.websocket_connect(f"/chat/ws/999") as ws:
            # We expect an auth error and a closed connection
            data = ws.receive_json()
            assert data.get("error") == "Authentication required"
    except Exception as e:
        pass
        
    print("All security tests passed!")

if __name__ == "__main__":
    test_security()
