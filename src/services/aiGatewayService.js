const axios = require('axios');
const FormData = require('form-data');

// Use your existing AI_SERVICE_URL for the predictive microservice
const AI_SERVICE_URL = process.env.AI_SERVICE_URL
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL
const RAG_API_SECRET_KEY = process.env.RAG_API_SECRET_KEY

/**
 * Forwards sensory telemetry logs directly to the serverless predictive analytics model.
 */
async function fetchSensoryCrisisPrediction(predictionPayload) {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/predict`, predictionPayload, {
            headers: { 'Content-Type': 'application/json' }
        });
        return response.data;
    } catch (error) {
        console.error('AI Gateway Error [Predictive Analytics]:', error.message);
        throw new Error('Failed to compute predictive crisis indicators from the analytics model.');
    }
}

/**
 * Proxies file buffers directly onto the Dockerized RAG Nutrition Engine pipeline.
 */
async function generateGeneticNutritionPlan(fileBuffer, originalName, mimeType, patientId) {
    try {
        const form = new FormData();
        form.append('patient_id', patientId);
        form.append('file', fileBuffer, {
            filename: originalName,
            contentType: mimeType,
        });

        const response = await axios.post(`${RAG_SERVICE_URL}/generate-nutrition-plan`, form, {
            headers: {
                ...form.getHeaders(),
                'X-API-Key': RAG_API_SECRET_KEY,
                'Bypass-Tunnel-Warning': 'true'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        return response.data;
    } catch (error) {
        console.error('AI Gateway Error [RAG Engine]:', error.message);
        throw new Error('Failed to run retrieval-augmented generation on the genetic report.');
    }
}

module.exports = {
    fetchSensoryCrisisPrediction,
    generateGeneticNutritionPlan
};