"""Minimal Riot API client with dev-key rate limiting (20 req/1s, 100 req/120s)."""
import os
import time
from collections import deque
from pathlib import Path
from urllib.parse import quote

import requests
from dotenv import load_dotenv

# Repo-root .env; a RIOT_API_KEY already set in the environment wins.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

PLATFORM = "https://na1.api.riotgames.com"   # NA league / mastery endpoints
REGION = "https://americas.api.riotgames.com"  # match-v5 for NA

SOLO_QUEUE = "RANKED_SOLO_5x5"
SOLO_QUEUE_ID = 420


class RateLimiter:
    def __init__(self, limits=((20, 1.0), (100, 120.0))):
        self.limits = limits
        self.calls = deque()

    def wait(self):
        while True:
            now = time.monotonic()
            longest = max(w for _, w in self.limits)
            while self.calls and now - self.calls[0] > longest:
                self.calls.popleft()
            sleep_for = 0.0
            for count, window in self.limits:
                recent = [t for t in self.calls if now - t <= window]
                if len(recent) >= count:
                    sleep_for = max(sleep_for, window - (now - recent[0]) + 0.05)
            if sleep_for <= 0:
                self.calls.append(now)
                return
            time.sleep(sleep_for)


class RiotClient:
    def __init__(self, api_key=None, session=None, limiter=None):
        self.api_key = api_key or os.environ.get("RIOT_API_KEY")
        if not self.api_key:
            raise RuntimeError("Set RIOT_API_KEY in .env (see .env.example) or the environment")
        self.session = session or requests.Session()
        self.limiter = limiter or RateLimiter()

    def get(self, url, params=None, retries=5):
        for _ in range(retries):
            self.limiter.wait()
            resp = self.session.get(url, params=params, headers={"X-Riot-Token": self.api_key}, timeout=15)
            if resp.status_code == 429:
                time.sleep(int(resp.headers.get("Retry-After", "10")))
                continue
            if resp.status_code in (500, 502, 503, 504):
                time.sleep(2)
                continue
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
        raise RuntimeError(f"Gave up on {url}")

    def league_entries(self, tier, division, page=1):
        return self.get(f"{PLATFORM}/lol/league/v4/entries/{SOLO_QUEUE}/{tier}/{division}", {"page": page}) or []

    def match_ids(self, puuid, count=20, start=0, start_time=None):
        params = {"queue": SOLO_QUEUE_ID, "type": "ranked", "start": start, "count": count}
        if start_time:
            params["startTime"] = start_time  # epoch seconds
        return self.get(f"{REGION}/lol/match/v5/matches/by-puuid/{puuid}/ids", params) or []

    def season_match_ids(self, puuid, start_time, limit=100):
        """All Solo/Duo match ids since start_time, newest first, capped at limit."""
        ids = []
        while len(ids) < limit:
            page = self.match_ids(puuid, count=min(100, limit - len(ids)), start=len(ids), start_time=start_time)
            ids += page
            if len(page) < 100:
                break
        return ids

    def account_by_riot_id(self, game_name, tag_line):
        """{"puuid", "gameName", "tagLine"} or None if the Riot ID does not exist."""
        return self.get(f"{REGION}/riot/account/v1/accounts/by-riot-id/{quote(game_name)}/{quote(tag_line)}")

    def solo_entry(self, puuid):
        """The player's Solo/Duo league entry, or None if unranked this season."""
        entries = self.get(f"{PLATFORM}/lol/league/v4/entries/by-puuid/{puuid}") or []
        return next((e for e in entries if e.get("queueType") == SOLO_QUEUE), None)

    def match(self, match_id):
        return self.get(f"{REGION}/lol/match/v5/matches/{match_id}")
