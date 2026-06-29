from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from sklearn.linear_model import LinearRegression
import numpy as np

app = FastAPI(title="AutiCare AI Predictive Analytics Microservice")

class ChildData(BaseModel):
    name: str
    age: Optional[int] = None
    asdLevel: Optional[str] = None

class MedicationData(BaseModel):
    name: str
    taken: bool

class LogEntry(BaseModel):
    mood: str
    sleepHours: float
    meltdowns: int
    notes: Optional[str] = ""
    medication: Optional[List[MedicationData]] = []

class ScoreEntry(BaseModel):
    gameName: str
    score: float
    reactionTimeMs: Optional[float] = 0

class PredictionRequest(BaseModel):
    child: ChildData
    logs: List[LogEntry]
    scores: Optional[List[ScoreEntry]] = []
    geneticReport: Optional[dict] = None


# Features: [sleep_hours, meltdown_count, mood_numeric]
# Target: sensory_crisis_score (0 - 100)
X_train = np.array([
    [8.0, 0, 2.0],  # Good sleep, no meltdowns, stable/happy mood
    [5.0, 2, 0.0],  # Poor sleep, multiple meltdowns, distressed/angry
    [6.5, 1, 1.0],  # Average sleep, one meltdown, neutral mood
    [9.0, 0, 2.0],  # Perfect sleep, no meltdowns, good mood
    [4.0, 3, 0.0],  # Critical sleep deprivation, high meltdowns, distressed
    [7.5, 0, 1.5],  # Good sleep, no meltdowns, slightly happy
])
y_train = np.array([15.0, 85.0, 50.0, 10.0, 95.0, 25.0])

reg_model = LinearRegression()
reg_model.fit(X_train, y_train)

def get_mood_numeric(mood: str) -> float:
    mood = mood.lower()
    if mood in ['very_happy', 'happy', 'excellent']:
        return 2.0
    elif mood in ['good', 'neutral']:
        return 1.5
    elif mood in ['sad', 'anxious']:
        return 1.0
    elif mood in ['very_sad', 'angry', 'distressed']:
        return 0.0
    return 1.0

