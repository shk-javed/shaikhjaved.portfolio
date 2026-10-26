#!/usr/bin/env python3
"""Build or check the "Talk to Me" twin knowledge base (twin/knowledge.json).

The live site (index.html) is canonical. Project rows, certificates and the toolkit
(EL/MOL) are parsed from index.html. Other facts are curated below, and each one
lists `verify` snippets that must still appear in the section it cites, so a site
edit that changes a fact makes --check fail instead of letting the twin go stale.
Raw resume text is never stored or written. Some facts are only on the resume; they
are verified against it at check time when `pdftotext` is available.

  python3 tools/build_twin_kb.py           # write twin/knowledge.json
  python3 tools/build_twin_kb.py --check   # validate KB + tests/twin/eval.json against the site
"""
import argparse
import hashlib
import html as H
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
KB_PATH = ROOT / "twin" / "knowledge.json"
EVAL_PATH = ROOT / "tests" / "twin" / "eval.json"
RESUME = "Shaikh_Javed_Data_Analyst.pdf"
SCHEMA = "twin-kb/1"

# Shared with the engine test and QA (contract v2, item 5).
PHONE = re.compile(r"(?:\+?91[\s-]*)?(?<![\d,.])[6-9]\d{4}[\s-]?\d{5}(?!\d)")
INTENTS = ["greet", "bye", "thanks", "twin_meta", "identity", "current_role", "experience", "role_detail",
           "metrics", "education", "leadership", "projects_list", "project_detail", "project_repo", "certs_list",
           "cert_detail", "cert_verify", "skills_overview", "tool_detail", "tool_usage", "contact", "resume",
           "availability", "location", "more", "clarify", "unknown", "refusal"]
REFUSAL_CATS = ["unknown", "personal", "identity", "injection", "offtopic", "too_long", "empty"]
EVAL_TAGS = ["recruiter", "technical", "credentials", "casual", "unanswerable", "adversarial", "hinglish", "multiturn"]
EV_KINDS = ["anchor", "project", "cert", "tool", "url", "file", "mailto"]
BANNED_TRIGGERS = {"number", "pay", "call", "age", "home", "rate", "think", "internal", "phone", "old", "live",
                   "family", "remote", "act", "you", "who", "what", "how", "contact", "job", "work"}
TITLE = "Automation Analyst / Google Apps Script Developer"
GH = "https://github.com/shk-javed/"


# ---------------------------------------------------------------- site parsing
def norm(s):
    s = H.unescape(s).replace(" ", " ").replace("’", "'").replace("−", "-")
    s = re.sub(r"[–—]", "-", s)
    return re.sub(r"\s+", " ", s).strip()


def to_text(fragment):
    fragment = re.sub(r"<(script|style)\b[\s\S]*?</\1>", " ", fragment)
    fragment = re.sub(r'<img\b[^>]*\balt="([^"]*)"[^>]*>', r" \1 ", fragment)
    fragment = re.sub(r'\baria-label="([^"]*)"', lambda m: m.group(0), fragment)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    return norm(fragment)


def parse_site(raw):
    site = {"raw": raw}
    ids = [(m.start(), m.group(1)) for m in re.finditer(r'<(?:section|header|footer)\b[^>]*\bid="([^"]+)"', raw)]
    site["anchors"] = set(re.findall(r'\bid="([^"]+)"', raw))
    site["sections"] = {}
    for i, (pos, sid) in enumerate(ids):
        end = ids[i + 1][0] if i + 1 < len(ids) else len(raw)
        chunk = raw[pos:end]
        labels = " ".join(re.findall(r'aria-label="([^"]*)"', chunk))
        site["sections"][sid] = to_text(chunk) + " " + norm(labels)
    site["page"] = to_text(raw)
    site["rows"] = [dict(href=m[0], i=int(m[1]), kicker=norm(m[2]), title=norm(m[3]), desc=norm(m[4])) for m in re.findall(
        r'<a class="work-row[^"]*" href="([^"]+)"[^>]*data-i="(\d+)">[\s\S]*?work-row__kicker">([^<]+)<[\s\S]*?<h3>([^<]+)</h3>'
        r'[\s\S]*?work-row__desc">([^<]+)<', raw)]
    certs = []
    for m in re.finditer(r'<li class="cert cert--(\w+)"[^>]*data-i="(\d+)">([\s\S]*?)(?=<li class="cert cert--|</ol>|</ul>)', raw):
        body = m.group(3)
        meta = norm(re.search(r'class="cert__meta">([^<]+)<', body).group(1))
        verify = re.search(r'class="cert__verify" href="([^"]+)"', body)
        certs.append(dict(key=m.group(1), i=int(m.group(2)), issuer=meta.split(" · ")[0], date=meta.split(" · ")[1],
                          title=norm(re.search(r"<h3>([^<]+)</h3>", body).group(1)),
                          verify=verify.group(1) if verify else None,
                          full=re.search(r'data-full="([^"]+)"', body).group(1)))
    site["certs"] = certs
    line = next(l for l in raw.split("\n") if "const EL=" in l)
    dec = json.JSONDecoder()
    i = line.find("const EL=") + len("const EL=")
    site["EL"], end = dec.raw_decode(line[i:])
    j = line.find("MOL=", i + end) + len("MOL=")
    site["MOL"], _ = dec.raw_decode(line[j:])
    ld = re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', raw)
    site["jsonld"] = json.loads(ld.group(1)) if ld else {}
    site["hrefs"] = set(re.findall(r'href="([^"]+)"', raw))
    return site


