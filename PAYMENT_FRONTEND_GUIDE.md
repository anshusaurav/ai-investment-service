# Payment Integration — Frontend Guide

This guide covers everything a frontend developer needs to integrate Razorpay payments with this backend.

---

## Base URL

```
https://<your-api-domain>/api/payment
```

All protected endpoints require a Firebase ID token as a Bearer token:

```
Authorization: Bearer <firebase_id_token>
```

---

## Payment Flow Overview

```
1.  [Frontend]  User clicks "Pay"
2.  [Frontend]  POST /api/payment/create-order  →  get order_id
3.  [Frontend]  Open Razorpay checkout with order_id
4.  [User]      Completes payment in Razorpay modal
5.  [Frontend]  Razorpay calls your handler with payment response
6.  [Frontend]  POST /api/payment/verify  →  confirm success
7.  [Backend]   Webhooks independently confirm final state (authoritative)
```

> **Important:** Always verify on the server (step 6). Never treat the Razorpay
> frontend callback alone as confirmation of payment success.

---

## Step 1 — Create an Order

```http
POST /api/payment/create-order
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

| Field      | Type   | Required | Description                          |
|------------|--------|----------|--------------------------------------|
| `amount`   | number | Yes      | Amount **in rupees** (e.g. `499`)    |
| `currency` | string | No       | Default: `"INR"`                     |
| `receipt`  | string | No       | Your internal reference ID           |
| `notes`    | object | No       | Key-value metadata (max 15 keys)     |

```json
{
  "amount": 499,
  "currency": "INR",
  "receipt": "sub_pro_monthly_uid123",
  "notes": {
    "plan": "pro",
    "userId": "uid123"
  }
}
```

### Response

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": "order_PXqZ8kL2mNvBcD",
      "amount": 49900,
      "currency": "INR",
      "receipt": "sub_pro_monthly_uid123",
      "status": "created"
    },
    "savedOrder": {
      "_id": "...",
      "razorpayOrderId": "order_PXqZ8kL2mNvBcD",
      "userId": "uid123",
      "amount": 499,
      "amountInPaise": 49900,
      "status": "created"
    }
  }
}
```

---

## Step 2 — Open Razorpay Checkout

Include the Razorpay script in your HTML once:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

Then open the payment modal with the `order.id` from step 1:

```javascript
async function initiatePayment(amount, planName) {
  // Step 1: Create order
  const res = await fetch('/api/payment/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + await getFirebaseToken()
    },
    body: JSON.stringify({ amount, notes: { plan: planName } })
  });

  const { data } = await res.json();
  const order = data.order;

  // Step 2: Open Razorpay modal
  const options = {
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,  // your Key ID (not secret)
    amount: order.amount,     // in paise (already converted by backend)
    currency: order.currency,
    name: 'Your App Name',
    description: `${planName} Plan Subscription`,
    image: 'https://yourdomain.com/logo.png',  // optional
    order_id: order.id,       // REQUIRED — ties payment to order
    handler: async function (response) {
      // Step 3: Verify on server
      await verifyPayment(response);
    },
    prefill: {
      name: currentUser.displayName,
      email: currentUser.email,
      contact: ''   // optional phone number
    },
    theme: {
      color: '#4F46E5'
    },
    modal: {
      ondismiss: function () {
        console.log('Payment modal closed');
      }
    }
  };

  const rzp = new window.Razorpay(options);

  rzp.on('payment.failed', function (response) {
    console.error('Payment failed:', response.error);
    // Show error UI — but wait for server webhook for final state
  });

  rzp.open();
}
```

---

## Step 3 — Verify Payment

Call this immediately after the Razorpay `handler` callback fires:

