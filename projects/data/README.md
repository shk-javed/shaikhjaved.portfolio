# Project data: provenance

These files feed the project case-study pages. Every number comes from the owner's public GitHub files listed below. A small Python script (pandas) built them; nothing was typed in by hand. Where a rule is my own assumption or an approximation, the JSON says so in `rules`, and each file has a `verify` block that checks the results against the original dashboard.

| File | Built from | Rows | Size |
|---|---|---|---|
| `hospital-er.json` | `Hospital Emergency Room Data.csv` | 9,216 records → 19 month cells | ~11 KB |
| `customer-service.json` | `Comcast.xlsx` | 2,224 complaints | ~65 KB |
| `spotify-2023.json` | `spotify-2023.xlsx` | 932 tracks | ~77 KB |
| `../assets/customer-service-dashboard.webp` | `dashboard-preview.png` | 1600×897 | ~90 KB |
| `../assets/customer-service-sql.webp` | `sql-analysis.png` (see note) | 1600×897 | ~77 KB |
| `../assets/airline-dashboard.webp` | `dashboard.png` | 1472×828 | ~84 KB |

Images were converted with `cwebp -q 80` and resized to a maximum width of 1600 px.

---

## Hospital ER: `hospital-er.json`

- **Source:** https://github.com/shk-javed/Hospital-ER-Dashboard, `Hospital Emergency Room Data.csv` (9,216 rows, 12 columns), plus `Hospital ER Dashboard.xlsx` for the KPI definitions.
- **Date range:** 2023-04-01 to 2024-10-30, 19 months. The data has no Jan–Mar 2023 and no Nov–Dec 2024.
- **Columns used:** admission date, gender, age, department referral, admission flag, satisfaction score, wait time. Patient Id, first initial, last name and race are dropped. The Id was used only to confirm that all 9,216 Ids are unique.
- **Shape:** one cell for each (year, month), holding counts and sums, so the page can filter by year or month (or All) and recompute every KPI.
- **Rules (taken from the workbook):**
  - The Power Query M code and the DAX calculated columns were read from inside the .xlsx.
  - On time = wait ≤ 30 min (`IF([Patient Waittime]>30,"Delay","Ontime")`).
  - Satisfaction is averaged over non-blank scores only. 6,699 rows (72.7%) are blank, and the scale is 0–10.
  - "No. of Patient" = distinct Patient Id, which is the same as the row count.
  - Gender `Male`/`Female` spellings (46 rows) are folded into M/F.
  - Age groups use the workbook rule `IF([Patient Age]>70,"70-79", >60 ..., >10 "10-19", "00-9")`. Because it uses `>`, the labels are off by one: "00-9" is really ages 1–10, and so on up to "70-79", which is 71–79. `age[]` keeps the workbook bins so the dashboard can be reproduced. `ageDecade[]` holds true decade bins.
- **Verification:** the owner's dashboard screenshot (Feb selected) is reproduced exactly:
  - 431 patients, average wait 36.67, satisfaction 4.72.
  - Not admitted 207 / admitted 224 (48/52%), delay 66% / on time 34%, female 45% / male 55%.
  - Age groups 42, 46, 54, 68, 62, 52, 54, 53. Departments 252, 89, 46, 14, 12, 6, 6, 6.
  - The workbook's cached pivot values agree too.
  - The screenshot highlights 2023 on the year slicer, but that slicer is wired only to a stray pivot (PivotTable12). The KPIs therefore show Feb for all years, and since there is no Feb 2023 in the data, that equals Feb 2024.
- **Known limitations:**
  - The repo does not document where the CSV comes from. The owner's README calls it "a real Hospital ER dataset", but it circulates widely as a practice dataset, so it should not be presented as one named hospital's records.
  - In the workbook, the satisfaction sparkline plots daily average *wait time* because its pivot uses the wrong field.

## Customer service (Comcast): `customer-service.json`

- **Source:** https://github.com/shk-javed/comcast-customer-complaints-analysis, `Comcast.xlsx` (2,224 rows, 10 columns).
- **Columns used:**
  - `Date_month_year`, which is corrected (see below).
  - Hour from `Time`.
  - `State`, `City`, `Status`, `Received Via`.
  - `Customer Complaint`, used only to derive the categories; the text itself is not published.