# ---------------------------------------------------------------- curated content
PROJECTS = {  # key -> (row index, repo slug, chip label, aliases)
    "aadhaar": (0, "Aadhaar-Masking-Tool", "Aadhaar Masking Tool",
                ["aadhaar masking tool", "aadhaar", "aadhar", "adhaar", "adhar", "aadhaar masking", "masking tool", "privacy tool", "ocr project", "ocr app"]),
    "csmis": (1, "comcast-customer-complaints-analysis", "Customer Service MIS",
              ["customer service mis", "customer service", "customer complaints", "complaints analysis", "comcast", "sla", "mis dashboard", "customer service operations mis dashboard", "cs mis"]),
    "airline": (2, "domestic-airline-kpi-dashboard", "Airline KPI Dashboard",
                ["domestic airline kpi dashboard", "airline", "airlines", "airline kpi", "domestic airline", "flight", "flights", "aviation", "airline dashboard", "airlne", "star schema", "star-schema", "star schema project"]),
    "er": (3, "Hospital-ER-Dashboard", "Hospital ER Dashboard",
           ["hospital er dashboard", "hospital", "er dashboard", "emergency room", "hospital er", "healthcare dashboard", "aspatal", "hospitel"]),
    "spotify": (4, "spotify2023-dashboard", "Spotify 2023 Dashboard",
                ["spotify 2023 dashboard", "spotify", "spotfy", "spotify dashboard", "music", "songs", "gaane", "streams"]),
}
CERTS = {  # key -> (index, issuer, date, title, chip label, aliases)
    "ga": (0, "Great Learning Academy", "Jul 2024", "Google Analytics", "Google Analytics cert",
           ["google analytics", "great learning", "great learning academy", "analytics certificate", "ga certificate"]),
    "pbi": (1, "Office Master", "Sep 2025", "Power BI Workshop", "Power BI Workshop cert",
            ["power bi workshop", "office master", "power bi certificate", "powerbi workshop"]),
    "gc": (2, "Google Cloud", "Nov 2025", "Data Analytics on Google Cloud", "Google Cloud badge",
           ["google cloud", "gcp", "data analytics on google cloud", "introduction to data analytics on google cloud", "cloud certificate", "google cloud badge"]),
    "gdg": (3, "GDG Cloud Mumbai", "Jan 2026", "Build and Grow AI Hackathon 2.0", "Hackathon certificate",
            ["hackathon certificate", "build and grow certificate", "participation certificate", "gdg cloud mumbai certificate"]),
    "ibm": (4, "IBM", "Mar 2026", "Python for Data Science", "IBM Python cert",
            ["ibm", "ibm certificate", "python for data science", "python certificate", "credly"]),
    "gh": (5, "Dev Days Mumbai", "Mar 2026", "GitHub Copilot", "GitHub Copilot cert",
           ["github copilot", "copilot", "copilot dev days", "dev days", "dev days mumbai", "microsoft copilot event"]),
}
TOOL_ALIASES = {
    "Pq": ["power query", "powerquery", "power qurey", "power querry"], "Dc": ["data cleaning", "cleaning data", "data cleansing", "data cleanup"],
    "Dv": ["data validation", "validation", "validating data"], "Dm": ["data modeling", "data modelling", "data model"],
    "Sq": ["sql", "sequel", "sql queries", "sqll"], "Ex": ["advanced excel", "excel", "ms excel", "exel", "excell", "microsoft excel"],
    "Pt": ["pivottables", "pivot tables", "pivot table", "pivots"], "Py": ["python", "pyhton", "phyton", "pyton"],
    "Rc": ["root cause analysis", "rca", "root cause"], "Pb": ["power bi", "powerbi", "pbi", "power bl", "powerbee"],
    "Dx": ["dax", "dax measures"], "Kp": ["kpi dashboards", "kpi dashboard", "kpis", "kpi"],
    "Tb": ["tableau", "tablue", "tableu", "tablaeu"], "As": ["apps script", "google apps script", "app script", "appscript", "apps scrpit", "gas"],
    "Gs": ["google sheets", "gsheets", "g sheets", "google sheet", "sheets"], "Js": ["javascript", "java script", "js", "javscript"],
    "Hc": ["html / css", "html", "css", "html css", "html/css"], "Ai": ["ai-assisted dev", "ai assisted development", "ai-assisted development", "ai tools", "ai coding"],
    "Dj": ["django", "djnago", "djano"], "Cv": ["opencv", "open cv", "computer vision"], "Oc": ["ocr", "paddleocr", "paddle ocr", "ocr · paddleocr"],
    "Rx": ["regex", "regular expressions", "regexp", "regular expression"], "Gm": ["google maps api", "maps api", "google maps"],
    "Mi": ["mis reporting", "mis", "mis reports", "mis report"], "Qa": ["quality assurance", "qa", "quality reviews", "quality checks"],
    "Gh": ["git & github", "git", "github", "version control", "git hub"],
}
GROUP_ALIASES = {"Prepare": ["prepare", "data preparation", "data prep"], "Analyse": ["analyse", "analyze", "analysis stage"],
                 "Visualise": ["visualise", "visualize", "visualisation", "visualization"], "Automate": ["automate", "automation", "automations"],
                 "Build": ["build", "build stage", "development tools"], "Deliver": ["deliver", "delivery", "delivery stage"]}
USED_PHRASE = {  # toolkit "used in" label -> phrase; an unknown label fails --check so the KB never goes stale silently
    "MAK { Byte }": "at MAK { Byte }", "American Hairline": "at American Hairline", "This portfolio": "on this portfolio",
    "Domestic Airline KPI": "in the Domestic Airline KPI project", "Customer Service MIS": "in the Customer Service MIS project",
    "Hospital ER Dashboard": "in the Hospital ER Dashboard", "Spotify 2023 Dashboard": "in the Spotify 2023 Dashboard",
    "Aadhaar Masking Tool": "in the Aadhaar Masking Tool", "IBM · Python for Data Science": "in the IBM Python for Data Science course",
    "GitHub Copilot Dev Days": "at GitHub Copilot Dev Days", "Maayura · AI Hackathon 2.0": "in the Maayura hackathon build",
    "All five projects in Work": "across all five Work projects",
    "Working knowledge · additional tool": "as working knowledge",
}
MOL_ENTITY = {"mak": "role.mak.da", "ah": "role.ah", "csmis": "proj.csmis", "airline": "proj.airline", "er": "proj.er",
              "spotify": "proj.spotify", "aadhaar": "proj.aadhaar", "site": "proj.site"}

# (id, entity, type, text, source, verify[], evidence[], tags[], status, confidence)
#   verify prefixes: "raw:" = raw index.html, "readme:" = README.md, "resume:" = resume PDF text; else = cited section text.
C = []
def fact(fid, ent, typ, text, src, verify, ev, tags, status="canonical", conf=1.0):
    C.append(dict(id=fid, entity=ent, type=typ, text=text, source=src, verify=verify, evidence=ev, tags=tags, status=status, confidence=conf))

# identity
fact("f.id.name", "person", "identity", "Javed's full name is Shaikh Javed, and two of his certificates print it as Javed Shaikh.", "#hero",
     ["Shaikh Javed", "raw:Javed Shaikh"], ["ev.about"], ["name", "full name", "naam", "who is"])
fact("f.id.title", "person", "identity", f"Javed currently works as an {TITLE} at American Hairline.", "#hero",
     [f"{TITLE} at American Hairline"], ["ev.experience"], ["title", "role", "job", "designation", "current", "what does he do", "kya karta"])
fact("f.id.summary", "person", "identity", "Javed builds Sheets-based automations, internal tools and dashboards, backed by SQL, Power BI and Excel.", "#hero",
     ["Sheets-based automations, internal tools and dashboards, backed by SQL, Power BI and Excel"], ["ev.hero"], ["summary", "about", "introduce", "overview"])
fact("f.id.about", "person", "identity", "Javed automates MIS with Google Apps Script and Google Sheets and builds internal web tools with HTML, CSS and JavaScript.", "#about",
     ["automate MIS with Google Apps Script and Google Sheets, build internal web tools with HTML, CSS and JavaScript"], ["ev.about"], ["about", "background", "what he does"])
fact("f.id.about2", "person", "identity", "Javed backs his automation work with SQL, Power BI, data validation and AI-assisted workflows.", "#about",
     ["SQL, Power BI, data validation and AI-assisted workflows"], ["ev.about"], ["about", "approach", "skills"])
fact("f.id.tagline", "person", "identity", "Javed's About section sums up his approach as turning messy signals into clear decisions.", "#about",
     ["I turn messy", "signals into clear decisions"], ["ev.about"], ["tagline", "motto", "approach", "philosophy"])
fact("f.id.location", "person", "location", "Javed is based in Mumbai, India, which runs on IST (UTC+5:30).", "#contact",
     ["Mumbai, India", "UTC+5:30", "IST"], ["ev.contact"], ["location", "city", "where", "based", "kahan", "timezone", "time"])
fact("f.id.stage", "person", "identity", "The About photo shows Javed speaking on stage at Google Developer Groups MAD and Cloud Mumbai.", "#about",
     ["Shaikh Javed speaking on stage at Google Developer Groups MAD and Cloud Mumbai"], ["ev.about"], ["stage", "talk", "speaker", "photo", "gdg"])
fact("f.id.stage_quote", "person", "identity", "The screen behind Javed in that stage photo reads: “Every model tells a story, I just help it to speak.”", "#about",
     ["Every model tells a story, I just help it to speak."], ["ev.about"], ["quote", "stage", "photo"])
# American Hairline
fact("f.ah.role", "role.ah", "current_role", f"Javed has been an {TITLE} at American Hairline since Aug 2026.", "#experience",
     ["Aug 2026 - Present", TITLE, "American Hairline"], ["ev.experience"], ["american hairline", "current", "since when", "start date", "joined"])
fact("f.ah.mode", "role.ah", "role_detail", "Javed's American Hairline role is full-time and on-site in Mumbai.", "#experience",
     ["American Hairline · Full-time · On-site · Mumbai"], ["ev.experience"], ["on-site", "onsite", "office", "full-time", "remote", "hybrid", "work mode"])
fact("f.ah.work", "role.ah", "role_detail", "At American Hairline, Javed handles MIS automation, Google Apps Script development and Google Sheets-based business solutions.", "#experience",
     ["MIS automation, Google Apps Script development and Google Sheets-based business solutions"], ["ev.experience"], ["responsibilities", "work", "apps script", "sheets", "kaam"])
