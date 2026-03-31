import { Event, Topic } from '../types';
import Constants from 'expo-constants';

function inferLanHostFromExpo(): string | null {
  const hostUri =
    // SDKs differ in where hostUri lives; keep it defensive.
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.hostUri ||
    null;

  if (!hostUri || typeof hostUri !== 'string') return null;
  // hostUri example: "192.168.1.10:8081" (dev) or "exp://192.168.1.10:8081"
  const cleaned = hostUri.replace(/^exp:\/\//, '').replace(/^https?:\/\//, '');
  const host = cleaned.split('/')[0]?.split(':')[0];
  return host || null;
}

function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim()) {
    // Частый баг в Expo Go: localhost указывает на телефон, а не на ноутбук.
    const normalized = fromEnv.trim();
    if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
      const lanHost = inferLanHostFromExpo();
      if (lanHost) return `http://${lanHost}:8787`;
    }
    return normalized;
  }

  const lanHost = inferLanHostFromExpo();
  return lanHost ? `http://${lanHost}:8787` : 'http://localhost:8787';
}

interface TopicsResponse {
  topics: Topic[];
}

interface TopicEventsResponse {
  topicId: string;
  events: Event[];
}

interface EventResponse {
  event: Event;
}

async function request<T>(path: string): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API request failed: ${response.status} ${response.statusText} (${url}) ${body}`);
  }
  return response.json();
}

export async function fetchTopics(): Promise<Topic[]> {
  const data = await request<TopicsResponse>('/topics');
  return data.topics || [];
}

export async function fetchTopicEvents(topicId: string): Promise<Event[]> {
  const data = await request<TopicEventsResponse>(`/topics/${topicId}/events`);
  return data.events || [];
}

export async function fetchEvent(eventId: string): Promise<Event | null> {
  try {
    const data = await request<EventResponse>(`/events/${eventId}`);
    return data.event || null;
  } catch (_error) {
    return null;
  }
}