@app.post("/predict")
def predict_sensory_crisis(data: PredictionRequest):
    # If logs are empty, return default response
    if not data.logs:
        return {
            "riskScore": 0,
            "riskLevel": "insufficient_data",
            "message": "Not enough behavior logs to calculate score.",
            "alerts": [],
            "interventions": []
        }

    # Extract features for prediction
    sleep_list = [l.sleepHours for l in data.logs]
    meltdown_list = [l.meltdowns for l in data.logs]
    mood_list = [get_mood_numeric(l.mood) for l in data.logs]

    avg_sleep = np.mean(sleep_list)
    avg_meltdowns = np.mean(meltdown_list)
    avg_mood = np.mean(mood_list)

    # Linear Regression prediction
    X_pred = np.array([[avg_sleep, avg_meltdowns, avg_mood]])
    raw_score = float(reg_model.predict(X_pred)[0])
    risk_score = raw_score

    # Integrate Cognitive Game Telemetry into Risk Scoring
    low_performance_sessions_count = 0
    if data.scores:
        for s in data.scores:
            rt = s.reactionTimeMs if s.reactionTimeMs is not None else 0.0
            if s.score < 50 or rt > 1200:
                low_performance_sessions_count += 1

    if low_performance_sessions_count > 0:
        risk_score += (5.0 * low_performance_sessions_count)

    # Clip between 0 and 100
    risk_score = max(0.0, min(100.0, risk_score))

    # Determine risk level
    if risk_score < 35:
        risk_level = "low"
    elif risk_score < 70:
        risk_level = "medium"
    else:
        risk_level = "high"

    # Dynamic alerts and interventions matching specific triggers in notes/logs
    alerts = []
    interventions = []

    # Add cognitive fatigue warnings if regression is present
    if low_performance_sessions_count > 0:
        alerts.append("Cognitive performance regression or attention slippage detected in recent play sessions.")
        interventions.append("Implement immediate sensory decompression windows and reduce cognitive workload.")

    # Check for sleep deprivation trigger
    if avg_sleep < 6.5:
        alerts.append("Increased susceptibility to sensory overload detected due to sub-optimal sleep durations.")
        interventions.append("Establish a calming sensory buffer zone (e.g. dim lights, sound machine) 30 minutes before bed.")

    # Check for recent meltdowns
    if avg_meltdowns > 0.5:
        alerts.append("Elevated meltdown frequency observed over the last log period.")
        interventions.append("Introduce visual scheduling and decompression breaks immediately following school/work transitions.")

    # Check for gut health or other notes triggers
    all_notes = " ".join([l.notes for l in data.logs if l.notes]).lower()
    if any(k in all_notes for k in ["gut", "stomach", "food", "gluten", "pain"]):
        alerts.append("Potential digestive distress noted in behavioral logs.")
        interventions.append("Review dietary triggers. Localized sprouted grains or Ful Medames might support gut microflora stability.")

    # Check genetic markers to personalize warnings
    genetic_alerts = []
    if data.geneticReport and "parsedMarkers" in data.geneticReport:
        markers = data.geneticReport["parsedMarkers"]
        for m in markers:
            marker = m.get("marker", "").upper()
            result = m.get("result", "").lower()
            if result != "negative" and result != "unknown" and result != "normal":
                if "MTHFR" in marker:
                    genetic_alerts.append(f"MTHFR ({m.get('value') or 'variant'}) limits methylation efficiency.")
                    interventions.append("Administer active cofactors (L-Methylfolate) under clinical guidance to support focus.")
                elif "HLA-DQ2" in marker or "HLA-DQ8" in marker:
                    genetic_alerts.append(f"Celiac disease/gluten sensitivity predisposition ({marker}) identified.")
                    interventions.append("Enforce strict gluten elimination from daily meals.")
                elif "COMT" in marker:
                    genetic_alerts.append(f"COMT ({m.get('value') or 'variant'}) affects stress hormone clearance rate.")
                    interventions.append("Implement scheduled sensory decompression windows to prevent high-stress overload.")
                elif "FUT2" in marker:
                    genetic_alerts.append(f"FUT2 variant affects secretor status and gut microbiome diversity.")
                    interventions.append("Supplement targeted spore-based probiotics to support gut microflora stability.")
                elif "VDR" in marker:
                    genetic_alerts.append("VDR variant reduces Vitamin D receptor efficiency.")
                    interventions.append("Administer active liquid Vitamin D3 with K2 cofactors under clinical guidance.")
                elif "FADS1" in marker or "FADS2" in marker:
                    genetic_alerts.append("FADS pathway shift limits standard omega-3 conversion kinetics.")
                    interventions.append("Introduce high-purity, direct EPA/DHA marine lipids.")
                elif "TNF" in marker or "ALPHA" in marker:
                    genetic_alerts.append("TNF-alpha mutation indicates elevated baseline systemic inflammation.")
                    interventions.append("Prioritize anti-inflammatory MENA dietary frameworks like clean lentil soups and extra virgin olive oil.")

    if not alerts:
        alerts.append("Behavioral indicators remain within stable, baseline parameters.")
    if not interventions:
        interventions.append("Continue current sensory pacing and visual schedule models.")

    # Warm, empathetic clinical message referencing child's details
    name = data.child.name
    if risk_level == "high":
        message = f"We noticed {name} had some difficulty recently, particularly with sensory load or sleep. Focus on low-sensory environments."
    elif risk_level == "medium":
        message = f"{name} is demonstrating moderate sensitivity. Consider adding additional sensory breaks and monitoring hydration."
    else:
        message = f"Keep up the great work! {name} is showing stable patterns and steady behavioral engagement."

    return {
        "riskScore": int(risk_score),
        "riskLevel": risk_level,
        "message": message,
        "alerts": alerts + genetic_alerts,
        "interventions": interventions
    }
