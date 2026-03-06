"""
LumiCart MBA Engine — Flask REST API
Run: python app.py
"""

import os
import io
import json
import logging
import time
import random
from collections import defaultdict
from datetime import datetime

import pandas as pd
import numpy as np
from flask import Flask, request, jsonify

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

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
)
logger = logging.getLogger("lumicart.api")

# ── Flask app ─────────────────────────────────────────────────
app = Flask(__name__)

# ── CORS — allow React dev server ──────────────────────────────
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

@app.route("/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/<path:path>", methods=["OPTIONS"])
def handle_options(path):
    return "", 204

# ── Global state ──────────────────────────────────────────────
STATE = {
    "all_transactions": [],
    "current_rules": [],
    "current_item_support": {},
    "engine": SelfLearningEngine(),
    "version_counter": 0,
    "dataset_files": [],        # list of loaded filenames
    "last_run_stats": None,
}


# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────
def parse_csv_to_transactions(file_content: str, filename: str):
    """
    Accept multiple CSV formats:
    1. Wide: transaction_id, item1, item2, item3, ...
    2. Long: transaction_id, item
    3. Basket: each row is a comma-separated basket (no header tid)
    Returns: list of sets
    """
    try:
        df = pd.read_csv(io.StringIO(file_content))
    except Exception as e:
        raise ValueError(f"Could not parse CSV: {e}")

    cols = [c.strip().lower() for c in df.columns]
    df.columns = cols

    transactions = []

    # Format 1: transaction_id + item (long format)
    if "transaction_id" in cols and "item" in cols:
        grouped = df.groupby("transaction_id")["item"].apply(list)
        transactions = [set(str(i).strip() for i in items if str(i).strip()) for items in grouped]

    # Format 2: transaction_id + multiple item columns (wide format)
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

    # Format 3: each row is a basket (first col may be index or items)
    else:
        for _, row in df.iterrows():
            basket = set()
            for val in row:
                v = str(val).strip()
                if v and v.lower() not in ("nan", "none", ""):
                    basket.add(v)
            if basket:
                transactions.append(basket)

    # Remove trivial single-item baskets only if we have enough multi-item baskets
    multi = [t for t in transactions if len(t) >= 2]
    if len(multi) >= len(transactions) * 0.3:
        transactions = multi

    return transactions


def run_pipeline(transactions, version_label=None):
    """Full MBA pipeline run — returns analysis results dict."""
    engine = STATE["engine"]
    n = len(transactions)
    if n == 0:
        raise ValueError("No transactions to process")

    min_sup_count = max(2, int(engine.min_support * n))

    start = time.time()
    logger.info(f"Running FP-Growth on {n} transactions, min_support={engine.min_support:.3f} (count={min_sup_count})")

    itemsets = fp_growth(transactions, min_sup_count)
    logger.info(f"Found {len(itemsets)} frequent itemsets")

    rules = generate_association_rules(
        itemsets,
        min_confidence=engine.min_confidence,
        n_transactions=n
    )
    logger.info(f"Generated {len(rules)} association rules")

    rules = engine.score_rules(rules)

    # Item-level support
    current_item_sup = {
        item: count / n
        for item, count in defaultdict(int,
            {k: v for t in transactions for k in t for v in [1]}).items()
    }
    # Proper item count
    item_count = defaultdict(int)
    for t in transactions:
        for item in t:
            item_count[item] += 1
    current_item_sup = {item: cnt / n for item, cnt in item_count.items()}

    # Drift detection
    drift = engine.detect_drift(current_item_sup, STATE["current_item_support"])

    # Adaptive updates
    threshold_changed = engine.adapt_thresholds(len(rules))
    engine.adapt_weights(rules)

    # Register version
    v_id = version_label or f"v{STATE['version_counter'] + 1}"
    STATE["version_counter"] += 1
    version_entry = engine.register_version(
        v_id, rules, engine.min_support, drift, threshold_changed, n
    )

    # Hit rate
    hit_rate = evaluate_hit_rate(transactions, rules, holdout=0.10)

    elapsed = round(time.time() - start, 3)

    # Build output
    item_freqs = get_item_frequencies(transactions, n)

    # Basket size distribution
    basket_sizes = defaultdict(int)
    for t in transactions:
        sz = len(t)
        key = str(sz) if sz <= 8 else "9+"
        basket_sizes[key] += 1

    result = {
        "version": v_id,
        "n_transactions": n,
        "n_itemsets": len(itemsets),
        "n_rules": len(rules),
        "avg_lift": version_entry["avg_lift"],
        "avg_confidence": version_entry["avg_confidence"],
        "hit_rate": hit_rate,
        "elapsed_seconds": elapsed,
        "min_support": round(engine.min_support, 4),
        "min_confidence": round(engine.min_confidence, 4),
        "weights": engine.weights,
        "drift_alerts": drift,
        "threshold_changed": threshold_changed,
        "top_bundles": get_top_bundles(rules, 10),
        "promotions": get_promotions(rules),
        "shelf_placement": get_shelf_placement(rules),
        "item_frequencies": item_freqs,
        "basket_size_dist": dict(basket_sizes),
        "version_history": engine.version_history,
        "rules_preview": rules[:50],   # top 50 for table
    }

    # Update global state
    STATE["current_rules"] = rules
    STATE["current_item_support"] = current_item_sup
    STATE["last_run_stats"] = result

    logger.info(f"Pipeline complete: {len(rules)} rules, hit_rate={hit_rate:.2%}, took {elapsed}s")
    return result


# ─────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "version_counter": STATE["version_counter"],
        "n_transactions": len(STATE["all_transactions"]),
        "n_rules": len(STATE["current_rules"]),
    })


