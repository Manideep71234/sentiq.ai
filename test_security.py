import requests

# 1. Register and Login as user1
requests.post("http://localhost:8000/auth/register", json={"username": "user1", "password": "password"})
session1 = requests.Session()
r = session1.post("http://localhost:8000/auth/token", data={"username": "user1", "password": "password"})
token1 = r.json()["access_token"]
session1.headers.update({"Authorization": f"Bearer {token1}"})

# Create doc for user1
doc = session1.post("http://localhost:8000/documents/", json={"title": "User1 Doc", "doc_type": "markdown", "content": "Hello"}).json()
print("User1 created doc:", doc)

# 2. Register and Login as user2
requests.post("http://localhost:8000/auth/register", json={"username": "user2", "password": "password"})
session2 = requests.Session()
r = session2.post("http://localhost:8000/auth/token", data={"username": "user2", "password": "password"})
token2 = r.json()["access_token"]
session2.headers.update({"Authorization": f"Bearer {token2}"})

# 3. User2 tries to read user1 doc
r = session2.get(f"http://localhost:8000/documents/{doc['id']}")
print("User2 read user1 doc:", r.status_code, r.text)

# 4. User2 tries to list user1 doc versions
r = session2.get(f"http://localhost:8000/documents/{doc['id']}/versions")
print("User2 list versions:", r.status_code, r.text)

# 5. User2 tries to update user1 doc
r = session2.put(f"http://localhost:8000/documents/{doc['id']}", json={"content": "hacked!"})
print("User2 update:", r.status_code, r.text)
