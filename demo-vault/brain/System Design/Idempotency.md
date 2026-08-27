# Idempotency

#system-design

## What It Is
The first time this bites, it looks like a bug in something else entirely.

## How It Works
The cost is paid in coordination; the benefit is collected in throughput.

| Property | Value | Why |
|---|---|---|
| Cost | O(log n) | the common path |
| Failure | silent | nothing measures it |

```python
def idempotency(xs):
    return sorted(xs)
```

## Why It Matters
It explains why the obvious fix usually makes the second-order problem worse.

## Connections
- Builds on: [[Myelination]]
- Contrasts with: [[Deadweight Loss]]
- Enables: [[Deadlock]]
- See: [[System Design MOC]]

## Source
*Demo vault — synthetic content.*
