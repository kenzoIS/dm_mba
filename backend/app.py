"""
LumiCart MBA Engine — Flask REST API with Supabase (PostgreSQL)
Run: python app.py

Credentials loaded from backend/.env:
  DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
  DB_PORT=6543
  DB_NAME=postgres
  DB_USER=postgres.surgjpamzyydyieosdng
  DB_PASSWORD=KenzoValoPH123
"""

import os
import io
import json
import logging
import time
import random
from collections import defaultdict
from datetime import datetime
from contextlib import contextmanager

import pandas as pd
from flask import Flask, request, jsonify, Response
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

from mba_engine import (
    fp_growth,
    generate_association_rules,
    SelfLearningEngine,
    get_top_bundles,
    get_cart_crosssell,
    get_promotions,
    get_shelf_placement,
    get_item_frequencies,
    evaluate_hit_rate,
)

# ── Load .env ──────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DB_PARAMS = {
    "host":     os.getenv("DB_HOST"),
    "port":     os.getenv("DB_PORT", "6543"),
    "dbname":   os.getenv("DB_NAME", "postgres"),
    "user":     os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "sslmode":  "require",
    "connect_timeout": 10,
}

missing = [k for k in ("host", "user", "password") if not DB_PARAMS.get(k)]
if missing:
    raise RuntimeError(
        f"Missing .env variables: {missing}. "
        "Make sure backend/.env has DB_HOST, DB_USER, DB_PASSWORD set."
    )

# ── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
)
logger = logging.getLogger("lumicart.api")

# ── Flask ──────────────────────────────────────────────────────
app = Flask(__name__)


# ─────────────────────────────────────────────
#  DATABASE LAYER  (Supabase / PostgreSQL)
# ─────────────────────────────────────────────

@contextmanager
def get_db():
    """Yield a psycopg2 connection using individual params."""
    conn = psycopg2.connect(**DB_PARAMS)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """
    Create tables if they don't exist.
    Safe to call every startup — uses IF NOT EXISTS.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id          BIGSERIAL PRIMARY KEY,
                    tid         TEXT      NOT NULL,
                    item        TEXT      NOT NULL,
                    source_file TEXT      NOT NULL,
                    uploaded_at TEXT      NOT NULL
                );

                CREATE TABLE IF NOT EXISTS dataset_files (
                    id          BIGSERIAL PRIMARY KEY,
                    filename    TEXT      NOT NULL,
                    n_rows      INTEGER   NOT NULL,
                    mode        TEXT      NOT NULL,
                    uploaded_at TEXT      NOT NULL
                );

                CREATE TABLE IF NOT EXISTS versions (
                    id                BIGSERIAL PRIMARY KEY,
                    version_id        TEXT      NOT NULL,
                    n_transactions    INTEGER   NOT NULL,
                    rule_count        INTEGER   NOT NULL,
                    avg_lift          FLOAT     NOT NULL,
                    avg_confidence    FLOAT     NOT NULL,
                    min_support       FLOAT     NOT NULL,
                    min_confidence    FLOAT     NOT NULL,
                    hit_rate          FLOAT     NOT NULL,
                    drift_alerts      TEXT      NOT NULL,
                    threshold_changed INTEGER   NOT NULL,
                    weights           TEXT      NOT NULL,
                    top_rule          TEXT,
                    created_at        TEXT      NOT NULL
                );

                CREATE TABLE IF NOT EXISTS engine_state (
                    id              INTEGER   NOT NULL DEFAULT 1,
                    min_support     FLOAT     NOT NULL DEFAULT 0.03,
                    min_confidence  FLOAT     NOT NULL DEFAULT 0.30,
                    weights         TEXT      NOT NULL DEFAULT '{}',
                    version_counter INTEGER   NOT NULL DEFAULT 0,
                    PRIMARY KEY (id),
                    CONSTRAINT single_row CHECK (id = 1)
                );

                CREATE TABLE IF NOT EXISTS rules (
                    id              BIGSERIAL PRIMARY KEY,
                    version_id      TEXT      NOT NULL,
                    antecedents     TEXT      NOT NULL,
                    consequents     TEXT      NOT NULL,
                    support         FLOAT     NOT NULL,
                    confidence      FLOAT     NOT NULL,
                    lift            FLOAT     NOT NULL,
                    leverage        FLOAT     NOT NULL,
                    conviction      FLOAT     NOT NULL,
                    composite_score FLOAT     NOT NULL
                );
            """)
    logger.info("Supabase tables verified / created")


