# model.py — AI-based expense categorization
# Rule-based NLP classifier (easy to swap for ML model later)

import re

# ---------------------------------------------------------------------------
# Keyword taxonomy — extend or replace with ML model in the future
# ---------------------------------------------------------------------------
CATEGORY_KEYWORDS = {
    "Food": [
        "food", "restaurant", "cafe", "coffee", "lunch", "dinner", "breakfast",
        "pizza", "burger", "sushi", "groceries", "grocery", "supermarket",
        "snack", "meal", "eat", "drink", "juice", "tea", "bakery", "fast food",
        "takeaway", "takeout", "zomato", "swiggy", "ubereats", "doordash",
        "starbucks", "mcdonald", "subway", "kfc", "dominos", "dairy", "milk",
        "vegetables", "fruits", "chicken", "bread", "rice", "noodles",
    ],
    "Transport": [
        "uber", "ola", "lyft", "cab", "taxi", "bus", "metro", "train",
        "flight", "airline", "fuel", "petrol", "diesel", "gas", "parking",
        "toll", "ferry", "auto", "rickshaw", "transport", "travel", "ticket",
        "commute", "ride", "bike", "scooter", "rental", "car", "vehicle",
        "rapido", "blablacar", "redbus", "irctc", "makemytrip",
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "ajio", "meesho", "shop", "store",
        "mall", "clothes", "shoes", "shirt", "pants", "dress", "jacket",
        "watch", "electronics", "mobile", "laptop", "headphones", "gadget",
        "book", "stationery", "furniture", "home decor", "appliance",
        "purchase", "order", "delivery", "online", "market", "bazaar",
        "gift", "toy", "cosmetics", "beauty", "salon", "spa",
    ],
    "Bills": [
        "bill", "electricity", "water", "gas", "internet", "wifi", "broadband",
        "phone", "mobile recharge", "recharge", "subscription", "netflix",
        "spotify", "amazon prime", "rent", "emi", "loan", "insurance",
        "hospital", "doctor", "medicine", "pharmacy", "medical", "clinic",
        "tax", "fee", "maintenance", "repair", "service", "utility",
        "credit card", "payment", "invoice", "premium",
    ],
}

# Confidence scores for matched categories
CONFIDENCE_MAP = {
    "exact": 0.95,
    "partial": 0.75,
    "default": 0.50,
}


def preprocess(text: str) -> str:
    """Lowercase and strip extra whitespace."""
    return re.sub(r"\s+", " ", text.lower().strip())


def classify_expense(description: str) -> dict:
    """
    Classify an expense description into a category.

    Returns:
        dict with keys: category (str), confidence (float), matched_keyword (str|None)

    To upgrade to ML:
        Replace this function body with a model.predict() call.
        Keep the return signature identical so app.py needs no changes.
    """
    clean = preprocess(description)
    tokens = re.findall(r"\b\w+\b", clean)

    best_category = "Other"
    best_confidence = 0.0
    matched_keyword = None

    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            kw_tokens = kw.split()
            # Exact phrase match (highest confidence)
            if kw in clean:
                score = CONFIDENCE_MAP["exact"] + (len(kw_tokens) * 0.01)
                if score > best_confidence:
                    best_confidence = score
                    best_category = category
                    matched_keyword = kw
                continue
            # Single-token partial match
            if len(kw_tokens) == 1 and kw_tokens[0] in tokens:
                score = CONFIDENCE_MAP["partial"]
                if score > best_confidence:
                    best_confidence = score
                    best_category = category
                    matched_keyword = kw

    if best_category == "Other":
        best_confidence = CONFIDENCE_MAP["default"]

    return {
        "category": best_category,
        "confidence": round(min(best_confidence, 1.0), 2),
        "matched_keyword": matched_keyword,
    }


def get_all_categories() -> list:
    """Return the full list of supported categories."""
    return list(CATEGORY_KEYWORDS.keys()) + ["Other"]