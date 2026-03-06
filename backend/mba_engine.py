"""
LumiCart MBA Engine — Pure Python FP-Growth + Association Rules
No mlxtend required — uses only pandas, numpy, itertools
"""

from itertools import combinations
from collections import defaultdict
import pandas as pd
import numpy as np
import json
import logging

logger = logging.getLogger("lumicart.engine")


# ─────────────────────────────────────────────
#  FP-TREE NODE
# ─────────────────────────────────────────────
class FPNode:
    def __init__(self, item, count=0, parent=None):
        self.item = item
        self.count = count
        self.parent = parent
        self.children = {}
        self.node_link = None  # horizontal link to next same-item node

    def increment(self, count=1):
        self.count += count


# ─────────────────────────────────────────────
#  FP-TREE
# ─────────────────────────────────────────────
class FPTree:
    def __init__(self):
        self.root = FPNode(None, 0)
        self.header_table = {}  # item -> first node

    def _link(self, item, node):
        if item not in self.header_table:
            self.header_table[item] = node
        else:
            cur = self.header_table[item]
            while cur.node_link:
                cur = cur.node_link
            cur.node_link = node

    def insert_transaction(self, transaction, count=1):
        cur = self.root
        for item in transaction:
            if item in cur.children:
                cur.children[item].increment(count)
            else:
                node = FPNode(item, count, cur)
                cur.children[item] = node
                self._link(item, node)
            cur = cur.children[item]

    def nodes(self, item):
        node = self.header_table.get(item)
        while node:
            yield node
            node = node.node_link

    def is_single_path(self):
        node = self.root
        while True:
            children = list(node.children.values())
            if len(children) == 0:
                return True
            if len(children) > 1:
                return False
            node = children[0]


# ─────────────────────────────────────────────
#  FP-GROWTH ALGORITHM
# ─────────────────────────────────────────────
def _build_tree(transactions_with_counts, freq_items_ordered):
    tree = FPTree()
    for transaction, count in transactions_with_counts:
        # Filter & sort by frequency order
        filtered = [item for item in freq_items_ordered if item in transaction]
        if filtered:
            tree.insert_transaction(filtered, count)
    return tree


def fp_growth(transactions, min_support_count):
    """
    Mine frequent itemsets using FP-Growth.
    Returns: list of (frozenset, support_count)
    """
    # Count item frequencies
    item_count = defaultdict(int)
    for t in transactions:
        for item in t:
            item_count[item] += 1

    # Filter by min support
    freq_items = {item: cnt for item, cnt in item_count.items()
                  if cnt >= min_support_count}

    if not freq_items:
        return []

    # Sort by frequency (desc) for tree efficiency
    freq_order = sorted(freq_items, key=lambda x: freq_items[x], reverse=True)
    freq_set = set(freq_order)

    # Build initial tree
    transactions_list = [(set(t) & freq_set, 1) for t in transactions]
    transactions_list = [(t, c) for t, c in transactions_list if t]

    # Deduplicate transactions (compress)
    txn_counter = defaultdict(int)
    for t, c in transactions_list:
        txn_counter[frozenset(t)] += c

    compressed = list(txn_counter.items())
    tree = _build_tree(compressed, freq_order)

    results = []
    _mine_tree(tree, freq_order, min_support_count, frozenset(), results)
    return results


def _mine_tree(tree, freq_order, min_support_count, prefix, results):
    # Single path optimization
    if tree.is_single_path():
        # Collect all items along single path
        path_items = []
        node = list(tree.root.children.values())[0] if tree.root.children else None
        while node:
            path_items.append((node.item, node.count))
            children = list(node.children.values())
            node = children[0] if children else None

        # Emit all subsets
        for r in range(1, len(path_items) + 1):
            for combo in combinations(path_items, r):
                items = frozenset(i for i, _ in combo)
                sup = min(c for _, c in combo)
                if sup >= min_support_count:
                    results.append((prefix | items, sup))
        return

    # Mine each frequent item (bottom-up)
    for item in reversed(freq_order):
        if item not in tree.header_table:
            continue

        # Calculate support of this item in current tree
        item_support = sum(n.count for n in tree.nodes(item))
        if item_support < min_support_count:
            continue

        new_prefix = prefix | {item}
        results.append((frozenset(new_prefix), item_support))

        # Build conditional pattern base
        cond_patterns = []
        for node in tree.nodes(item):
            path = []
            cur = node.parent
            while cur.item is not None:
                path.append(cur.item)
                cur = cur.parent
            if path:
                cond_patterns.append((frozenset(path), node.count))

        if not cond_patterns:
            continue

        # Build conditional FP-tree
        cond_item_count = defaultdict(int)
        for pattern, count in cond_patterns:
            for i in pattern:
                cond_item_count[i] += count

        cond_freq = {i: c for i, c in cond_item_count.items()
                     if c >= min_support_count}
        if not cond_freq:
            continue

        cond_order = sorted(cond_freq, key=lambda x: cond_freq[x], reverse=True)
        cond_tree = _build_tree(cond_patterns, cond_order)
        _mine_tree(cond_tree, cond_order, min_support_count, new_prefix, results)