# ── Persistence helpers ────────────────────────────────────────

def save_engine_state(engine, version_counter):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO engine_state
                    (id, min_support, min_confidence, weights, version_counter)
                VALUES (1, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    min_support     = EXCLUDED.min_support,
                    min_confidence  = EXCLUDED.min_confidence,
                    weights         = EXCLUDED.weights,
                    version_counter = EXCLUDED.version_counter
            """, (
                engine.min_support,
                engine.min_confidence,
                json.dumps(engine.weights),
                version_counter,
            ))


def load_engine_state():
    engine = SelfLearningEngine()
    version_counter = 0
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM engine_state WHERE id = 1")
            row = cur.fetchone()
            if row:
                engine.min_support    = row["min_support"]
                engine.min_confidence = row["min_confidence"]
                saved_weights         = json.loads(row["weights"])
                if saved_weights:
                    engine.weights    = saved_weights
                version_counter       = row["version_counter"]

            cur.execute("SELECT * FROM versions ORDER BY id ASC")
            for r in cur.fetchall():
                engine.version_history.append({
                    "version":           r["version_id"],
                    "n_transactions":    r["n_transactions"],
                    "rule_count":        r["rule_count"],
                    "avg_lift":          r["avg_lift"],
                    "avg_confidence":    r["avg_confidence"],
                    "min_support":       r["min_support"],
                    "min_confidence":    r["min_confidence"],
                    "hit_rate":          r["hit_rate"],
                    "drift_alerts":      json.loads(r["drift_alerts"]),
                    "threshold_changed": bool(r["threshold_changed"]),
                    "weights":           json.loads(r["weights"]),
                    "top_rule":          json.loads(r["top_rule"]) if r["top_rule"] else None,
                })
    return engine, version_counter


def save_transactions(transactions, source_file, mode):
    now = datetime.now().isoformat()
    with get_db() as conn:
        with conn.cursor() as cur:
            if mode == "replace":
                cur.execute("DELETE FROM transactions")
                cur.execute("DELETE FROM dataset_files")
                cur.execute("DELETE FROM versions")
                cur.execute("DELETE FROM rules")
                cur.execute("DELETE FROM engine_state")
                logger.info("Cleared all previous data (replace mode)")
                current_tid = 1
            else:
                cur.execute("SELECT COALESCE(MAX(CAST(tid AS BIGINT)), 0) FROM transactions")
                current_tid = cur.fetchone()[0] + 1

            rows = []
            for basket in transactions:
                tid_str = str(current_tid)
                for item in basket:
                    rows.append((tid_str, item, source_file, now))
                current_tid += 1

            psycopg2.extras.execute_values(
                cur,
                "INSERT INTO transactions (tid, item, source_file, uploaded_at) VALUES %s",
                rows
            )
            cur.execute(
                "INSERT INTO dataset_files (filename, n_rows, mode, uploaded_at) VALUES (%s, %s, %s, %s)",
                (source_file, len(transactions), mode, now)
            )


def load_transactions():
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT tid, item FROM transactions ORDER BY CAST(tid AS BIGINT)"
            )
            rows = cur.fetchall()
    if not rows:
        return []
    grouped = defaultdict(set)
    for row in rows:
        grouped[row["tid"]].add(row["item"])
    return list(grouped.values())


def load_dataset_files():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT filename FROM dataset_files ORDER BY id")
            return [r[0] for r in cur.fetchall()]


def save_version(version_entry, rules):
    now = datetime.now().isoformat()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO versions (
                    version_id, n_transactions, rule_count, avg_lift,
                    avg_confidence, min_support, min_confidence, hit_rate,
                    drift_alerts, threshold_changed, weights, top_rule, created_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                version_entry["version"],
                version_entry["n_transactions"],
                version_entry["rule_count"],
                version_entry["avg_lift"],
                version_entry.get("avg_confidence", 0),
                version_entry["min_support"],
                version_entry.get("min_confidence", 0.3),
                version_entry.get("hit_rate", 0),
                json.dumps(version_entry["drift_alerts"]),
                int(version_entry["threshold_changed"]),
                json.dumps(version_entry["weights"]),
                json.dumps(version_entry["top_rule"]) if version_entry.get("top_rule") else None,
                now,
            ))

            # Delete old rules for this version then insert fresh
            cur.execute("DELETE FROM rules WHERE version_id = %s", (version_entry["version"],))
            rule_rows = []
            for r in rules[:200]:
                rule_rows.append((
                    version_entry["version"],
                    json.dumps(r["antecedents"]),
                    json.dumps(r["consequents"]),
                    r["support"],
                    r["confidence"],
                    r["lift"],
                    r["leverage"],
                    r["conviction"],
                    r.get("composite_score", 0),
                ))
            if rule_rows:
                psycopg2.extras.execute_values(
                    cur,
                    """INSERT INTO rules
                        (version_id, antecedents, consequents, support, confidence,
                         lift, leverage, conviction, composite_score)
                       VALUES %s""",
                    rule_rows
                )


def load_latest_rules():
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT version_id FROM versions ORDER BY id DESC LIMIT 1")
            latest = cur.fetchone()
            if not latest:
                return []
            cur.execute(
                "SELECT * FROM rules WHERE version_id = %s ORDER BY composite_score DESC",
                (latest["version_id"],)
            )
            rows = cur.fetchall()
    return [{
        "antecedents":     json.loads(r["antecedents"]),
        "consequents":     json.loads(r["consequents"]),
        "support":         r["support"],
        "confidence":      r["confidence"],
        "lift":            r["lift"],
        "leverage":        r["leverage"],
        "conviction":      r["conviction"],
        "composite_score": r["composite_score"],
    } for r in rows]


def load_item_support():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(DISTINCT tid) FROM transactions")
            total = cur.fetchone()[0]
            if total == 0:
                return {}
            cur.execute(
                "SELECT item, COUNT(DISTINCT tid) FROM transactions GROUP BY item"
            )
            return {item: cnt / total for item, cnt in cur.fetchall()}


# ── CORS ───────────────────────────────────────────────────────
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

@app.route("/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/<path:path>", methods=["OPTIONS"])
def handle_options(path):
    return "", 204


# ── In-memory state ────────────────────────────────────────────
STATE = {
    "current_rules":        [],
    "current_item_support": {},
    "engine":               None,
    "version_counter":      0,
    "last_run_stats":       None,
}


# ─────────────────────────────────────────────
#  CSV PARSER
# ─────────────────────────────────────────────

def parse_csv_to_transactions(file_content, filename):
    try:
        df = pd.read_csv(io.StringIO(file_content))
    except Exception as e:
        raise ValueError(f"Could not parse CSV: {e}")

    cols = [c.strip().lower() for c in df.columns]
    df.columns = cols
    transactions = []

    if "transaction_id" in cols and "item" in cols:
        grouped = df.groupby("transaction_id")["item"].apply(list)
        transactions = [
            set(str(i).strip() for i in items if str(i).strip())
            for items in grouped
        ]
    elif "transaction_id" in cols:
        item_cols = [c for c in cols if c != "transaction_id"]
        for _, row in df.iterrows():
            basket = set()
            for c in item_cols:
                val = str(row[c]).strip()
                if val and val.lower() not in ("nan", "none", ""):
                    basket.add(val)
            if basket:
                transactions.append(basket)
    else:
        for _, row in df.iterrows():
            basket = set()
            for val in row:
                v = str(val).strip()
                if v and v.lower() not in ("nan", "none", ""):
                    basket.add(v)
            if basket:
                transactions.append(basket)

    multi = [t for t in transactions if len(t) >= 2]
    if len(multi) >= len(transactions) * 0.3:
        transactions = multi
    return transactions


# ─────────────────────────────────────────────
#  PIPELINE
# ─────────────────────────────────────────────

def run_pipeline(transactions, version_label=None):
    engine = STATE["engine"]
    n = len(transactions)
    if n == 0:
        raise ValueError("No transactions to process")

    min_sup_count = max(2, int(engine.min_support * n))
    start = time.time()
    logger.info(f"FP-Growth on {n} transactions, min_support={engine.min_support:.3f} (count={min_sup_count})")

    itemsets = fp_growth(transactions, min_sup_count)
    logger.info(f"Found {len(itemsets)} frequent itemsets")

    rules = generate_association_rules(
        itemsets, min_confidence=engine.min_confidence, n_transactions=n
    )
    logger.info(f"Generated {len(rules)} association rules")

    rules = engine.score_rules(rules)

    item_count = defaultdict(int)
    for t in transactions:
        for item in t:
            item_count[item] += 1
    current_item_sup = {item: cnt / n for item, cnt in item_count.items()}

    drift             = engine.detect_drift(current_item_sup, STATE["current_item_support"])
    threshold_changed = engine.adapt_thresholds(len(rules))
    engine.adapt_weights(rules)

    v_id = version_label or f"v{STATE['version_counter'] + 1}"
    STATE["version_counter"] += 1

    version_entry = engine.register_version(
        v_id, rules, engine.min_support, drift, threshold_changed, n
    )
    version_entry["hit_rate"]       = evaluate_hit_rate(transactions, rules, holdout=0.10)
    version_entry["avg_confidence"] = round(sum(r["confidence"] for r in rules) / len(rules), 3) if rules else 0
    version_entry["min_confidence"] = engine.min_confidence

    # ── Save to Supabase ───────────────────────────────────────
    save_version(version_entry, rules)
    save_engine_state(engine, STATE["version_counter"])

    elapsed      = round(time.time() - start, 3)
    item_freqs   = get_item_frequencies(transactions, n)
    basket_sizes = defaultdict(int)
    for t in transactions:
        sz  = len(t)
        key = str(sz) if sz <= 8 else "9+"
        basket_sizes[key] += 1

    result = {
        "version":           v_id,
        "n_transactions":    n,
        "n_itemsets":        len(itemsets),
        "n_rules":           len(rules),
        "avg_lift":          version_entry["avg_lift"],
        "avg_confidence":    version_entry["avg_confidence"],
        "hit_rate":          version_entry["hit_rate"],
        "elapsed_seconds":   elapsed,
        "min_support":       round(engine.min_support, 4),
        "min_confidence":    round(engine.min_confidence, 4),
        "weights":           engine.weights,
        "drift_alerts":      drift,
        "threshold_changed": threshold_changed,
        "top_bundles":       get_top_bundles(rules, 10),
        "promotions":        get_promotions(rules),
        "shelf_placement":   get_shelf_placement(rules),
        "item_frequencies":  item_freqs,
        "basket_size_dist":  dict(basket_sizes),
        "version_history":   engine.version_history,
        "rules_preview":     rules[:50],
        "dataset_files":     load_dataset_files(),
    }

    STATE["current_rules"]        = rules
    STATE["current_item_support"] = current_item_sup
    STATE["last_run_stats"]       = result

    logger.info(f"Pipeline complete: {len(rules)} rules, hit_rate={version_entry['hit_rate']:.2%}, {elapsed}s")
    return result


def rebuild_state_from_db():
    """Called on startup — restores full state from Supabase."""
    engine, version_counter   = load_engine_state()
    STATE["engine"]           = engine
    STATE["version_counter"]  = version_counter
    STATE["current_rules"]        = load_latest_rules()
    STATE["current_item_support"] = load_item_support()

    if STATE["current_rules"] and engine.version_history:
        transactions  = load_transactions()
        dataset_files = load_dataset_files()
        n             = len(transactions)
        item_freqs    = get_item_frequencies(transactions, n) if n > 0 else {}
        basket_sizes  = defaultdict(int)
        for t in transactions:
            sz  = len(t)
            key = str(sz) if sz <= 8 else "9+"
            basket_sizes[key] += 1

        last_v = engine.version_history[-1]
        STATE["last_run_stats"] = {
            "version":           last_v["version"],
            "n_transactions":    n,
            "n_itemsets":        0,
            "n_rules":           len(STATE["current_rules"]),
            "avg_lift":          last_v["avg_lift"],
            "avg_confidence":    last_v["avg_confidence"],
            "hit_rate":          last_v.get("hit_rate", 0),
            "elapsed_seconds":   0,
            "min_support":       engine.min_support,
            "min_confidence":    engine.min_confidence,
            "weights":           engine.weights,
            "drift_alerts":      last_v["drift_alerts"],
            "threshold_changed": last_v["threshold_changed"],
            "top_bundles":       get_top_bundles(STATE["current_rules"], 10),
            "promotions":        get_promotions(STATE["current_rules"]),
            "shelf_placement":   get_shelf_placement(STATE["current_rules"]),
            "item_frequencies":  item_freqs,
            "basket_size_dist":  dict(basket_sizes),
            "version_history":   engine.version_history,
            "rules_preview":     STATE["current_rules"][:50],
            "dataset_files":     dataset_files,
        }
        logger.info(
            f"Restored from Supabase: {n} transactions, "
            f"{len(STATE['current_rules'])} rules, "
            f"{len(engine.version_history)} versions"
        )
    else:
        logger.info("No previous data in Supabase — fresh start")


# ─────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(DISTINCT tid) FROM transactions")
            n_txn = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM versions")
            n_ver = cur.fetchone()[0]
    return jsonify({
        "status":          "ok",
        "version_counter": STATE["version_counter"],
        "n_transactions":  n_txn,
        "n_rules":         len(STATE["current_rules"]),
        "n_versions":      n_ver,
        "database":        "Supabase (PostgreSQL)",
    })


@app.route("/api/upload", methods=["POST"])
def upload_dataset():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Only CSV files are accepted"}), 400

    mode = request.form.get("mode", "append")

    try:
        content          = file.stream.read().decode("utf-8", errors="replace")
        new_transactions = parse_csv_to_transactions(content, file.filename)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if len(new_transactions) == 0:
        return jsonify({"error": "No valid transactions found in file"}), 400

    if mode == "replace":
        STATE["engine"]               = SelfLearningEngine()
        STATE["version_counter"]      = 0
        STATE["current_item_support"] = {}

    save_transactions(new_transactions, file.filename, mode)
    all_transactions = load_transactions()

    try:
        result = run_pipeline(all_transactions)
        result["new_transactions_added"] = len(new_transactions)
        result["mode"]                   = mode
        return jsonify(result)
    except Exception as e:
        logger.exception("Pipeline error")
        return jsonify({"error": str(e)}), 500


@app.route("/api/rerun", methods=["POST"])
def rerun_pipeline():
    all_transactions = load_transactions()
    if not all_transactions:
        return jsonify({"error": "No transactions in database yet"}), 400
    try:
        result = run_pipeline(all_transactions)
        return jsonify(result)
    except Exception as e:
        logger.exception("Rerun error")
        return jsonify({"error": str(e)}), 500


@app.route("/api/state", methods=["GET"])
def get_state():
    if STATE["last_run_stats"] is None:
        return jsonify({"status": "no_data", "message": "Upload a dataset to begin"})
    return jsonify(STATE["last_run_stats"])


@app.route("/api/crosssell", methods=["GET"])
def crosssell():
    cart = request.args.get("cart", "")
    if not cart:
        return jsonify({"error": "Provide ?cart=item1,item2"}), 400
    cart_items  = [i.strip() for i in cart.split(",") if i.strip()]
    suggestions = get_cart_crosssell(STATE["current_rules"], cart_items)
    return jsonify({"cart": cart_items, "suggestions": suggestions})


@app.route("/api/db-stats", methods=["GET"])
def db_stats():
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT COUNT(DISTINCT tid) as n FROM transactions")
            n_txn = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(DISTINCT item) as n FROM transactions")
            n_items = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) as n FROM dataset_files")
            n_files = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) as n FROM versions")
            n_ver = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) as n FROM rules")
            n_rules = cur.fetchone()["n"]
            cur.execute("SELECT filename, n_rows, mode, uploaded_at FROM dataset_files ORDER BY id")
            files = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT version_id, n_transactions, rule_count, avg_lift, created_at FROM versions ORDER BY id")
            versions = [dict(r) for r in cur.fetchall()]
    return jsonify({
        "database":       "Supabase (PostgreSQL)",
        "n_transactions": n_txn,
        "n_unique_items": n_items,
        "n_files":        n_files,
        "n_versions":     n_ver,
        "n_rules_stored": n_rules,
        "files":          files,
        "versions":       versions,
    })


@app.route("/api/generate-sample", methods=["GET"])
def generate_sample():
    PRODUCTS = [
        "Hydrating Moisturizer", "Gentle Toner", "Vitamin C Serum",
        "Micellar Cleanser", "Sheet Mask Pack", "SPF 50 Sunscreen",
        "Matte Foundation", "Liquid Concealer", "Loose Setting Powder",
        "Brow Pencil", "Mascara", "Lip Tint", "Lip Liner",
        "Argan Oil Shampoo", "Repair Conditioner", "Hair Serum",
        "Face Mist", "BB Cream"
    ]
    AFFINITIES = {
        "Hydrating Moisturizer": ["Gentle Toner", "Vitamin C Serum", "Face Mist"],
        "Gentle Toner":          ["Hydrating Moisturizer", "Micellar Cleanser"],
        "Matte Foundation":      ["Liquid Concealer", "Loose Setting Powder"],
        "Argan Oil Shampoo":     ["Repair Conditioner", "Hair Serum"],
        "Lip Tint":              ["Lip Liner"],
        "Mascara":               ["Brow Pencil"],
        "SPF 50 Sunscreen":      ["Hydrating Moisturizer", "BB Cream"],
    }
    dataset_type    = request.args.get("type", "a")
    n               = int(request.args.get("n", 1000))
    sunscreen_boost = 1.4 if dataset_type == "b" else 1.0

    rows = []
    for i in range(n):
        size    = random.choices([2,3,4,5,6,7,8], weights=[0.25,0.35,0.20,0.10,0.05,0.03,0.02])[0]
        weights = [sunscreen_boost if p == "SPF 50 Sunscreen" else 1.0 for p in PRODUCTS]
        anchor  = random.choices(PRODUCTS, weights=weights)[0]
        basket  = {anchor}
        attempts = 0
        while len(basket) < size and attempts < 30:
            attempts += 1
            if anchor in AFFINITIES and random.random() < 0.65:
                item = random.choice(AFFINITIES[anchor])
            else:
                item = random.choices(PRODUCTS, weights=weights)[0]
            basket.add(item)
        for item in basket:
            rows.append({"transaction_id": i + 1, "item": item})

    csv_str = pd.DataFrame(rows).to_csv(index=False)
    return Response(
        csv_str,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=lumicart_sample_{dataset_type}.csv"}
    )


@app.route("/api/reset", methods=["POST"])
def reset():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM transactions")
            cur.execute("DELETE FROM dataset_files")
            cur.execute("DELETE FROM versions")
            cur.execute("DELETE FROM engine_state")
            cur.execute("DELETE FROM rules")
    STATE["engine"]               = SelfLearningEngine()
    STATE["version_counter"]      = 0
    STATE["current_rules"]        = []
    STATE["current_item_support"] = {}
    STATE["last_run_stats"]       = None
    logger.info("System reset — Supabase data cleared")
    return jsonify({"status": "reset", "message": "All data cleared from Supabase"})


# ─────────────────────────────────────────────
#  STARTUP
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  LumiCart MBA Engine — Flask + Supabase")
    print("  Connecting to Supabase...")
    init_db()
    rebuild_state_from_db()
    print("  Connected! Running at: http://localhost:5000")
    print("  Endpoints:")
    print("    GET  /api/health")
    print("    GET  /api/db-stats")
    print("    POST /api/upload        (multipart CSV)")
    print("    POST /api/rerun")
    print("    GET  /api/state")
    print("    GET  /api/crosssell?cart=item1,item2")
    print("    GET  /api/generate-sample?type=a&n=1000")
    print("    POST /api/reset")
    print("=" * 60)
    app.run(debug=True, port=5000, host="0.0.0.0")
