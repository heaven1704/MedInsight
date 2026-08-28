"""
Generate a Synthea-format `patients.csv` seed dataset for the MedInsight demo.

WHY THIS SCRIPT EXISTS
======================
Step 9 calls for using MITRE's Synthea to produce synthetic patients. Synthea is
a Java application, so on this machine we can't run it standalone without a JDK.
To keep the demo reproducible AND self-contained, this script writes the SAME
CSV format that Synthea exports (see `patients.csv` below), so `seed_from_synthea`
can consume a genuine Synthea-format file.

To regenerate the FULL population with real Synthea (requires Java 17+):
    # 1. Download the release jar:  https://github.com/synthetichealth/synthea/releases
    # 2. Run it with CSV exporting enabled:
    java -jar synthea-with-dependencies.jar \
        -p 40 \
        -r 20260301 \
        --exporter.csv.export=true \
        --exporter.csv.folder="./backend/seed_data/synthea" \
        --exporter.csv.appendMode=false
    # 3. Optionally override for India-centric demographics (not bundled):
    java -jar synthea-with-dependencies.jar -p 40 -c ./synthea/src/main/resources/synthea.properties

The deterministic CSV produced here matches Synthea's patients.csv column layout
so the importer is agnostic to whether the file came from this script or Synthea.
"""

from __future__ import annotations

import random
from pathlib import Path

random.seed(20260201)  # reproducible output

OUT_DIR = Path(__file__).resolve().parent
OUT_FILE = OUT_DIR / "patients.csv"

# ── Name pools (Indian-centric, consistent with the rest of the demo) ────────
FIRST_MALE = [
    "Arjun", "Rohan", "Vikram", "Karan", "Aditya", "Rahul", "Siddharth", "Harsh",
    "Nikhil", "Amit", "Rajesh", "Sanjay", "Vivek", "Mohit", "Tarun", "Sunil",
    "Dev", "Kunal", "Ajay", "Naveen", "Pranav", "Ishaan", "Ravi", "Aakash",
]
FIRST_FEMALE = [
    "Priya", "Ananya", "Sneha", "Kavya", "Pooja", "Ritu", "Neha", "Divya",
    "Aarohi", "Meera", "Shreya", "Tanvi", "Riya", "Isha", "Anjali", "Kritika",
    "Sakshi", "Nandini", "Vidya", "Lakshmi", "Swati", "Garima", "Ruchika", "Nisha",
]
LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Singh", "Kumar", "Gupta", "Reddy", "Iyer",
    "Nair", "Joshi", "Mehta", "Chopra", "Desai", "Bhat", "Malhotra", "Kapoor",
    "Agarwal", "Mishra", "Tiwari", "Rao", "Kulkarni", "Pillai", "Ghosh", "Bose",
]

STREETS = [
    "12 MG Road", "45 Hill View Lane", "8 Rose Garden Colony", "27 Park Avenue",
    "3 Lakeview Society", "19 Gandhi Nagar", "56 Palm Grove", "10 Sunrise Apartments",
    "4 Temple Street", "71 Orchard Drive", "15 Silver Oak", "33 River View Road",
    "6 Maple Court", "22 Blue Hills", "9 Cedar Lane", "40 Green Park",
]
CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"]
STATES = ["MH", "DL", "KA", "TS", "TN", "MH", "WB", "GJ"]

RACES = ["white", "asian", "other", "black", "hispanic"]
ETHNICITIES = ["nonhispanic", "hispanic"]
MARITAL = ["M", "S", "D", "W"]

PHONE_PREFIXES = ["98", "99", "90", "91", "97"]  # to shape shared household numbers

# Deterministic "household" groups — members intentionally share the SAME phone
# AND address (this is what drives Step 4's family-grouping banner / demo).
# Each inner list is one household; all listed indexes share phone + address.
HOUSEHOLDS = [
    [0, 1],        # spouse pair
    [2, 3],        # spouse pair
    [4, 5, 6],     # parent + two adult children
    [12, 13],      # another spouse pair (renders more family banners)
]

# ── Build person pool ─────────────────────────────────────────────────────────
ALL_PEOPLE: list[dict] = []
_person_id = 0


