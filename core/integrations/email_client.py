import imapclient
import smtplib
from email.message import EmailMessage
import email
from email.utils import parsedate_to_datetime

import re
import html
from email.header import decode_header

def _decode_mime_header(header_str):
    if not header_str:
        return "No Subject"
    try:
        decoded_parts = decode_header(header_str)
        result = []
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                result.append(part.decode(encoding or 'utf-8', errors='ignore'))
            else:
                result.append(part)
        return "".join(result)
    except Exception:
        return str(header_str)

def _parse_message(msg_data, msg_id):
    envelope = msg_data.get(b'ENVELOPE')
    body = b""
    for key, value in msg_data.items():
        if isinstance(key, tuple) and key[0] == b'BODY[]':
            body = value
            break
            
    parsed_email = email.message_from_bytes(body)
    
    # Extract text content
    content = ""
    html_content = ""
    if parsed_email.is_multipart():
        for part in parsed_email.walk():
            ct = part.get_content_type()
            if ct == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    content += payload.decode(errors="ignore") + "\n"
            elif ct == "text/html":
                payload = part.get_payload(decode=True)
                if payload:
                    html_content += payload.decode(errors="ignore") + "\n"
    else:
        ct = parsed_email.get_content_type()
        payload = parsed_email.get_payload(decode=True)
        if payload:
            if ct == "text/html":
                html_content = payload.decode(errors="ignore")
            else:
                content = payload.decode(errors="ignore")

    # Fallback to HTML if no plain text
    if not content.strip() and html_content:
        # Strip script/style tags
        clean_html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html_content, flags=re.IGNORECASE|re.DOTALL)
        # Strip all other HTML tags
        content = re.sub(r'<[^>]+>', ' ', clean_html)
        content = html.unescape(content)
        content = re.sub(r'\s+', ' ', content).strip()

    date_obj = envelope.date if envelope and envelope.date else None

    # Determine thread id (using In-Reply-To or Message-ID)
    message_id = envelope.message_id.decode() if envelope and envelope.message_id else str(msg_id)
    in_reply_to = envelope.in_reply_to.decode() if envelope and envelope.in_reply_to else None
    thread_id = in_reply_to if in_reply_to else message_id

    subject_raw = envelope.subject.decode(errors='ignore') if envelope and envelope.subject else ""
    sender_raw = f"{envelope.from_[0].mailbox.decode()}@{envelope.from_[0].host.decode()}" if envelope and envelope.from_ else "Unknown"

    return {
        "id": msg_id,
        "message_id": message_id,
        "thread_id": thread_id,
        "subject": _decode_mime_header(subject_raw),
        "sender": _decode_mime_header(sender_raw),
        "date": date_obj.isoformat() if date_obj else None,
        "snippet": content[:200].replace("\n", " ") + ("..." if len(content) > 200 else ""),
        "content": content
    }

def fetch_inbox(host, port, username, password, access_token=None, limit=50):
    with imapclient.IMAPClient(host, port=port, ssl=True) as server:
        if access_token:
            auth_string = f"user={username}\1auth=Bearer {access_token}\1\1"
            server.authenticate('XOAUTH2', lambda x: auth_string.encode())
        else:
            server.login(username, password)
        server.select_folder('INBOX', readonly=True)
        
        messages = server.search(['ALL'])
        # Get the latest messages
        messages = messages[-limit:]
        
        if not messages:
            return []
            
        fetch_data = server.fetch(messages, ['ENVELOPE', 'BODY[]'])
        
        parsed_messages = []
        for msg_id, data in fetch_data.items():
            parsed_messages.append(_parse_message(data, msg_id))
            
        # Group by thread_id (basic approximation)
        threads = {}
        for m in parsed_messages:
            tid = m['thread_id']
            if tid not in threads:
                threads[tid] = {
                    "thread_id": tid,
                    "subject": m['subject'],
                    "sender": m['sender'],
                    "date": m['date'],
                    "snippet": m['snippet'],
                    "messages": []
                }
            threads[tid]['messages'].append(m)
            # Update thread top-level info to latest message
            threads[tid]['date'] = m['date']
            threads[tid]['snippet'] = m['snippet']
            threads[tid]['sender'] = m['sender']
            
        # Sort threads by date descending
        sorted_threads = sorted(threads.values(), key=lambda t: t['date'] or "", reverse=True)
        return sorted_threads

def search_inbox(host, port, username, password, query, access_token=None, limit=10):
    with imapclient.IMAPClient(host, port=port, ssl=True) as server:
        if access_token:
            auth_string = f"user={username}\1auth=Bearer {access_token}\1\1"
            server.authenticate('XOAUTH2', lambda x: auth_string.encode())
        else:
            server.login(username, password)
        server.select_folder('INBOX', readonly=True)
        
        # Simple text search on subject and body
        messages = server.search(['OR', 'SUBJECT', query, 'BODY', query])
        messages = messages[-limit:]
        
        if not messages:
            return []
            
        fetch_data = server.fetch(messages, ['ENVELOPE', 'BODY[]'])
        
        parsed_messages = []
        for msg_id, data in fetch_data.items():
            parsed_messages.append(_parse_message(data, msg_id))
            
        return parsed_messages

def send_email(host, port, username, password, to_addr, subject, body, in_reply_to=None, access_token=None):
    msg = EmailMessage()
    msg.set_content(body)
    msg['Subject'] = subject
    msg['From'] = username
    msg['To'] = to_addr
    
    if in_reply_to:
        msg['In-Reply-To'] = in_reply_to
        msg['References'] = in_reply_to

    with smtplib.SMTP(host, port) as server:
        server.starttls()
        if access_token:
            auth_string = f"user={username}\1auth=Bearer {access_token}\1\1"
            server.docmd("AUTH", "XOAUTH2 " + __import__('base64').b64encode(auth_string.encode()).decode())
        else:
            server.login(username, password)
        server.send_message(msg)
