FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY housing.json .

# .pkl model files are downloaded from Azure Blob Storage at startup
# via _download_models_if_needed() in app.py

EXPOSE 8000

CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000", "--timeout", "120", "--workers", "2"]
