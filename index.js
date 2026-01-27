const functions = require("firebase-functions");
const Stripe = require("stripe");

exports.createCheckout = functions.https.onRequest(async (req, res) => {
        try {
            // Fetch secret at runtime
            const secret = await functions.config().stripe?.secret;
            const stripe = new Stripe(secret || "sk_test_FAKE"); // fallback

            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                payment_method_types: ["card", "venmo"],
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: { name: "Test Product" },
                            unit_amount: 5000,
                        },
                        quantity: 1,
                    },
                ],
                success_url: "https://example.com/success",
                cancel_url: "https://example.com/cancel",
            });

            res.json({ url: session.url });
        } catch (err) {
            console.error(err);
            res.status(500).send("Stripe error");
        }
    });