- **Dropped:** Ticket #, the complaint text, Zip code, and "Filing on Behalf of Someone".
- **Date fix (inference, documented in `rules.date`):**
  - The stored dates swap day and month whenever the real day is 1–12. Every stored date with day ≤ 12 falls on day 4, 5 or 6, so Jan–Mar and Jul–Dec contain only days 4–6.
  - After swapping day and month for those rows (572 dates actually change; dates like 4 Apr stay the same), all complaints fall between 1 Apr and 30 Jun 2015, and every one of those 91 days is present.
  - The owner's Power BI "Complaints by Month" (Jan–Dec, with a June spike of 1,046) uses the stored dates. The corrected monthly totals are Apr 545, May 399 and Jun 1,280.
  - The rule to rebuild the stored month from the corrected date is in `rules.date`.
- **Rules:**
  - Resolved = Solved + Closed (76.75%).
  - The dashboard's "Open Cases" counts Status = Open only (363); Pending (154) is not counted there.
  - "District Of Columbia" is merged into "District of Columbia".
- **Categories:**
  - `cat` is my own *approximate* keyword grouping: regex patterns on the lower-cased text, first match wins, 6 groups plus Other. The exact keywords are in `rules.category`. About 29% of complaints stay in Other because their titles are generic ("Comcast", "Comcast Internet").
  - `pc` is a *reconstruction* of the owner's Power BI `Complaint_Type`. The .pbix model is XPress9-compressed, so its DAX could not be read. The reconstruction (case-sensitive `speed`/`bill`/`service`/`outage`, first match wins) matches every Complaint_Type number in the three screenshots, but it remains an inference.
- **Verification:** these all match the dashboard screenshot:
  - 2,224 total, 76.75% resolved, 363 open.
  - Peak hour 16 (177 complaints), 59 complaints at hour 0.
  - Top cities Atlanta 63, Chicago 47, Knoxville 36, Houston 33, Jacksonville 31.

  Both filtered screenshots (stored month Feb + California + each channel) also match: 7 complaints / 85.71% / 1 open / peak 19, and 2 complaints / 100% / 0 open / peak 21.
- **Image note:**
  - `sql-analysis.png` is **not** a SQL screenshot. It is the same Power BI dashboard filtered to Feb + California + Customer Care Call.
  - `sql-analysisS.png` is the same filter with Internet as the channel. It is a different image, not a duplicate.
  - No SQL query screenshot exists in the repo. Even so, `customer-service-sql.webp` is a dashboard view.
- **Known limitations:**
  - The repo does not name the source. It appears to be the widely used public Kaggle "Comcast Telecom Consumer Complaints" dataset.
  - Cities are grouped by name only, so same-named cities in different states are combined, as the dashboard does.

## Spotify 2023: `spotify-2023.json`

- **Source:** https://github.com/shk-javed/spotify2023-dashboard, `spotify-2023.xlsx`, sheet `spotify-2023` (Excel table `javed`, 932 rows, 27 columns). It comes from the Kaggle dataset "Most Streamed Spotify Songs 2023".
- **Columns used:** track, artist(s), release year/month, streams, bpm, and the 7 audio-feature percentages. Nothing is dropped.
- **Checks:**
  - 932 tracks, which matches the site's claim.
  - The `streams` column is fully numeric, so the corrupted Kaggle row is not in this file. The original Kaggle file (reportedly 953 rows) is not in the repo, so the owner's earlier cleaning cannot be checked.
  - Six titles stored by Excel as numbers or a time are written back as text: "505", "69", "2055", "212", "295", "10:35".
  - 70 track names and 48 artist strings contain U+FFFD (lost accents, e.g. "Beyonc��"). They are left as-is.
  - "Que Vuelvas" has streams = 2,762, which is almost certainly a source error, but it is kept unchanged because the true value can't be proven.
- **Verification:** the workbook's saved slicer (2022 / July) shows 25 tracks, 9,409,698,670 streams and an average of 376,387,946.8, reproduced exactly. Its "Avg BPM" of 122.32 is actually the all-tracks average, because that pivot is not connected to the slicers.

## Domestic airline dashboard (image only)

