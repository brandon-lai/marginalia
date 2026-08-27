# Stack

#cs

## What It Is
Most of the difficulty here is bookkeeping, and most of the value is in noticing that early.

## How It Works
The failure mode is not that it breaks loudly but that it degrades in a way nobody measures.

| Property | Value | Why |
|---|---|---|
| Cost | amortized O(1) | the common path |
| Failure | delayed | it fails closed |

```python
def stack(xs):
    return sorted(xs)
```

## Why It Matters
It explains why the obvious fix usually makes the second-order problem worse.

## Connections
- Enables: [[Array and List]]
- Enables: [[CAP Theorem]]
- Builds on: [[Recursion]]
- See: [[CS MOC]]

## Source
*Demo vault — synthetic content.*