fact("f.ah.build", "role.ah", "role_detail", "At American Hairline, Javed builds and maintains internal web apps, reports, dashboards and automation tools with HTML, CSS, JavaScript and AI-assisted workflows.", "#experience",
     ["internal web applications, reports, dashboards and process automation tools with HTML, CSS, JavaScript and AI-assisted development workflows"], ["ev.experience"], ["web apps", "internal tools", "dashboards", "javascript"])
# MAK { Byte }
fact("f.mak.span", "org.mak", "experience", "Javed spent 1 yr 1 mo at MAK { Byte } in Mumbai, working hybrid, from Aug 2025 to Aug 2026.", "#experience",
     ["Aug 2025 - Aug 2026", "1 yr 1 mo · Hybrid · Mumbai"], ["ev.experience"], ["mak", "previous", "how long", "duration", "hybrid"])
fact("f.mak.path", "org.mak", "experience", "At MAK { Byte }, Javed was a Data Analyst Intern from Aug 2025 to Jan 2026, then a full-time Data Analyst from Jan 2026 to Aug 2026.", "#experience",
     ["Data Analyst Intern Aug 2025 - Jan 2026", "Data Analyst Jan 2026 - Aug 2026 · Full-time"], ["ev.experience"], ["promotion", "intern to analyst", "dates", "timeline"])
fact("f.mak.da.work", "role.mak.da", "role_detail", "As a Data Analyst at MAK { Byte }, Javed ran data analysis, quality reviews and validation with SQL, Excel and Power BI.", "#experience",
     ["Data analysis, quality reviews and validation with SQL, Excel and Power BI"], ["ev.experience"], ["data analyst", "responsibilities", "quality reviews"])
fact("f.mak.da.work2", "role.mak.da", "role_detail", "At MAK { Byte }, Javed also did root cause analysis on reporting discrepancies and automated recurring MIS reporting.", "#experience",
     ["root cause analysis on reporting discrepancies, and automated recurring MIS reporting"], ["ev.experience"], ["root cause", "automation", "mis"])
for k, lab, verb, v in [("acc", "Reporting accuracy", "raised reporting accuracy by", "+25%"), ("kpi", "KPI visibility", "raised KPI visibility by", "+30%"),
                        ("eff", "Manual reporting effort", "cut manual reporting effort by", "-22%"), ("inc", "Data inconsistencies", "cut data inconsistencies by", "-20%")]:
    fact(f"f.mak.metric.{k}", "role.mak.da", "metrics", f"As a Data Analyst at MAK {{ Byte }}, Javed {verb} {v.lstrip('+-')}.", "#experience",
         [f"{lab} {v}"], ["ev.experience"], ["impact", "metrics", "achievements", "numbers", "results", lab.lower()])
fact("f.mak.intern.work", "role.mak.intern", "role_detail", "As a Data Analyst Intern at MAK { Byte }, Javed cleaned, validated and standardised operational datasets.", "#experience",
     ["Cleaned, validated and standardised operational datasets"], ["ev.experience"], ["intern", "internship", "data cleaning"])
fact("f.mak.intern.work2", "role.mak.intern", "role_detail", "During his MAK { Byte } internship, Javed also supported dashboard development, reporting and business process documentation.", "#experience",
     ["supported dashboard development, reporting and business process documentation"], ["ev.experience"], ["intern", "internship", "documentation"])
fact("f.mak.intern.span", "role.mak.intern", "experience", "Javed's Data Analyst Intern role at MAK { Byte } ran from Aug 2025 to Jan 2026.", "#experience",
     ["Data Analyst Intern Aug 2025 - Jan 2026 · Internship"], ["ev.experience"], ["how long was his internship", "internship duration", "intern dates", "internship"])
fact("f.mak.tools", "org.mak", "experience", "Javed's MAK { Byte } work used SQL, Power BI, Excel, Power Query and data validation.", "#experience",
     ["SQL Power BI Excel Power Query Data Validation"], ["ev.experience"], ["tools", "stack", "mak tools"])
fact("f.mak.resume.workflow", "role.mak.da", "metrics", "His resume also notes that cross-functional work at MAK { Byte } raised workflow efficiency by 15%.", "resume",
     ["resume:workflow efficiency by 15%"], ["ev.resume"], ["workflow efficiency", "cross-functional", "teamwork"], "resume_only", 0.7)
fact("f.mak.resume.depts", "role.mak.da", "role_detail", "His resume also notes that his MAK { Byte } reports supported quality monitoring and decision-making across multiple departments.", "resume",
     ["resume:across multiple departments"], ["ev.resume"], ["departments", "stakeholders", "reports"], "resume_only", 0.7)
fact("f.exp.total", "person", "experience", "Javed has about a year of analytics experience from MAK { Byte } and has worked at American Hairline since Aug 2026.", "#experience",
     ["A year of making operational data dependable at MAK { Byte }", "now making the reporting run itself at American Hairline"], ["ev.experience"],
     ["years of experience", "how much experience", "kitna experience", "fresher", "experienced"], "derived")
# education
fact("f.edu.degree", "edu.bsc", "education", "Javed earned a B.Sc. in Data Science from the University of Mumbai, studying from Jul 2023 to Apr 2026.", "#education",
     ["Jul 2023 - Apr 2026 B.Sc. Data Science University of Mumbai"], ["ev.education"], ["degree", "college", "university", "graduation", "padhai", "qualification"])
fact("f.edu.cgpa", "edu.bsc", "education", "Javed graduated with a final CGPA of 7.60 out of 10.", "#education",
     ["Final CGPA 7.60 / 10"], ["ev.education"], ["cgpa", "gpa", "grades", "marks", "score", "percentage"])
fact("f.edu.graduated", "edu.bsc", "education", "Javed completed his B.Sc. in Data Science at the University of Mumbai in Apr 2026, graduating with a final CGPA of 7.60.", "#education",
     ["Jul 2023 - Apr 2026", "Final CGPA 7.60 / 10"], ["ev.education"], ["when did he graduate", "graduation year", "graduate", "completed degree", "pass out", "passing year"])
fact("f.edu.length", "edu.bsc", "education", "Javed's Bachelor of Science in Data Science was a three-year programme, running 2023-24 to 2025-26.", "#education",
     ["Bachelor of Science · 3 years", "Year 1 2023 - 24", "Year 3 2025 - 26"], ["ev.education"], ["duration", "years", "programme"])
fact("f.edu.content", "edu.bsc", "education", "Javed's degree covered statistics, Python and SQL, plus a grounding in machine learning and AI.", "#education",
     ["the statistics, Python and SQL", "grounding in machine learning and AI"], ["ev.education"], ["subjects", "curriculum", "machine learning", "ai", "statistics"])
# leadership
fact("f.lead.maayura", "lead.maayura", "leadership", "In Jan 2026, Javed led a team of 3 at Build & Grow AI Hackathon 2.0 to build Maayura, a HealthTech app for pregnancy care.", "#leadership",
     ["Hackathon Jan 2026", "Led a team of 3 at Build & Grow AI Hackathon 2.0", "Maayura.", "A HealthTech app for pregnancy care"], ["ev.leadership", "ev.cert.gdg"],
     ["hackathon", "maayura", "team lead", "led a team", "leadership", "healthtech"])
fact("f.lead.maayura.role", "lead.maayura", "leadership", "On Maayura, Javed designed the UI/UX and integrated the Google Maps API within a 24-hour sprint.", "#leadership",
     ["designing the UI/UX and integrating the Google Maps API within a 24-hour sprint"], ["ev.leadership", "ev.tool.Gm"], ["ui/ux", "design", "google maps", "24 hours"])
fact("f.lead.maayura.result", "lead.maayura", "leadership", "The site describes Javed as the team lead at Build & Grow AI Hackathon 2.0 and does not mention a prize or ranking.", "#leadership",
     ["Team of 3 · Led", "Team lead"], ["ev.leadership"], ["win", "won", "winner", "prize", "award", "rank", "position", "result"], "derived")
