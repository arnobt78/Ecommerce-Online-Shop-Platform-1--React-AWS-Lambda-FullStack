# AWS Lambda Functions - CodeBook E-Commerce

This directory contains AWS Lambda functions that power the CodeBook e-commerce backend API.

## 📁 Project Structure

```bash
aws-lambda/
├── functions/           # Individual Lambda functions (one per endpoint)
│   ├── products/       # Product management endpoints
│   ├── auth/           # Authentication endpoints
│   ├── orders/         # Order management endpoints
│   ├── admin/          # Admin-only endpoints
│   ├── payment/         # Payment processing (Stripe)
│   ├── email/          # Email service (Brevo)
│   ├── notifications/  # User notifications
│   ├── reviews/        # Product reviews
│   └── tickets/        # Support tickets
├── shared/              # Shared utilities used by all functions
│   ├── dynamodb.js     # DynamoDB client setup
│   ├── response.js     # HTTP response helpers
│   ├── auth.js         # Authentication helpers
│   ├── products.js     # Product helper functions
│   └── ...             # Other shared utilities
├── template.yaml        # AWS SAM template for deployment
├── deploy.sh            # Deployment script
├── .env.secrets         # Secrets file (NOT committed to Git)
└── package.json         # Dependencies
```

## 🚀 Getting Started

### Prerequisites

1. AWS Account with IAM permissions configured
2. AWS SAM CLI installed (`brew install aws-sam-cli` or `pip install aws-sam-cli`)
3. Node.js 22.x (matches Lambda runtime)
4. AWS credentials configured:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION=eu-north-1`

### Local Development

1. Install dependencies:

```bash
cd aws-lambda
npm install
```

2. Test locally with SAM:

```bash
sam local start-api
```

3. Test endpoint:

```bash
curl http://localhost:3000/products
```

## 📦 Deployment Guide

### Quick Deployment

Use the provided deployment script:

```bash
cd aws-lambda
./deploy.sh
```

The script will:

- Load environment variables from `../.env` or `.env`
- Load secrets from `.env.secrets`
- Build the SAM application
- Deploy to AWS with all parameters

### Manual Deployment

#### Step 1: Build the Application

```bash
cd aws-lambda
sam build
```

This packages your Lambda functions and dependencies.

#### Step 2: Deploy to AWS

```bash
sam deploy --guided
```

**First-time deployment questions:**

1. **Stack Name**: `codebook-lambda` (or any name you prefer)
2. **AWS Region**: `eu-north-1` (must match your DynamoDB region)
3. **Confirm changes**: `Y`
4. **Allow SAM CLI IAM role creation**: `Y` (SAM will create roles for Lambda)
5. **Disable rollback**: `N` (keep default)
6. **Save arguments to configuration**: `Y` (saves for future deployments)

**What SAM does:**

- Creates HTTP API in API Gateway
- Creates all Lambda functions
- Sets up IAM roles with DynamoDB permissions
- Configures environment variables
- Returns the API endpoint URL

#### Step 3: Get API Endpoint

After deployment, SAM will output:

```bash
ApiUrl = https://xxxxxxxxxx.execute-api.eu-north-1.amazonaws.com
```

**Save this URL** - you'll use it in your frontend as `REACT_APP_LAMBDA_API_URL`.

#### Step 4: Test the Endpoint

```bash
# Test products endpoint
curl https://YOUR_API_URL/products

# Test with search
curl "https://YOUR_API_URL/products?name_like=book"
```

## 🔐 Secrets Management

### ⚠️ Security Warning

**NEVER commit secrets (API keys, passwords, tokens) to GitHub!**

Even if your repository is private, secrets can be exposed through:

- Accidental public commits
- Repository access changes
- GitHub security breaches
- Code sharing

### Current Setup

This project uses **AWS SAM Parameters** to securely pass secrets during deployment without committing them to Git.

### How to Deploy with Secrets

#### Option 1: Use .env.secrets File (Recommended)

1. Copy the example file:

```bash
cp .env.secrets.example .env.secrets
```

2. Add your actual secrets to `.env.secrets`:

```bash
JWT_SECRET=your-jwt-secret-here
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=your-email@gmail.com
BREVO_ADMIN_EMAIL=your-email@gmail.com
SHIPPO_API_KEY=shippo_test_...
```

3. Run deployment script (automatically loads secrets):

```bash
./deploy.sh
```

#### Option 2: Pass Parameters During Deployment

```bash
cd aws-lambda

