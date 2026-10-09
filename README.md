# Systematic Review Screening Trainer 🎓📚
### Experimental In Vivo Mammalian Sepsis Models

An interactive, approachable web-based training platform designed to teach students and research assistants how to screen titles and abstracts for a systematic review of **experimental in vivo mammalian sepsis models**.

Built with zero server dependencies, it runs out of the box in any web browser and can be hosted for free on GitHub Pages, Netlify, or Vercel.

---

## 🌸 Baby Pink & Red Theme & 3-Stage Curriculum

1. **Structured 3-Stage Screening Curriculum**
   - **🌱 Training Mode (10 Papers)**: Interactive practice with instant feedback after every paper, showing comparisons against Zoe and Eva, consensus rationales, and high-yield Learning Pearls.
   - **📝 Exam 1 (30 Papers)**: Blinded test where ratings and scores remain hidden until all 30 papers are screened, testing baseline screening proficiency across real sepsis models and tricky traps.
   - **📝 Exam 2 (30 Papers)**: Second distinct blinded test (30 fresh papers) to evaluate retention, dual-screener consensus, and inter-rater reliability.

2. **Project Leads & Password-Protected Lead Hub**
   - Click **"👑 Lead Hub"** or change role in the header:
     - 👑 **Project Lead - Zoe**: Username `zfisk` | Password `missy`
     - 👑 **Project Lead - Eva**: Username `ekuhar` | Password `gunner`
     - 🎓 **Student / Trainee**: No password needed.
   - Both leads are equal partners and are featured side-by-side with crown icons across all leaderboards, feedback cards, and gradebooks.
   - Leads can sign out at any time directly from the Lead Hub modal.

3. **Manual Screening by Both Project Leads & Dynamic Scoring Against Real Choices**
   - **Both Zoe and Eva can screen all 70 papers manually**:
     - Log in as **Zoe** (`zfisk` / `missy`) &rarr; screen Training (10), Exam 1 (30), and Exam 2 (30).
     - Log in as **Eva** (`ekuhar` / `gunner`) &rarr; screen Training (10), Exam 1 (30), and Exam 2 (30).
     - Each lead's manual decisions (Include, Exclude + Reason, Uncertain, and Notes) are preserved independently in separate profiles.
   - **Student Scoring is Compared Against Your Real Decisions**:
     - Students' screening decisions are compared in real-time against **Zoe's actual choices**, **Eva's actual choices**, and your **Joint Consensus**!
     - In **Training Mode**, students see badges showing `✓ Real Choice` alongside Zoe's and Eva's decisions, plus whether both leads agreed (`🤝 Both Leads Agreed`).
     - In **Exam Scorecards**, students receive:
       - `Agreement with Zoe (Lead) %`
       - `Agreement with Eva (Lead) %`
       - `Consensus Agreement %`
       - Cohen's Kappa ($\kappa$) Reliability
   - **Inter-Lead Calibration & Discrepancy Resolver**:
     - Inside the **👑 Lead Hub**, track Zoe's and Eva's screening progress side-by-side.
     - View **Inter-Lead Reliability**: mutual papers screened, raw agreement %, and Cohen's Kappa between Zoe and Eva.
     - Any papers where Zoe and Eva voted differently appear in the **Interactive Discrepancy Resolver**, allowing 1-click consensus resolution (`[Use Zoe's]`, `[Use Eva's]`, or `[Mark Uncertain]`).
   - **Sync & Transfer Between Laptops (JSON & data.js)**:
     - Zoe and Eva can work on different computers:
       1. Click **"Export Lead Key (.json)"** to download your screening package.
       2. Send it to your co-lead (via Slack/email).
       3. Your co-lead clicks **"Import Co-Lead Key (.json)"** to merge the answers seamlessly!
       4. Click **"Download Updated data.js"** to bake your manual choices into the master dataset forever!

4. **Where Outputs Go: The Lead Hub & Gradebook**
   - **Student Outputs**: Upon finishing an exam, students click **"Download CSV"** or **"Copy Report"** and send it to you.
   - **Lead Gradebook**: Log into the **"👑 Lead Hub"** (using `zfisk` or `ekuhar`) and drop student `.csv` files into the batch uploader.
   - The app automatically parses every submission and compiles a live **Class Gradebook Table** with:
     - Student Name & Stage
     - Consensus Agreement %
     - Agreement with Zoe (Lead) %
     - Agreement with Eva (Lead) %
     - Cohen's Kappa ($\kappa$)
     - Missed Studies (False Exclusions) count
   - Click **"Download Roster CSV"** to save your consolidated class grades!

---

## 🩺 Systematic Review Eligibility Criteria (Sepsis SR)

