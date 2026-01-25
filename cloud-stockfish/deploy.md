# Deploying Stockfish API to AWS

## Prerequisites

- AWS CLI installed and configured
- Docker installed
- AWS account with appropriate permissions

## Option 1: AWS App Runner (Easiest)

App Runner is the simplest way to deploy a container.

### 1. Create ECR Repository

```bash
# Create repository
aws ecr create-repository --repository-name stockfish-api --region us-east-1

# Get the repository URI
aws ecr describe-repositories --repository-names stockfish-api --query 'repositories[0].repositoryUri' --output text
```

### 2. Build and Push Image

```bash
# Navigate to cloud-stockfish directory
cd cloud-stockfish

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t stockfish-api .

# Tag image
docker tag stockfish-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-api:latest

# Push image
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-api:latest
```

### 3. Create App Runner Service

```bash
aws apprunner create-service \
    --service-name stockfish-api \
    --source-configuration '{
        "ImageRepository": {
            "ImageIdentifier": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-api:latest",
            "ImageRepositoryType": "ECR",
            "ImageConfiguration": {
                "Port": "8000"
            }
        },
        "AutoDeploymentsEnabled": true,
        "AuthenticationConfiguration": {
            "AccessRoleArn": "arn:aws:iam::<account-id>:role/AppRunnerECRAccessRole"
        }
    }' \
    --instance-configuration '{
        "Cpu": "1024",
        "Memory": "2048"
    }' \
    --region us-east-1
```

### 4. Get Service URL

```bash
aws apprunner describe-service --service-arn <service-arn> --query 'Service.ServiceUrl' --output text
```

---

## Option 2: AWS ECS Fargate

More control, better for production.

### 1. Create ECR Repository (same as above)

### 2. Build and Push Image (same as above)

### 3. Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name stockfish-cluster
```

### 4. Create Task Definition

Save as `task-definition.json`:

```json
{
    "family": "stockfish-api",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "1024",
    "memory": "2048",
    "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
    "containerDefinitions": [
        {
            "name": "stockfish-api",
            "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-api:latest",
            "portMappings": [
                {
                    "containerPort": 8000,
                    "protocol": "tcp"
                }
            ],
            "essential": true,
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/stockfish-api",
                    "awslogs-region": "us-east-1",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        }
    ]
}
```

Register task:

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### 5. Create Service with Load Balancer

```bash
# Create security group
aws ec2 create-security-group --group-name stockfish-sg --description "Stockfish API SG" --vpc-id <vpc-id>

# Allow inbound traffic on port 8000
aws ec2 authorize-security-group-ingress --group-id <sg-id> --protocol tcp --port 8000 --cidr 0.0.0.0/0

# Create service
aws ecs create-service \
    --cluster stockfish-cluster \
    --service-name stockfish-api \
    --task-definition stockfish-api \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[<subnet-id>],securityGroups=[<sg-id>],assignPublicIp=ENABLED}"
```

---

## Option 3: AWS Lambda (Serverless)

Best for low traffic, pay-per-request.

Note: Lambda has cold start latency and 15-minute timeout. Not ideal for long analyses.

### 1. Create Lambda Container Image

Modify Dockerfile to use Lambda base image (see AWS docs).

### 2. Deploy with SAM or CDK

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `STOCKFISH_THREADS` | Engine threads | 2 |
| `STOCKFISH_HASH` | Hash table MB | 128 |

---

## Monitoring

### CloudWatch Logs

```bash
aws logs tail /ecs/stockfish-api --follow
```

### Health Check

```bash
curl https://<service-url>/health
```

---

## Cost Estimates

| Service | Config | Est. Monthly Cost |
|---------|--------|-------------------|
| App Runner | 1 vCPU, 2GB | ~$25-50 |
| ECS Fargate | 1 vCPU, 2GB, always-on | ~$35-70 |
| Lambda | Per-request | Pay per invocation |

---

## Updating the Service

```bash
# Build new image
docker build -t stockfish-api .

# Tag and push
docker tag stockfish-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-api:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/stockfish-api:latest

# App Runner auto-deploys if enabled
# For ECS, update service to force new deployment:
aws ecs update-service --cluster stockfish-cluster --service stockfish-api --force-new-deployment
```
