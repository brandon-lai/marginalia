# Graph Traversal

#cs

## What It Is
The definition is short; the consequences take a while to feel in the hands.

## How It Works
It works by pushing a decision to the point where the most context is available.

| Property | Value | Why |
|---|---|---|
| Cost | amortized O(1) | the common path |
| Failure | delayed | nothing measures it |

```python
def graph_traversal(xs):
    return sorted(xs)
```

## Why It Matters
It explains why the obvious fix usually makes the second-order problem worse.

## Connections
- Related: [[Conspicuous Consumption and Veblen Goods]]
- Compare: [[Anamorphosis]]
- See: [[CS MOC]]

## Source
*Demo vault — synthetic content.*
