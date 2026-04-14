# app.py — Flask backend for AI Expense Tracker
from flask import Flask, render_template, request, jsonify
import sqlite3
import os
from datetime import datetime, date
from model import classify_expense, get_all_categories

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "expenses.db")


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                description TEXT    NOT NULL,
                amount      REAL    NOT NULL,
                category    TEXT    NOT NULL,
                confidence  REAL    DEFAULT 0.0,
                date        TEXT    NOT NULL,
                created_at  TEXT    NOT NULL
            )
        """)
        conn.commit()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html", categories=get_all_categories(), active_page="dashboard")


@app.route("/expenses")
def expenses():
    return render_template("expenses.html", categories=get_all_categories(), active_page="expenses")


@app.route("/monthly")
def monthly():
    return render_template("monthly.html", categories=get_all_categories(), active_page="monthly")


@app.route("/insights")
def insights():
    return render_template("insights.html", categories=get_all_categories(), active_page="insights")


@app.route("/api/expenses", methods=["GET"])
def get_expenses():
    category = request.args.get("category", "")
    month    = request.args.get("month", "")      # format: YYYY-MM

    query  = "SELECT * FROM expenses WHERE 1=1"
    params = []

    if category and category != "All":
        query += " AND category = ?"
        params.append(category)

    if month:
        query += " AND date LIKE ?"
        params.append(f"{month}%")

    query += " ORDER BY date DESC, id DESC"

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    expenses = [dict(r) for r in rows]
    return jsonify({"expenses": expenses, "count": len(expenses)})


@app.route("/api/expenses", methods=["POST"])
def add_expense():
    data = request.get_json(force=True)

    description = (data.get("description") or "").strip()
    amount_raw  = data.get("amount")
    exp_date    = (data.get("date") or str(date.today()))

    # Validation
    if not description:
        return jsonify({"error": "Description is required"}), 400
    try:
        amount = float(amount_raw)
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "Amount must be a positive number"}), 400

    # AI classification
    ai_result = classify_expense(description)

    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO expenses (description, amount, category, confidence, date, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                description,
                round(amount, 2),
                ai_result["category"],
                ai_result["confidence"],
                exp_date,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )
        conn.commit()
        new_id = cursor.lastrowid

    with get_db() as conn:
        row = conn.execute("SELECT * FROM expenses WHERE id = ?", (new_id,)).fetchone()

    return jsonify({"expense": dict(row), "ai": ai_result}), 201


@app.route("/api/expenses/<int:expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    with get_db() as conn:
        deleted = conn.execute(
            "DELETE FROM expenses WHERE id = ?", (expense_id,)
        ).rowcount
        conn.commit()

    if deleted == 0:
        return jsonify({"error": "Expense not found"}), 404
    return jsonify({"deleted": expense_id})


@app.route("/api/summary", methods=["GET"])
def get_summary():
    month = request.args.get("month", "")

    base   = "FROM expenses"
    params = []
    if month:
        base  += " WHERE date LIKE ?"
        params.append(f"{month}%")

    with get_db() as conn:
        total = conn.execute(f"SELECT COALESCE(SUM(amount),0) {base}", params).fetchone()[0]

        rows = conn.execute(
            f"SELECT category, COUNT(*) as count, SUM(amount) as total {base} GROUP BY category ORDER BY total DESC",
            params,
        ).fetchall()

        monthly = conn.execute(
            """SELECT strftime('%Y-%m', date) as month,
                      COUNT(*) as count,
                      SUM(amount) as total
               FROM expenses
               GROUP BY month
               ORDER BY month DESC
               LIMIT 12"""
        ).fetchall()

    return jsonify({
        "total": round(total, 2),
        "by_category": [dict(r) for r in rows],
        "monthly": [dict(r) for r in monthly],
    })


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()
    print("\n✅  AI Expense Tracker running at http://127.0.0.1:5000\n")
    app.run(debug=True, port=5000)