#!/usr/bin/env python3
"""Polite official-first War Thunder Wiki crawler for Warthog.

Builds a compact, source-attributed knowledge snapshot from public official
War Thunder Wiki pages. It is intentionally conservative and rate-limited.
"""
from __future__ import annotations
import hashlib, json, os, re, time
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = "https://wiki.warthunder.com/"
OUT = os.path.join(os.path.dirname(__file__), "..", "site")
SOURCES = os.path.join(os.path.dirname(__file__), "..", "data", "sources.json")
USER_AGENT = "Warthog-Ground-RB-KnowledgeBot/0.3 (official-source research; respectful rate limit)"
MAX_PAGES = int(os.getenv("WT_MAX_PAGES", "500"))
DELAY = float(os.getenv("WT_DELAY_SECONDS", "1.25"))
MAX_DOCUMENT_CHARS = int(os.getenv("WT_MAX_DOCUMENT_CHARS", "30000"))
CHUNK_SIZE = int(os.getenv("WT_CHUNK_SIZE", "5000"))
CHUNK_OVERLAP = int(os.getenv("WT_CHUNK_OVERLAP", "500"))

ALLOWED_PREFIXES = ("/unit/", "/mechanics/", "/weapon/", "/gamemode/", "/ground", "/location/", "/map/", "/wiki/")

class TextParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts=[]; self.links=[]; self.skip=0; self.title=""; self.heading=[]; self.in_title=False
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag in {"script","style","noscript","svg"}: self.skip += 1
        if tag == "title": self.in_title=True
        if tag == "a" and attrs.get("href"): self.links.append(attrs["href"])
        if tag in {"h1","h2","h3"}: self.heading.append([])
    def handle_endtag(self, tag):
        if tag in {"script","style","noscript","svg"} and self.skip: self.skip -= 1
        if tag == "title": self.in_title=False
        if tag in {"h1","h2","h3"} and self.heading: self.heading.pop()
    def handle_data(self, data):
        if self.skip: return
        if self.in_title: self.title += " " + data
        self.parts.append(data)
        if self.heading: self.heading[-1].append(data)

def clean(text):
    return re.sub(r"\s+", " ", text).strip()

def fetch(url):
    req=Request(url, headers={"User-Agent":USER_AGENT,"Accept":"text/html,application/xhtml+xml"})
    with urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

def normalize(url):
    p=urlparse(url)
    if p.netloc.lower() != "wiki.warthunder.com": return None
    path=p.path.rstrip("/") or "/"
    return f"https://wiki.warthunder.com{path}"

def classify(url, fallback):
    path=urlparse(url).path.lower()
    if path.startswith("/unit/"): return "vehicle"
    if path.startswith("/weapon/"): return "ammunition"
    if path.startswith("/mechanics/"): return "mechanics"
    if path.startswith("/gamemode/"): return "gamemode"
    if path.startswith("/location/") or path.startswith("/map/"): return "map"
    if path.startswith("/ground"): return "vehicles"
    return fallback

def chunk(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    if len(text)<=size: return [text]
    out=[]; start=0
    while start<len(text):
        end=min(len(text),start+size)
        if end<len(text):
            cut=max(text.rfind(".",start,end),text.rfind("!",start,end),text.rfind("?",start,end))
            if cut>start+1800: end=cut+1
        out.append(text[start:end].strip()); start=max(end-overlap,start+1)
    return [x for x in out if x]

def main():
    with open(SOURCES,encoding="utf-8") as f: cfg=json.load(f)
    queue=[]
    for x in cfg["sources"]:
        u=normalize(x["url"])
        if u: queue.append((u,x.get("category","general"),x.get("priority",50)))
    queued={x[0] for x in queue}; seen=set(); docs=[]; failures=0
    while queue and len(seen)<MAX_PAGES:
        url,category,priority=queue.pop(0); queued.discard(url)
        if url in seen: continue
        seen.add(url)
        try: html=fetch(url)
        except Exception as exc:
            failures+=1; print(f"WARN {url}: {exc}"); time.sleep(DELAY); continue
        p=TextParser(); p.feed(html)
        text=clean(" ".join(p.parts))
        # Keep enough of each page for vehicle tables and mechanics, but cap
        # navigation/footer noise so the published KB remains compact.
        text=text[:MAX_DOCUMENT_CHARS]
        title=clean(p.title) or url
        m=re.search(r"(?:Ground Vehicles|Ground Vehicle|Tank ammunition|Armour|Armor|Realistic Battles)\s+([A-Z0-9][^.!?]{2,100})",text)
        if "/unit/" in url and m: title=clean(m.group(1))
        cat=classify(url,category)
        if len(text)>=160:
            docs.append({"url":url,"title":title[:180],"category":cat,"priority":priority,"text":text,"sha256":hashlib.sha256(text.encode()).hexdigest()})
        for href in p.links:
            child=normalize(urljoin(url,href))
            if not child or child in seen or child in queued: continue
            path=urlparse(child).path.lower()
            if path.startswith(ALLOWED_PREFIXES):
                queue.append((child,cat,max(priority-2,10))); queued.add(child)
        time.sleep(DELAY)
    chunks=[]
    for d in docs:
        for i,t in enumerate(chunk(d["text"])):
            chunks.append({"id":hashlib.sha1(f'{d["url"]}#{i}'.encode()).hexdigest(),"source":d["url"],"title":d["title"],"category":d["category"],"priority":d["priority"],"text":t})
    os.makedirs(OUT,exist_ok=True)
    manifest={"schema_version":3,"generated_at":datetime.now(timezone.utc).isoformat(),"pages":len(docs),"chunks":len(chunks),"failed_pages":failures,"sources_policy":"official-first","crawler_version":"0.3","max_document_chars":MAX_DOCUMENT_CHARS,"chunk_size":CHUNK_SIZE}
    with open(os.path.join(OUT,"kb.json"),"w",encoding="utf-8") as f: json.dump({"manifest":manifest,"chunks":chunks},f,ensure_ascii=False,separators=(",",":"))
    with open(os.path.join(OUT,"manifest.json"),"w",encoding="utf-8") as f: json.dump(manifest,f,indent=2)
    print(json.dumps(manifest,indent=2))

if __name__ == "__main__": main()