- **Source:** https://github.com/shk-javed/domestic-airline-kpi-dashboard. The GitHub contents API lists only `README.md` and `dashboard.png`. There is no data file and no .pbix, so nothing can be recomputed.
- **What the image shows:**
  - "9651 Total Flights", and the duration buckets 4,980 + 2,642 + 780 + 628 + 621 add up to 9,651.
  - "12 airlines" (from the README) **cannot be verified**, because the price chart shows only 7 airlines and has a scroll bar.
- **Visible issues:**
  - "Top 3 cheapest Routes" (by source) and "Top 3 Expensive Route" (by destination) show the same three values: 9,102.63, 10,468.39 and 11,916.37.
  - "Non-stop Flights %" shows 0.
  - The source donut includes a "(Blank)" slice.
- The README calls the data "custom (self-created)". However, the airline names and city spellings ("Jet Airways Business", "Multiple carriers Premium economy", "Banglore", "Cochin", "New Delhi") match the public Kaggle/MachineHack flight-fare dataset. This can't be settled without the data.

---

## Aadhaar Masking Tool: pipeline as implemented

Source: https://github.com/shk-javed/Aadhaar-Masking-Tool. Only the code was read: `masking/utils/ocr_utils.py`, `masking/views.py`, `masking/urls.py`, `masking/templates/upload.html`, `aadhar_masking_project/settings.py` and `requirements.txt`. No card images were downloaded or published.

1. **Upload** (`views.upload_image`, route `/`):
   - The form field is `image`, and the browser `accept` list is `.jpg,.jpeg,.png,.pdf`.
   - The server branches on a `.pdf` extension. Any other file is decoded with OpenCV (`cv2.imdecode`, with `cv2.imread` as a fallback). If decoding fails, the page shows the error "Could not read uploaded file as image".
   - The upload is saved to `MEDIA_ROOT` (`<project>/media`) with Django `FileSystemStorage`, and the original is deleted in `finally`.
2. **PDF handling:**
   - PyMuPDF (`fitz`) renders **every** page at 2× (`fitz.Matrix(2, 2)`, no alpha).
   - Each page goes through the image pipeline and is written to a temporary PNG.
   - The PNGs are put back together as a new image-only PDF, `masked_<name>.pdf`, so the text layer is lost.
   - A `preview_<name>.png` of page 1 is kept, and the temporary PNGs are deleted.
3. **No deskew:**
   - `deskew_and_warp()` (Canny, largest 4-point contour, perspective warp) exists but is commented out in `mask_aadhaar_image` ("SKIP WARPING"), so the full original image is used.
   - The only rotation handling is PaddleOCR's text-line angle classifier (`PaddleOCR(use_angle_cls=True)`, `ocr(..., cls=True)`).
4. **Preprocessing** (`enhance_for_ocr`):
   - BGR → RGB → LAB, then CLAHE on L (`clipLimit=2.0`, `tileGridSize=(8, 8)`), then back to RGB for PaddleOCR.
   - A grayscale copy with a 3×3 Gaussian blur is made for Tesseract.
5. **OCR** (`paddle_ocr_read`, then `pytesseract_read`):
   - PaddleOCR runs first, as a lazily created singleton with language `PADDLE_OCR_LANG`, default `en`.
   - Tesseract (`image_to_data`, `lang='eng'`) runs **only if PaddleOCR returns no lines or raises an error**. The two engines are never combined.
   - EasyOCR is listed in `requirements.txt` but is not used.
6. **Normalisation:** `normalize_text` removes zero-width spaces, turns NBSP into a space and trims. `digits_only` keeps only the digit characters of each OCR line or word.
7. **Disqualifier** (`is_near_disqualifier`, `proximity=3`):
   - A candidate is skipped if any OCR item within ±3 positions in OCR output order contains one of `DISQUALIFY_KEYWORDS`: virtual, mobile, phone, tel, telephone, email, contact, mob, eid, vid, virtual id.
   - Hindi मोबाइल, फोन and ईमेल also disqualify.
   - Matching is substring-based after lower-casing, and only a-z, 0-9, Devanagari and spaces are kept. As a result the Telugu-script entry in `DISQUALIFY_KEYWORDS_HI` can never match, and "tel" also matches words like "hotel".