sam deploy \
  --parameter-overrides \
    JwtSecret="your-jwt-secret-here" \
    StripeSecretKey="sk_test_..." \
    StripeWebhookSecret="whsec_..." \
    BrevoApiKey="xkeysib-..." \
    BrevoSenderEmail="your-email@gmail.com" \
    BrevoAdminEmail="your-email@gmail.com" \
    ShippoApiKey="shippo_test_..."
```

#### Option 3: AWS Systems Manager Parameter Store (Free Tier)

Store secrets in AWS Systems Manager Parameter Store (FREE for standard parameters):

```bash
# Store secrets in Parameter Store
aws ssm put-parameter \
  --name "/codebook/jwt-secret" \
  --value "your-jwt-secret" \
  --type "SecureString" \
  --region eu-north-1

aws ssm put-parameter \
  --name "/codebook/stripe-secret-key" \
  --value "sk_test_..." \
  --type "SecureString" \
  --region eu-north-1
```

Then update `template.yaml` to reference Parameter Store:

```yaml
Environment:
  Variables:
    JWT_SECRET: !Sub "{{resolve:ssm:/codebook/jwt-secret}}"
    STRIPE_SECRET_KEY: !Sub "{{resolve:ssm:/codebook/stripe-secret-key}}"
```

### Updating Secrets After Deployment

#### Via AWS Console

1. Go to AWS Lambda Console
2. Select your function
3. Go to "Configuration" → "Environment variables"
4. Update the values
5. Save

#### Via AWS CLI

```bash
aws lambda update-function-configuration \
  --function-name codebook-lambda-PaymentCreateIntentFunction-XXXXX \
  --environment Variables="{STRIPE_SECRET_KEY=sk_test_...}" \
  --region eu-north-1
