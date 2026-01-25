# Cloud Stockfish Service

Stockfish chess engine deployed as AWS Lambda for ChessBlunders.org.

## Architecture

```
Web App (/api/engine) --> API Gateway --> Lambda --> Stockfish
     |
     v
  Supabase (engine_usage table - rate limiting)
```

Rate limiting happens in the web app BEFORE calling Lambda (saves costs).

---

## Current Deployment: AWS Lambda

Lambda is ideal for this use case:
- Pay per request (no idle costs)
- Auto-scaling
- ~$2-3/month for moderate usage

---

## Files Overview

| File | Purpose |
|------|---------|
| `Dockerfile.lambda` | Lambda container image |
| `lambda_handler.py` | Lambda function code |
| `requirements.txt` | Python dependencies |
| `test_lambda.py` | Test the deployed Lambda |

### Legacy (ECS - not used)

| File | Purpose |
|------|---------|
| `Dockerfile` | ECS/App Runner container |
| `app.py` | FastAPI server |
| `docker-compose.yml` | Local testing |
| `test_local_container.py` | Test local container |
| `test_cloud_container.py` | Test ECS deployment |

---

## Lambda Setup Steps

### 1. Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name stockfish-lambda \
  --region us-east-1
```

### 2. Create Lambda Files

**Dockerfile.lambda:**
```dockerfile
FROM public.ecr.aws/lambda/python:3.11

RUN yum install -y wget tar && \
    wget https://github.com/official-stockfish/Stockfish/releases/download/sf_16.1/stockfish-ubuntu-x86-64-avx2.tar && \
    tar -xf stockfish-ubuntu-x86-64-avx2.tar && \
    mv stockfish/stockfish-ubuntu-x86-64-avx2 /usr/local/bin/stockfish && \
    chmod +x /usr/local/bin/stockfish && \
    rm -rf stockfish stockfish-ubuntu-x86-64-avx2.tar && \
    yum clean all

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY lambda_handler.py .

CMD ["lambda_handler.handler"]
```

**lambda_handler.py:** See the file in this folder.

### 3. Build and Push

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build
docker build -f Dockerfile.lambda -t stockfish-lambda .

# Tag
docker tag stockfish-lambda:latest \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-lambda:latest

# Push
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-lambda:latest
```

### 4. Create Lambda Execution Role

```bash
# Create trust policy
cat > lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create role
aws iam create-role \
  --role-name StockfishLambdaRole \
  --assume-role-policy-document file://lambda-trust-policy.json

# Attach policy
aws iam attach-role-policy \
  --role-name StockfishLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 5. Create Lambda Function

```bash
ROLE_ARN=$(aws iam get-role --role-name StockfishLambdaRole --query 'Role.Arn' --output text)

aws lambda create-function \
  --function-name stockfish-analyze \
  --package-type Image \
  --code ImageUri=<account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-lambda:latest \
  --role $ROLE_ARN \
  --timeout 30 \
  --memory-size 1024 \
  --region us-east-1
```

### 6. Create API Gateway

```bash
# Create HTTP API
API_ID=$(aws apigatewayv2 create-api \
  --name stockfish-api \
  --protocol-type HTTP \
  --query 'ApiId' --output text)

# Create integration
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id $API_ID \
  --integration-type AWS_PROXY \
  --integration-uri arn:aws:lambda:us-east-1:<account-id>:function:stockfish-analyze \
  --payload-format-version 2.0 \
  --query 'IntegrationId' --output text)

# Create route
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "POST /analyze" \
  --target integrations/$INTEGRATION_ID

# Create stage
aws apigatewayv2 create-stage \
  --api-id $API_ID \
  --stage-name prod \
  --auto-deploy

# Grant permission
aws lambda add-permission \
  --function-name stockfish-analyze \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:<account-id>:$API_ID/*"

# Get URL
echo "https://$API_ID.execute-api.us-east-1.amazonaws.com/prod/analyze"
```

### 7. Test

```bash
python test_lambda.py https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/analyze
```

---

## API Reference

### POST /analyze

Request:
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "depth": 20,
  "multipv": 1
}
```

Response:
```json
{
  "bestmove": "e2e4",
  "lines": [
    {
      "depth": 20,
      "score": {"cp": 20},
      "pv": ["e2e4", "e7e5", "g1f3"],
      "multipv": 1
    }
  ]
}
```

---

## Updating Lambda

```bash
# Build and push new image
docker build -f Dockerfile.lambda -t stockfish-lambda .
docker tag stockfish-lambda:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-lambda:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-lambda:latest

# Update function
aws lambda update-function-code \
  --function-name stockfish-analyze \
  --image-uri <account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-lambda:latest
```

---

## Cost Estimate

- ~1000 analyses/day
- 1024MB memory, ~5 seconds each
- **Monthly cost: ~$2-3**

Much cheaper than always-on ECS (~$35-70/month).
