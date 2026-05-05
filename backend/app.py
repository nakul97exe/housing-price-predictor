import os
import json
import joblib
import numpy as np
import pandas as pd
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()


def _download_models_if_needed():
    """Download .pkl files from Azure Blob Storage when running in production."""
    account   = os.getenv('AZURE_STORAGE_ACCOUNT')
    key       = os.getenv('AZURE_STORAGE_KEY')
    container = os.getenv('AZURE_STORAGE_CONTAINER', 'models')
    if not (account and key):
        return
    try:
        from azure.storage.blob import BlobServiceClient
        conn_str = (
            f"DefaultEndpointsProtocol=https;AccountName={account};"
            f"AccountKey={key};EndpointSuffix=core.windows.net"
        )
        client = BlobServiceClient.from_connection_string(conn_str)
        for fname in ['california_housing_model.pkl', 'power_transformer.pkl', 'feature_columns.pkl']:
            if not os.path.exists(fname):
                print(f"Downloading {fname} from blob storage...")
                blob = client.get_blob_client(container=container, blob=fname)
                with open(fname, 'wb') as f:
                    f.write(blob.download_blob().readall())
                print(f"Downloaded {fname} ✅")
    except Exception as e:
        print(f"Blob download error: {e}")


app = Flask(__name__)
_cors_origins = [o.strip() for o in os.getenv('CORS_ORIGIN', 'http://localhost:3000').split(',')]
CORS(app, origins=_cors_origins)

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')

# ── Lazy-loaded globals ───────────────────────────────────────────────────
model        = None
transformer  = None
feature_cols = None
housing_df   = None


def _ensure_models_loaded():
    global model, transformer, feature_cols, housing_df
    if model is not None:
        return
    _download_models_if_needed()
    model        = joblib.load(os.getenv('MODEL_PATH',       'california_housing_model.pkl'))
    transformer  = joblib.load(os.getenv('TRANSFORMER_PATH', 'power_transformer.pkl'))
    feature_cols = joblib.load(os.getenv('FEATURES_PATH',    'feature_columns.pkl'))
    housing_json_path = os.getenv('HOUSING_JSON_PATH', 'housing.json')
    with open(housing_json_path, 'r') as f:
        housing_data = json.load(f)
    housing_df = pd.DataFrame(housing_data)
    print("Model loaded ✅")
    print(f"Housing data loaded ✅ — {len(housing_df)} rows")

# ── Helper — predict price for one row ────────────────────────────────────
def predict_price_for_row(row, ocean_proximity):
    try:
        total_rooms    = float(row.get('total_rooms',    1000))
        total_bedrooms = float(row.get('total_bedrooms', 200))
        population     = float(row.get('population',     500))
        households     = float(row.get('households',     200))
        median_income  = float(row.get('median_income',  3.0))
        latitude       = float(row.get('latitude',       36.0))
        longitude      = float(row.get('longitude',      -119.0))
        housing_median_age = float(row.get('housing_median_age', 20))

        rooms_per_household      = total_rooms    / households
        bedrooms_per_room        = total_bedrooms / total_rooms
        population_per_household = population     / households
        dist_sf = np.sqrt((latitude - 37.77)**2 + (longitude - (-122.41))**2)
        dist_la = np.sqrt((latitude - 34.05)**2 + (longitude - (-118.24))**2)

        input_dict = {
            'longitude': longitude, 'latitude': latitude,
            'housing_median_age': housing_median_age,
            'total_rooms': total_rooms, 'total_bedrooms': total_bedrooms,
            'population': population, 'households': households,
            'median_income': median_income,
            'rooms_per_household': rooms_per_household,
            'bedrooms_per_room': bedrooms_per_room,
            'population_per_household': population_per_household,
            'dist_sf': dist_sf, 'dist_la': dist_la,
        }

        df_input = pd.DataFrame([input_dict])

        ocean_categories = [
            'ocean_proximity_<1H OCEAN', 'ocean_proximity_INLAND',
            'ocean_proximity_ISLAND', 'ocean_proximity_NEAR BAY',
            'ocean_proximity_NEAR OCEAN'
        ]
        for col in ocean_categories:
            df_input[col] = 0
        col_name = f'ocean_proximity_{ocean_proximity}'
        if col_name in df_input.columns:
            df_input[col_name] = 1

        numerical_cols = [
            'housing_median_age', 'total_rooms', 'total_bedrooms',
            'population', 'households', 'median_income',
            'rooms_per_household', 'bedrooms_per_room',
            'population_per_household', 'dist_sf', 'dist_la'
        ]
        df_input[numerical_cols] = transformer.transform(df_input[numerical_cols])
        feature_cols_clean = [c for c in feature_cols if c != 'median_house_value']
        df_input = df_input.reindex(columns=feature_cols_clean, fill_value=0)

        return float(model.predict(df_input)[0])
    except:
        return float(row.get('median_house_value', 200000))


