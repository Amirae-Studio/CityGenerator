# City Generator — commercial license (send to MakerLab)

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
