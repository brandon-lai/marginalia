# Deadlock

#operating-systems

## What It Is
What makes this stick is that the same shape shows up in three unrelated places.

## How It Works
The cost is paid in coordination; the benefit is collected in throughput.

| Property | Value | Why |
|---|---|---|
| Cost | O(1) | after the index is warm |
| Failure | loud | it fails closed |

```python
def deadlock(xs):
    return sorted(xs)
```

## Why It Matters
It explains why the obvious fix usually makes the second-order problem worse.

## Connections
- Compare: [[Idempotency]]
- Compare: [[Comparative Advantage]]
- See: [[Operating Systems MOC]]

## Source
*Demo vault — synthetic content.*