# ── Helper — zone insights (count + price range only) ─────────────────────
def compute_insights_by_zones(filtered_df):
    affordable_count = len(filtered_df)

    if affordable_count > 0:
        price_range = {
            "min": round(float(filtered_df['median_house_value'].min()), 0),
            "max": round(float(filtered_df['median_house_value'].max()), 0),
            "avg": round(float(filtered_df['median_house_value'].mean()), 0)
        }
    else:
        price_range = { "min": 0, "max": 0, "avg": 0 }

    return {
        "affordable_count": affordable_count,
        "price_range":      price_range,
    }


# ── Health check ──────────────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({ "status": "ok", "model": "RandomForestRegressor", "models_loaded": model is not None })


# ── Chat endpoint ─────────────────────────────────────────────────────────
@app.route('/chat', methods=['POST'])
def chat():
    _ensure_models_loaded()
    try:
        data       = request.get_json()
        user_query = data.get('query', '')

        if not user_query:
            return jsonify({ "error": "No query provided" }), 400

        # ── Step 1 — OpenRouter: extract income + optional qualifiers ──────
        or_response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type":  "application/json"
            },
            json={
                "model": "anthropic/claude-3-haiku",
                "messages": [
                    {
                        "role":    "system",
                        "content": """You are a California housing data analyst.
Extract parameters from the user query and return ONLY valid JSON:

{
    "annual_income": number or null,
    "ocean_proximity": "INLAND | NEAR BAY | NEAR OCEAN | <1H OCEAN | ISLAND" or null,
    "housing_median_age": number or null,
    "total_bedrooms": number or null,
    "population": number or null,
    "near_city": "San Francisco | Los Angeles" or null,
    "summary": "2-3 sentence explanation"
}

RULES:
    - annual_income: extract yearly salary/income in dollars (e.g. "$80K/year" → 80000)
    - If user mentions older home/neighborhood → housing_median_age = 40
    - If user mentions newer home/modern → housing_median_age = 10
    - If user mentions small community/quiet area → population = 1000
    - If user mentions 1/2/3 bedrooms → total_bedrooms = that number * 200
    - If user mentions near SF/San Francisco → near_city = "San Francisco"
    - If user mentions near LA/Los Angeles → near_city = "Los Angeles"
    - ocean_proximity exact values only: INLAND, NEAR BAY, NEAR OCEAN, <1H OCEAN, ISLAND
    - Return ONLY JSON, nothing else"""
                    },
                    {
                        "role":    "user",
                        "content": user_query
                    }
                ]
            }
        )

        response_text = or_response.json()['choices'][0]['message']['content']
        clean         = response_text.replace('```json', '').replace('```', '').strip()
        claude_parsed = json.loads(clean)

        # ── Step 2 — Validate income ──────────────────────────────────────
        annual_income = claude_parsed.get('annual_income')
        if not annual_income:
            return jsonify({ "error": "Please provide your annual income to find affordable zones." }), 400

        user_median_income = annual_income / 10000  # dataset unit: tens of thousands
        threshold          = annual_income * 3.5    # standard mortgage affordability rule

        # ── Step 3 — Optional qualifiers ─────────────────────────────────
        user_age        = claude_parsed.get('housing_median_age')
        user_bedrooms   = claude_parsed.get('total_bedrooms')
        user_population = claude_parsed.get('population')
        near_city       = claude_parsed.get('near_city')
        user_ocean      = claude_parsed.get('ocean_proximity')

        ocean_types            = ['INLAND', '<1H OCEAN', 'NEAR BAY', 'NEAR OCEAN', 'ISLAND']
        types_to_predict       = [user_ocean] if user_ocean else ocean_types
        ocean_predictions      = {}
        affordable_ocean_types = []

        # ── Step 4 — Predict price per zone using model ───────────────────
        for ocean_type in types_to_predict:
            ocean_rows = housing_df[housing_df['ocean_proximity'] == ocean_type]
            if len(ocean_rows) == 0:
                continue

            avg_row = ocean_rows.mean(numeric_only=True).to_dict()
            avg_row['median_income'] = user_median_income

            if user_age:
                avg_row['housing_median_age'] = user_age
            if user_bedrooms:
                avg_row['total_bedrooms']     = user_bedrooms
            if user_population:
                avg_row['population']         = user_population
            if near_city == 'San Francisco':
                avg_row['latitude']  = 37.77
                avg_row['longitude'] = -122.41
            elif near_city == 'Los Angeles':
                avg_row['latitude']  = 34.05
                avg_row['longitude'] = -118.24

            predicted     = predict_price_for_row(avg_row, ocean_type)
            is_affordable = predicted <= threshold

            ocean_predictions[ocean_type] = {
                "predicted_price": round(predicted, 0),
                "affordable":      is_affordable,
            }
            if is_affordable:
                affordable_ocean_types.append(ocean_type)

        # ── Step 5 — Build map expression from affordable zones ──────────
        if affordable_ocean_types:
            expression = "(" + " OR ".join(
                f"ocean_proximity = '{z}'" for z in affordable_ocean_types
            ) + ")"
        elif user_ocean:
            expression = f"(ocean_proximity = '{user_ocean}')"
        else:
            expression = "1=1"

        # ── Step 6 — Zone insights on filtered dataset ────────────────────
        if affordable_ocean_types:
            filtered_df = housing_df[housing_df['ocean_proximity'].isin(affordable_ocean_types)]
        elif user_ocean:
            filtered_df = housing_df[housing_df['ocean_proximity'] == user_ocean]
        else:
            filtered_df = housing_df

        insights = compute_insights_by_zones(filtered_df)

        # ── Step 7 — Best zone + top 5 properties ────────────────────────
        zone_labels = {
            'INLAND':     'Inland California / Central Valley',
            '<1H OCEAN':  'Coastal California (< 1hr from Ocean)',
            'NEAR BAY':   'Bay Area',
            'NEAR OCEAN': 'Near Ocean',
            'ISLAND':     'Island',
        }

        best_zone   = None
        top_5_props = []

        candidate_zones = affordable_ocean_types if affordable_ocean_types else (
            [user_ocean] if user_ocean else []
        )

        if candidate_zones:
            # Best zone = most properties under threshold
            def count_under_budget(z):
                return len(housing_df[
                    (housing_df['ocean_proximity'] == z) &
                    (housing_df['median_house_value'] <= threshold)
                ])

            best_ocean_type = max(candidate_zones, key=count_under_budget)

            zone_df = housing_df[
                (housing_df['ocean_proximity'] == best_ocean_type) &
                (housing_df['median_house_value'] <= threshold)
            ]

            best_zone = {
                "ocean_zone": best_ocean_type,
                "label":      zone_labels.get(best_ocean_type, best_ocean_type),
                "center": {
                    "latitude":  round(float(zone_df['latitude'].mean()),  4),
                    "longitude": round(float(zone_df['longitude'].mean()), 4),
                },
                "bounds": {
                    "min_lat": round(float(zone_df['latitude'].min()),  4),
                    "max_lat": round(float(zone_df['latitude'].max()),  4),
                    "min_lng": round(float(zone_df['longitude'].min()), 4),
                    "max_lng": round(float(zone_df['longitude'].max()), 4),
                },
                "properties_under_budget": len(zone_df),
                "avg_price": round(float(zone_df['median_house_value'].mean()), 0),
                "price_range": {
                    "min": round(float(zone_df['median_house_value'].min()), 0),
                    "max": round(float(zone_df['median_house_value'].max()), 0),
                },
            }

            # Top 5 across ALL affordable zones combined
            all_affordable_df = housing_df[
                (housing_df['ocean_proximity'].isin(candidate_zones)) &
                (housing_df['median_house_value'] <= threshold)
            ].copy()
            all_affordable_df['value_score'] = (
                all_affordable_df['median_income'] / (all_affordable_df['median_house_value'] / 10000)
            )
            for idx, row in all_affordable_df.nlargest(5, 'value_score').iterrows():
                top_5_props.append({
                    "id":                 int(idx),
                    "latitude":           round(float(row['latitude']),           4),
                    "longitude":          round(float(row['longitude']),          4),
                    "median_house_value": round(float(row['median_house_value']), 0),
                    "median_income":      round(float(row['median_income']),      2),
                    "ocean_proximity":    row['ocean_proximity'],
                    "housing_median_age": round(float(row['housing_median_age']), 0),
                    "total_rooms":        round(float(row['total_rooms']),        0),
                    "total_bedrooms":     round(float(row['total_bedrooms']),     0),
                    "population":         round(float(row['population']),         0),
                    "households":         round(float(row['households']),         0),
                    "value_score":        round(float(row['value_score']),        4),
                })

        # ── Step 8 — Return ───────────────────────────────────────────────
        return jsonify({
            "annual_income":     annual_income,
            "max_budget":        round(threshold, 0),
            "threshold":         round(threshold, 0),
            "summary":           claude_parsed.get('summary', ''),
            "expression":        expression,
            "ocean_predictions": ocean_predictions,
            "affordable_zones":  affordable_ocean_types,
            "affordable_count":  insights['affordable_count'],
            "price_range":       insights['price_range'],
            "best_zone":         best_zone,
            "top_5_properties":  top_5_props,
        })

    except Exception as e:
        return jsonify({ "error": str(e) }), 500


