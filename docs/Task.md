## 🎯 Goal
Migrate existing Bon Appétit API integration from **v1** to **v2**, updating all API fetch logic and associated **Zod schemas** to match the new data contracts for **menus**, **cafes**, and **items**.

---

## 🧱 Context
- Previous integration used **v1** of Bon Appétit’s API, which is now behind authentication.  
- A temporary workaround parsed HTML-encoded JSON responses.  
- The new implementation must use **v2**, which requires **Basic Authorization**.

---

## 🔐 Authentication
Use **Basic Auth** credentials stored as GitHub environment secrets:

BON_APPETIT_API_USERNAME  
BON_APPETIT_API_PASSWORD

These should be injected at runtime from the environment and **encoded** for use in the request headers.

---

## 🌐 API Endpoints
Use the following Bon Appétit v2 endpoints:

| Type   | Endpoint |
|--------|----------|
| Cafes  | https://cafemanager-api.cafebonappetit.com/api/2/cafes?cafe={cafeIndex} |
| Items  | https://cafemanager-api.cafebonappetit.com/api/2/items?item={itemIndex} |
| Menus  | https://cafemanager-api.cafebonappetit.com/api/2/menus?menu={menuIndex} |

Each `{...Index}` parameter will be dynamically provided at runtime.

---

## 🧩 Schema Update Task
- Existing Zod schema (for v1) is located at:  
  source/menus-bonapp/types-bonapp.ts
- Update or replace schemas for:  
  - menus  
  - cafes  
  - items

Ensure new schemas match **v2 response formats** precisely.

---

## 📂 Reference Code
Use the original v1 implementation as reference only:

- https://github.com/frog-pond/ccc-server/blob/b0327c551a33dd02777cb1660d36285857622a66/modules/node_modules/%40frogpond/ccci-carleton-college/v1/menu/index.js  
- https://github.com/frog-pond/ccc-server/blob/b0327c551a33dd02777cb1660d36285857622a66/modules/node_modules/@frogpond/ccc-bonapp/index.js

> ⚠️ Note: Response contracts differ — do **not** assume field parity with v1.

---

## ⚙️ Implementation Requirements
- Use modern fetch syntax (`fetch` / `node-fetch`) with Basic Auth headers.  
- Handle and log API errors gracefully.  
- Confirm that Zod validation succeeds for sample v2 responses.  
- Modularize schemas and fetch logic for reuse across endpoints.  
- Write **TypeScript-safe wrappers** that return typed data.

---

## 🧪 Testing
Validate all three endpoints (**menus**, **cafes**, **items**) return data matching the updated Zod schemas.

Add unit tests verifying:  
- Successful API call and schema validation  
- Proper rejection for invalid responses  

---

## ✅ Deliverables
- Updated fetch functions for **v2** endpoints  
- Updated Zod schemas in types-bonapp.ts  
- Verified **type-safe responses**  
- Test coverage for all endpoint integrations
