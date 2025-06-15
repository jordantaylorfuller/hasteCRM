#\!/bin/bash

echo "📊 Coverage Analysis Report"
echo "=========================="
echo ""

cd /Users/haste/Cursor/hasteCRM/apps/api

# Generate coverage report
echo "Generating coverage report..."
pnpm test:cov --silent 2>&1 > coverage-output.txt

# Extract files with less than 100% coverage
echo "Files with less than 100% coverage:"
echo "-----------------------------------"
grep -E "\.ts.*\|.*[0-9]" coverage-output.txt | grep -v " 100 " | grep -v "\.spec\.ts" | sort -k2 -n | head -20

echo ""
echo "Coverage Summary:"
echo "----------------"
grep "All files" coverage-output.txt

echo ""
echo "Top files needing coverage:"
echo "--------------------------"
grep -E "\.ts.*\|.*[0-9]" coverage-output.txt | grep -v " 100 " | grep -v "\.spec\.ts" | awk '{print $1, $3"%"}' | sort -k2 -n | head -10

rm coverage-output.txt