fact("f.lead.maayura.host", "lead.maayura", "leadership", "Build & Grow AI Hackathon 2.0 was hosted by GDG Cloud Mumbai and GDG Cloud Pune at NMIMS Mukesh Patel, Mumbai.", "#leadership",
     ["hosted by GDG Cloud Mumbai and GDG Cloud Pune at NMIMS Mukesh Patel, Mumbai"], ["ev.leadership"], ["venue", "host", "nmims", "gdg"])
fact("f.lead.maayura.team", "lead.maayura", "leadership", "Javed's hackathon team at Build and Grow AI Hackathon 2.0 was called Code_Runners.", "#certificates",
     ["Team Code_Runners"], ["ev.cert.gdg"], ["team name", "code_runners", "code runners"])
fact("f.lead.devfest", "lead.devfest", "leadership", "Javed was selected to demonstrate a personal analytics project on stage at GDG DevFest Mumbai.", "#leadership",
     ["GDG DevFest Mumbai Selected to demonstrate a personal analytics project on stage"], ["ev.leadership"], ["devfest", "showcase", "conference", "stage", "demo"])
fact("f.lead.gsa", "lead.gsa", "leadership", "As a Google Student Ambassador, Javed represented Google on campus and organised technical and analytics-focused events.", "#leadership",
     ["Google Student Ambassador", "organised technical and analytics-focused events", "representing Google on campus"], ["ev.leadership"],
     ["google student ambassador", "ambassador", "community", "events", "campus"])
fact("f.lead.oscg", "lead.oscg", "leadership", "Javed was recognised as an Open Source Contributor at Open Source Connect Global 2026 (OSCG '26).", "#leadership",
     ["OSCG '26 · Open Source Connect Global", "Recognised as a contributor at Open Source Connect Global 2026"], ["ev.leadership"], ["open source", "oscg", "contributor"])
fact("f.lead.overview", "person", "leadership", "Javed's leadership covers leading a hackathon team, representing Google on campus, presenting on a conference stage and contributing to open source.", "#leadership",
     ["Leading a hackathon team, representing Google on campus, presenting on a conference stage and contributing to open source"], ["ev.leadership"],
     ["leadership", "achievements", "extracurricular", "community"])
# projects (row text is parsed and cross-checked; sentences are curated)
P = [
    ("aadhaar", "desc", "Javed's Aadhaar Masking Tool finds Aadhaar numbers in images and PDFs with OCR, checks them with regex and masks the first eight digits.",
     ["Finds Aadhaar numbers in images and PDFs with OCR, checks them with regex and masks the first eight digits"], ["how it works", "what is"]),
    ("aadhaar", "stack", "The Aadhaar Masking Tool is a privacy tool built with Python, Django, OpenCV and PaddleOCR.",
     ["PYTHON · DJANGO · OPENCV · PADDLEOCR", "Privacy tool · Python / Django"], ["stack", "tech", "built with"]),
    ("aadhaar", "figure", "Because the Aadhaar Masking Tool masks only the first 8 of 12 digits, the last 4 digits stay visible.",
     ["first 8 of 12 digits masked automatically"], ["digits", "masked", "last 4"]),
    ("csmis", "desc", "Javed's Customer Service MIS project used SQL to analyse 2,224 customer complaints and find recurring SLA delays.",
     ["SQL analysis of 2,224 customer complaints to find recurring SLA delays"], ["what is", "complaints", "sla"]),
    ("csmis", "dash", "The Customer Service MIS project includes a Power BI dashboard for weekly monitoring.",
     ["with a Power BI dashboard for weekly monitoring"], ["dashboard", "power bi", "weekly"]),
    ("csmis", "figure", "In the Customer Service MIS data, 76.75% of the 2,224 complaints were resolved.",
     ["76.75% of 2,224 complaints resolved"], ["resolved", "resolution rate", "numbers"]),
    ("csmis", "stack", "The Customer Service MIS project uses SQL, Power BI and SLA reporting.",
     ["SQL · POWER BI · SLA REPORTING"], ["stack", "tech", "built with"]),
    ("airline", "desc", "Javed's Domestic Airline KPI Dashboard uses a star-schema model with DAX measures to compare pricing, routes and performance across 12 airlines.",
     ["A star-schema model with DAX measures comparing pricing, routes and performance across 12 airlines"], ["what is", "star schema", "pricing", "routes"]),
    ("airline", "figure", "The Domestic Airline KPI Dashboard compares 9,651 flights across 12 airlines.",
     ["flights compared across 12 airlines", "raw:9,651"], ["flights", "dataset size", "numbers"]),
    ("airline", "stack", "The Domestic Airline KPI Dashboard was built with Power BI, DAX and Power Query.",
     ["POWER BI · DAX · POWER QUERY"], ["stack", "tech", "built with"]),
    ("er", "desc", "Javed's Hospital ER Dashboard tracks wait times, satisfaction, admissions and referrals across 9,216 emergency-room records.",
     ["Wait times, satisfaction, admissions and referrals across 9,216 emergency-room records"], ["what is", "records", "wait times"]),
    ("er", "figure", "The Hospital ER Dashboard shows a 36.67-minute average ER wait in its February view.",
     ["36.67", "average ER wait · February view"], ["average wait", "numbers", "february"]),
    ("er", "stack", "The Hospital ER Dashboard was built in Excel with PivotTables.",
     ["Healthcare · Excel / PivotTables", "EXCEL · PIVOTTABLES · 9,216 RECORDS"], ["stack", "tech", "built with"]),
    ("spotify", "desc", "Javed's Spotify 2023 Dashboard covers top tracks and artists, decade-wise popularity and audio features across 932 tracks.",
     ["Top tracks and artists, decade-wise popularity and audio features across 932 tracks"], ["what is", "tracks", "artists"]),
    ("spotify", "figure", "The Spotify 2023 Dashboard adds up 478B streams across 932 tracks.",
     ["478B streams across 932 tracks"], ["streams", "numbers"]),
    ("spotify", "stack", "The Spotify 2023 Dashboard was built with Excel PivotTables and slicers.",
     ["EXCEL · PIVOTTABLES · SLICERS"], ["stack", "tech", "built with"]),
]
for key, part, text, verify, tags in P:
    fact(f"f.proj.{key}.{part}", f"proj.{key}", "project_detail", text, "#projects", verify, [f"ev.proj.{key}", f"ev.repo.{key}"], tags + ["project"])
for key, (i, slug, label, _a) in PROJECTS.items():
    fact(f"f.proj.{key}.repo", f"proj.{key}", "project_repo", f"The code for the {label} is on GitHub at github.com/shk-javed/{slug}.", GH + slug,
         [f"raw:{GH}{slug}"], [f"ev.repo.{key}"], ["github", "repo", "code", "source code", "link"])
fact("f.proj.csmis.resume", "proj.csmis", "project_detail", "His resume also notes that the Customer Service MIS dashboard has KPI cards and dynamic filters.", "resume",
     ["resume:KPI cards and dynamic filters"], ["ev.resume"], ["kpi cards", "filters"], "resume_only", 0.7)
fact("f.proj.airline.resume", "proj.airline", "project_detail", "His resume also notes that Javed transformed the 9,651 flight records with Power Query to prepare them for reporting.", "resume",
     ["resume:transformed 9,651 flight records using Power Query"], ["ev.resume"], ["power query", "transform"], "resume_only", 0.7)
fact("f.proj.count", "person", "projects_list", "Javed's Work section shows five projects, from a privacy tool to operational dashboards, and each one links to its code on GitHub.", "#projects",
     ["Five projects, from a privacy tool to operational dashboards", "every row opens its code on GitHub"], ["ev.projects"], ["projects", "portfolio", "work", "kya banaya"])
fact("f.proj.site", "proj.site", "project_detail", "Javed built this portfolio by hand as a single page of plain HTML, CSS and JavaScript, with no framework and no build step.", "README.md",
     ["readme:plain HTML, CSS and JavaScript in one file, with no framework and no build step"], ["ev.github"], ["this website", "portfolio", "how built"])
