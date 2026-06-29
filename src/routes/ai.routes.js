const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const BehaviorLog = require('../models/BehaviorLog.model');
const GameScore = require('../models/GameScore.model');
const GeneticReport = require('../models/GeneticReport.model');
const ChildProfile = require('../models/ChildProfile.model');
const Notification = require('../models/Notification.model');
const { sendMeltdownAlertEmail } = require('../services/email.service');
const axios = require('axios');
const { getAuth } = require('firebase-admin/auth');
const admin = require('firebase-admin');
const User = require('../models/User.model');

// Helper to trigger email & in-app alerts if crisis score is high (>= 70)
const triggerHighRiskAlerts = async (child, score, interventions) => {
  if (score >= 70) {
    try {
      // 1. Fully populate parent profile credentials
      const populatedChild = await ChildProfile.findById(child._id || child)
        .populate('parentId', 'name email fcmToken');

      if (!populatedChild || !populatedChild.parentId) return;
      const parent = populatedChild.parentId;

      // 2. Persist an in-app database notice instance
      await Notification.create({
        userId: parent._id,
        title: 'High Risk Alert ⚠️',
        message: `Urgent: Sensory crisis score for ${child.name} has reached ${score}%. Review safety mitigation strategies.`,
        type: 'alert',
        relatedTo: 'system',
      });

      // 3. Dispatch Live Outbound Email Alert via Nodemailer Relay
      if (parent.email) {
        try {
          // Utilizes your beautiful pre-configured email service courier methods
          await sendMeltdownAlertEmail(parent.email, parent.name, child.name, score, interventions);
          console.log(`✉️ Crisis alert email successfully dispatched to: ${parent.email}`);
        } catch (mailErr) {
          console.error('⚠️ Secondary Mail Delivery failed:', mailErr.message);
        }
      }

      // 4. Dispatch Firebase Real-time Device Push Payload
      if (parent.fcmToken) {
        const pushPayload = {
          token: parent.fcmToken,
          notification: {
            title: `⚠️ Critical Care Alert: ${child.name}`,
            body: `Sensory score hit ${score}%. Check out recommended tracking decompression interventions right away.`
          },
          data: {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            type: 'behavior_alert',
            childId: String(child._id)
          }
        };

        const response = await admin.messaging().send(pushPayload);
        console.log(`🔔 [FCM SUCCESS] Sent tray banner alert safely: ${response}`);
      } else {
        console.warn(`ℹ️ Notification skipped: Parent profile document has no saved device token identifier.`);
      }
    } catch (err) {
      console.error('CRITICAL: High-risk alert operational delivery layout broken:', err);
    }
  }
};

// GET /api/ai/health — Public endpoint: is Gemini reachable?
router.get('/health', async (req, res) => {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.json({ gemini: false, reason: 'GEMINI_API_KEY not set in .env', fallback: 'rule-based' });
  }
  try {
    const startMs = Date.now();
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: 'Reply with exactly: {"status":"ok"}' }] }],
        generationConfig: { responseMimeType: 'application/json' }
      },
      { timeout: 10000 }
    );
    const elapsed = Date.now() - startMs;
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    res.json({ gemini: true, latency: elapsed + 'ms', response: text, model: 'gemini-2.5-flash' });
  } catch (err) {
    const errDetail = err.response?.data?.error?.message || err.message;
    const errStatus = err.response?.status || 'N/A';
    res.json({ gemini: false, reason: errDetail, httpStatus: errStatus, fallback: 'rule-based' });
  }
});

router.use(protect);