### Population / Animal Models
- **Included**: In vivo mammalian models of experimentally induced sepsis:
  - Cecal Ligation and Puncture (CLP) and variants (cecal incision, cecum/colon ligation and dissection)
  - Fecal-Induced Peritonitis (FIP) & fecal slurry
  - Colon Ascendants Stent Peritonitis (CASP)
  - Fibrin clot, agar pellet, and fecal pellet implantation models
  - Necrotizing Enterocolitis (NEC) & neonatal sepsis in mammalian pups/piglets
  - Polymicrobial sepsis / peritonitis / abdominal sepsis
  - Pneumonia-derived sepsis & intratracheal/intranasal live pathogen inoculation
  - Bloodstream infection & bacteremia
  - Interstitial nephritis and urosepsis
  - Live pathogens (*E. coli*, *Pseudomonas*, *Klebsiella*, *Staphylococcus*, *Streptococcus*, *Candida*) paired with sepsis, bacteremia, candidemia, or peritonitis in mammals (mice, rats, pigs, sheep, rabbits).
- **Excluded**:
  - 🩺 **Clinical human studies** (clinical trials in human patients, adult ICU cohorts, observational patient studies) &rarr; `EX-CLINICAL`
  - 🚨 **Pure LPS / Endotoxin models** (Lipopolysaccharide challenge, endotoxemia, endotoxic shock) &rarr; `EX-LPS`
  - 🔬 **In vitro cell cultures**, ex vivo organs/slices, or non-mammalian organisms (*Zebrafish*, *Drosophila*, *C. elegans*, *Galleria*) &rarr; `EX-NOT-INVIVO`
  - 🦠 **Non-sepsis disease models** (sterile acute lung injury without sepsis, stroke, trauma, burns) &rarr; `EX-NOT-SEPSIS`

### Intervention / Therapy
- **Included**: Any therapy or standard supportive care for Sepsis. All doses, routes (IV, IP, oral), frequencies, and timings (given either **before** or **after** induction) and combination therapies are eligible! (No exclusions on therapeutic interventions).

### Comparator & Study Limits
- **Comparators**: All studies with or without controls are included (placebo, vehicle, sham, active comparator).
- **Study Design & Language**: Primary research papers published in **English** from **2020 to present** only.
  - Published before 2020 &rarr; `EX-PRE2020`
  - Reviews, meta-analyses, editorials, letters, or conference abstracts &rarr; `EX-NONPRIMARY`
  - Non-English papers &rarr; `EX-LANG`

---

## 🔍 Pedagogical PICO & LPS Clues Toolbar

Students can click one of the interactive highlight buttons to color-code abstracts instantly:
- 🟨 **[P] Model (CLP/Sepsis/Mammal)**: Highlights approved sepsis models, surgical techniques, and mammalian host species.
- 🌸 **[I] Therapy (Treatment/Drug)**: Highlights administered drugs, peptides, antibodies, probiotics, and interventions.
- 🟩 **[O] Outcome (Survival/Organ)**: Highlights survival rates, organ injury metrics (creatinine, BALF, PaO2/FiO2), and cytokines.
- 🚨 **Flag LPS (Endotoxin Trap)**: Instantly reveals Lipopolysaccharide / endotoxin keywords so students spot the #1 pitfall in animal sepsis reviews!

---

## ⌨️ Fast Keyboard Shortcuts

- `1` or `I` : **Include**
- `2` or `E` : **Exclude**
- `3` or `M` : **Uncertain / Maybe**
- `Enter` : **Confirm Decision / Next Paper**
- `N` / `→` : **Next Paper**
- `P` / `←` : **Previous Paper**
- `G` : **Toggle Guidelines Drawer**

---

## 🚀 How to Open & Host

Because the application has **zero build steps** and no `npm` dependencies:

### 1. Opening Locally
- **Option A**: Double-click `index.html` in your file manager to open it directly in Chrome, Safari, or Edge. (All datasets are pre-bundled in `data.js` so it works even via `file://`).
- **Option B (Local server)**: Run `python3 -m http.server 8000` in the directory and visit `http://localhost:8000`.

### 2. Hosting for Free
- **GitHub Pages**: Create a repository, push this folder, and turn on GitHub Pages in repository settings under **Pages** &rarr; Branch `main` &rarr; Folder `/ (root)`.
- **Netlify Drop**: Drag and drop the `systematic-review-trainer` folder onto [app.netlify.com/drop](https://app.netlify.com/drop) for an instant HTTPS website.
- **Vercel**: Import the GitHub repository for one-click deployment.

---

## 📁 File Structure

```
systematic-review-trainer/
├── index.html                  # Main UI, 3 modes, Lead Hub, PICO highlighters
├── styles.css                  # Baby pink & red palette, highlighter badges
├── app.js                      # Core state, Cohen's Kappa, gradebook parser, shortcuts
├── data.js                     # Pre-bundled offline dataset (70 papers + guidelines)
├── generate_sepsis_datasets.py # Generator script for training, exam1, and exam2 papers
├── data/
│   ├── guidelines.json         # Sepsis PICO criteria, exclusion codes, golden rules
│   ├── training10.json         # 10 practice papers with learning pearls
│   ├── exam1.json              # 30 blinded exam papers (Round 1)
│   └── exam2.json              # 30 blinded exam papers (Round 2)
└── README.md                   # Full documentation & guide
```
# SOLES-Sepsis-Trainer