```http
POST /api/payment/verify
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

All three fields come directly from the Razorpay `handler` response:

| Field                  | Type   | Description                          |
|------------------------|--------|--------------------------------------|
| `razorpay_order_id`    | string | Order ID (same as step 1)            |
| `razorpay_payment_id`  | string | Payment ID assigned by Razorpay      |
| `razorpay_signature`   | string | HMAC signature from Razorpay         |

```javascript
async function verifyPayment(razorpayResponse) {
  const res = await fetch('/api/payment/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + await getFirebaseToken()
    },
    body: JSON.stringify({
      razorpay_order_id: razorpayResponse.razorpay_order_id,
      razorpay_payment_id: razorpayResponse.razorpay_payment_id,
      razorpay_signature: razorpayResponse.razorpay_signature
    })
  });

  const result = await res.json();

  if (result.data.verified) {
    // Payment verified — update UI, redirect to success page
    showSuccessScreen();
  } else {
    showErrorScreen('Payment verification failed');
  }
}
```

### Response

```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "verified": true,
    "payment": {
      "id": "pay_PXqZ8kL2mNvBcD",
      "order_id": "order_PXqZ8kL2mNvBcD",
      "amount": 49900,
      "currency": "INR",
      "status": "captured",
      "method": "upi",
      "email": "user@example.com"
    }
  }
}
```

---

## Get Payment History

Retrieve the authenticated user's payments and orders:

```http
GET /api/payment/history?page=1&limit=20
Authorization: Bearer <token>
```

### Query Parameters

| Param   | Default | Max | Description         |
|---------|---------|-----|---------------------|
| `page`  | `1`     | —   | Page number         |
| `limit` | `20`    | `100` | Records per page  |

### Response

```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "...",
        "razorpayPaymentId": "pay_xxx",
        "razorpayOrderId": "order_xxx",
        "userId": "uid123",
        "amount": 49900,
        "currency": "INR",
        "status": "captured",
        "method": "card",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "orders": [
      {
        "_id": "...",
        "razorpayOrderId": "order_xxx",
        "userId": "uid123",
        "amount": 499,
        "amountInPaise": 49900,
        "status": "paid",
        "createdAt": "2024-01-15T10:29:00.000Z"
      }
    ],
    "page": 1,
    "limit": 20
  }
}
```

---

## Get Order Details

```http
GET /api/payment/order/:orderId
Authorization: Bearer <token>
```

Returns raw Razorpay order object.

---

## Get Payment Details

```http
GET /api/payment/payment/:paymentId
Authorization: Bearer <token>
```

Returns raw Razorpay payment object.

---

## Create Refund

```http
POST /api/payment/refund/:paymentId
Authorization: Bearer <token>
Content-Type: application/json
```

| Field    | Type   | Required | Description                                    |
|----------|--------|----------|------------------------------------------------|
| `amount` | number | No       | Partial refund in **rupees**. Omit for full refund |
| `notes`  | object | No       | Reason or metadata                             |

```json
{
  "amount": 499,
  "notes": { "reason": "Duplicate payment" }
}
```

---

## Webhook Events

Configure your webhook URL in the Razorpay Dashboard:
`Settings → Webhooks → Add New Webhook`

**Webhook URL:** `https://<your-api-domain>/api/payment/webhook`

**Events to subscribe:**

| Event                | When it fires                            |
|----------------------|------------------------------------------|
| `payment.authorized` | Payment held, auto-capture pending       |
| `payment.captured`   | Payment captured — funds received ✅     |
| `payment.failed`     | Payment declined or failed ❌            |
| `order.paid`         | All payments on an order are complete    |
| `refund.created`     | Refund initiated                         |
| `refund.processed`   | Refund credited to customer              |
| `refund.failed`      | Refund could not be processed            |

The backend verifies each webhook's `X-Razorpay-Signature` header before processing.

---

## Error Responses

All errors follow the same shape:

```json
{
  "success": false,
  "message": "Error description",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

| HTTP Status | Meaning                          |
|-------------|----------------------------------|
| `400`       | Bad request / validation failed  |
| `401`       | Missing or expired Firebase token|
| `500`       | Server error                     |

---

## React / Next.js — Complete Example

```tsx
'use client';
import { useEffect } from 'react';

declare global {
  interface Window { Razorpay: any; }
}

export function PaymentButton({ plan, amount }: { plan: string; amount: number }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const getToken = async () => {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    return auth.currentUser?.getIdToken();
  };

  const handlePayment = async () => {
    const token = await getToken();

    // 1. Create order
    const orderRes = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount, notes: { plan } })
    });
    const { data } = await orderRes.json();

    // 2. Open checkout
    const rzp = new window.Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: data.order.amount,
      currency: data.order.currency,
      order_id: data.order.id,
      name: 'Your App',
      description: `${plan} Plan`,
      handler: async (response: any) => {
        // 3. Verify
        const verifyRes = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(response)
        });
        const result = await verifyRes.json();
        if (result.data.verified) {
          window.location.href = '/dashboard?payment=success';
        }
      },
      prefill: { email: data.savedOrder.userId }
    });
    rzp.open();
  };

  return (
    <button onClick={handlePayment}>
      Pay ₹{amount}
    </button>
  );
}
```

---

## Environment Variables (Frontend)

```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

> Never expose `RAZORPAY_KEY_SECRET` to the frontend. It lives only in backend `.env`.

---

## Test Credentials

**Test Mode Cards:**

| Card Number          | Result  |
|----------------------|---------|
| `4111 1111 1111 1111`| Success |
| `4000 0000 0000 0002`| Failure |
| CVV: any 3 digits, Expiry: any future date |  |

**Test UPI IDs:**

| UPI ID              | Result  |
|---------------------|---------|
| `success@razorpay`  | Success |
| `failure@razorpay`  | Failure |