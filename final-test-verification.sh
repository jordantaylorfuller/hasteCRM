#!/bin/bash

# Final Test Verification Script
# This script runs all tests and generates a comprehensive coverage report

set -e

echo "🚀 Final Test Verification and Coverage Report"
echo "============================================="
echo ""

# Navigate to project root
cd "$(dirname "$0")"

# Function to run tests with coverage
run_coverage() {
  local app=$1
  local output_file="${app}-coverage-final.txt"
  
  echo "📊 Running tests for ${app}..."
  echo "----------------------------"
  
  cd "apps/${app}"
  
  # Run tests with coverage
  if [ "$app" = "api" ]; then
    pnpm test:cov --silent 2>&1 | tee "$output_file"
  else
    pnpm test --coverage --silent 2>&1 | tee "$output_file"
  fi
  
  # Extract summary
  echo ""
  echo "Coverage Summary for ${app}:"
  grep -E "(Statements|Branches|Functions|Lines)" "$output_file" | tail -1 || echo "No coverage data"
  
  # Count test results
  echo ""
  echo "Test Results for ${app}:"
  grep -E "(Test Suites:|Tests:)" "$output_file" | tail -2 || echo "No test results"
  
  cd ../..
  echo ""
}

# Run tests for both apps
echo "🧪 Running API Tests..."
echo "======================="
run_coverage "api"

echo ""
echo "🧪 Running Web Tests..."
echo "======================="
run_coverage "web"

# Generate final report
echo ""
echo "📈 Final Coverage Report"
echo "======================="

# API Coverage
echo ""
echo "API Coverage:"
if [ -f "apps/api/api-coverage-final.txt" ]; then
  grep -E "(All files.*\|.*\|.*\|.*\|)" "apps/api/api-coverage-final.txt" | tail -1
else
  echo "No API coverage data available"
fi

# Web Coverage
echo ""
echo "Web Coverage:"
if [ -f "apps/web/web-coverage-final.txt" ]; then
  grep -E "(All files.*\|.*\|.*\|.*\|)" "apps/web/web-coverage-final.txt" | tail -1
else
  echo "No Web coverage data available"
fi

# Check for 100% coverage
echo ""
echo "🎯 Coverage Goals:"
echo "=================="

# Function to check if coverage is 100%
check_100_coverage() {
  local file=$1
  local name=$2
  
  if [ -f "$file" ]; then
    if grep -q "100" "$file" && grep -E "(All files.*100.*100.*100.*100)" "$file" > /dev/null; then
      echo "✅ ${name}: 100% coverage achieved!"
    else
      echo "❌ ${name}: Not yet at 100% coverage"
      # Show what's missing
      echo "   Missing coverage in:"
      grep -E "\.ts\s+\|.*\|.*\|.*\|.*[0-9]+" "$file" | grep -v " 100 " | head -5 || true
    fi
  else
    echo "⚠️ ${name}: No coverage data found"
  fi
}

check_100_coverage "apps/api/api-coverage-final.txt" "API"
check_100_coverage "apps/web/web-coverage-final.txt" "Web"

# Summary
echo ""
echo "📊 Summary"
echo "========="

# Count failing tests
api_failures=$(grep -E "failed," "apps/api/api-coverage-final.txt" 2>/dev/null | grep -o "[0-9]* failed" | awk '{print $1}' || echo "0")
web_failures=$(grep -E "failed," "apps/web/web-coverage-final.txt" 2>/dev/null | grep -o "[0-9]* failed" | awk '{print $1}' || echo "0")

echo "API: ${api_failures} failing tests"
echo "Web: ${web_failures} failing tests"

if [ "$api_failures" = "0" ] && [ "$web_failures" = "0" ]; then
  echo ""
  echo "🎉 All tests are passing!"
else
  echo ""
  echo "⚠️ Some tests are still failing. Review the output above for details."
fi

echo ""
echo "✨ Test verification complete!"
echo ""
echo "Next steps:"
echo "1. Fix any remaining test failures"
echo "2. Add tests for uncovered code"
echo "3. Run this script again to verify 100% coverage"