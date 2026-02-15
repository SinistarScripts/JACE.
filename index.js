/* 
=============================
   IMPORTS
============================= */
const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");

const admin = require("firebase-admin");
const Stripe = require("stripe");
const cors = require("cors")({ origin: true });

/* =============================
   INIT
============================= */
admin.initializeApp();
const db = admin.firestore();

/* =============================
   SECRETS
============================= */
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const GIPHY_KEY = defineSecret("GIPHY_KEY");

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

/* =============================
   GIPHY SEARCH (V2 CALLABLE)
============================= */
exports.searchGifs = onCall(
    {
        region: "us-central1",
        secrets: [GIPHY_KEY],
    },
    async (request) => {
        const { auth, data } = request;

        if (!auth) {
            throw new Error("User must be logged in");
        }

        const query = data?.query;

        if (!query || query.length > 50) {
            throw new Error("Invalid search query");
        }

        // Basic keyword blocklist
        const blocked = ["nsfw", "porn", "xxx", "nude"];
        if (blocked.includes(query.toLowerCase())) {
            throw new Error("Search term not allowed");
        }

        const response = await fetch(
            `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY.value()}&q=${encodeURIComponent(query)}&limit=20&rating=g`
        );

        const result = await response.json();

        return result.data.map((gif) => ({
            id: gif.id,
            preview: gif.images.fixed_height_small.url,
            full: gif.images.fixed_height.url,
        }));
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
   1️⃣ LOG USER INTERACTION
--------------------------------*/
exports.logInteraction = onCall(async (request) => {
    const { auth, data } = request;

    if (!auth) {
        throw new Error("User must be logged in");
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
   2️⃣ AUTO UPDATE VIDEO SCORE
--------------------------------*/
exports.updateVideoScore = onDocumentUpdated(
    {
        document: "videos/{videoId}",
        region: "us-central1",
    },
    async (event) => {
        const video = event.data.after.data();
        if (!video) return;

        const score = computeScore(video);

        const stats = video.stats || {};
        let phase = video.phase || 1;
        if (stats.avgWatch > 0.6) phase = 2;
        if (stats.avgWatch > 0.75) phase = 3;

        await event.data.after.ref.update({
            score,
            phase,
        });
    }
);

/* -----------------------------
   3️⃣ FOR YOU FEED GENERATOR
--------------------------------*/
exports.getForYouFeed = onCall(async (request) => {
    const { auth } = request;

    if (!auth) {
        throw new Error("User must be logged in");
    }

    const uid = auth.uid;
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
   4️⃣ CREATE VIDEO RECORD
--------------------------------*/
exports.createVideo = onCall(async (request) => {
    const { auth, data } = request;

    if (!auth) {
        throw new Error("Login required");
    }

    const uid = auth.uid;
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