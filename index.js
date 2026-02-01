/* =============================
   IMPORTS
============================= */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const functions = require("firebase-functions/v1"); // ✅ IMPORTANT
const admin = require("firebase-admin");

const Stripe = require("stripe");
const cors = require("cors")({ origin: true });

/* =============================
   INIT
============================= */
admin.initializeApp();
const db = admin.firestore();

// Stripe secret
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

/* =============================
   STRIPE CHECKOUT (V2)
============================= */
exports.createCheckout = onRequest(
    {
        region: "us-central1",
        secrets: [STRIPE_SECRET_KEY],
    },
    (req, res) => {
        cors(req, res, async () => {
            try {
                if (req.method !== "POST") {
                    return res.status(405).json({ error: "Method not allowed" });
                }

                const stripe = new Stripe(STRIPE_SECRET_KEY.value());

                const { items, success_url, cancel_url } = req.body;

                if (!items || !Array.isArray(items) || items.length === 0) {
                    return res.status(400).json({ error: "No items provided" });
                }

                const line_items = items.map((item) => ({
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: item.title || "Product",
                        },
                        unit_amount: Math.round(item.price * 100),
                    },
                    quantity: item.quantity || 1,
                }));

                const session = await stripe.checkout.sessions.create({
                    mode: "payment",
                    payment_method_types: ["card"],
                    line_items,
                    success_url: success_url || "https://jace-usa.com/",
                    cancel_url: cancel_url || "https://jace-usa.com/",
                });

                return res.status(200).json({ url: session.url });
            } catch (err) {
                console.error("🔥 STRIPE ERROR:", err);
                return res.status(500).json({ error: err.message });
            }
        });
    }
);

/* -----------------------------
   HELPER: SCORE CALCULATION
--------------------------------*/
function computeScore(video) {
    const stats = video.stats || {};

    const views = stats.views || 0;
    const likes = stats.likes || 0;
    const avgWatch = stats.avgWatch || 0;
    const completionRate = stats.completionRate || 0;

    const likeRate = views > 0 ? likes / views : 0;

    return (
        avgWatch * 0.4 +
        completionRate * 0.25 +
        likeRate * 0.15
    );
}

/* -----------------------------
   1️⃣ LOG USER INTERACTION (V1 CALLABLE)
--------------------------------*/
exports.logInteraction = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User must be logged in"
        );
    }

    const { videoId, watchPercent, liked, completed } = data;
    const videoRef = db.collection("videos").doc(videoId);

    await db.runTransaction(async (t) => {
        const snap = await t.get(videoRef);
        if (!snap.exists) return;

        const video = snap.data();
        const stats = video.stats || {
            views: 0,
            likes: 0,
            avgWatch: 0,
            completionRate: 0,
        };

        const newViews = stats.views + 1;
        const newAvgWatch =
            (stats.avgWatch * stats.views + watchPercent) / newViews;

        const newCompletionRate = completed
            ? (stats.completionRate * stats.views + 1) / newViews
            : (stats.completionRate * stats.views) / newViews;

        t.update(videoRef, {
            "stats.views": newViews,
            "stats.likes": liked ? stats.likes + 1 : stats.likes,
            "stats.avgWatch": newAvgWatch,
            "stats.completionRate": newCompletionRate,
        });
    });

    return { success: true };
});

/* -----------------------------
   2️⃣ AUTO UPDATE VIDEO SCORE (V1 FIRESTORE)
--------------------------------*/
exports.updateVideoScore = functions.firestore
    .document("videos/{videoId}")
    .onUpdate(async (change) => {
        const video = change.after.data();
        const score = computeScore(video);

        let phase = video.phase || 1;
        if (video.stats.avgWatch > 0.6) phase = 2;
        if (video.stats.avgWatch > 0.75) phase = 3;

        await change.after.ref.update({
            score,
            phase,
        });
    });

/* -----------------------------
   3️⃣ FOR YOU FEED GENERATOR (V1 CALLABLE)
--------------------------------*/
exports.getForYouFeed = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User must be logged in"
        );
    }

    const uid = context.auth.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    const user = userSnap.data() || {};
    const interests = user.interests || {};

    const snapshot = await db
        .collection("videos")
        .orderBy("score", "desc")
        .limit(50)
        .get();

    const ranked = snapshot.docs.map((doc) => {
        const video = doc.data();
        let interestBoost = 1;

        (video.tags || []).forEach((tag) => {
            if (interests[tag]) {
                interestBoost += interests[tag];
            }
        });

        const hoursOld =
            (Date.now() - video.createdAt.toMillis()) / 36e5;
        const freshnessBoost = Math.max(1.5 - hoursOld * 0.05, 1);

        return {
            id: doc.id,
            creatorId: video.creatorId,
            finalScore: video.score * interestBoost * freshnessBoost,
        };
    });

    ranked.sort((a, b) => b.finalScore - a.finalScore);

    return ranked.slice(0, 10);
});

/* -----------------------------
   4️⃣ CREATE VIDEO RECORD (V1 CALLABLE)
--------------------------------*/
exports.createVideo = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "Login required"
        );
    }

    const uid = context.auth.uid;
    const { title, description, tags, productId } = data;

    const videoRef = await db.collection("videos").add({
        creatorId: uid,
        title,
        description,
        tags,
        productId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        phase: 1,
        score: 0,
        stats: {
            views: 0,
            likes: 0,
            avgWatch: 0,
            completionRate: 0,
        },
    });

    return { videoId: videoRef.id };
});
