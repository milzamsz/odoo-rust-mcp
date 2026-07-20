# API Contracts

## 1. Tool response envelope

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "request_id": "req_01J...",
    "instance": "production",
    "tool": "mrp_order_get",
    "pack": "manufacturing",
    "capability_snapshot": "cap_01J...",
    "policy_revision": "pol_01J...",
    "registry_revision": 18
  },
  "warnings": []
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "CAPABILITY_MISSING_MODULE",
    "message": "The Manufacturing pack requires the mrp module.",
    "retryable": false,
    "details": {
      "required_module": "mrp"
    }
  },
  "meta": {
    "request_id": "req_01J..."
  }
}
```

## 2. Confirmation response

```json
{
  "ok": false,
  "error": {
    "code": "POLICY_CONFIRMATION_REQUIRED",
    "message": "Publishing requires confirmation.",
    "retryable": true,
    "details": {
      "impact": {
        "website": "Main Website",
        "page": "/services",
        "current_state": "draft",
        "target_state": "published",
        "audience": "public"
      },
      "confirmation_token": "eyJ...",
      "expires_at": "2026-07-20T16:30:00+07:00"
    }
  }
}
```

## 3. Common inputs

```json
{
  "instance": "production",
  "company_id": 1,
  "dry_run": false,
  "confirmation_token": null,
  "idempotency_key": null
}
```

Only include fields that make sense for the tool. Do not force irrelevant
common fields into every schema.

## 4. Search contract

```json
{
  "domain": [],
  "fields": ["id", "name"],
  "limit": 50,
  "cursor": null,
  "order": "id asc"
}
```

Server restrictions:

- domain operators are validated;
- sensitive fields are denied;
- maximum limit applies;
- deterministic order is required.

## 5. Money contract

```json
{
  "amount": "1250.00",
  "currency_id": 1,
  "currency_code": "USD",
  "company_id": 3
}
```

Use decimal strings in external contracts where precision matters.

## 6. Quantity contract

```json
{
  "quantity": "10.500",
  "uom_id": 7,
  "uom_name": "kg"
}
```

Never compare or aggregate quantities across incompatible units without explicit
conversion.

## 7. Record reference

```json
{
  "model": "mrp.production",
  "id": 125,
  "display_name": "WH/MO/00125",
  "write_date": "2026-07-20T07:12:44Z"
}
```

## 8. Audit context

Each request receives server-generated:

- request ID;
- actor ID;
- client ID;
- transport;
- instance;
- registry revision;
- capability snapshot;
- policy revision.

Client-supplied audit identifiers are supplemental, not authoritative.
