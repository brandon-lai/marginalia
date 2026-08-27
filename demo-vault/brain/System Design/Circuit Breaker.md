# Circuit Breaker

#system-design

## What It Is
This shows up everywhere once you have a word for it, which is most of the value of learning it.

## How It Works
The tradeoff is between doing work now and doing more work later under worse information.

| Property | Value | Why |
|---|---|---|
| Cost | O(log n) | the common path |
| Failure | loud | it fails closed |

## Why It Matters
It gives a name to something I had been working around without noticing.

## Connections
- Enables: [[Context Switching]]
- Enables: [[Seeing Like a State]]
- See: [[System Design MOC]]

## Source
*Demo vault — synthetic content.*