# certificates
CERT_TEXT = {
    "ga": ("Javed earned the Google Analytics certificate from Great Learning Academy in Jul 2024.",
           "The Google Analytics certificate was Javed's first, covering tracking, funnels and reports.", ["My first certificate: tracking, funnels and reports in Google Analytics"]),
    "pbi": ("Javed completed the Power BI Workshop from Office Master in Sep 2025.",
            "The Power BI Workshop certified Javed to build AI-powered Power BI dashboards in under 30 minutes.", ["Certified to build AI-powered Power BI dashboards in under 30 minutes"]),
    "gc": ("Javed earned the Google Cloud completion badge for Introduction to Data Analytics on Google Cloud in Nov 2025.",
           "Javed's Google Cloud badge for Introduction to Data Analytics on Google Cloud is dated Nov 6, 2025.", ["Completion badge for Introduction to Data Analytics on Google Cloud", "Nov 6, 2025"]),
    "gdg": ("Javed holds a certificate of participation in Build and Grow AI Hackathon 2.0 from GDG Cloud Mumbai, dated Jan 2026.",
            "Javed's hackathon certificate records the 24-hour sprint in which he led a team of 3 to build Maayura, a pregnancy-care app.", ["Led a team of 3 to build Maayura, a pregnancy-care app, in a 24-hour sprint"]),
    "ibm": ("Javed earned IBM's Python for Data Science certificate in Mar 2026.",
            "IBM's Python for Data Science certificate, issued to Javed on Mar 24, 2026, covers Python for cleaning and analysing real data.", ["Python for cleaning and analysing real data", "Mar 24, 2026"]),
    "gh": ("Javed has a GitHub Copilot certificate of participation from Dev Days Mumbai, dated Mar 28, 2026.",
           "At GitHub Copilot Dev Days Mumbai, held at Microsoft Office, Mumbai, Javed explored AI-assisted development.", ["Explored AI-assisted development with GitHub Copilot at Microsoft Office, Mumbai", "Mar 28, 2026"]),
}
for key, (i, iss, date, title, label, _a) in CERTS.items():
    t1, t2, v2 = CERT_TEXT[key]
    ev = [f"ev.cert.{key}"]
    fact(f"f.cert.{key}", f"cert.{key}", "cert_detail", t1, "#certificates", [f"{iss} · {date}", title], ev, ["certificate", "certification", "when", "issuer"])
    fact(f"f.cert.{key}.about", f"cert.{key}", "cert_detail", t2, "#certificates", v2, ev, ["certificate", "what is", "about"])
fact("f.cert.ga.verify", "cert.ga", "cert_verify", "Javed's Google Analytics certificate can be verified on Great Learning's website.", "#certificates",
     ["raw:https://www.mygreatlearning.com/certificate/WWQRNADG"], ["ev.cert.ga.verify", "ev.cert.ga"], ["verify", "proof", "authentic", "link"])
fact("f.cert.ibm.verify", "cert.ibm", "cert_verify", "Javed's IBM Python for Data Science certificate can be verified on Credly.", "#certificates",
     ["raw:https://www.credly.com/badges/b3c20a98-d472-45f4-97ef-cdf0a97972ed"], ["ev.cert.ibm.verify", "ev.cert.ibm"], ["verify", "proof", "credly", "badge", "link"])
fact("f.cert.noverify", "person", "cert_verify", "The Power BI Workshop, Google Cloud, hackathon and GitHub Copilot certificates have no public verify link, but each opens full size on the site.", "#certificates",
     ["raw:data-full=\"cert-powerbi.png\"", "raw:data-full=\"github-copilot.png\""], ["ev.certificates"], ["verify", "proof", "no link", "view"])
fact("f.cert.count", "person", "certs_list", "Javed's Credentials section shows six certificates, from Jul 2024 to Mar 2026.", "#certificates",
     ["Six certificates, 2024 to 2026"], ["ev.certificates"], ["certificates", "certifications", "how many", "credentials", "list"])
# contact
fact("f.contact.email", "person", "contact", "Javed's email is shkjaved41@gmail.com, and the Contact section has a button to copy it.", "#contact",
     ["raw:mailto:shkjaved41@gmail.com", "Copy email"], ["ev.email", "ev.contact"], ["email", "mail", "contact", "reach", "hire", "message"])
fact("f.contact.linkedin", "person", "contact", "Javed is on LinkedIn at linkedin.com/in/shk-javed.", "#contact",
     ["raw:https://www.linkedin.com/in/shk-javed/"], ["ev.linkedin"], ["linkedin", "connect", "social"])
fact("f.contact.github", "person", "contact", "Javed's GitHub profile is github.com/shk-javed, where all five Work projects live.", "#contact",
     ["raw:https://github.com/shk-javed\""], ["ev.github"], ["github", "code", "profile", "repos"])
fact("f.contact.resume", "person", "resume", "Javed's resume is available as a PDF download from the Contact section.", "#contact",
     ["raw:Shaikh_Javed_Data_Analyst.pdf", "Download Resume"], ["ev.resume", "ev.contact"], ["resume", "cv", "pdf", "download"])
fact("f.contact.availability", "person", "availability", "The site doesn't say whether Javed is looking for a new role, so the best way to ask about opportunities is to email him.", "#contact",
     ["Currently Automation Analyst / Google Apps Script Developer, American Hairline"], ["ev.email"], ["available", "open to work", "hiring", "looking for job", "opportunities"], "partial", 0.8)
# the guide itself
fact("f.twin.what", "twin", "twin_meta", "SHK JAVED is an AI guide, not Javed himself, and it answers only from this site's verified facts.", "twin",
     [], [], ["who are you", "are you javed", "are you human", "bot", "ai"], "meta")
fact("f.twin.privacy", "twin", "twin_meta", "The guide runs entirely in this browser tab, sends nothing over the network and keeps the chat only until the tab closes.", "twin",
     [], [], ["privacy", "data", "tracking", "store", "saved"], "meta")
fact("f.twin.scope", "twin", "twin_meta", "The guide can answer questions about Javed's roles, projects, education, leadership, certificates, toolkit and contact details.", "twin",
     [], [], ["help", "what can you do", "topics"], "meta")