def _add_person(gender: str, age: int):
    global _person_id
    _person_id += 1
    first = random.choice(FIRST_MALE if gender == "M" else FIRST_FEMALE)
    last = random.choice(LAST_NAMES)
    # %Y%m%d birthdate from age (birth roughly `age` years ago, with some month offset)
    birth_month = random.randint(1, 12)
    birth_day = random.randint(1, 28)
    birth_year = 2026 - age
    birthdate = f"{birth_year:04d}{birth_month:02d}{birth_day:02d}"
    ALL_PEOPLE.append(
        {
            "id": _person_id,
            "first": first,
            "last": last,
            "birthdate": birthdate,
            "gender": gender,
            "race": random.choice(RACES),
            "ethnicity": random.choice(ETHNICITIES),
            "marital": random.choice(MARITAL),
        }
    )


# Roughly 60% female / 40% male, mixed ages 0-90, ~40 people covering a range.
_age_span = [random.randint(0, 8) for _ in range(3)] + \
            [random.randint(9, 17) for _ in range(3)] + \
            [random.randint(18, 35) for _ in range(8)] + \
            [random.randint(36, 55) for _ in range(12)] + \
            [random.randint(56, 75) for _ in range(10)] + \
            [random.randint(76, 90) for _ in range(4)]
for i, age in enumerate(_age_span):
    g = "F" if i % 5 in (0, 1, 3) else "M"  # ~60% female
    _add_person(g, age)

# ── Assign phone + address, keeping household members identical ──────────────
phones: list[str] = [None] * len(ALL_PEOPLE)
addresses: list[str] = [None] * len(ALL_PEOPLE)

def _assign_for_person(idx: int):
    """Assign a fresh (phone, address)."""
    prefix = random.choice(PHONE_PREFIXES)
    ext = f"{random.randint(10000000, 99999999)}"
    phones[idx] = prefix + ext
    addresses[idx] = f"{random.choice(STREETS)}, {random.choice(CITIES)} {random.choice(STATES)}"

# Household members first
for members in HOUSEHOLDS:
    _assign_for_person(members[0])
    for m in members[1:]:
        phones[m] = phones[members[0]]
        addresses[m] = addresses[members[0]]

# Everyone not in a household gets their own phone/address
for i in range(len(ALL_PEOPLE)):
    if phones[i] is None:
        _assign_for_person(i)


def _csv_quote(v: str) -> str:
    v = str(v)
    if "," in v or '"' in v:
        return '"' + v.replace('"', '""') + '"'
    return v


HEADER = (
    "Id,BIRTHDATE,DEATHDATE,SSN,DRIVERS,PASSPORT,PREFIX,FIRST,LAST,SUFFIX,MAIDEN,"
    "MARITAL,RACE,ETHNICITY,GENDER,BIRTHPLACE,ADDRESS,CITY,STATE,ZIP,"
    "HEALTHCARE_EXPENSES,HEALTHCARE_COVERAGE"
)

rows = [HEADER]
for i, p in enumerate(ALL_PEOPLE):
    ssn = f"{random.randint(100,999)}-{random.randint(10,99)}-{random.randint(1000,9999)}"
    driver = f"DL{random.randint(100000,999999)}"
    rows.append(
        ",".join(
            _csv_quote(v)
            for v in [
                f"SYNTH{i+1:04d}",          # Id
                p["birthdate"],             # BIRTHDATE  YYYYMMDD
                "",                          # DEATHDATE (alive)
                ssn,                         # SSN
                driver,                      # DRIVERS
                "",                          # PASSPORT
                "",                          # PREFIX
                p["first"],                  # FIRST
                p["last"],                   # LAST
                "",                          # SUFFIX
                "",                          # MAIDEN
                p["marital"],                # MARITAL
                p["race"],                   # RACE
                p["ethnicity"],              # ETHNICITY
                p["gender"],                 # GENDER  M / F
                f"{random.choice(CITIES)}, {random.choice(STATES)}",  # BIRTHPLACE
                addresses[i].split(",")[0].strip(),  # ADDRESS (street only)
                addresses[i].split(",")[1].strip().rsplit(" ", 1)[0],  # CITY
                addresses[i].rsplit(" ", 1)[1],                         # STATE
                str(random.randint(400001, 482001)), # ZIP
                str(random.randint(5000, 90000)),    # HEALTHCARE_EXPENSES
                str(random.randint(10, 95)),         # HEALTHCARE_COVERAGE (%)
            ]
        )
    )

OUT_FILE.write_text("\n".join(rows) + "\n", encoding="utf-8")
print(f"Wrote {len(ALL_PEOPLE)} patients to {OUT_FILE}")
