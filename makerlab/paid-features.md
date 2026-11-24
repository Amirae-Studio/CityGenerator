# City Generator — paid features (send to MakerLab)

Two paid features, each with its own `functionKey` (Paid Features › Step 1).
App membership type: `partial_buyout` (the app is free; users buy features).

## 1. City Generator Pro

| Field           | Value |
| --------------- | ----- |
| App ID          | `city-generator` |
| functionKey     | `pro_pack` |
| functionName    | City Generator Pro |
| functionDesc    | 8 premium frame looks, 5 extra edge shapes, 6 extra textures, your own SVG pattern on the frame, and Optimize roads (main roads only). |
| originPrice     | 6.00 USD |
| Enable discount | No |

In code: `PRO_KEY` in `lib/makerlab/types.ts`; every Pro option calls
`requestAccess("pro_pack")` before it's applied, and locks/badges use
`isUnlocked("pro_pack")`, refreshed from `onPaymentChange`.

## 2. Commercial license

Real payments run on MakerLab's side: the price comes from the MakerLab
platform, and the host takes the payment. The app only calls
`sdk.requestAccess("commercial_eeee")`. To switch it on, send MakerLab the
details below (Paid Features › Step 1) when publishing on the Generator
Management Platform.

| Field           | Value |
| --------------- | ----- |
| App ID          | `city-generator` |
| functionKey     | `commercial_eeee` (MakerLab's reserved key for the commercial license) |
| functionName    | Commercial License |
| functionDesc    | Sell physical prints of city models made with City Generator. |
| originPrice     | 99.00 USD |
| Enable discount | No |

**Export limit:** none for now (unlimited exports for everyone). A limit
(for example 3 per day) can be set on the platform later; the app needs no
code change — the host enforces it and offers the commercial license when a
user runs out.

**License text (permissionScope, HTML):**

```html
<p>Permission to sell and otherwise use physical prints of models made with City Generator for commercial purposes during an active license.</p>
<p>Map data © OpenStreetMap contributors and the other sources credited in the app. <strong>Attribution required.</strong></p>
```
