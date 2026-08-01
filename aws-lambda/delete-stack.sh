#!/bin/bash

# Delete failed CloudFormation stack
# Run this if deployment failed and stack is in ROLLBACK_COMPLETE state

set -e

# Load environment variables
if [ -f "../.env" ]; then
  export $(grep -v '^#' ../.env | grep -v '^$' | xargs)
fi

export AWS_REGION=${AWS_REGION:-eu-north-1}

echo "🗑️  Deleting failed stack: codebook-lambda"
echo "Region: $AWS_REGION"
echo ""

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI not found in PATH"
  echo ""
  echo "Please delete the stack manually:"
  echo "1. Go to: https://console.aws.amazon.com/cloudformation/"
  echo "2. Select stack: codebook-lambda"
  echo "3. Click 'Delete'"
  echo "4. Wait for deletion to complete"
  echo "5. Then run ./deploy.sh again"
  exit 1
fi

aws cloudformation delete-stack \
  --stack-name codebook-lambda \
  --region $AWS_REGION

echo "✅ Delete command sent"
echo ""
echo "⏳ Waiting for stack deletion to complete..."
echo "This may take 1-2 minutes..."
echo ""

aws cloudformation wait stack-delete-complete \
  --stack-name codebook-lambda \
  --region $AWS_REGION

echo "✅ Stack deleted successfully!"
echo ""
echo "Now you can run: ./deploy.sh"