8. **Acceptance:** only digit counts and layout are checked. There is no regex and no Verhoeff checksum.
   - **Pass 1:** any OCR token whose digits-only length is exactly **12**.
   - **Pass 2:** three tokens with exactly 4 digits, sorted by (y, x). They must lie on one line (centre-y difference ≤ 0.5 × height), and each gap must satisfy `0 < gap < 3 × height`.
   - **Fallback:** used only if nothing was found. It takes the first token with **11–13** digits, to tolerate OCR errors.
   - A 16-digit VID is excluded only because it isn't 12 digits.
   - `AADHAAR_PATTERNS`, `VID_PATTERN`, `EID_PATTERN` and `PARTIAL4` are defined but never used.
9. **Mask geometry:**
   - Pass 1 covers the left 8/12 of the token box. Pass 2 covers the union of the first two 4-digit boxes. The fallback covers the left 8/len(digits) of the box.
   - Each box gets 2 px of padding (`expand_box`).
   - The last 4 digits are the original pixels; they are never redrawn.
10. **Mask drawing** (`apply_mask`, `MASK_STYLE` from the environment, default `solid`):
    - `solid` fills each box with the median BGR colour of that box, so it blends with the card.
    - `blur` applies a 51×51 Gaussian blur.
    - `pixelate` scales the box down 10× and back up.
    - `draw_mask_label` then writes **black** "XXXX XXXX" (Hershey Simplex, scale `max(h/40, 0.6)`) centred on each box.
11. **Output and serving:**
    - Images are saved as `masked_<name>.png` (always PNG) and PDFs as `masked_<name>.pdf`, both in `MEDIA_ROOT`. They are linked through `MEDIA_URL` `/media/`, which is served by Django only while `DEBUG=True`.
    - Outputs are never cleaned up.
    - `preview/<filename>/` serves any file in `MEDIA_ROOT` as a PDF with `Access-Control-Allow-Origin: *`.
12. **Settings:**
    - `TESSERACT_CMD`: environment variable, default `/opt/homebrew/bin/tesseract`. `ocr_utils` itself falls back to `/usr/bin/tesseract`.
    - `MASK_STYLE` and `PADDLE_OCR_LANG`.
    - `OCR_CONF_MIN=30` and `OCR_CONF_STRICT=40` are defined, but confidence is never used to filter results.
    - `DEBUG=True`, `ALLOWED_HOSTS=[]`, and a hard-coded `SECRET_KEY` is committed.

**README / UI vs code**
- The README says "Regex-based validation". The regexes are defined but unused; acceptance is digit counting plus the nearby-keyword check.
- The README says "Tesseract / PaddleOCR". In the code, PaddleOCR is primary and Tesseract is only a fallback when Paddle returns nothing.
- `requirements.txt` pins `paddleocr==3.1.0`, but the code uses the 2.x-style `ocr(img, cls=True)` call and parses the 2.x result shape.
  - With 3.x the call or the parsing may fail or return nothing, which would silently route everything to Tesseract.
  - This was not executed, so it is unverified.
- The README says "Handles tilted ... formats". Deskew is disabled, and only PaddleOCR's text-angle classifier remains.
- The README says "first 8 digits masked, last 4 visible (configurable)". The 8/4 split is hard-coded; only the mask style is configurable.
- The README mentions "Render / Hugging Face (optional)" deployment, but the repo has no Procfile, render.yaml, Dockerfile or Space config. `ALLOWED_HOSTS` is empty and `DEBUG` is on.
- The README demo images `assets/original_aadhaar.png` and `assets/masked_aadhaar.png` do not exist in the repo.
- The README lists Matplotlib, which is not in the requirements or the code. `requirements.txt` also carries unused EasyOCR, LangChain, OpenAI and torch.
- The UI says "No data is stored on the server". The upload is deleted, but the masked outputs and PDF previews stay in `media/`.
- The UI says "PDF (single-page)", but every page is processed.
- The UI says "white or blurred mask". The default is a median-colour fill with black "XXXX XXXX" text.
- The code comments mention a white label with "XXXX XXXX 1234", but the code draws black "XXXX XXXX" only.
- The UI's "Validate Aadhaar" nav link points to `#`; there is no validation feature.