REFUSALS = [
    dict(id="r.phone", category="personal", hard=True, redirect="ev.email",
         reply="The guide doesn't share phone numbers. Email is the best way to reach Javed.",
         triggers=["phone number", "mobile number", "contact number", "cell number", "his phone", "your phone", "phone no", "mobile no",
                   "whatsapp", "telephone", "call him", "call javed", "uska number", "number de do", "number dedo", "number bhejo"]),
    dict(id="r.salary", category="personal", hard=True, redirect="ev.email",
         reply="The guide doesn't know Javed's pay or expectations. That's a conversation to have with him by email.",
         triggers=["salary", "ctc", "lpa", "compensation", "pay scale", "how much does he earn", "how much does javed earn", "expected package",
                   "current package", "salary kitni", "kitna kamata", "kitni salary"]),
    dict(id="r.notice", category="personal", hard=False, redirect="ev.email",
         reply="The guide doesn't know Javed's notice period or joining timeline. Email him to ask.",
         triggers=["notice period", "joining date", "when can he join", "how soon can he join", "serving notice", "last working day", "kab join"]),
    dict(id="r.relocation", category="personal", hard=False, redirect="ev.email",
         reply="The site doesn't say whether Javed would relocate, freelance or work remotely. Email him to ask.",
         triggers=["relocate", "relocation", "willing to move", "shift to another city", "open to remote", "willing to work remotely",
                   "freelance rate", "hourly rate", "freelancing"]),
    dict(id="r.personal", category="personal", hard=True, redirect=None,
         reply="The guide only knows Javed's professional background.",
         triggers=["how old", "his age", "date of birth", "birthday", "married", "wife", "girlfriend", "boyfriend", "religion", "caste",
                   "home address", "his address", "where does he live", "his family", "his parents", "health issue", "shaadi", "dob"]),
    dict(id="r.opinion", category="unknown", hard=False, redirect="ev.email",
         reply="The guide doesn't speak for Javed's opinions or reasons, only his verified work.",
         triggers=["what does he think", "his opinion", "his views", "why did he leave", "reason for leaving", "politics", "political",
                   "does he like", "his favourite", "his favorite"]),
    dict(id="r.languages", category="unknown", hard=False, redirect="ev.email",
         reply="The site doesn't say which languages Javed speaks. Email him to ask.",
         triggers=["languages does he speak", "languages he speaks", "does he speak hindi", "does he speak english", "mother tongue",
                   "kaunsi language bolta", "spoken languages"]),
    dict(id="r.employer_internal", category="unknown", hard=False, redirect="ev.experience",
         reply="The guide can't share anything about Javed's employers beyond what this site shows.",
         triggers=["american hairline clients", "client list", "company revenue", "his manager", "team size", "confidential", "salary of his team"]),
    dict(id="r.identity", category="identity", hard=True, redirect=None,
         reply="The guide is an AI that talks about Javed. It can't speak as him, but it can share what he's built.",
         triggers=["pretend to be javed", "pretend you are javed", "act as javed", "speak as javed", "answer as javed", "you are javed",
                   "be javed", "reply as javed", "talk like javed"]),
    dict(id="r.injection", category="injection", hard=True, redirect=None,
         reply="The guide sticks to Javed's verified background. Ask about his work, projects or skills.",
         triggers=["ignore previous", "ignore all previous", "ignore your instructions", "ignore the above", "system prompt",
                   "developer mode", "jailbreak", "reveal your instructions", "your instructions", "you are now", "new instructions",
                   "disregard previous", "disregard your", "override your rules"]),
    dict(id="r.offtopic", category="offtopic", hard=False, redirect=None,
         reply="That's outside what the guide covers. It's here for Javed's work, projects and skills.",
         triggers=["write a poem", "tell me a joke", "weather", "stock price", "recipe", "write me code", "write a program for me",
                   "do my homework", "solve this equation", "cricket score"]),
    dict(id="r.unknown", category="unknown", hard=False, redirect="ev.email", fallback=True,
         reply="That isn't in what the guide knows about Javed. Try his experience, projects, certificates or toolkit, or email him.",
         triggers=[]),
]
STARTERS = ["What does Javed do now?", "Which projects has he built?", "What did he achieve at MAK { Byte }?",
            "Which certificates can I verify?", "How can I contact him?"]