# ─────────────────────────────────────────────
#  ASSOCIATION RULES GENERATOR
# ─────────────────────────────────────────────
def generate_association_rules(freq_itemsets, min_confidence=0.3, n_transactions=None):
    """
    Generate association rules from frequent itemsets.
    Returns list of rule dicts with all metrics.
    """
    # Build support lookup
    support_lookup = {itemset: sup for itemset, sup in freq_itemsets}

    rules = []
    for itemset, support_count in freq_itemsets:
        if len(itemset) < 2:
            continue

        items = list(itemset)
        for r in range(1, len(items)):
            for antecedent in combinations(items, r):
                antecedent = frozenset(antecedent)
                consequent = itemset - antecedent

                ant_support = support_lookup.get(antecedent, 0)
                con_support = support_lookup.get(consequent, 0)

                if ant_support == 0 or con_support == 0:
                    continue

                confidence = support_count / ant_support

                if confidence < min_confidence:
                    continue

                sup_ratio = support_count / n_transactions if n_transactions else support_count
                ant_ratio = ant_support / n_transactions if n_transactions else ant_support
                con_ratio = con_support / n_transactions if n_transactions else con_support

                lift = confidence / con_ratio if con_ratio > 0 else 0
                leverage = sup_ratio - (ant_ratio * con_ratio)
                conviction = (1 - con_ratio) / (1 - confidence + 1e-9) if confidence < 1 else float('inf')

                rules.append({
                    "antecedents": list(antecedent),
                    "consequents": list(consequent),
                    "support": round(sup_ratio, 4),
                    "confidence": round(confidence, 4),
                    "lift": round(lift, 4),
                    "leverage": round(leverage, 4),
                    "conviction": round(min(conviction, 99.0), 4),
                    "support_count": support_count,
                    "antecedent_support": round(ant_ratio, 4),
                    "consequent_support": round(con_ratio, 4),
                })

    return rules


# ─────────────────────────────────────────────
#  SELF-LEARNING ENGINE
# ─────────────────────────────────────────────
class SelfLearningEngine:
    def __init__(self):
        self.min_support = 0.03
        self.min_confidence = 0.30
        self.weights = {"lift": 0.40, "confidence": 0.30, "support": 0.20, "conviction": 0.10}
        self.version_history = []

    def score_rules(self, rules):
        if not rules:
            return rules

        df = pd.DataFrame(rules)

        for col in ["lift", "confidence", "support", "conviction"]:
            col_min = df[col].min()
            col_max = df[col].max()
            rng = col_max - col_min + 1e-9
            df[f"{col}_norm"] = (df[col] - col_min) / rng

        df["composite_score"] = (
            self.weights["lift"]       * df["lift_norm"] +
            self.weights["confidence"] * df["confidence_norm"] +
            self.weights["support"]    * df["support_norm"] +
            self.weights["conviction"] * df["conviction_norm"]
        )
        df["composite_score"] = df["composite_score"].round(4)
        return df.sort_values("composite_score", ascending=False).to_dict("records")

    def adapt_thresholds(self, rule_count):
        changed = False
        if rule_count < 15:
            self.min_support = max(0.01, self.min_support - 0.005)
            logger.info(f"Low rules ({rule_count}) — lowered min_support to {self.min_support:.3f}")
            changed = True
        elif rule_count > 300:
            self.min_support = min(0.15, self.min_support + 0.005)
            logger.info(f"Too many rules ({rule_count}) — raised min_support to {self.min_support:.3f}")
            changed = True
        return changed

    def adapt_weights(self, rules):
        if not rules:
            return
        avg_conf = sum(r["confidence"] for r in rules) / len(rules)
        avg_lift = sum(r["lift"] for r in rules) / len(rules)

        if avg_conf < 0.40:
            self.weights["confidence"] = 0.40
            self.weights["lift"] = 0.30
        elif avg_lift > 3.0:
            self.weights["lift"] = 0.45
            self.weights["confidence"] = 0.25
        else:
            self.weights = {"lift": 0.40, "confidence": 0.30, "support": 0.20, "conviction": 0.10}

    def detect_drift(self, current_item_support, prev_item_support, threshold=0.15):
        drifted = []
        for item, cur in current_item_support.items():
            prev = prev_item_support.get(item, cur)
            if prev == 0:
                continue
            change = abs(cur - prev) / prev
            if change > threshold:
                drifted.append({
                    "item": item,
                    "prev_support": round(prev, 4),
                    "curr_support": round(cur, 4),
                    "change_pct": round(change * 100, 1),
                    "direction": "↑" if cur > prev else "↓"
                })
        return drifted

    def register_version(self, version_id, rules, min_support, drift_alerts, threshold_changed, n_transactions):
        top_rule = None
        if rules:
            r = rules[0]
            top_rule = {
                "antecedents": r["antecedents"],
                "consequents": r["consequents"],
                "lift": r["lift"],
                "confidence": r["confidence"],
                "score": r.get("composite_score", 0)
            }

        entry = {
            "version": version_id,
            "n_transactions": n_transactions,
            "rule_count": len(rules),
            "avg_lift": round(sum(r["lift"] for r in rules) / len(rules), 3) if rules else 0,
            "avg_confidence": round(sum(r["confidence"] for r in rules) / len(rules), 3) if rules else 0,
            "min_support": min_support,
            "min_confidence": self.min_confidence,
            "weights": self.weights.copy(),
            "drift_alerts": drift_alerts,
            "threshold_changed": threshold_changed,
            "top_rule": top_rule,
        }
        self.version_history.append(entry)
        return entry


