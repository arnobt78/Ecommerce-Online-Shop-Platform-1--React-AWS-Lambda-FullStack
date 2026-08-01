#!/bin/bash

# Script to create GSI for featured_product on codebook-products table
# Run this AFTER migrating featured_product from Boolean to Number (1/0)
# 
# Prerequisites:
# 1. Run migration: POST /admin/migrate-featured-to-number
# 2. Verify all products have featured_product as Number (1 or 0)
# 3. Ensure AWS CLI is configured
#
# Note: featured_product is stored as Number (1 = featured, 0 = not featured)
# This allows us to create a GSI with Number type for efficient queries

set -e

# Load environment variables
if [ -f "../.env" ]; then
  export $(grep -v '^#' ../.env | grep -v '^$' | xargs)
fi

REGION=${AWS_REGION:-eu-north-1}
TABLE_NAME="codebook-products"
INDEX_NAME="featured-product-index"

echo "Creating GSI: $INDEX_NAME on table: $TABLE_NAME"
echo "Region: $REGION"
echo "Attribute Type: Number (N) - 1 = featured, 0 = not featured"
echo ""

# First, check if the attribute exists in the table
echo "Checking table structure..."
aws dynamodb describe-table \
  --table-name $TABLE_NAME \
  --region $REGION \
  --query 'Table.AttributeDefinitions' \
  --output json

echo ""
echo "Creating GSI with Number type..."

# Create the GSI with Number type
# N = Number type (supports 1/0 for featured/not featured)
aws dynamodb update-table \
  --table-name $TABLE_NAME \
  --region $REGION \
  --attribute-definitions AttributeName=featured_product,AttributeType=N \
  --global-secondary-index-updates \
    "[{
      \"Create\": {
        \"IndexName\": \"$INDEX_NAME\",
        \"KeySchema\": [{\"AttributeName\": \"featured_product\", \"KeyType\": \"HASH\"}],
        \"Projection\": {\"ProjectionType\": \"ALL\"},
        \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5, \"WriteCapacityUnits\": 5}
      }
    }]" \
  --output json

echo ""
echo "✅ GSI creation initiated. It may take a few minutes to complete."
echo "Check status in AWS Console: DynamoDB → Tables → $TABLE_NAME → Indexes"
echo ""
echo "After GSI is active, queries will automatically use it for better performance."