// POST /api/ai/predict/:childId — Behavioral risk prediction
router.post('/predict/:childId', async (req, res, next) => {
  try {
    const childId = req.params.childId;
    const child = await ChildProfile.findById(childId);
    if (!child) return res.status(404).json({ error: 'Child profile not found' });

    const logs = await BehaviorLog.find({ childId }).sort('-date').limit(7);
    const scores = await GameScore.find({ childId }).sort('-createdAt').limit(5);
    const geneticReport = await GeneticReport.findOne({ childId }).sort('-createdAt');

    if (!logs.length) {
      return res.json({
        success: true,
        data: {
          riskScore: 0,
          riskLevel: 'insufficient_data',
          message: req.query.lang === 'ar' ? 'بيانات غير كافية للتنبؤ' : 'Not enough data for prediction',
          alerts: [],
          interventions: []
        }
      });
    }

    // Check and call the local FastAPI predictive AI microservice container
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    try {
      console.log(`🔮 Querying FastAPI AI microservice at ${aiServiceUrl}/predict...`);
      const response = await axios.post(`${aiServiceUrl}/predict`, {
        child: {
          name: child.name,
          age: child.calculatedAge || child.age || 6,
          asdLevel: child.asdLevel
        },
        logs: logs.map(l => ({
          mood: l.mood,
          sleepHours: l.sleepHours || 8.0,
          meltdowns: l.meltdowns || 0,
          notes: l.notes || '',
          medication: l.medication || []
        })),
        scores: scores.map(s => ({
          gameName: s.gameName,
          score: s.score,
          reactionTimeMs: s.reactionTimeMs || 0
        })),
        geneticReport: geneticReport ? {
          parsedMarkers: geneticReport.parsedMarkers
        } : null
      }, { timeout: 10000 });

      if (response.data) {
        const prediction = response.data;
        console.log('✅ FastAPI prediction received — Risk Score:', prediction.riskScore, '| Level:', prediction.riskLevel);
        
        // Trigger email & in-app alerts if risk is high
        await triggerHighRiskAlerts(child, prediction.riskScore, prediction.interventions);

        return res.json({
          success: true,
          data: {
            ...prediction,
            source: 'fastapi_microservice',
            generatedAt: new Date(),
            basedOnDays: logs.length,
            disclaimer: 'AI prediction is assistive only. Clinical judgment required.',
          }
        });
      }
    } catch (err) {
      console.error(`⚠️ FastAPI service error: ${err.message}. Falling back to rule-based prediction engine...`);
    }

    // Fallback: Rule-based risk scoring (if Gemini is missing or failed)
    console.log('⚡ Running fallback rule-based risk prediction...');
    let riskScore = 0;
    const alerts = [];

    const avgSleep = logs.reduce((s, l) => s + (l.sleepHours || 7), 0) / logs.length;
    const totalMeltdowns = logs.reduce((s, l) => s + (l.meltdowns || 0), 0);
    const poorSleepDays = logs.filter(l => (l.sleepHours || 7) < 6).length;

    if (avgSleep < 6) {
      riskScore += 25;
      alerts.push(req.query.lang === 'ar' ? 'تنبيه: قلة النوم المزمنة (المعدل أقل من 6 ساعات)' : 'Chronic poor sleep detected (avg < 6h)');
    } else if (avgSleep < 7) {
      riskScore += 10;
    }

    if (totalMeltdowns > 5) {
      riskScore += 30;
      alerts.push(req.query.lang === 'ar' ? `تنبيه: تم رصد عدد ${totalMeltdowns} نوبات انهيار في آخر 7 أيام` : `${totalMeltdowns} meltdowns in past 7 days`);
    } else if (totalMeltdowns > 2) {
      riskScore += 15;
    }

    if (poorSleepDays >= 5) {
      riskScore += 20;
      alerts.push(req.query.lang === 'ar' ? `تنبيه: نوم مضطرب لـ ${poorSleepDays} أيام متتالية` : `Poor sleep for ${poorSleepDays} consecutive days`);
    }

    const recentMoods = logs.slice(0, 3).map(l => l.mood);
    const negativeMoods = recentMoods.filter(m => ['sad', 'very_sad', 'anxious', 'angry'].includes(m)).length;
    if (negativeMoods >= 2) {
      riskScore += 20;
      alerts.push(req.query.lang === 'ar' ? 'نمط مزاج سلبي مستمر' : 'Persistent negative mood pattern');
    }

    riskScore = Math.min(riskScore, 100);
    const riskLevel = riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low';

    const interventions = [];
    if (riskScore >= 70) {
      interventions.push(
        req.query.lang === 'ar' ? 'استشارة فورية مع فريق الرعاية المتابع' : 'Immediate consultation with care team recommended',
        req.query.lang === 'ar' ? 'مراجعة الأدوية ومستوى نظافة النوم' : 'Review medication and sleep hygiene'
      );
    }
    if (riskScore >= 40) {
      interventions.push(
        req.query.lang === 'ar' ? 'جدولة جلسة علاج سلوكي هذا الأسبوع' : 'Schedule therapy session this week',
        req.query.lang === 'ar' ? 'تقييم المحفزات الغذائية المحتملة' : 'Assess dietary triggers'
      );
    }
    interventions.push(req.query.lang === 'ar' ? 'الاستمرار في تدوين المؤشرات اليومية' : 'Continue daily behavior logging for trend analysis');

    const arMsg = riskScore >= 70
      ? `⚠️ خطر انهيار مرتفع. ${alerts[0] || 'تم رصد عوامل خطر متعددة.'}`
      : riskScore >= 40
        ? `⚡ خطر سلوكي متوسط. يرجى المتابعة عن كثب.`
        : `✅ خطر سلوكي منخفض. تابع خطة الرعاية الحالية.`;

    const enMsg = riskScore >= 70
      ? `⚠️ High meltdown risk detected. ${alerts[0] || 'Multiple risk factors identified.'}`
      : riskScore >= 40
        ? `⚡ Moderate behavioral risk. Monitor closely.`
        : `✅ Low behavioral risk. Continue current care plan.`;

    console.log('⚡ Fallback result — Risk Score:', riskScore, '| Level:', riskLevel);

    // Trigger email & in-app alerts if risk is high
    await triggerHighRiskAlerts(child, riskScore, interventions);

    res.json({
      success: true,
      data: {
        riskScore,
        riskLevel,
        alerts,
        interventions,
        message: req.query.lang === 'ar' ? arMsg : enMsg,
        source: 'rule-based',
        basedOnDays: logs.length,
        generatedAt: new Date(),
        disclaimer: 'AI prediction is assistive only. Clinical judgment required.',
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
