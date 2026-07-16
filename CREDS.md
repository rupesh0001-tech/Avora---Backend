# Backend Integration Credentials Setup Guide

This guide explains how to get the required credentials for background workers (email, calendar, payments) and set them up in your `.env` file.

---

## 1. Email Integration (Resend API Key)

We use **Resend** for sending transactional booking confirmation, cancellation, and reminder emails.

### How to get it:
1. Sign up/Log in to [Resend](https://resend.com).
2. Go to the **API Keys** section in the sidebar.
3. Click **Create API Key**.
4. Set description/permission and click **Add**.
5. Copy the generated key (starts with `re_`) and add it to your `.env` file:
   ```env
   RESEND_API_KEY="re_your_api_key_here"
   ```

---

## 2. Payment Gateway (Razorpay Keys)

We use **Razorpay** to process paid booking links and capture transaction webhooks asynchronously.

### How to get Key ID & Secret:
1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com) (switch to **Test Mode** for local development).
2. Navigate to **Account & Settings** > **API Keys**.
3. Click **Generate Key** or **Regenerate Key**.
4. Copy the `Key ID` and `Key Secret` to `.env`:
   ```env
   RAZORPAY_KEY_ID="rzp_test_xxxxxx"
   RAZORPAY_KEY_SECRET="your_razorpay_secret"
   ```

### How to configure Webhooks:
1. Navigate to **Account & Settings** > **Webhooks** in the Razorpay dashboard.
2. Click **Add New Webhook**.
3. Set the Webhook URL to: `https://<your-public-ngrok-url>/api/webhooks/razorpay`.
4. In **Active Events**, select:
   - `payment.captured`
   - `order.paid`
5. Set a custom secret string in the **Secret** field.
6. Click **Create Webhook**.
7. Copy the webhook secret to `.env`:
   ```env
   RAZORPAY_WEBHOOK_SECRET="your_webhook_secret_here"
   ```

---

## 3. Google Calendar Sync (OAuth 2.0 Credentials)

We use Google OAuth APIs to synchronize bookings automatically with a host's Google Calendar.

### How to get it:
1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create or select a project.
3. Search for **Google Calendar API** and click **Enable**.
4. Go to the **OAuth consent screen** configurations, set up user type (External), and configure app name.
5. In **Credentials** tab, click **+ Create Credentials** > **OAuth client ID**.
6. Set Application Type to **Web application**.
7. Add **Authorized Redirect URIs**:
   - `http://localhost:5001/api/auth/google/callback` (or your backend redirect URI).
8. Click **Create** and copy the Client ID and Client Secret:
   ```env
   GOOGLE_CLIENT_ID="your_google_client_id"
   GOOGLE_CLIENT_SECRET="your_google_client_secret"
   GOOGLE_REDIRECT_URI="http://localhost:5001/api/auth/google/callback"
   ```
