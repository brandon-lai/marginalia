# Big O

#cs

## What It Is
Worth holding onto because it reframes a problem I kept solving badly by instinct.

## How It Works
The tradeoff is between doing work now and doing more work later under worse information.

| Property | Value | Why |
|---|---|---|
| Cost | O(1) | worst case only |
| Failure | delayed | it retries first |

```python
def big_o(xs):
    return sorted(xs)
```

## Why It Matters
Knowing this turns a class of surprising failures into an expected one.

## Connections
- Contrasts with: [[Stack]]
- Compare: [[Virtual Memory]]
- Related: [[Deadlock]]
- See: [[CS MOC]]

## Source
*Demo vault — synthetic content.*
