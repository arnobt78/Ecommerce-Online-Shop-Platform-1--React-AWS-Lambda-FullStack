#!/bin/bash

# AWS Lambda Deployment Script
# This script helps deploy the Lambda functions to AWS

set -e  # Exit on error

echo "🚀 CodeBook Lambda Deployment"
echo "=============================="
echo ""

# Load environment variables from .env file in parent directory
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

echo "✅ AWS Region: $AWS_REGION"
echo "✅ AWS Access Key: ${AWS_ACCESS_KEY_ID:0:4}..."
echo ""

# Build the application
echo "📦 Building SAM application..."
sam build

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo "✅ Build successful!"
echo ""

# Deploy
echo "🚀 Deploying to AWS..."
echo "This will create/update the Lambda function and HTTP API"
echo ""
echo "Stack name: codebook-lambda"
echo "Region: $AWS_REGION"
echo ""

# Check for secrets in environment or .env.secrets file
if [ -f ".env.secrets" ]; then
  echo "📝 Loading secrets from .env.secrets"
  export $(grep -v '^#' .env.secrets | grep -v '^$' | xargs)
  echo "✅ Secrets loaded"
  echo ""
fi

# Build parameter overrides if secrets are available
PARAM_OVERRIDES=""
if [ ! -z "$JWT_SECRET" ]; then
  PARAM_OVERRIDES="$PARAM_OVERRIDES JwtSecret=$JWT_SECRET"
fi
if [ ! -z "$STRIPE_SECRET_KEY" ]; then
  PARAM_OVERRIDES="$PARAM_OVERRIDES StripeSecretKey=$STRIPE_SECRET_KEY"
fi
if [ ! -z "$STRIPE_WEBHOOK_SECRET" ]; then
  PARAM_OVERRIDES="$PARAM_OVERRIDES StripeWebhookSecret=$STRIPE_WEBHOOK_SECRET"
fi
if [ ! -z "$BREVO_API_KEY" ]; then
  PARAM_OVERRIDES="$PARAM_OVERRIDES BrevoApiKey=$BREVO_API_KEY"
fi
if [ ! -z "$BREVO_SENDER_EMAIL" ]; then
  PARAM_OVERRIDES="$PARAM_OVERRIDES BrevoSenderEmail=$BREVO_SENDER_EMAIL"
fi
if [ ! -z "$BREVO_ADMIN_EMAIL" ]; then
  PARAM_OVERRIDES="$PARAM_OVERRIDES BrevoAdminEmail=$BREVO_ADMIN_EMAIL"
fi
if [ ! -z "$SHIPPO_API_KEY" ]; then
  PARAM_OVERRIDES="$PARAM_OVERRIDES ShippoApiKey=$SHIPPO_API_KEY"
fi

# Deploy with parameters if available
if [ ! -z "$PARAM_OVERRIDES" ]; then
  echo "🔐 Using secrets from environment variables"
  sam deploy --no-confirm-changeset --parameter-overrides $PARAM_OVERRIDES
else
  echo "⚠️  Warning: No secrets found in environment variables"
  echo "   Secrets will need to be set manually in AWS Lambda Console after deployment"
  echo "   Or create .env.secrets file with: JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET"
  echo ""
  read -p "Continue deployment without secrets? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled. Please set secrets and try again."
    exit 1
  fi
  sam deploy --no-confirm-changeset
fi

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Deployment successful!"
  echo ""
  echo "📝 Next steps:"
  echo "1. Copy the ApiUrl from the output above"
  echo "2. Test the endpoint: curl https://YOUR_API_URL/products"
  echo "3. Update frontend to use the new API URL"
else
  echo "❌ Deployment failed!"
  exit 1
fi

