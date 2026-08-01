#!/bin/bash

# Script to clean up SAM deployment artifacts from S3 bucket
# This helps minimize S3 storage costs by removing old deployment packages
# 
# Usage: ./cleanup-sam-bucket.sh [--force]
#   --force: Skip confirmation prompt

set -e

echo "🧹 CodeBook SAM Bucket Cleanup"
echo "=============================="
echo ""

# Load environment variables from .env file in parent directory (same as deploy.sh)
if [ -f "../.env" ]; then
  echo "📝 Loading environment variables from ../.env"
  # Export variables from .env file (skip comments and empty lines)
  export $(grep -v '^#' ../.env | grep -v '^$' | xargs)
  echo "✅ Environment variables loaded"
  echo ""
elif [ -f ".env" ]; then
  echo "📝 Loading environment variables from .env"
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
  echo "✅ Environment variables loaded"
  echo ""
fi

# Check if AWS credentials are set
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "❌ Error: AWS credentials not found"
  echo "Please ensure ../.env file exists with:"
  echo "  AWS_ACCESS_KEY_ID=..."
  echo "  AWS_SECRET_ACCESS_KEY=..."
  echo "  AWS_REGION=eu-north-1"
  exit 1
fi

# Set default region if not set
export AWS_REGION=${AWS_REGION:-eu-north-1}
export AWS_DEFAULT_REGION=$AWS_REGION

# Configure AWS CLI with credentials
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY

echo "✅ AWS Region: $AWS_REGION"
echo "✅ AWS Access Key: ${AWS_ACCESS_KEY_ID:0:4}..."
echo ""

BUCKET_NAME="aws-sam-cli-managed-default-samclisourcebucket-euqe4g0vdaos"

echo "🧹 Cleaning up SAM deployment artifacts..."
echo "📦 Bucket: $BUCKET_NAME"

# Check if bucket exists
if ! aws s3 ls "s3://$BUCKET_NAME" &>/dev/null; then
  echo "❌ Bucket not found or no access"
  exit 1
fi

# Get current usage
echo ""
echo "📊 Current bucket usage:"
aws s3 ls s3://$BUCKET_NAME --recursive --human-readable --summarize | tail -n 2

# Count objects
OBJECT_COUNT=$(aws s3 ls s3://$BUCKET_NAME --recursive | wc -l | tr -d ' ')
echo "   Total objects: $OBJECT_COUNT"

# Ask for confirmation (unless --force flag)
if [ "$1" != "--force" ]; then
  echo ""
  read -p "⚠️  Do you want to delete all objects in this bucket? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Cancelled"
    exit 0
  fi
fi

# Delete all objects (but keep the bucket - SAM needs it)
echo ""
echo "🗑️  Deleting all objects..."
aws s3 rm s3://$BUCKET_NAME --recursive

echo ""
echo "✅ Cleanup complete!"
echo "📊 Bucket is now empty (but still exists for future deployments)"
echo ""
echo "💡 Tip: Run this script periodically to keep S3 costs minimal"
echo "   Or set up a lifecycle policy in S3 console to auto-delete old artifacts"