```

### What's Safe to Commit

✅ **Safe to commit:**

- `template.yaml` (uses parameters, no hardcoded secrets)
- `deploy.sh` (reads from .env files)
- `samconfig.toml` (only contains stack name and region)
- `.env.secrets.example` (example structure without actual secrets)
- Documentation files

❌ **Never commit:**

- `.env.secrets` (already in .gitignore)
- `.env` (already in .gitignore)
- Any file with actual API keys, passwords, or tokens

### Cost

- **Lambda Environment Variables**: FREE ✅
- **AWS Systems Manager Parameter Store (Standard)**: FREE (10,000 parameters) ✅
- **AWS Secrets Manager**: Costs money (not recommended for this project)

## 💰 Cost Monitoring

### API Gateway HTTP API Pricing

#### Free Tier (First 12 Months)

- **API Calls**: 1 million requests/month FREE
- **Data Transfer**:
  - First 1 GB/month outbound FREE
  - After that: $0.09 per GB outbound

#### After Free Tier

- **API Calls**: $1.00 per million requests
- **Data Transfer**: $0.09 per GB outbound

### Understanding Your Charges

The $0.01 charge you might see is likely from:

- **Data Transfer**: ~111 MB outbound data (0.111 GB × $0.09 ≈ $0.01)
- This is normal for API responses with product data, images, etc.

### Setting Up Cost Alarms

#### Step 1: Create AWS Budget

1. Go to **AWS Billing Console** → **Budgets**
2. Click **"Create budget"**
3. Choose **"Cost budget"**
4. Set budget amount:
   - **Monthly budget**: $5.00 (or your preferred limit)
   - **Alert threshold**: 80% ($4.00) and 100% ($5.00)
5. Configure alerts:
   - Email: your email address
   - Alert when: Actual > 80% of budgeted amount
   - Alert when: Actual > 100% of budgeted amount

#### Step 2: Create Cost Anomaly Detection

1. Go to **AWS Billing Console** → **Cost Anomaly Detection**
2. Click **"Create monitor"**
3. Select **"All services"** or **"API Gateway"** specifically
4. Set sensitivity: **Medium** or **High**
5. Add email alerts with threshold: **$0.10 AND 50%** (recommended)

#### Step 3: Set Up API Gateway Usage Plans (Optional)

To limit API usage and prevent unexpected charges:

1. Go to **API Gateway Console** → Your API → **Usage Plans**
2. Create a usage plan:
   - **Throttle**: 100 requests/second (adjust as needed)
   - **Quota**: 1 million requests/month (free tier limit)
3. Associate with API stages

#### Step 4: Monitor in CloudWatch

1. Go to **CloudWatch** → **Metrics** → **API Gateway**
2. Monitor:
   - **Count**: Number of API calls
   - **DataTransferOut**: Outbound data transfer
   - **4XXError**: Client errors
   - **5XXError**: Server errors

### Cost Optimization Tips

1. **Enable Caching**: Cache API responses to reduce Lambda invocations
2. **Compress Responses**: Use gzip compression to reduce data transfer
3. **Optimize Payload Size**: Minimize response data (only return needed fields)
4. **Use CDN**: Serve static assets via CloudFront (cheaper than API Gateway)
5. **Monitor Regularly**: Check AWS Cost Explorer weekly

### Expected Monthly Costs

#### Free Tier (First 12 Months)

- **API Gateway Calls**: $0.00 (within 1M limit)
- **API Gateway Data Transfer**: $0.00 - $0.50 (depends on usage)
- **Lambda**: $0.00 (within 1M requests, 400K GB-seconds)
- **DynamoDB**: $0.00 (within 25 GB storage, 25 RCU/WCU)
- **S3**: $0.00 (within 5 GB storage)

**Total Expected**: $0.00 - $1.00/month (within free tier)

#### After Free Tier (Month 13+)

- **API Gateway**: ~$1-5/month (depending on traffic)
- **Lambda**: ~$0.20/month (if within 1M requests)
- **DynamoDB**: ~$0.25/month (if within free tier limits)
- **S3**: $0.00 (if within 5 GB)

**Total Expected**: $1.50 - $6.00/month (after free tier)

### Recommended Alerts

1. **Budget Alert**: $5/month total AWS spend
2. **API Gateway Alert**: > 800K requests/month (80% of free tier)
3. **Data Transfer Alert**: > 800 MB/month (80% of free tier)
4. **DynamoDB Alert**: > 20 GB storage (80% of free tier)
5. **Cost Anomaly Detection**: $0.10 AND 50% threshold

### Important Notes

- **Free Tier**: Only applies for first 12 months after account creation
- **Data Transfer**: Always charged (even in free tier, after 1 GB/month)
- **Regional**: Charges vary by region (eu-north-1 is standard pricing)
- **Monitor Regularly**: Set up alerts to avoid surprises

## 🔧 Troubleshooting

### Error: "Table does not exist"

- Make sure DynamoDB tables exist in eu-north-1 region
- Table names: `codebook-products`, `codebook-orders`, `codebook-users`, `codebook-activity-log`, `codebook-tickets`, `codebook-reviews`

### Error: "Access Denied"

- Check IAM permissions for your AWS user
- Ensure Lambda execution role has DynamoDB permissions
- Verify API Gateway has proper CORS configuration

### Error: "Region not configured"

- Set `AWS_REGION=eu-north-1` in environment or use `--region eu-north-1`
- Ensure all resources (DynamoDB, Lambda) are in the same region

### Error: "Secrets not found"

- Ensure `.env.secrets` file exists in `aws-lambda/` directory
- Check that secrets are properly formatted (no quotes, no spaces around `=`)
- Verify deployment script is loading secrets correctly

### Error: "Build failed"

- Check Node.js version matches Lambda runtime (22.x)
- Ensure all dependencies are in `package.json`
- Try deleting `.aws-sam/` folder and rebuilding

## ⚠️ Important Notes

### Linter Warnings

The `template.yaml` file may show linter warnings about `!Ref` and `!Sub`. These are **false positives** - these are valid CloudFormation intrinsic functions used in AWS SAM templates. The template will work correctly despite these warnings.

### Security Best Practices

1. **Never commit secrets** - Always use `.env.secrets` (in `.gitignore`)
2. **Use parameters** - All secrets are passed as SAM parameters
3. **Rotate keys regularly** - Update API keys periodically
4. **Monitor access** - Check CloudWatch logs for suspicious activity
5. **Use IAM roles** - Lambda functions use IAM roles, not access keys

## 📝 Current Status

1. ✅ Project structure created
2. ✅ All Lambda functions implemented
3. ✅ Shared utilities (DynamoDB, Response helpers, Auth)
4. ✅ Secure secrets management
5. ✅ Deployment automation
6. ✅ Cost monitoring setup

## 🔗 Related Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
