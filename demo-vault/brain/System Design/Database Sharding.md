# Database Sharding

#system-design

## What It Is
The mechanism is mechanical; the interesting part is when it stops being the right choice.

## How It Works
The tradeoff is between doing work now and doing more work later under worse information.

| Property | Value | Why |
|---|---|---|
| Cost | amortized O(1) | worst case only |
| Failure | delayed | nothing measures it |

```python
def database_sharding(xs):
    return sorted(xs)
```

## Why It Matters
It explains why the obvious fix usually makes the second-order problem worse.

## Connections
- Compare: [[Load Balancing]]
- Contrasts with: [[Seeing Like a State]]
- See: [[System Design MOC]]

## Source
*Demo vault — synthetic content.*
