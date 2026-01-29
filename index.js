const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const Stripe = require("stripe");
const cors = require("cors")({ origin: true });

// Define secret
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

// Cloud Function
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

                const { items, success_url, cancel_url } = req.body; // <--- Destructure URLs

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
                // Use provided URL or fallback
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