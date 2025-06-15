#!/bin/bash

echo "🎯 Test Coverage Improvement Script"
echo "=================================="
echo ""

# Change to API directory
cd apps/api

# Run coverage and generate detailed report
echo "📊 Generating coverage report..."
pnpm test:cov > coverage-report.txt 2>&1

# Extract files with less than 100% coverage
echo ""
echo "📋 Files needing coverage improvement:"
echo ""

# Parse coverage report and show files below 100%
grep -E "^\s+[a-zA-Z].*\.(ts|js)" coverage-report.txt | grep -v "100\s" | grep -v "spec\.ts" | while read line; do
    # Extract filename and coverage percentages
    filename=$(echo "$line" | awk '{print $1}')
    stmt_cov=$(echo "$line" | awk '{print $3}')
    branch_cov=$(echo "$line" | awk '{print $5}')
    func_cov=$(echo "$line" | awk '{print $7}')
    line_cov=$(echo "$line" | awk '{print $9}')
    uncovered=$(echo "$line" | cut -d'|' -f6-)
    
    echo "📄 $filename"
    echo "   Statements: $stmt_cov% | Branches: $branch_cov% | Functions: $func_cov% | Lines: $line_cov%"
    echo "   Uncovered: $uncovered"
    echo ""
done

# Show overall coverage
echo ""
echo "📈 Overall Coverage:"
grep "All files" coverage-report.txt

# Count files needing improvement
count=$(grep -E "^\s+[a-zA-Z].*\.(ts|js)" coverage-report.txt | grep -v "100\s" | grep -v "spec\.ts" | wc -l)
echo ""
echo "📊 Total files needing improvement: $count"

# Create a prioritized list based on coverage percentage
echo ""
echo "🎯 Priority List (lowest coverage first):"
echo ""

grep -E "^\s+[a-zA-Z].*\.(ts|js)" coverage-report.txt | grep -v "spec\.ts" | grep -v "100\s" | while read line; do
    filename=$(echo "$line" | awk '{print $1}')
    line_cov=$(echo "$line" | awk '{print $9}' | sed 's/%//')
    echo "$line_cov% - $filename"
done | sort -n | head -10

# Cleanup
rm -f coverage-report.txt

echo ""
echo "💡 Next Steps:"
echo "1. Start with the files having the lowest coverage"
echo "2. Look at the uncovered line numbers"
echo "3. Write tests to cover those specific lines"
echo "4. Run 'pnpm test:cov' to verify improvements"