@app.route("/api/upload", methods=["POST"])
def upload_dataset():
    """
    Upload a CSV file. Appends to existing transactions and re-runs pipeline.
    mode: 'append' (default) or 'replace'
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Only CSV files are accepted"}), 400

    mode = request.form.get("mode", "append")

    try:
        content = file.stream.read().decode("utf-8", errors="replace")
        new_transactions = parse_csv_to_transactions(content, file.filename)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if len(new_transactions) == 0:
        return jsonify({"error": "No valid transactions found in file"}), 400

    if mode == "replace":
        STATE["all_transactions"] = new_transactions
        STATE["current_item_support"] = {}
        STATE["engine"] = SelfLearningEngine()
        STATE["version_counter"] = 0
        STATE["dataset_files"] = [file.filename]
        logger.info(f"Replaced dataset with {file.filename}: {len(new_transactions)} transactions")
    else:
        STATE["all_transactions"].extend(new_transactions)
        STATE["dataset_files"].append(file.filename)
        logger.info(f"Appended {file.filename}: +{len(new_transactions)} transactions → total {len(STATE['all_transactions'])}")

    try:
        result = run_pipeline(STATE["all_transactions"])
        result["new_transactions_added"] = len(new_transactions)
        result["mode"] = mode
        result["dataset_files"] = STATE["dataset_files"]
        return jsonify(result)
    except Exception as e:
        logger.exception("Pipeline error")
        return jsonify({"error": str(e)}), 500


@app.route("/api/rerun", methods=["POST"])
def rerun_pipeline():
    """Re-run the pipeline on accumulated transactions (manual trigger)."""
    if not STATE["all_transactions"]:
        return jsonify({"error": "No transactions loaded yet"}), 400
    try:
        result = run_pipeline(STATE["all_transactions"])
        result["dataset_files"] = STATE["dataset_files"]
        return jsonify(result)
    except Exception as e:
        logger.exception("Rerun error")
        return jsonify({"error": str(e)}), 500


@app.route("/api/state", methods=["GET"])
def get_state():
    """Return current engine state without re-running."""
    if STATE["last_run_stats"] is None:
        return jsonify({"status": "no_data", "message": "Upload a dataset to begin"})
    result = dict(STATE["last_run_stats"])
    result["dataset_files"] = STATE["dataset_files"]
    return jsonify(result)


@app.route("/api/crosssell", methods=["GET"])
def crosssell():
    """Get cross-sell suggestions for a given cart."""
    cart = request.args.get("cart", "")
    if not cart:
        return jsonify({"error": "Provide ?cart=item1,item2"}), 400
    cart_items = [i.strip() for i in cart.split(",") if i.strip()]
    suggestions = get_cart_crosssell(STATE["current_rules"], cart_items)
    return jsonify({"cart": cart_items, "suggestions": suggestions})


@app.route("/api/generate-sample", methods=["GET"])
def generate_sample():
    """Generate and return a sample CSV for download/testing."""
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
        "Gentle Toner":         ["Hydrating Moisturizer", "Micellar Cleanser"],
        "Matte Foundation":     ["Liquid Concealer", "Loose Setting Powder"],
        "Argan Oil Shampoo":   ["Repair Conditioner", "Hair Serum"],
        "Lip Tint":             ["Lip Liner"],
        "Mascara":              ["Brow Pencil"],
        "SPF 50 Sunscreen":    ["Hydrating Moisturizer", "BB Cream"],
    }

    dataset_type = request.args.get("type", "a")
    n = int(request.args.get("n", 1000))
    sunscreen_boost = 1.4 if dataset_type == "b" else 1.0

    rows = []
    for i in range(n):
        size = random.choices([2,3,4,5,6,7,8], weights=[0.25,0.35,0.20,0.10,0.05,0.03,0.02])[0]
        weights = [sunscreen_boost if p == "SPF 50 Sunscreen" else 1.0 for p in PRODUCTS]
        anchor = random.choices(PRODUCTS, weights=weights)[0]
        basket = {anchor}
        attempts = 0
        while len(basket) < size and attempts < 30:
            attempts += 1
            if anchor in AFFINITIES and random.random() < 0.65:
                item = random.choice(AFFINITIES[anchor])
            else:
                item = random.choices(PRODUCTS, weights=weights)[0]
            basket.add(item)
        for item in basket:
            rows.append({"transaction_id": i+1, "item": item})

    df = pd.DataFrame(rows)
    csv_str = df.to_csv(index=False)
    from flask import Response
    return Response(
        csv_str,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=lumicart_sample_{dataset_type}.csv"}
    )


@app.route("/api/reset", methods=["POST"])
def reset():
    """Reset all state."""
    STATE["all_transactions"] = []
    STATE["current_rules"] = []
    STATE["current_item_support"] = {}
    STATE["engine"] = SelfLearningEngine()
    STATE["version_counter"] = 0
    STATE["dataset_files"] = []
    STATE["last_run_stats"] = None
    return jsonify({"status": "reset"})


if __name__ == "__main__":
    print("=" * 60)
    print("  LumiCart MBA Engine — Flask API")
    print("  Running at: http://localhost:5000")
    print("  Endpoints:")
    print("    GET  /api/health")
    print("    POST /api/upload        (multipart CSV)")
    print("    POST /api/rerun")
    print("    GET  /api/state")
    print("    GET  /api/crosssell?cart=item1,item2")
    print("    GET  /api/generate-sample?type=a&n=1000")
    print("    POST /api/reset")
    print("=" * 60)
    app.run(debug=True, port=5000, host="0.0.0.0")
