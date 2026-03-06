# 💄 LumiCart MBA Engine

**Production-grade Market Basket Analysis system** for a cosmetics shop.
Self-learning · FP-Growth · Association Rules · Flask API · React Dashboard

---

## 🏗️ Project Structure

```
lumicart/
├── backend/
│   ├── app.py              ← Flask REST API
│   ├── mba_engine.py       ← FP-Growth + Rules + Self-Learning
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.jsx         ← Full React dashboard
│   │   └── index.js
│   └── package.json
│
└── README.md
```

---

## ⚙️ Setup — VS Code Step by Step

### Step 1 — Prerequisites

Make sure you have installed:
- **Python 3.9+** → https://python.org
- **Node.js 18+** → https://nodejs.org
- **VS Code** → https://code.visualstudio.com

---

### Step 2 — Open the Project in VS Code

```
File → Open Folder → select the `lumicart/` folder
```

Open two terminal panels: **Terminal → New Terminal** (do this twice)

---

### Step 3 — Set Up Python Backend

In **Terminal 1**:

```bash
# Navigate to backend
cd backend

# (Optional but recommended) Create virtual environment
python -m venv venv

# Activate it:
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the Flask server
python app.py
```

You should see:
```
LumiCart MBA Engine — Flask API
Running at: http://localhost:5000
```

> Keep this terminal running throughout your session.

---

### Step 4 — Set Up React Frontend

In **Terminal 2**:

```bash
# Navigate to frontend
cd frontend

# Install Node dependencies (first time only — takes ~1 min)
npm install

# Start the React development server
npm start
```

Browser opens automatically at **http://localhost:3000**

---

### Step 5 — Use the System

1. **Upload Page** → Click "Download CSV" to get sample datasets
2. Load **Dataset A** first (baseline — 1,000 transactions)
3. Explore: Overview, Frequencies, Bundles, Rules Table
4. Return to Upload → Load **Dataset B** with mode = **Append**
5. System re-runs automatically — check Learning History for drift alerts
6. Use **Cross-sell Simulator** to test live rule matching
7. Click **Re-run Pipeline** anytime to force a new iteration

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Backend status |
| POST | `/api/upload` | Upload CSV file (multipart) |
| POST | `/api/rerun` | Re-run pipeline on existing data |
| GET | `/api/state` | Get current results without re-running |
| GET | `/api/crosssell?cart=item1,item2` | Get cross-sell suggestions |
| GET | `/api/generate-sample?type=a&n=1000` | Download sample CSV |
| POST | `/api/reset` | Clear all data |

### Test with curl:
```bash
# Health check
curl http://localhost:5000/api/health

# Upload CSV
curl -X POST -F "file=@yourdata.csv" -F "mode=append" http://localhost:5000/api/upload

# Cross-sell
curl "http://localhost:5000/api/crosssell?cart=Gentle+Toner,Hydrating+Moisturizer"

# Download sample dataset
curl "http://localhost:5000/api/generate-sample?type=a&n=1000" -o sample_a.csv
```

---

## 📄 CSV Formats Supported

**Format 1 — Long (recommended):**
```csv
transaction_id,item
1,Hydrating Moisturizer
1,Gentle Toner
2,Foundation
2,Concealer
```

**Format 2 — Wide:**
```csv
transaction_id,item1,item2,item3
1,Moisturizer,Toner,Serum
2,Foundation,Concealer,
```

**Format 3 — Basket rows:**
```csv
Moisturizer,Toner,Serum
Foundation,Concealer
Shampoo,Conditioner
```

---

## 🧠 System Architecture

```
CSV Upload
    ↓
parse_csv_to_transactions()
    ↓
FP-Growth Algorithm (pure Python, no mlxtend)
    ↓
generate_association_rules()  →  support, confidence, lift, leverage, conviction
    ↓
SelfLearningEngine.score_rules()  →  composite score
    ↓
SelfLearningEngine.detect_drift()  →  item support shift detection
    ↓
SelfLearningEngine.adapt_thresholds()  →  auto min_support tuning
    ↓
SelfLearningEngine.adapt_weights()  →  dynamic scoring weights
    ↓
SelfLearningEngine.register_version()  →  iteration versioning
    ↓
RecommendationEngine  →  bundles, cross-sell, promos, shelf placement
    ↓
Flask JSON API
    ↓
React Dashboard
```

---

## 🔄 Self-Learning Mechanisms

| Mechanism | Trigger | Effect |
|-----------|---------|--------|
| Adaptive Thresholds | Rules < 15 or > 300 | min_support ↑ or ↓ by 0.005 |
| Drift Detection | Item support changes > 15% | Alert logged in version history |
| Weight Adaptation | Avg confidence < 0.40 | Confidence weight boosted to 0.40 |
| Rule Scoring | Every iteration | Composite = 0.4×lift + 0.3×conf + 0.2×sup + 0.1×conv |
| Version Registry | Every run | Full history logged with metrics |

---

## 📊 Metrics Explained

| Metric | Formula | Business Use |
|--------|---------|--------------|
| Support | P(A∪B) | Bundle frequency |
| Confidence | P(B\|A) | Upsell success rate |
| Lift | P(B\|A)/P(B) | Genuine affinity (>1 = real pattern) |
| Leverage | P(A∪B) - P(A)×P(B) | Co-occurrence above random |
| Conviction | (1-P(B))/(1-conf) | Rule directional strength |
| Composite Score | Weighted combination | Overall rule quality ranking |

---

## 🌸 Sample Cosmetics Items

18 SKUs across 3 categories:

**Skincare:** Hydrating Moisturizer, Gentle Toner, Vitamin C Serum, Micellar Cleanser, Sheet Mask Pack, SPF 50 Sunscreen, Face Mist

**Makeup:** Matte Foundation, Liquid Concealer, Loose Setting Powder, Brow Pencil, Mascara, Lip Tint, Lip Liner, BB Cream

**Hair:** Argan Oil Shampoo, Repair Conditioner, Hair Serum

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.9+ · Flask 3.x |
| ML Algorithm | FP-Growth (pure Python stdlib) |
| Rule Generation | Custom association rules engine |
| Frontend | React 18 · CSS Variables |
| Communication | REST JSON API · CORS enabled |
| No external ML libs | ✅ pandas + numpy + scipy only |
