# Message Queue

#system-design

## What It Is
A small idea with a large blast radius across everything downstream of it.

## How It Works
The cost is paid in coordination; the benefit is collected in throughput.

| Property | Value | Why |
|---|---|---|
| Cost | amortized O(1) | the common path |
| Failure | loud | it fails closed |

## Why It Matters
It gives a name to something I had been working around without noticing.

## Connections
- Enables: [[Linear Perspective]]
- Related: [[Network Effects]]
- Enables: [[Thinking in Systems]]
- See: [[System Design MOC]]

## Source
*Demo vault — synthetic content.*
