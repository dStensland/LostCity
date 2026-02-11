#!/bin/bash
# Test script for activism/volunteering crawlers
# Run after activating sources in the database

set -e

echo "================================"
echo "Testing Activism Crawlers"
echo "================================"
echo ""

# Phase 1: Known-working sites
echo "PHASE 1: Testing known-working sites..."
echo "----------------------------------------"
echo ""

echo "[1/5] Testing King Center..."
python3 main.py --source king-center || echo "❌ Failed"
echo ""

echo "[2/5] Testing Atlanta Mission..."
python3 main.py --source atlanta-mission || echo "❌ Failed"
echo ""

echo "[3/5] Testing New Georgia Project..."
python3 main.py --source new-georgia-project || echo "❌ Failed"
echo ""

echo "[4/5] Testing Dogwood Alliance..."
python3 main.py --source dogwood-alliance || echo "❌ Failed"
echo ""

echo "[5/5] Testing Everybody Wins Atlanta..."
python3 main.py --source everybody-wins-atlanta || echo "❌ Failed"
echo ""

# Phase 2: Redirect sites
echo "PHASE 2: Testing redirect sites..."
echo "----------------------------------------"
echo ""

echo "[1/1] Testing C4 Atlanta..."
python3 main.py --source c4-atlanta || echo "❌ Failed"
echo ""

# Phase 3: Potentially problematic sites
echo "PHASE 3: Testing potentially problematic sites..."
echo "----------------------------------------"
echo ""

echo "[1/4] Testing Hosea Helps (may timeout)..."
python3 main.py --source hosea-helps || echo "⚠️  May need timeout adjustment"
echo ""

echo "[2/4] Testing Project South (may timeout)..."
python3 main.py --source project-south || echo "⚠️  May need timeout adjustment"
echo ""

echo "[3/4] Testing South River Forest (may timeout)..."
python3 main.py --source south-river-forest || echo "⚠️  May need timeout adjustment"
echo ""

echo "[4/4] Testing Georgia Peace (may get 403)..."
python3 main.py --source georgia-peace || echo "⚠️  May need different UA"
echo ""

echo "================================"
echo "Testing Complete"
echo "================================"
echo ""
echo "NOTE: Meals On Wheels Atlanta (mowama.org) NOT tested - DNS error"
echo "      Verify correct URL before activating this source."
echo ""