# ---------------------------------------------------------------- build
def build(site):
    EL, MOL = site["EL"], site["MOL"]
    ev = {
        "ev.hero": dict(kind="anchor", label="Top of the page", target="#hero"),
        "ev.about": dict(kind="anchor", label="About", target="#about"),
        "ev.experience": dict(kind="anchor", label="Experience", target="#experience"),
        "ev.education": dict(kind="anchor", label="Education", target="#education"),
        "ev.leadership": dict(kind="anchor", label="Leadership", target="#leadership"),
        "ev.projects": dict(kind="anchor", label="Work", target="#projects"),
        "ev.certificates": dict(kind="anchor", label="Credentials", target="#certificates"),
        "ev.skills": dict(kind="anchor", label="Toolkit", target="#skills"),
        "ev.contact": dict(kind="anchor", label="Contact", target="#contact"),
        "ev.resume": dict(kind="file", label="Resume (PDF)", target=RESUME),
        "ev.email": dict(kind="mailto", label="Email Javed", target="mailto:shkjaved41@gmail.com"),
        "ev.linkedin": dict(kind="url", label="LinkedIn", target="https://www.linkedin.com/in/shk-javed/"),
        "ev.github": dict(kind="url", label="GitHub profile", target="https://github.com/shk-javed"),
    }
    for key, (i, slug, label, _a) in PROJECTS.items():
        ev[f"ev.proj.{key}"] = dict(kind="project", label=label, target="#projects", index=i)
        ev[f"ev.repo.{key}"] = dict(kind="url", label="Code on GitHub", target=GH + slug)
    for key, (i, iss, date, title, label, _a) in CERTS.items():
        ev[f"ev.cert.{key}"] = dict(kind="cert", label=label, target="#certificates", index=i)
    ev["ev.cert.ga.verify"] = dict(kind="url", label="Verify on Great Learning", target="https://www.mygreatlearning.com/certificate/WWQRNADG")
    ev["ev.cert.ibm.verify"] = dict(kind="url", label="Verify on Credly", target="https://www.credly.com/badges/b3c20a98-d472-45f4-97ef-cdf0a97972ed")
    for sym, d in EL.items():
        ev[f"ev.tool.{sym}"] = dict(kind="tool", label=d["name"] + " in Toolkit" if len(d["name"]) <= 17 else d["name"], target="#skills", select=sym)
    for e in ev.values():  # contract v2 item 4: every evidence item carries href
        e["external"] = e["kind"] == "url"
        e["href"] = e["target"]

    ents = [
        dict(id="person", type="person", name="Shaikh Javed",
             aliases=["javed", "shaikh javed", "javed shaikh", "shk javed", "shaikh", "jawed", "javid", "javed bhai", "the owner", "portfolio owner"]),
        dict(id="twin", type="twin", name="SHK JAVED (AI guide)",
             aliases=["ai guide", "guide", "pangolin", "bot", "chatbot", "assistant", "digital twin", "twin"]),
        dict(id="role.ah", type="role", name="American Hairline", title=TITLE, start="2026-08", end=None, display_dates="Aug 2026 – Present",
             employment="Full-time", mode="On-site", location="Mumbai", tools=["As", "Gs", "Js", "Hc", "Ai", "Kp", "Mi"], evidence=["ev.experience"],
             aliases=["american hairline", "americanhairline", "american hair line", "hairline", "current company", "current job", "current role",
                      "present job", "abhi ki company", "abhi wali job", "automation analyst", "apps script developer"]),
        dict(id="org.mak", type="org", name="MAK { Byte }", start="2025-08", end="2026-08", display_dates="Aug 2025 – Aug 2026", duration="1 yr 1 mo",
             mode="Hybrid", location="Mumbai", children=["role.mak.da", "role.mak.intern"], evidence=["ev.experience"],
             aliases=["mak { byte }", "mak byte", "makbyte", "mak-byte", "mak", "mak bytes", "previous company", "last company", "pehle wali company", "purani company"]),
        dict(id="role.mak.da", type="role", name="MAK { Byte }", title="Data Analyst", start="2026-01", end="2026-08", display_dates="Jan 2026 – Aug 2026",
             employment="Full-time", tools=MOL["mak"]["list"], evidence=["ev.experience"],
             aliases=["data analyst", "data analyst role", "analyst role", "da role", "data analyst at mak"]),
        dict(id="role.mak.intern", type="role", name="MAK { Byte }", title="Data Analyst Intern", start="2025-08", end="2026-01",
             display_dates="Aug 2025 – Jan 2026", employment="Internship", tools=["Sq", "Pb", "Ex", "Pq", "Dv"], evidence=["ev.experience"],
             aliases=["internship", "intern", "data analyst intern", "interning", "first job"]),
        dict(id="edu.bsc", type="education", name="B.Sc. Data Science", institution="University of Mumbai", start="2023-07", end="2026-04",
             cgpa="7.60 / 10", evidence=["ev.education"],
             aliases=["b.sc", "bsc", "b.sc. data science", "bachelor", "bachelors", "degree", "college", "university", "university of mumbai",
                      "mumbai university", "graduation", "padhai", "data science degree", "education", "studies"]),
        dict(id="lead.maayura", type="leadership", name="Maayura · Build & Grow AI Hackathon 2.0", date="2026-01", evidence=["ev.leadership"],
             aliases=["maayura", "mayura", "maayura app", "hackathon", "build & grow", "build and grow", "build n grow", "ai hackathon 2.0",
                      "code_runners", "code runners", "nmims", "pregnancy app"]),
        dict(id="lead.devfest", type="leadership", name="GDG DevFest Mumbai project showcase", date=None, evidence=["ev.leadership"],
             aliases=["devfest", "dev fest", "gdg devfest", "devfest mumbai", "project showcase", "conference"]),
        dict(id="lead.gsa", type="leadership", name="Google Student Ambassador", date=None, evidence=["ev.leadership"],
             aliases=["google student ambassador", "gsa", "student ambassador", "campus ambassador", "google ambassador"]),
        dict(id="lead.oscg", type="leadership", name="Open Source Contributor · OSCG '26", date="2026", evidence=["ev.leadership"],
             aliases=["oscg", "open source connect global", "open source", "opensource", "open-source contributor"]),
        dict(id="proj.site", type="project", name="This portfolio", featured=False, tools=MOL["site"]["list"], evidence=["ev.github"],
             aliases=["this portfolio", "this website", "this site", "portfolio website", "your website"]),
    ]
    rows = {r["i"]: r for r in site["rows"]}
    for key, (i, slug, label, aliases) in PROJECTS.items():
        r = rows[i]
        ents.append(dict(id=f"proj.{key}", type="project", name=r["title"], featured=True, index=i, kicker=r["kicker"],
                         tools=MOL[key]["list"], repo=r["href"], evidence=[f"ev.proj.{key}", f"ev.repo.{key}"], aliases=aliases))
    for key, (i, iss, date, title, label, aliases) in CERTS.items():
        c = site["certs"][i]
        ents.append(dict(id=f"cert.{key}", type="cert", name=c["title"], issuer=c["issuer"], date=c["date"], index=i, verify=c["verify"],
                         evidence=[f"ev.cert.{key}"] + ([f"ev.cert.{key}.verify"] if c["verify"] else []), aliases=aliases))
    groups = {}
    for sym, d in EL.items():
        groups.setdefault(d["group"], []).append(sym)
        ents.append(dict(id=f"tool.{sym}", type="tool", name=d["name"], symbol=sym, n=d["n"], group=d["group"], blurb=d["f"],
                         used_in=[dict(label=u[0], molecule=u[1]) for u in d["used"]], evidence=[f"ev.tool.{sym}"],
                         aliases=TOOL_ALIASES[sym]))
    for g, syms in groups.items():
        ents.append(dict(id=f"group.{g.lower()}", type="skill-group", name=g, tools=syms, evidence=["ev.skills"], aliases=GROUP_ALIASES[g]))

    facts = [{k: v for k, v in f.items() if k != "verify"} for f in C]
    names = {s: d["name"] for s, d in EL.items()}
    for sym, d in EL.items():
        places = [USED_PHRASE.get(u[0], "\u0000" + u[0]) for u in d["used"]]
        mol_ev = [f"ev.proj.{u[1]}" for u in d["used"] if u[1] in PROJECTS]
        if sym == "Tb":
            usage = "Javed lists Tableau as working knowledge, an additional tool that no project or role on the site uses."
        else:
            joined = places[0] if len(places) == 1 else ", ".join(places[:-1]) + " and " + places[-1]
            labels = {u[0] for u in d["used"]}
            verb = "uses" if labels <= {"American Hairline", "This portfolio"} else "has used" if "American Hairline" in labels else "used"
            usage = f"Javed {verb} {d['name']} {joined}."
        blurb = d["f"][0].lower() + d["f"][1:]
        base = dict(entity=f"tool.{sym}", source="#skills", status="canonical", confidence=1.0)
        facts.append(dict(id=f"f.tool.{sym}.used", type="tool_usage", text=usage, evidence=[f"ev.tool.{sym}"] + mol_ev,
                          tags=["used in", "where", "experience with", "projects using"], **base))
        facts.append(dict(id=f"f.tool.{sym}.card", type="tool_detail", text=f"Javed's toolkit lists {d['name']} under {d['group']}: {blurb}",
                          evidence=[f"ev.tool.{sym}"], tags=["what is", "know", "skill", "does he know"], **base))
    for g, syms in groups.items():
        listed = ", ".join(names[s] for s in syms[:-1]) + " and " + names[syms[-1]]
        facts.append(dict(id=f"f.group.{g.lower()}", entity=f"group.{g.lower()}", type="skills_overview", source="#skills", status="canonical",
                          confidence=1.0, text=f"The {g} stage of Javed's toolkit holds {listed}.", evidence=["ev.skills"], tags=["stage", "group", g.lower()]))
    facts.append(dict(id="f.tool.count", entity="person", type="skills_overview", source="#skills", status="canonical", confidence=1.0,
                      text="Javed's toolkit is a periodic table of 26 tools in workflow order: Prepare, Analyse, Visualise, Automate, Build and Deliver.",
                      evidence=["ev.skills"], tags=["skills", "tech stack", "tools", "toolkit", "what does he know"]))
    for mid, m in MOL.items():
        listed = ", ".join(names[s] for s in m["list"][:-1]) + " and " + names[m["list"][-1]]
        where = {"mak": "At MAK { Byte }", "ah": "At American Hairline", "site": "On this portfolio"}.get(mid, f"In the {m['name']} project")
        facts.append(dict(id=f"f.mol.{mid}", entity=MOL_ENTITY[mid], type="tool_usage", source="#skills", status="canonical", confidence=1.0,
                          text=f"{where}, Javed {'combines' if mid in ('ah', 'site') else 'combined'} {listed}.", evidence=["ev.skills"] + ([f"ev.proj.{mid}"] if mid in PROJECTS else []),
                          tags=["tools used together", "stack", "molecule", "combination"]))
    molecules = {mid: dict(name=m["name"], tools=m["list"], entity=MOL_ENTITY[mid]) for mid, m in MOL.items()}
    return dict(schema=SCHEMA, generated=None, sources={"index.html": hashlib.sha256(site["raw"].encode()).hexdigest()[:16]},
                canonical="site", evidence=ev, entities=ents, facts=facts, molecules=molecules, refusals=REFUSALS, starters=STARTERS)


# ---------------------------------------------------------------- check
def resume_text():
    pdf = ROOT / RESUME
    if not shutil.which("pdftotext") or not pdf.exists():
        return None
    out = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True).stdout
    return norm(out)  # kept in memory only