# ─────────────────────────────────────────────
#  RECOMMENDATION ENGINE
# ─────────────────────────────────────────────
def get_top_bundles(rules, n=10):
    """Highest composite-score rules for homepage carousel."""
    return rules[:n]


def get_cart_crosssell(rules, cart_items, n=5):
    cart_set = set(cart_items)
    results = []
    for rule in rules:
        ant = set(rule["antecedents"])
        con = set(rule["consequents"])
        if ant.issubset(cart_set) and not con.issubset(cart_set):
            results.append({
                "suggest": rule["consequents"],
                "because": rule["antecedents"],
                "confidence": rule["confidence"],
                "lift": rule["lift"],
                "score": rule.get("composite_score", 0)
            })
        if len(results) >= n:
            break
    return results


def get_promotions(rules, min_lift=1.8, min_confidence=0.55, n=8):
    """Bundle promotion candidates — high-lift, high-confidence rules."""
    promos = []
    for rule in rules:
        if rule["lift"] >= min_lift and rule["confidence"] >= min_confidence:
            bundle = list(set(rule["antecedents"] + rule["consequents"]))
            promos.append({
                "bundle": bundle,
                "discount": "10% off when bought together",
                "lift": rule["lift"],
                "confidence": rule["confidence"],
                "rationale": f"Lift {rule['lift']:.2f}× — strong purchase affinity"
            })
        if len(promos) >= n:
            break
    return promos


def get_shelf_placement(rules, min_lift=2.0, n=6):
    """Items that should be co-located on shelves."""
    placements = []
    seen = set()
    for rule in rules:
        if rule["lift"] >= min_lift:
            pair = tuple(sorted(rule["antecedents"] + rule["consequents"]))
            if pair not in seen:
                seen.add(pair)
                placements.append({
                    "item_a": rule["antecedents"],
                    "item_b": rule["consequents"],
                    "lift": rule["lift"],
                    "advice": "Place within reach of each other"
                })
        if len(placements) >= n:
            break
    return placements


def get_item_frequencies(transactions, n_transactions):
    """Item-level support for frequency bar chart."""
    item_count = defaultdict(int)
    for t in transactions:
        for item in t:
            item_count[item] += 1
    return {
        item: {
            "count": count,
            "support": round(count / n_transactions, 4)
        }
        for item, count in sorted(item_count.items(), key=lambda x: -x[1])
    }


def evaluate_hit_rate(transactions, rules, holdout=0.10):
    """Hold-out hit-rate evaluation."""
    import random
    test = random.sample(transactions, max(1, int(len(transactions) * holdout)))
    hits, total = 0, 0
    for basket in test:
        if len(basket) < 2:
            continue
        hidden = random.choice(list(basket))
        known = set(basket) - {hidden}
        suggested = set()
        for rule in rules[:50]:
            ant = set(rule["antecedents"])
            if ant.issubset(known):
                suggested |= set(rule["consequents"])
        if hidden in suggested:
            hits += 1
        total += 1
    return round(hits / total, 4) if total > 0 else 0