# ── Predict endpoint ──────────────────────────────────────────────────────
@app.route('/predict', methods=['POST'])
def predict():
    _ensure_models_loaded()
    try:
        data = request.get_json()

        longitude          = float(data['longitude'])
        latitude           = float(data['latitude'])
        housing_median_age = float(data['housing_median_age'])
        total_rooms        = float(data['total_rooms'])
        total_bedrooms     = float(data['total_bedrooms'])
        population         = float(data['population'])
        households         = float(data['households'])
        median_income      = float(data['median_income'])
        ocean_proximity    = data['ocean_proximity']

        rooms_per_household      = total_rooms    / households
        bedrooms_per_room        = total_bedrooms / total_rooms
        population_per_household = population     / households
        dist_sf = np.sqrt((latitude - 37.77)**2 + (longitude - (-122.41))**2)
        dist_la = np.sqrt((latitude - 34.05)**2 + (longitude - (-118.24))**2)

        input_dict = {
            'longitude': longitude, 'latitude': latitude,
            'housing_median_age': housing_median_age,
            'total_rooms': total_rooms, 'total_bedrooms': total_bedrooms,
            'population': population, 'households': households,
            'median_income': median_income,
            'rooms_per_household': rooms_per_household,
            'bedrooms_per_room': bedrooms_per_room,
            'population_per_household': population_per_household,
            'dist_sf': dist_sf, 'dist_la': dist_la,
        }

        df_input = pd.DataFrame([input_dict])

        ocean_categories = [
            'ocean_proximity_<1H OCEAN', 'ocean_proximity_INLAND',
            'ocean_proximity_ISLAND', 'ocean_proximity_NEAR BAY',
            'ocean_proximity_NEAR OCEAN'
        ]
        for col in ocean_categories:
            df_input[col] = 0
        col_name = f'ocean_proximity_{ocean_proximity}'
        if col_name in df_input.columns:
            df_input[col_name] = 1

        numerical_cols = [
            'housing_median_age', 'total_rooms', 'total_bedrooms',
            'population', 'households', 'median_income',
            'rooms_per_household', 'bedrooms_per_room',
            'population_per_household', 'dist_sf', 'dist_la'
        ]
        df_input[numerical_cols] = transformer.transform(df_input[numerical_cols])
        feature_cols_clean = [c for c in feature_cols if c != 'median_house_value']
        df_input = df_input.reindex(columns=feature_cols_clean, fill_value=0)

        predicted_price = model.predict(df_input)[0]

        return jsonify({
            "predicted_price": round(float(predicted_price), 2),
            "currency":        "USD",
            "ocean_proximity": ocean_proximity,
            "location":        { "latitude": latitude, "longitude": longitude }
        })

    except KeyError as e:
        return jsonify({ "error": f"Missing field: {str(e)}" }), 400
    except Exception as e:
        return jsonify({ "error": str(e) }), 500


if __name__ == '__main__':
    app.run(
        port  = int(os.getenv('FLASK_PORT', 8000)),
        debug = os.getenv('FLASK_ENV') == 'development'
    )