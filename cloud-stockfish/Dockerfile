FROM python:3.11-slim

# Install dependencies for Stockfish
RUN apt-get update && apt-get install -y \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download and install Stockfish
RUN wget https://github.com/official-stockfish/Stockfish/releases/download/sf_17/stockfish-ubuntu-x86-64-avx2.tar \
    && tar -xf stockfish-ubuntu-x86-64-avx2.tar \
    && mv stockfish/stockfish-ubuntu-x86-64-avx2 /usr/local/bin/stockfish \
    && chmod +x /usr/local/bin/stockfish \
    && rm -rf stockfish stockfish-ubuntu-x86-64-avx2.tar

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