def check(site, kb):
    errs, warns = [], []
    fresh = build(site)
    strip = lambda d: {k: v for k, v in d.items() if k not in ("generated", "sources")}
    if strip(fresh) != strip(kb):
        errs.append("twin/knowledge.json is stale: re-run tools/build_twin_kb.py")
    if kb["sources"]["index.html"] != fresh["sources"]["index.html"]:
        warns.append("index.html changed since the last build (content checks still apply)")
    # site sync
    if len(site["rows"]) != len(PROJECTS):
        errs.append(f"expected {len(PROJECTS)} work rows, found {len(site['rows'])}")
    for key, (i, slug, label, _a) in PROJECTS.items():
        r = next((r for r in site["rows"] if r["i"] == i), None)
        if not r or r["href"] != GH + slug:
            errs.append(f"work row {i} no longer links to {slug}")
    if len(site["certs"]) != len(CERTS):
        errs.append(f"expected {len(CERTS)} certs, found {len(site['certs'])}")
    for key, (i, iss, date, title, label, _a) in CERTS.items():
        c = site["certs"][i] if i < len(site["certs"]) else None
        if not c or (c["issuer"], c["date"], c["title"]) != (iss, date, title):
            errs.append(f"cert {i} ({key}) changed on the site: {c and (c['issuer'], c['date'], c['title'])}")
    for sym, d in site["EL"].items():
        if sym not in TOOL_ALIASES:
            errs.append(f"new toolkit element {sym}: add aliases")
        for u in d["used"]:
            if u[0] not in USED_PHRASE:
                errs.append(f"toolkit 'used in' label not mapped: {u[0]}")
    person = next((g for g in site["jsonld"].get("@graph", []) if g.get("@type") == "Person"), {})
    if person.get("jobTitle") != TITLE:
        errs.append(f"JSON-LD jobTitle is {person.get('jobTitle')!r}, expected {TITLE!r}")
    # curated verify snippets
    readme = norm((ROOT / "README.md").read_text(encoding="utf-8"))
    rtext = resume_text()
    if rtext is None:
        warns.append("pdftotext unavailable: resume_only facts not verified")
    for f in C:
        for v in f["verify"]:
            if v.startswith("raw:"):
                hay, needle = site["raw"], v[4:]
            elif v.startswith("readme:"):
                hay, needle = readme, norm(v[7:])
            elif v.startswith("resume:"):
                if rtext is None:
                    continue
                hay, needle = rtext, norm(v[7:])
            else:
                hay = site["sections"].get(f["source"].lstrip("#"), "")
                needle = norm(v)
            if needle.lower() not in hay.lower():
                errs.append(f"{f['id']}: '{needle}' not found in {f['source']}")
        if f["status"] == "resume_only" and not f["text"].startswith("His resume also notes"):
            errs.append(f"{f['id']}: resume_only facts must be hedged")
    # schema
    if kb.get("schema") != SCHEMA:
        errs.append("schema must be " + SCHEMA)
    ent_ids = [e["id"] for e in kb["entities"]]
    if len(set(ent_ids)) != len(ent_ids):
        errs.append("duplicate entity ids")
    for e in kb["entities"]:
        if not e.get("aliases"):
            errs.append(f"entity {e['id']} has no aliases")
        for x in e.get("evidence", []):
            if x not in kb["evidence"]:
                errs.append(f"entity {e['id']}: unknown evidence {x}")
    fids = [f["id"] for f in kb["facts"]]
    if len(set(fids)) != len(fids):
        errs.append("duplicate fact ids")
    FIRST = re.compile(r"\b(I|I'm|I've|my|me|mine|we|our)\b")
    for f in kb["facts"]:
        t = f["text"]
        if f["entity"] not in ent_ids:
            errs.append(f"{f['id']}: undefined entity {f['entity']}")
        if len(t) > 200:
            errs.append(f"{f['id']}: {len(t)} chars (max 200)")
        if not t[0].isupper() or t[-1] not in ".”?":
            errs.append(f"{f['id']}: not a full sentence")
        if FIRST.search(re.sub(r"“[^”]*”", "", t)):
            errs.append(f"{f['id']}: first-person wording")
        if "\u0000" in t:
            errs.append(f"{f['id']}: unmapped toolkit label")
        for x in f["evidence"]:
            if x not in kb["evidence"]:
                errs.append(f"{f['id']}: unknown evidence {x}")
    # evidence resolves
    for eid, e in kb["evidence"].items():
        k, tgt = e["kind"], e["target"]
        if k not in EV_KINDS:
            errs.append(f"{eid}: bad kind {k}")
        if len(e["label"]) > 28:
            errs.append(f"{eid}: label over 28 chars")
        if not e.get("href"):
            errs.append(f"{eid}: missing href")
        if k in ("anchor", "project", "cert", "tool") and tgt.lstrip("#") not in site["anchors"]:
            errs.append(f"{eid}: anchor {tgt} missing")
        if k == "project" and not 0 <= e["index"] < len(site["rows"]):
            errs.append(f"{eid}: project index out of range")
        if k == "cert" and not 0 <= e["index"] < len(site["certs"]):
            errs.append(f"{eid}: cert index out of range")
        if k == "tool" and e["select"] not in site["EL"]:
            errs.append(f"{eid}: unknown tool {e['select']}")
        if k in ("url", "mailto", "file") and tgt not in site["hrefs"]:
            errs.append(f"{eid}: {tgt} is not linked from index.html")
        if k == "file" and not (ROOT / tgt).exists():
            errs.append(f"{eid}: file {tgt} missing")
    # refusals
    for r in kb["refusals"]:
        if r["category"] not in REFUSAL_CATS:
            errs.append(f"{r['id']}: bad category")
        if r.get("redirect") and r["redirect"] not in kb["evidence"]:
            errs.append(f"{r['id']}: unknown redirect")
        for t in r["triggers"]:
            if t != t.lower() or t.strip() in BANNED_TRIGGERS:
                errs.append(f"{r['id']}: trigger too broad or not lowercase: {t!r}")
    unk = next((r for r in kb["refusals"] if r["id"] == "r.unknown"), None)
    if not unk or unk["triggers"]:
        errs.append("r.unknown must exist and have no triggers")
    st = kb.get("starters", [])
    if len(st) != 5 or "now" not in st[0].lower():
        errs.append("starters must be 5, led by the current role")
    # phone pattern
    for probe in ("9,216", "2026-08", "b3c20a98-d472-45f4-97ef-cdf0a97972ed", "9,651", "2,224"):
        if PHONE.search(probe):
            errs.append(f"phone regex false positive on {probe}")
    if not PHONE.search("+91 91234 56789"):
        errs.append("phone regex self-test failed")
    if PHONE.search(json.dumps(kb, ensure_ascii=False)):
        errs.append("phone-like pattern in knowledge.json")
    # eval
    n_eval = 0
    if EVAL_PATH.exists():
        raw_eval = EVAL_PATH.read_text(encoding="utf-8")
        if PHONE.search(raw_eval):
            errs.append("phone-like pattern in eval.json")
        items = json.loads(raw_eval)
        n_eval = len(items)
        ids = [x["id"] for x in items]
        if len(set(ids)) != len(ids):
            errs.append("duplicate eval ids")
        all_trig = [(r["id"], t) for r in kb["refusals"] for t in r["triggers"]]
        for x in items:
            if x["intent"] not in INTENTS:
                errs.append(f"{x['id']}: intent {x['intent']} not frozen")
            for t in x["tags"]:
                if t not in EVAL_TAGS:
                    errs.append(f"{x['id']}: bad tag {t}")
            for fid in x.get("mustFactIds", []):
                if fid not in fids:
                    errs.append(f"{x['id']}: unknown fact {fid}")
            for e in x.get("expectEvidence", []):
                if e not in kb["evidence"]:
                    errs.append(f"{x['id']}: unknown evidence {e}")
            tg = x.get("expectTarget")
            if tg and tg not in kb["evidence"] and tg.lstrip("#") not in site["anchors"]:
                errs.append(f"{x['id']}: unresolvable target {tg}")
            er = x.get("expectRefusal")
            if er is not None and er not in REFUSAL_CATS:
                errs.append(f"{x['id']}: bad refusal category {er}")
            if er is None and "adversarial" not in x["tags"]:
                q = " " + re.sub(r"[^a-z0-9 ]+", " ", x["q"].lower()) + " "
                for rid, t in all_trig:
                    if f" {t} " in q:
                        errs.append(f"{x['id']}: answerable question hits refusal trigger {rid}:{t!r}")
        if sum(1 for x in items if x.get("prev")) < 6:
            errs.append("eval needs at least 6 multi-turn items")
        qs = {x["q"] for x in items}
        for s in st:
            if s not in qs:
                errs.append(f"starter not covered by eval: {s}")
    else:
        errs.append("tests/twin/eval.json missing")
    return errs, warns, n_eval


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    site = parse_site(INDEX.read_text(encoding="utf-8"))
    if not a.check:
        kb = build(site)
        import datetime
        kb["generated"] = datetime.date.today().isoformat()
        KB_PATH.parent.mkdir(parents=True, exist_ok=True)
        KB_PATH.write_text(json.dumps(kb, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"wrote {KB_PATH.relative_to(ROOT)}: {len(kb['facts'])} facts, {len(kb['entities'])} entities, "
              f"{len(kb['evidence'])} evidence, {len(kb['refusals'])} refusals")
        return 0
    kb = json.loads(KB_PATH.read_text(encoding="utf-8"))
    errs, warns, n_eval = check(site, kb)
    for w in warns:
        print("WARN", w)
    for e in errs:
        print("FAIL", e)
    print(f"{'FAIL' if errs else 'PASS'}: {len(kb['facts'])} facts, {len(kb['entities'])} entities, {len(kb['evidence'])} evidence, "
          f"{len(kb['refusals'])} refusals, {n_eval} eval items, {len(errs)} errors, {len(warns)} warnings")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
