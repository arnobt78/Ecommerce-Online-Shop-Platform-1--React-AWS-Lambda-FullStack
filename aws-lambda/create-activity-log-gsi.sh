#!/bin/bash

# Script to create GSI for activity log table
# This allows efficient querying by userId

# Configuration
TABLE_NAME="codebook-activity-log"
INDEX_NAME="userId-index"
REGION="eu-north-1"

echo "Creating GSI for Activity Log table..."
echo "Table: $TABLE_NAME"
echo "Index: $INDEX_NAME"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if table exists
echo "Checking if table exists..."
if ! aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" &> /dev/null; then
    echo "❌ Table $TABLE_NAME does not exist. Please create it first."
    exit 1
fi

echo "✅ Table exists"
echo ""

echo "Creating GSI: $INDEX_NAME on table: $TABLE_NAME"

# Create the GSI
aws dynamodb update-table \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
    --global-secondary-index-updates \
        "[{
            \"Create\": {
                \"IndexName\": \"$INDEX_NAME\",
                \"KeySchema\": [
                    {\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"}
                ],
                \"Projection\": {
                    \"ProjectionType\": \"ALL\"
                }
            }
        }]"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ GSI creation initiated. It may take a few minutes to complete."
    echo "You can check the status in the DynamoDB console."
    echo ""
    echo "After GSI is active, queries by userId will automatically use it for better performance."
else
    echo ""
    echo "❌ Failed to create GSI. Please check the error message above."
    exit 1
fi

