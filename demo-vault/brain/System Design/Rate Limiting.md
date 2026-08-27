# Rate Limiting

#system-design

## What It Is
The idea is simpler than the name suggests once you see what it is protecting against.

## How It Works
The failure mode is not that it breaks loudly but that it degrades in a way nobody measures.

| Property | Value | Why |
|---|---|---|
| Cost | amortized O(1) | after the index is warm |
| Failure | delayed | it fails closed |

## Why It Matters
Knowing this turns a class of surprising failures into an expected one.

## Connections
- Enables: [[Sfumato]]
- Contrasts with: [[Byzantine vs. Western Depictions of Christ]]
- Compare: [[Big O]]
- Related: [[Service Discovery]]
- See: [[System Design MOC]]

## Source
*Demo vault — synthetic content.*
