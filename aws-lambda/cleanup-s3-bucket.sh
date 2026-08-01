#!/bin/bash

# Script to clean up SAM deployment artifacts from S3 bucket
# This helps minimize S3 storage costs by removing old deployment packages

set -e

echo "🧹 Cleaning up SAM deployment artifacts..."

# Get the SAM deployment bucket name
BUCKET_NAME=$(aws s3 ls | grep "aws-sam-cli-managed" | awk '{print $3}' | head -n 1)

if [ -z "$BUCKET_NAME" ]; then
  echo "❌ No SAM deployment bucket found"
  exit 1
fi

echo "📦 Found bucket: $BUCKET_NAME"

# List objects in the bucket
OBJECT_COUNT=$(aws s3 ls s3://$BUCKET_NAME --recursive | wc -l)
SIZE=$(aws s3 ls s3://$BUCKET_NAME --recursive --human-readable --summarize | tail -n 1)

echo "📊 Current usage:"
echo "   Objects: $OBJECT_COUNT"
echo "   Size: $SIZE"

# Ask for confirmation
read -p "⚠️  Do you want to delete all objects in this bucket? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Cancelled"
  exit 0
fi

# Delete all objects (but keep the bucket)
echo "🗑️  Deleting all objects..."
aws s3 rm s3://$BUCKET_NAME --recursive

echo "✅ Cleanup complete!"
echo "📊 Bucket is now empty (but still exists for future deployments)"

