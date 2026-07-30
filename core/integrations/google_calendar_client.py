
import httpx
from datetime import datetime
from typing import List, Dict, Any

class GoogleCalendarClient:
    BASE_URL = 'https://www.googleapis.com/calendar/v3'

    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/json'
        }

    async def fetch_events(self, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        url = f'{self.BASE_URL}/calendars/primary/events'
        params = {
            'timeMin': start_date.isoformat() + 'Z' if not start_date.tzinfo else start_date.isoformat(),
            'timeMax': end_date.isoformat() + 'Z' if not end_date.tzinfo else end_date.isoformat(),
            'singleEvents': 'true',
            'orderBy': 'startTime'
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params)
            
            if response.status_code != 200:
                print(f'Google Calendar API Error: {response.text}')
                return []
                
            data = response.json()
            events = data.get('items', [])
            
            formatted_events = []
            for item in events:
                start = item.get('start', {}).get('dateTime') or item.get('start', {}).get('date')
                end = item.get('end', {}).get('dateTime') or item.get('end', {}).get('date')
                
                formatted_events.append({
                    'id': item.get('id'),
                    'summary': item.get('summary', 'Untitled Event'),
                    'description': item.get('description', ''),
                    'start': start,
                    'end': end,
                    'location': item.get('location', '')
                })
                
            return formatted_events

    async def create_event(self, summary: str, start_time: datetime, end_time: datetime, description: str = '', location: str = '') -> Dict[str, Any]:
        url = f'{self.BASE_URL}/calendars/primary/events'
        
        payload = {
            'summary': summary,
            'description': description,
            'location': location,
            'start': {
                'dateTime': start_time.isoformat()
            },
            'end': {
                'dateTime': end_time.isoformat()
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=self.headers, json=payload)
            if response.status_code in (200, 201):
                return response.json()
            else:
                raise Exception(f'Failed to create Google Calendar event: {response.text}')

