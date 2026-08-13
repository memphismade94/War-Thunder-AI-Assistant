#!/usr/bin/env python3
"""Polite official-first War Thunder Wiki crawler for Warthog.

The crawler intentionally starts from a small, curated set of official pages and
follows only wiki.warthunder.com links. It emits a lightweight JSON knowledge
snapshot suitable for browser retrieval. It is not intended to mirror the site.
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
USER_AGENT = "Warthog-Ground-RB-KnowledgeBot/0.1 (official-source research; respectful rate limit)"
MAX_PAGES = int(os.getenv("WT_MAX_PAGES", "150"))
DELAY = float(os.getenv("WT_DELAY_SECONDS", "1.25"))

class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts=[]; self.links=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag in {"script","style","noscript","svg"}: self.skip += 1
        if tag == "a" and "href" in attrs: self.links.append(attrs["href"])
    def handle_endtag(self, tag):
        if tag in {"script","style","noscript","svg"} and self.skip: self.skip -= 1
    def handle_data(self, data):
        if not self.skip: self.parts.append(data)

def clean(text):
    text=re.sub(r"\s+", " ", text).strip()
    return text

def fetch(url):
    req=Request(url, headers={"User-Agent":USER_AGENT,"Accept":"text/html"})
    with urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")

def normalize(url):
    p=urlparse(url)
    if p.netloc.lower() != "wiki.warthunder.com": return None
    if not p.path.startswith("/"): return None
    return f"https://wiki.warthunder.com{p.path}" + (f"?{p.query}" if p.query else "")

def chunk(text, size=1800, overlap=220):
    if len(text)<=size: return [text]
    out=[]; start=0
    while start<len(text):
        end=min(len(text), start+size)
        if end<len(text):
            cut=text.rfind(".", start, end)
            if cut>start+900: end=cut+1
        out.append(text[start:end].strip()); start=max(end-overlap,start+1)
    return [x for x in out if x]

def main():
    with open(SOURCES, encoding="utf-8") as f: cfg=json.load(f)
    queue=[(x["url"],x.get("category","general"),x.get("priority",50)) for x in cfg["sources"]]
    seen=set(); docs=[]
    while queue and len(seen)<MAX_PAGES:
        raw, category, priority=queue.pop(0); url=normalize(raw)
        if not url or url in seen: continue
        seen.add(url)
        try: html=fetch(url)
        except Exception as exc:
            print(f"WARN {url}: {exc}"); continue
        p=TextParser(); p.feed(html); text=clean(" ".join(p.parts))
        title=(text[:160].split("  ")[0] if text else url)
        if len(text)>=120:
            docs.append({"url":url,"title":title,"category":category,"priority":priority,"text":text,"sha256":hashlib.sha256(text.encode()).hexdigest()})
        for href in p.links:
            child=normalize(urljoin(url,href))
            if child and child not in seen and child not in {q[0] for q in queue}:
                # Stay conservative: only crawl likely documentation/content routes.
                path=urlparse(child).path.lower()
                if any(k in path for k in ("/vehicle/","/mechanics/","/gamemode/","/ground","/ammunition","/armor","/location","/map","/wiki")):
                    queue.append((child,category,max(priority-5,10)))
        time.sleep(DELAY)
    chunks=[]
    for d in docs:
        for i,t in enumerate(chunk(d["text"])):
            chunks.append({"id":hashlib.sha1(f'{d["url"]}#{i}'.encode()).hexdigest(),"source":d["url"],"title":d["title"],"category":d["category"],"priority":d["priority"],"text":t})
    os.makedirs(OUT,exist_ok=True)
    manifest={"schema_version":1,"generated_at":datetime.now(timezone.utc).isoformat(),"pages":len(docs),"chunks":len(chunks),"sources_policy":"official-first","crawler_version":"0.1"}
    with open(os.path.join(OUT,"kb.json"),"w",encoding="utf-8") as f: json.dump({"manifest":manifest,"chunks":chunks},f,ensure_ascii=False)
    with open(os.path.join(OUT,"manifest.json"),"w",encoding="utf-8") as f: json.dump(manifest,f,indent=2)
    print(json.dumps(manifest,indent=2))

if __name__ == "__main__": main()
