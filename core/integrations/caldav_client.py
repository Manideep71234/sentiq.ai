import caldav
from datetime import datetime

def get_caldav_client(url, username, password):
    return caldav.DAVClient(url=url, username=username, password=password)

def fetch_events(url, username, password, start_date=None, end_date=None):
    client = get_caldav_client(url, username, password)
    principal = client.principal()
    calendars = principal.calendars()
    
    events_list = []
    for calendar in calendars:
        if start_date and end_date:
            events = calendar.date_search(start=start_date, end=end_date, expand=True)
        else:
            events = calendar.events()
            
        for event in events:
            # Basic parsing of the vobject
            try:
                vobj = event.vobject_instance
                vevent = vobj.vevent
                
                start = vevent.dtstart.value
                if hasattr(start, 'isoformat'):
                    start_str = start.isoformat()
                else:
                    start_str = str(start)
                    
                end = vevent.dtend.value if hasattr(vevent, 'dtend') else None
                if end and hasattr(end, 'isoformat'):
                    end_str = end.isoformat()
                else:
                    end_str = str(end) if end else None

                events_list.append({
                    "id": event.url,
                    "title": vevent.summary.value if hasattr(vevent, 'summary') else "Untitled Event",
                    "start": start_str,
                    "end": end_str,
                    "description": vevent.description.value if hasattr(vevent, 'description') else ""
                })
            except Exception as e:
                pass # Skip events that fail to parse
                
    # Sort events by start date
    events_list.sort(key=lambda x: x['start'])
    return events_list

def create_event(url, username, password, start_date, end_date, summary, description=""):
    client = get_caldav_client(url, username, password)
    principal = client.principal()
    calendars = principal.calendars()
    
    if not calendars:
        raise ValueError("No calendar found on this CalDAV server")
        
    calendar = calendars[0] # Pick the first calendar by default
    
    # Format dates to string if they are datetime objects
    dtstart = start_date.strftime("%Y%m%dT%H%M%S")
    dtend = end_date.strftime("%Y%m%dT%H%M%S")
    
    vcal = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sentiq.AI//CalDAV Client//EN
BEGIN:VEVENT
SUMMARY:{summary}
DESCRIPTION:{description}
DTSTART:{dtstart}
DTEND:{dtend}
END:VEVENT
END:VCALENDAR"""
    
    calendar.save_event(vcal)
    return True
